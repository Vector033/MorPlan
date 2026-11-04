import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { events } from "@/db/schema";
import { answerQuestion } from "@/lib/rag/answer";
import { RAG_RETRIEVER, RAG_SIGNAL, RAG_STRATEGY, RAG_THRESHOLD } from "@/lib/rag/config";
import { getLlm, LlmError } from "@/lib/rag/llm";
import { getRetrieval } from "@/lib/rag/server";

export const runtime = "nodejs";

const body = z.object({ question: z.string().trim().min(3).max(500) });

// Small per-process limiter: 20 questions per minute per client address.
const hits = new Map<string, number[]>();
function limited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > 20;
}

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "พิมพ์คำถามอย่างน้อย 3 ตัวอักษร" }, { status: 400 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(ip)) return NextResponse.json({ error: "ถามเร็วเกินไป รอสักครู่แล้วลองใหม่" }, { status: 429 });

  try {
    const answer = await answerQuestion(parsed.data.question, getRetrieval(), {
      strategy: RAG_STRATEGY,
      threshold: RAG_THRESHOLD,
      signal: RAG_SIGNAL,
      retriever: RAG_RETRIEVER,
      llm: getLlm(),
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
