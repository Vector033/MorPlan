import { NextResponse } from "next/server";
import { z } from "zod";
import { linkAlive, UNIVERSITY_SYSTEM, universityPrompt, universityReplySchema, verifyUniversity } from "@/lib/core/university";
import { getLlm } from "@/lib/rag/llm";
import { guardMutation, LIMITS } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const body = z.object({ name: z.string().trim().min(2).max(100) });

/**
 * Suggest a university's registrar and course-search pages, then keep only the links that check out.
 * shortcut: no cache, every lookup is a model call; add a table keyed by normalised name if usage grows.
 */
export async function POST(request: Request) {
  const blocked = await guardMutation(request, LIMITS.university);
  if (blocked) return blocked;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "พิมพ์ชื่อมหาวิทยาลัย" }, { status: 400 });

  const unavailable = NextResponse.json({ error: "ตอนนี้ค้นข้อมูลมหาวิทยาลัยไม่ได้ ข้ามขั้นนี้แล้ววางข้อมูลได้เลย" }, { status: 503 });
  const llm = getLlm();
  if (!llm) return unavailable;

  try {
    const { data } = await llm.json({ system: UNIVERSITY_SYSTEM, prompt: universityPrompt(parsed.data.name), schema: universityReplySchema });
    return NextResponse.json(await verifyUniversity(data, linkAlive));
  } catch (e) {
    console.error("university lookup failed:", e instanceof Error ? e.message : e);
    return unavailable;
  }
}
