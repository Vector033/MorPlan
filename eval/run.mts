// RAG evaluation. Usage: npm run eval   (needs local Supabase with `npm run index` done)
// Writes eval/results/latest.json and eval/results/latest.md.
import { config } from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";
import { answerQuestion } from "../src/lib/rag/answer";
import { loadDocs, loadPages } from "../src/lib/rag/corpus";
import { getEmbedder } from "../src/lib/rag/embed";
import { freeLlm, getLlm, type LlmProvider } from "../src/lib/rag/llm";
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
let ablation = { strategy: "", recall1: 0, recall5: 0, mrr: 0 };
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
      if (retriever === "bm25") cases.coverage.push({ score: signals.coverage, answerable: q.answerable });
      if (!q.answerable) continue;
      const ranked = hits.map((h) => h.chunk);
      const rank = firstGoldRank(ranked, q);
      ranks.push(rank);
      docRanks.push(ranked.findIndex((c) => c.docId === q.docId) + 1 || null);
      if (q.quote && ranked.slice(0, 3).some((c) => c.text.includes(q.quote!))) evidence++;
      if (retriever === "hybrid" && (rank === null || rank > 5)) (misses[strategy] ??= []).push(q.id);
    }
    if (retriever === "hybrid") for (const sig of SIGNALS) scores.set(`${strategy}|hybrid|${sig}`, cases[sig]);
    if (retriever === "bm25") scores.set(`${strategy}|bm25|coverage`, cases.coverage);
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

// Ablation: the best setup without query rewriting.
{
  retrieval.rewrite = false;
  const plain = new Map<string, number[]>();
  for (const q of questions) plain.set(q.id, await retrieval.embedQuery(q.question));
  const strategy = [...rows].filter((r) => r.retriever === "hybrid").sort((a, b) => b.recall5 - a.recall5 || b.mrr - a.mrr)[0].strategy;
  const ranks: (number | null)[] = [];
  for (const q of answerable) {
    const { hits } = await retrieval.retrieve(q.question, strategy, "hybrid", 10, plain.get(q.id));
    ranks.push(firstGoldRank(hits.map((h) => h.chunk), q));
  }
  ablation = { strategy, recall1: recallAt(ranks, 1), recall5: recallAt(ranks, 5), mrr: mrr(ranks) };
  retrieval.rewrite = true;
}

// Abstention: tune the threshold on the dev split, report on test.
const abstain = STRATEGIES.flatMap((strategy) =>
  [...SIGNALS.map((signal) => ["hybrid", signal] as const), ["bm25", "coverage"] as const].map(([retriever, signal]) => {
    const cases = scores.get(`${strategy}|${retriever}|${signal}`)!;
    const withId = questions.map((q, i) => ({ ...cases[i], split: split(q.id) }));
    const dev = withId.filter((c) => c.split === "dev");
    const t = bestThreshold(dev);
    return {
      strategy,
      retriever: retriever as Retriever,
      signal: signal as Signal,
      devBalanced: abstention(dev, t).balancedAccuracy,
      ...abstention(withId.filter((c) => c.split === "test"), t),
    };
  }),
);

const best = [...rows].filter((r) => r.retriever === "hybrid").sort((a, b) => b.recall5 - a.recall5 || b.mrr - a.mrr)[0];
// Signal chosen on dev only.
const bestAbstain = abstain
  .filter((a) => a.strategy === best.strategy && a.retriever === "hybrid")
  .sort((a, b) => b.devBalanced - a.devBalanced)[0];
// Lexical-only setup for hosts that can't run the embedding model (Vercel functions).
const lexical = abstain.find((a) => a.strategy === best.strategy && a.retriever === "bm25")!;

// End-to-end answers on the test split with the chosen setup.
// EVAL_LLM_MODELS (comma list of FreeLLMAPI model ids) compares answer models on the
// hybrid setup, all graded by one fixed judge (EVAL_JUDGE_MODEL) so no model grades
// itself. Without it, the base run uses getLlm() as both answerer and judge.
const compareModels = (process.env.EVAL_LLM_MODELS ?? "").split(",").map((m) => m.trim()).filter(Boolean);
const judgeModel = process.env.EVAL_JUDGE_MODEL || "claude-sonnet-4-5";
const baseLlm = compareModels.length ? null : getLlm();
// Pace free tiers, e.g. EVAL_LLM_DELAY_MS=6000 for a 10-requests-a-minute model.
const LLM_DELAY_MS = Number(process.env.EVAL_LLM_DELAY_MS ?? 0);
const testQs = questions.filter((q) => split(q.id) === "test");
const judge = z.object({ supported: z.boolean(), correct: z.boolean() });

/** Free tiers rate-limit and time out; retry a few times before counting an error. */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= 5) throw e;
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
    }
  }
}

async function endToEnd(
  cfg: { retriever: Retriever; signal: Signal; threshold: number },
  llm: LlmProvider | null,
  grader: LlmProvider | null = llm,
) {
  const lat: number[] = [];
  let cost = 0;
  let correctStatus = 0;
  let citedGold = 0;
  let faithful = 0;
  let correct = 0;
  let judged = 0;
  let errors = 0;
  for (const q of testQs) {
    if (llm && LLM_DELAY_MS) await new Promise((r) => setTimeout(r, LLM_DELAY_MS));
    let a;
    try {
      a = await withRetry(() => answerQuestion(q.question, retrieval, { strategy: best.strategy, ...cfg, llm }));
    } catch (e) {
      errors++;
      console.warn(`[${llm?.name}] ${q.id}: ${String(e).slice(0, 120)}`);
      continue;
    }
    lat.push(a.latencyMs);
    cost += a.costUsd;
    if ((a.status === "answered") === q.answerable) correctStatus++;
    if (q.answerable && a.citations.some((c) => c.docId === q.docId && q.pages.includes(c.page))) citedGold++;
    if (llm && grader && q.answerable && a.status === "answered") {
      const passages = a.citations.map((c) => c.snippet).join("\n");
      try {
        const r = await withRetry(() =>
          grader.json({
            system:
              "You grade a Thai RAG answer. supported: every claim in ANSWER is stated in PASSAGES. correct: ANSWER agrees with GOLD. Reply JSON.",
            prompt: `QUESTION: ${q.question}\nGOLD: ${q.answer}\nANSWER: ${a.text}\nPASSAGES:\n${passages}`,
            schema: judge,
          }),
        );
        cost += grader.cost(r.inputTokens, r.outputTokens);
        judged++;
        if (r.data.supported) faithful++;
        if (r.data.correct) correct++;
      } catch (e) {
        console.warn(`[judge] ${q.id}: ${String(e).slice(0, 120)}`);
      }
    }
  }
  const nAns = testQs.filter((q) => q.answerable).length;
  return {
    setup: `${best.strategy} + ${cfg.retriever}, ${cfg.signal} >= ${cfg.threshold.toFixed(3)}`,
    mode: llm ? llm.name : "extractive (no LLM)",
    ...(llm && grader ? { judge: grader.name } : {}),
    questions: testQs.length,
    statusAccuracy: correctStatus / testQs.length,
    citesGoldPage: citedGold / nAns,
    ...(llm ? { faithfulness: faithful / Math.max(1, judged), correctness: correct / Math.max(1, judged), judged } : {}),
    ...(errors ? { errors } : {}),
    p50ms: percentile(lat, 50),
    p95ms: percentile(lat, 95),
    costPerQuestionUsd: cost / testQs.length,
  } as Record<string, number | string>;
}
const hybridCfg = { retriever: "hybrid" as const, signal: bestAbstain.signal, threshold: bestAbstain.threshold };
const e2e = await endToEnd(hybridCfg, baseLlm);
const e2eLexical = await endToEnd({ retriever: "bm25", signal: "coverage", threshold: lexical.threshold }, baseLlm);
const grader = compareModels.length ? freeLlm(judgeModel) : null;
if (compareModels.length && !grader) throw new Error("EVAL_LLM_MODELS needs FREELLMAPI_KEY in .env.local");
// Models run in parallel (different upstream providers); questions run in order within each.
const llmCompare = await Promise.all(compareModels.map((m) => endToEnd(hybridCfg, freeLlm(m), grader)));

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
  `Ablation, ${ablation.strategy} + hybrid **without** query rewriting: R@1 ${pct(ablation.recall1)}, R@5 ${pct(ablation.recall5)}, MRR ${ablation.mrr.toFixed(3)}.`,
  ``,
  `## "ไม่พบ" (abstention), threshold tuned on dev split, scored on test split`,
  ``,
  `| chunking | retriever | signal | threshold | accuracy | balanced acc. | correct refusals | false refusals |`,
  `|---|---|---|---|---|---|---|---|`,
  ...abstain.map(
    (a) =>
      `| ${a.strategy} | ${a.retriever} | ${a.signal} | ${a.threshold.toFixed(3)} | ${pct(a.accuracy)} | ${pct(a.balancedAccuracy)} | ${pct(a.correctRefusal)} | ${pct(a.falseRefusal)} |`,
  ),
  ``,
  `Signals: dense = top cosine; coverage = share of the question's IDF weight found in a top-3 chunk; combined = coverage × dense.`,
  ``,
  `## End to end (test split)`,
  ``,
  ...(llmCompare.length
    ? [
        `## Answer models (test split, ${e2e.setup}; judge \`${judgeModel}\`)`,
        ``,
        `| model | answer vs "ไม่พบ" | cites gold page | faithfulness | correctness | judged | errors | p50 ms | p95 ms |`,
        `|---|---|---|---|---|---|---|---|---|`,
        ...llmCompare.map(
          (r) =>
            `| ${r.mode} | ${pct(+r.statusAccuracy)} | ${pct(+r.citesGoldPage)} | ${pct(+r.faithfulness)} | ${pct(+r.correctness)} | ${r.judged} | ${r.errors ?? 0} | ${(+r.p50ms).toFixed(0)} | ${(+r.p95ms).toFixed(0)} |`,
        ),
        ``,
        `faithfulness: every claim is in the cited passages. correctness: agrees with the gold answer. Both over judged answered questions.`,
        ``,
      ]
    : []),
  ...[e2e, e2eLexical].flatMap((r) => [
    ...Object.entries(r).map(
      ([k, v]) =>
        `- ${k}: ${typeof v === "number" ? (v < 1 && k !== "costPerQuestionUsd" && !k.endsWith("ms") ? pct(v) : v.toFixed(k === "costPerQuestionUsd" ? 6 : 0)) : v}`,
    ),
    ``,
  ]),
].join("\n");

mkdirSync("eval/results", { recursive: true });
writeFileSync(
  "eval/results/latest.json",
  JSON.stringify({
    date: new Date().toISOString(),
    model: embedder.model,
    rows,
    ablation,
    abstain,
    best: { strategy: best.strategy, signal: bestAbstain.signal, threshold: bestAbstain.threshold },
    lexical: { strategy: best.strategy, signal: "coverage", threshold: lexical.threshold },
    e2e,
    e2eLexical,
    ...(llmCompare.length ? { judge: judgeModel, llmCompare } : {}),
    misses,
  }, null, 2) + "\n",
);
writeFileSync("eval/results/latest.md", md);

// The answer-model table accumulates across runs, so one rate-limited model can be rerun alone.
if (llmCompare.length) {
  const file = "eval/results/llm-compare.json";
  type CmpRow = Record<string, number | string>;
  type Excluded = { mode: string; reason: string };
  const old: { rows?: CmpRow[]; excluded?: Excluded[] } = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const prev = old.rows ?? [];
  const ran = new Set(llmCompare.map((r) => r.mode));
  const today = new Date().toISOString().slice(0, 10);
  const merged: CmpRow[] = [...prev.filter((r) => !ran.has(String(r.mode))), ...llmCompare.map((r) => ({ ...r, date: today }))];
  // Models dropped by hand (e.g. quota hit mid-run) stay listed until they are rerun.
  const excluded = (old.excluded ?? []).filter((x) => !ran.has(x.mode));
  writeFileSync(file, JSON.stringify({ judge: judgeModel, setup: e2e.setup, rows: merged, excluded }, null, 2) + "\n");
  writeFileSync(
    "eval/results/llm-compare.md",
    [
      `# Answer models`,
      ``,
      `Test split (${testQs.length} questions), ${e2e.setup}. Judge: \`${judgeModel}\`, which is not one of the graded models. All calls go through FreeLLMAPI free tiers, so cost is $0; latency includes the local router.`,
      ``,
      `| model | answer vs "ไม่พบ" | cites gold page | faithfulness | correctness | judged | errors | p50 ms | p95 ms | run |`,
      `|---|---|---|---|---|---|---|---|---|---|`,
      ...merged.map(
        (r) =>
          `| ${r.mode} | ${pct(+r.statusAccuracy)} | ${pct(+r.citesGoldPage)} | ${pct(+r.faithfulness)} | ${pct(+r.correctness)} | ${r.judged} | ${r.errors ?? 0} | ${(+r.p50ms).toFixed(0)} | ${(+r.p95ms).toFixed(0)} | ${r.date} |`,
      ),
      ``,
      `faithfulness: every claim is in the cited passages. correctness: agrees with the gold answer. Both over judged answered questions.`,
      `Extractive baseline (no LLM, same setup): answer vs "ไม่พบ" ${pct(+e2e.statusAccuracy)}, cites gold page ${pct(+e2e.citesGoldPage)}.`,
      ...excluded.map((x) => `Not reported: ${x.mode} (${x.reason}).`),
      ``,
    ].join("\n"),
  );
}
console.log(md);
