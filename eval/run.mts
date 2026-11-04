// RAG evaluation. Usage: npm run eval   (needs local Supabase with `npm run index` done)
// Writes eval/results/latest.json and eval/results/latest.md.
import { config } from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";
import { answerQuestion } from "../src/lib/rag/answer";
import { loadDocs, loadPages } from "../src/lib/rag/corpus";
import { getEmbedder } from "../src/lib/rag/embed";
import { getLlm } from "../src/lib/rag/llm";
import { PgDenseStore } from "../src/lib/rag/pg-store";
import { Retrieval, type Signal } from "../src/lib/rag/retrieve";
import { STRATEGIES, type Retriever, type Strategy } from "../src/lib/rag/types";
import { abstention, bestThreshold, firstGoldRank, mrr, percentile, recallAt, split, type AbstainCase } from "./metrics";

config({ path: ".env.local" });

type Question = {
  id: string;
  question: string;
  answer: string;
  docId: string | null;
  pages: number[];
  answerable: boolean;
  type: string;
  quote?: string;
  ocrMismatch?: boolean;
};

const questions = readFileSync("eval/questions.jsonl", "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l) as Question);
const answerable = questions.filter((q) => q.answerable);

const sql = postgres(process.env.DATABASE_URL!, { max: 2 });
const embedder = getEmbedder();
const retrieval = new Retrieval(loadPages(), loadDocs(), embedder, new PgDenseStore(drizzle(sql)));
const RETRIEVERS: Retriever[] = ["bm25", "dense", "hybrid"];

// Embed every question once; time it separately so latency is per question.
const embedStart = performance.now();
const vectors = new Map<string, number[]>();
await retrieval.embedQuery("warm-up");
for (const q of questions) vectors.set(q.id, await retrieval.embedQuery(q.question));
const embedMs = (performance.now() - embedStart) / questions.length;

type Row = {
  strategy: Strategy;
  retriever: Retriever;
  recall1: number;
  recall3: number;
  recall5: number;
  recall10: number;
  mrr: number;
  docRecall5: number;
  evidence3: number;
  p50ms: number;
  p95ms: number;
};
const rows: Row[] = [];
const SIGNALS: Signal[] = ["dense", "coverage", "combined"];
const scores = new Map<string, AbstainCase[]>();
const misses: Record<string, string[]> = {};

for (const strategy of STRATEGIES) {
  for (const retriever of RETRIEVERS) {
    const ranks: (number | null)[] = [];
    const docRanks: (number | null)[] = [];
    let evidence = 0;
    const times: number[] = [];
    const cases: Record<Signal, AbstainCase[]> = { dense: [], coverage: [], combined: [] };
    for (const q of questions) {
      const t0 = performance.now();
      const { hits, signals } = await retrieval.retrieve(q.question, strategy, retriever, 10, vectors.get(q.id));
      times.push(performance.now() - t0 + (retriever === "bm25" ? 0 : embedMs));
      if (retriever === "hybrid") for (const sig of SIGNALS) cases[sig].push({ score: signals[sig], answerable: q.answerable });
      if (!q.answerable) continue;
      const ranked = hits.map((h) => h.chunk);
      const rank = firstGoldRank(ranked, q);
      ranks.push(rank);
      docRanks.push(ranked.findIndex((c) => c.docId === q.docId) + 1 || null);
      if (q.quote && ranked.slice(0, 3).some((c) => c.text.includes(q.quote!))) evidence++;
      if (retriever === "hybrid" && (rank === null || rank > 5)) (misses[strategy] ??= []).push(q.id);
    }
    if (retriever === "hybrid") for (const sig of SIGNALS) scores.set(`${strategy}|${sig}`, cases[sig]);
    rows.push({
      strategy,
      retriever,
      recall1: recallAt(ranks, 1),
      recall3: recallAt(ranks, 3),
      recall5: recallAt(ranks, 5),
      recall10: recallAt(ranks, 10),
      mrr: mrr(ranks),
      docRecall5: recallAt(docRanks, 5),
      evidence3: evidence / answerable.length,
      p50ms: percentile(times, 50),
      p95ms: percentile(times, 95),
    });
  }
}

// Abstention: tune the threshold on the dev split, report on test.
const abstain = STRATEGIES.flatMap((strategy) =>
  SIGNALS.map((signal) => {
    const cases = scores.get(`${strategy}|${signal}`)!;
    const withId = questions.map((q, i) => ({ ...cases[i], split: split(q.id) }));
    const dev = withId.filter((c) => c.split === "dev");
    const t = bestThreshold(dev);
    return { strategy, signal, devBalanced: abstention(dev, t).balancedAccuracy, ...abstention(withId.filter((c) => c.split === "test"), t) };
  }),
);

const best = [...rows].filter((r) => r.retriever === "hybrid").sort((a, b) => b.recall5 - a.recall5 || b.mrr - a.mrr)[0];
// Signal chosen on dev only.
const bestAbstain = abstain.filter((a) => a.strategy === best.strategy).sort((a, b) => b.devBalanced - a.devBalanced)[0];

// End-to-end answers on the test split with the chosen setup (LLM when a key is set).
const llm = getLlm();
const testQs = questions.filter((q) => split(q.id) === "test");
const judge = z.object({ supported: z.boolean(), correct: z.boolean() });
let e2e: Record<string, number | string> = {};
{
  const lat: number[] = [];
  let cost = 0;
  let correctStatus = 0;
  let citedGold = 0;
  let faithful = 0;
  let correct = 0;
  let judged = 0;
  for (const q of testQs) {
    const a = await answerQuestion(q.question, retrieval, {
      strategy: best.strategy,
      threshold: bestAbstain.threshold,
      signal: bestAbstain.signal,
      llm,
    });
    lat.push(a.latencyMs);
    cost += a.costUsd;
    if ((a.status === "answered") === q.answerable) correctStatus++;
    if (q.answerable && a.citations.some((c) => c.docId === q.docId && q.pages.includes(c.page))) citedGold++;
    if (llm && q.answerable && a.status === "answered") {
      const passages = a.citations.map((c) => c.snippet).join("\n");
      const r = await llm.json({
        system:
          "You grade a Thai RAG answer. supported: every claim in ANSWER is stated in PASSAGES. correct: ANSWER agrees with GOLD. Reply JSON.",
        prompt: `QUESTION: ${q.question}\nGOLD: ${q.answer}\nANSWER: ${a.text}\nPASSAGES:\n${passages}`,
        schema: judge,
      });
      cost += llm.cost(r.inputTokens, r.outputTokens);
      judged++;
      if (r.data.supported) faithful++;
      if (r.data.correct) correct++;
    }
  }
  const nAns = testQs.filter((q) => q.answerable).length;
  e2e = {
    mode: llm ? llm.name : "extractive (no GEMINI_API_KEY)",
    questions: testQs.length,
    statusAccuracy: correctStatus / testQs.length,
    citesGoldPage: citedGold / nAns,
    ...(llm ? { faithfulness: faithful / Math.max(1, judged), correctness: correct / Math.max(1, judged) } : {}),
    p50ms: percentile(lat, 50),
    p95ms: percentile(lat, 95),
    costPerQuestionUsd: cost / testQs.length,
  };
}

await sql.end();

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const md = [
  `# RAG evaluation`,
  ``,
  `${questions.length} questions (${answerable.length} answerable, ${questions.length - answerable.length} unanswerable; ${
    questions.filter((q) => q.ocrMismatch).length
  } answerable ones have a key number the OCR misreads). Embeddings: \`${embedder.model}\`. Run ${new Date().toISOString().slice(0, 10)}.`,
  ``,
  `## Retrieval (answerable questions, page-level)`,
  ``,
  `| chunking | retriever | R@1 | R@3 | R@5 | R@10 | MRR | doc R@5 | evidence@3 | p50 ms | p95 ms |`,
  `|---|---|---|---|---|---|---|---|---|---|---|`,
  ...rows.map(
    (r) =>
      `| ${r.strategy} | ${r.retriever} | ${pct(r.recall1)} | ${pct(r.recall3)} | ${pct(r.recall5)} | ${pct(r.recall10)} | ${r.mrr.toFixed(3)} | ${pct(
        r.docRecall5,
      )} | ${pct(r.evidence3)} | ${r.p50ms.toFixed(0)} | ${r.p95ms.toFixed(0)} |`,
  ),
  ``,
  `evidence@3: the gold quote appears verbatim in one of the top 3 chunks.`,
  ``,
  `## "ไม่พบ" (abstention), hybrid, threshold tuned on dev split, scored on test split`,
  ``,
  `| chunking | signal | threshold | accuracy | balanced acc. | correct refusals | false refusals |`,
  `|---|---|---|---|---|---|---|`,
  ...abstain.map(
    (a) =>
      `| ${a.strategy} | ${a.signal} | ${a.threshold.toFixed(3)} | ${pct(a.accuracy)} | ${pct(a.balancedAccuracy)} | ${pct(a.correctRefusal)} | ${pct(a.falseRefusal)} |`,
  ),
  ``,
  `Signals: dense = top cosine; coverage = share of the question's IDF weight found in a top-3 chunk; combined = coverage × dense.`,
  ``,
  `## End to end (${best.strategy} + hybrid, ${bestAbstain.signal} ≥ ${bestAbstain.threshold.toFixed(3)}, test split)`,
  ``,
  ...Object.entries(e2e).map(([k, v]) => `- ${k}: ${typeof v === "number" ? (v < 1 && k !== "costPerQuestionUsd" && !k.endsWith("ms") ? pct(v) : v.toFixed(k === "costPerQuestionUsd" ? 6 : 0)) : v}`),
  ``,
].join("\n");

mkdirSync("eval/results", { recursive: true });
writeFileSync(
  "eval/results/latest.json",
  JSON.stringify({
    date: new Date().toISOString(),
    model: embedder.model,
    rows,
    abstain,
    best: { strategy: best.strategy, signal: bestAbstain.signal, threshold: bestAbstain.threshold },
    e2e,
    misses,
  }, null, 2) + "\n",
);
writeFileSync("eval/results/latest.md", md);
console.log(md);
