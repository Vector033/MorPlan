import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { events } from "@/db/schema";
import { canonicalUniversity } from "@/lib/core/university";
import { answerQuestion } from "@/lib/rag/answer";
import { LEXICAL_THRESHOLD, RAG_RETRIEVER, RAG_SIGNAL, RAG_STRATEGY, RAG_THRESHOLD } from "@/lib/rag/config";
import { getLlm, LlmError } from "@/lib/rag/llm";
import { retrievalFor } from "@/lib/rag/server";
import { pagesSchema, REG_LIMITS } from "@/lib/regulations/pages";
import { guardMutation, LIMITS } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const privateDoc = z.object({ title: z.string().trim().min(1).max(200), pages: pagesSchema });
const body = z
  .object({
    question: z.string().trim().min(3).max(500),
    university: z.string().trim().min(2).max(100),
    /** Uploaded or pasted by the student: used for this answer only, never stored. */
    privateDocs: z.array(privateDoc).max(REG_LIMITS.privateDocs).default([]),
  })
  .refine((b) => b.privateDocs.reduce((n, d) => n + d.pages.reduce((m, p) => m + p.text.length, 0), 0) <= REG_LIMITS.privateChars);

export async function POST(request: Request) {
  const blocked = await guardMutation(request, LIMITS.ask);
  if (blocked) return blocked;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "เลือกมหาวิทยาลัยและพิมพ์คำถามอย่างน้อย 3 ตัวอักษร" }, { status: 400 });
  const { question, privateDocs } = parsed.data;
  const university = canonicalUniversity(parsed.data.university);

  try {
    const scoped = await retrievalFor(
      university,
      privateDocs.map((d, i) => ({ id: `private-${i + 1}`, title: d.title, kind: "private", url: "", pages: d.pages })),
    );
    // Nothing to answer from: the page asks the student to add a regulation document first.
    if (!scoped) return NextResponse.json({ status: "no_docs" });
    const opts = scoped.lexical
      ? { strategy: RAG_STRATEGY, threshold: LEXICAL_THRESHOLD, signal: "coverage" as const, retriever: "bm25" as const }
      : { strategy: RAG_STRATEGY, threshold: RAG_THRESHOLD, signal: RAG_SIGNAL, retriever: RAG_RETRIEVER };
    // Extractive unless opted in, so a key added for other features does not change regulation answers.
    const llm = process.env.ASK_LLM === "true" ? getLlm() : null;
    // If the model is down or slow, fall back to extractive passages rather than failing the question.
    const answer = await answerQuestion(question, scoped.retrieval, { ...opts, llm, university }).catch((e) => {
      if (!llm) throw e;
      console.warn("LLM failed, answering extractively:", e instanceof Error ? e.message : e);
      return answerQuestion(question, scoped.retrieval, { ...opts, llm: null, university });
    });
    // Counts only: neither the question nor the university is stored.
    await db
      .insert(events)
      .values({ kind: "ask", meta: { status: answer.status, mode: answer.mode, ms: answer.latencyMs, private: privateDocs.length } })
      .catch(() => {});
    return NextResponse.json(answer);
  } catch (e) {
    const message = e instanceof LlmError ? "ระบบสรุปคำตอบขัดข้อง ลองใหม่อีกครั้ง" : "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
    console.error(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
