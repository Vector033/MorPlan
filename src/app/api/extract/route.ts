import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { events } from "@/db/schema";
import { checkExtraction, EXTRACT_SYSTEM, extractedSchema, extractPrompt, redact } from "@/lib/core/extract";
import { getLlm } from "@/lib/rag/llm";
import { guardMutation, LIMITS } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const body = z.object({
  text: z.string().trim().min(20).max(40_000),
  university: z.string().trim().min(2).max(100),
});

/** Another university's pasted schedule → sections, each checked against the paste. Nothing is stored. */
export async function POST(request: Request) {
  const blocked = await guardMutation(request, LIMITS.extract);
  if (blocked) return blocked;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "วางข้อมูลอย่างน้อย 20 ตัวอักษร และไม่เกิน 40,000 ตัวอักษร" }, { status: 400 });

  const llm = getLlm();
  if (!llm) return NextResponse.json({ error: "ตอนนี้ยังอ่านตารางของมหาวิทยาลัยอื่นไม่ได้ เพิ่มวิชาเองด้วยฟอร์มด้านล่างได้" }, { status: 503 });

  const text = redact(parsed.data.text);
  try {
    const { data } = await llm.json({ system: EXTRACT_SYSTEM, prompt: extractPrompt(parsed.data.university, text), schema: extractedSchema });
    const result = checkExtraction(text, data);
    // Counts only: neither the paste nor the university name is stored.
    await db
      .insert(events)
      .values({ kind: "extract", meta: { sections: result.sections.length, dropped: result.warnings.length } })
      .catch(() => {});
    return NextResponse.json(result);
  } catch (e) {
    console.error("extract failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "อ่านข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง หรือเพิ่มวิชาเองด้วยฟอร์มด้านล่าง" }, { status: 502 });
  }
}
