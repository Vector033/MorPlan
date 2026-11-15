import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { curricula } from "@/db/schema";
import { courseItems, readDocument } from "@/lib/curriculum/read";
import { readRow } from "@/lib/curriculum/rows";
import { readUrl } from "@/lib/curriculum/source";
import { replaceData } from "@/lib/curriculum/store";
import { getLlm } from "@/lib/rag/llm";
import { guardMutation, LIMITS } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const body = z.object({ id: z.string().regex(/^[\w-]{10}$/) });

/** Re-read a link-sourced row; the stored data is replaced only when the new read is not much smaller. */
export async function POST(request: Request) {
  const blocked = await guardMutation(request, LIMITS.curriculumRead);
  if (blocked) return blocked;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  const [row] = await db.select().from(curricula).where(and(eq(curricula.id, parsed.data.id), eq(curricula.status, "shared"))).limit(1);
  const old = row && readRow(row);
  if (!old || old.meta.provenance !== "link" || !old.meta.sourceUrl) return NextResponse.json({ error: "ไม่พบหลักสูตรที่อัปเดตจากลิงก์ได้" }, { status: 404 });

  const llm = getLlm();
  if (!llm) return NextResponse.json({ error: "ตอนนี้อ่านเอกสารใหม่ไม่ได้ หลักสูตรที่มีในระบบแล้วยังใช้ได้" }, { status: 503 });

  try {
    const { meta } = old;
    const source = await readUrl(meta.sourceUrl!);
    const fresh = await readDocument(llm, meta.kind, source, { university: meta.university, faculty: meta.faculty ?? "", major: meta.major ?? "", cohort: meta.cohortFrom ?? 0 });
    const before = courseItems({ kind: meta.kind, data: old.data });
    if (courseItems(fresh) * 2 < before) return NextResponse.json({ replaced: false });
    await replaceData(meta.id, fresh.data);
    return NextResponse.json({ replaced: true });
  } catch (e) {
    console.error("curriculum refresh failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "อ่านเอกสารต้นทางไม่สำเร็จ ลองใหม่ภายหลัง" }, { status: 502 });
  }
}
