import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { curricula } from "@/db/schema";
import type { Curriculum } from "@/lib/core/curriculum";
import { readDocument, type ReadResult } from "@/lib/curriculum/read";
import { readRow } from "@/lib/curriculum/rows";
import { readUrl } from "@/lib/curriculum/source";
import { replaceData } from "@/lib/curriculum/store";
import { getLlm } from "@/lib/rag/llm";
import { guardMutation, LIMITS } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const body = z.object({ id: z.string().regex(/^[\w-]{10}$/) });

function courseItems(r: ReadResult): number {
  if (r.kind === "electives") return r.data.length;
  if (r.kind === "minors") return r.data.reduce((n, m) => n + m.groups.reduce((k, g) => k + g.courseNos.length, 0), 0);
  return (r.data as Curriculum).plans.reduce((n, p) => n + p.terms.reduce((k, t) => k + t.items.filter((i) => i.type === "course").length, 0), 0);
}

/** Re-read a link-sourced row; the stored data is replaced only when the new read is not much smaller. */
export async function POST(request: Request) {
  const blocked = await guardMutation(request, LIMITS.curriculumRead);
  if (blocked) return blocked;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  const [row] = await db.select().from(curricula).where(eq(curricula.id, parsed.data.id)).limit(1);
  const old = row && readRow(row);
  if (!old || old.meta.provenance !== "link" || !old.meta.sourceUrl) return NextResponse.json({ error: "ไม่พบหลักสูตรที่อัปเดตจากลิงก์ได้" }, { status: 404 });

  const llm = getLlm();
  if (!llm) return NextResponse.json({ error: "ตอนนี้อ่านเอกสารใหม่ไม่ได้ หลักสูตรที่มีในระบบแล้วยังใช้ได้" }, { status: 503 });

  try {
    const { meta } = old;
    const source = await readUrl(meta.sourceUrl!);
    const fresh = await readDocument(llm, meta.kind, source, { university: meta.university, faculty: meta.faculty ?? "", major: meta.major ?? "", cohort: meta.cohortFrom ?? 0 });
    const before = courseItems({ kind: meta.kind, data: old.data, dropped: [] } as ReadResult);
    if (courseItems(fresh) * 2 < before) return NextResponse.json({ replaced: false });
    await replaceData(meta.id, fresh.data);
    return NextResponse.json({ replaced: true });
  } catch (e) {
    console.error("curriculum refresh failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ replaced: false });
  }
}
