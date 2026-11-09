import { NextResponse } from "next/server";
import { z } from "zod";
import { universityPrompt, universityReplySchema, verifyUniversity, type Source } from "@/lib/core/university";
import { extractJson } from "@/lib/rag/llm";
import { guardMutation, LIMITS } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const body = z.object({ name: z.string().trim().min(2).max(100) });

type GroundedReply = {
  candidates?: { content?: { parts?: { text?: string }[] }; groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] } }[];
};

/**
 * Find a university's registrar and course-search pages with Gemini + Google Search.
 * Needs GEMINI_API_KEY: search grounding is a Gemini feature, the local router has no equivalent.
 * shortcut: no cache, every lookup is a model call; add a table keyed by normalised name if usage grows.
 */
export async function POST(request: Request) {
  const blocked = await guardMutation(request, LIMITS.university);
  if (blocked) return blocked;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "พิมพ์ชื่อมหาวิทยาลัย" }, { status: 400 });

  const key = process.env.GEMINI_API_KEY;
  const unavailable = NextResponse.json({ error: "ตอนนี้ค้นข้อมูลมหาวิทยาลัยไม่ได้ ข้ามขั้นนี้แล้ววางข้อมูลได้เลย" }, { status: 503 });
  if (!key) return unavailable;

  try {
    const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: universityPrompt(parsed.data.name) }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0 },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const reply = (await res.json()) as GroundedReply;
    const candidate = reply.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const sources: Source[] = (candidate?.groundingMetadata?.groundingChunks ?? [])
      .flatMap((c) => (c.web?.uri && c.web.title ? [{ title: c.web.title, uri: c.web.uri }] : []))
      .slice(0, 8);
    const info = universityReplySchema.safeParse(extractJson(text));
    if (!info.success || sources.length === 0) throw new Error("ungrounded or malformed reply");
    return NextResponse.json(verifyUniversity(info.data, sources));
  } catch (e) {
    console.error("university lookup failed:", e instanceof Error ? e.message : e);
    return unavailable;
  }
}
