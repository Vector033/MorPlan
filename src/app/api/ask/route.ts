import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { events } from "@/db/schema";
import { answerQuestion } from "@/lib/rag/answer";
import { RAG_RETRIEVER, RAG_SIGNAL, RAG_STRATEGY, RAG_THRESHOLD } from "@/lib/rag/config";
import { getLlm, LlmError } from "@/lib/rag/llm";
import { getRetrieval } from "@/lib/rag/server";
import { guardMutation, LIMITS } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const body = z.object({ question: z.string().trim().min(3).max(500) });

export async function POST(request: Request) {
  const blocked = await guardMutation(request, LIMITS.ask);
  if (blocked) return blocked;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "พิมพ์คำถามอย่างน้อย 3 ตัวอักษร" }, { status: 400 });

  try {
    const opts = { strategy: RAG_STRATEGY, threshold: RAG_THRESHOLD, signal: RAG_SIGNAL, retriever: RAG_RETRIEVER };
    // Extractive unless opted in, so a key added for other-university import does not change regulation answers.
    const llm = process.env.ASK_LLM === "true" ? getLlm() : null;
    // If the model is down or slow, fall back to extractive passages rather than failing the question.
    const answer = await answerQuestion(parsed.data.question, getRetrieval(), { ...opts, llm }).catch((e) => {
      if (!llm) throw e;
      console.warn("LLM failed, answering extractively:", e instanceof Error ? e.message : e);
      return answerQuestion(parsed.data.question, getRetrieval(), { ...opts, llm: null });
    });
    // Counts only: the question text is not stored.
    await db
      .insert(events)
      .values({ kind: "ask", meta: { status: answer.status, mode: answer.mode, ms: answer.latencyMs } })
      .catch(() => {});
    return NextResponse.json(answer);
  } catch (e) {
    const message = e instanceof LlmError ? "ระบบสรุปคำตอบขัดข้อง ลองใหม่อีกครั้ง" : "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
    console.error(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
