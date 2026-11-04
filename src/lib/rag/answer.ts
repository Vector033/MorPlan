import { z } from "zod";
import type { LlmProvider } from "./llm";
import type { Retrieval, Signal } from "./retrieve";
import { tokenize } from "./tokenize";
import { NOT_FOUND, OFFICIAL_NOTICE, type Answer, type Citation, type Hit, type Strategy } from "./types";

export type AnswerOptions = {
  strategy: Strategy;
  /** Below this confidence, answer "ไม่พบ" without calling the model. Tuned on the eval dev split. */
  threshold: number;
  /** Which retrieval signal the threshold applies to (default: query-term coverage). */
  signal?: Signal;
  llm: LlmProvider | null;
  passages?: number;
};

const SYSTEM = `คุณช่วยตอบคำถามเรื่องระเบียบการศึกษาของมหาวิทยาลัยเชียงใหม่ จากข้อความที่ให้เท่านั้น
- ตอบเป็นภาษาไทย สั้น ตรงคำถาม
- ใช้เฉพาะข้อมูลในข้อความที่ให้ ห้ามเดา ห้ามใช้ความรู้อื่น
- อ้างอิงหมายเลขข้อความที่ใช้ใน cited (เช่น [1, 3])
- ถ้าข้อความที่ให้ไม่มีคำตอบ ให้ status เป็น "not_found" และ answer เป็น "${NOT_FOUND}"
- ข้อความมาจาก OCR อาจมีตัวเลขไทยผิดบ้าง ถ้าตัวเลขสำคัญดูผิดปกติ ให้บอกว่าควรตรวจกับเอกสารต้นฉบับ`;

const schema = z.object({
  status: z.enum(["answered", "not_found"]),
  answer: z.string(),
  cited: z.array(z.number().int()),
});

export async function answerQuestion(question: string, retrieval: Retrieval, opts: AnswerOptions): Promise<Answer> {
  const started = performance.now();
  const q = question.trim().slice(0, 500);
  const { hits, signals } = await retrieval.retrieve(q, opts.strategy, "hybrid", opts.passages ?? 6);
  const topScore = signals[opts.signal ?? "coverage"];
  const base = { notice: OFFICIAL_NOTICE, topScore };
  const done = (a: Omit<Answer, "latencyMs" | "notice" | "topScore">): Answer => ({
    ...base,
    ...a,
    latencyMs: Math.round(performance.now() - started),
  });

  if (hits.length === 0 || topScore < opts.threshold) {
    return done({ status: "not_found", text: NOT_FOUND, citations: [], mode: opts.llm ? "llm" : "extractive", costUsd: 0 });
  }

  if (!opts.llm) {
    const citations = cite(hits.slice(0, 3), retrieval, q);
    return done({
      status: "answered",
      text: "ข้อความที่เกี่ยวข้องที่สุดจากเอกสาร (ยังไม่ได้สรุปด้วย AI):",
      citations,
      mode: "extractive",
      costUsd: 0,
    });
  }

  const prompt =
    hits
      .map((h, i) => `[${i + 1}] ${retrieval.docs.get(h.chunk.docId)?.title ?? h.chunk.docId} หน้า ${h.chunk.page}\n${h.chunk.text}`)
      .join("\n\n") + `\n\nคำถาม: ${q}`;
  const res = await opts.llm.json({ system: SYSTEM, prompt, schema });
  const costUsd = opts.llm.cost(res.inputTokens, res.outputTokens);
  if (res.data.status === "not_found" || res.data.answer.trim() === NOT_FOUND) {
    return done({ status: "not_found", text: NOT_FOUND, citations: [], mode: "llm", costUsd });
  }
  const cited = [...new Set(res.data.cited)].filter((n) => n >= 1 && n <= hits.length).map((n) => hits[n - 1]);
  return done({
    status: "answered",
    text: res.data.answer.trim(),
    citations: cite(cited.length ? cited : hits.slice(0, 1), retrieval, q),
    mode: "llm",
    costUsd,
  });
}

function cite(hits: Hit[], retrieval: Retrieval, question: string): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const h of hits) {
    const key = `${h.chunk.docId}:${h.chunk.page}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const doc = retrieval.docs.get(h.chunk.docId);
    out.push({
      n: out.length + 1,
      docId: h.chunk.docId,
      title: doc?.title ?? h.chunk.docId,
      page: h.chunk.page,
      url: doc ? `${doc.url}#page=${h.chunk.page}` : "",
      snippet: bestSnippet(h.chunk.text, question),
    });
  }
  return out;
}

/** The ~280-char window of the chunk sharing the most words with the question. */
export function bestSnippet(text: string, question: string, size = 280): string {
  const lines = text.split("\n").filter((l) => l.trim());
  const q = new Set(tokenize(question));
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < lines.length; i++) {
    const score = tokenize(lines[i]).filter((t) => q.has(t)).length;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  let out = lines[best] ?? "";
  for (let j = best + 1; j < lines.length && out.length < size; j++) out += ` ${lines[j]}`;
  return out.length > size ? `${out.slice(0, size)}…` : out;
}
