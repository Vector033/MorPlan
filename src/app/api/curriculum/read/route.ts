import { NextResponse } from "next/server";
import { z } from "zod";
import { CurriculumError } from "@/lib/core/curriculum-extract";
import { readDocument } from "@/lib/curriculum/read";
import { MAX_UPLOAD_BYTES, readPasted, readPdf, readUrl, SourceError, type SourceText } from "@/lib/curriculum/source";
import { getShared, savePending } from "@/lib/curriculum/store";
import { getLlm } from "@/lib/rag/llm";
import { guardMutation, LIMITS } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const name = z.string().trim().max(100).default("");
const body = z
  .object({
  kind: z.enum(["curriculum", "electives", "minors"]),
  university: z.string().trim().min(2).max(100),
  faculty: name,
  major: name,
  cohort: z.number().int().min(0).max(99),
  parentId: z.string().regex(/^[\w-]{10}$/).optional(),
  source: z.union([
    z.object({ url: z.string().trim().url().max(500) }),
    z.object({ text: z.string().max(200_000) }),
    z.object({ pdfBase64: z.string().max(Math.ceil((MAX_UPLOAD_BYTES * 4) / 3) + 8), name: z.string().trim().max(200) }),
  ]),
  })
  .refine((b) => !(b.kind === "electives" && "url" in b.source) || !!b.parentId)
  .refine((b) => b.kind !== "curriculum" || (b.faculty !== "" && b.major !== ""));

/** Read a curriculum document into a preview. Only a link is stored (as pending): an upload or paste is never shared. */
export async function POST(request: Request) {
  const blocked = await guardMutation(request, LIMITS.curriculumRead);
  if (blocked) return blocked;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง ตรวจชื่อมหาวิทยาลัย คณะ สาขา ปีรหัส และเอกสารที่ใส่" }, { status: 400 });
  const { kind, university, faculty, major, cohort, parentId, source } = parsed.data;

  const llm = getLlm();
  if (!llm) return NextResponse.json({ error: "ตอนนี้อ่านเอกสารใหม่ไม่ได้ หลักสูตรที่มีในระบบแล้วยังใช้ได้" }, { status: 503 });

  // A link's electives are shared through their curriculum: without a shared parent the row could never appear.
  if (kind === "electives" && "url" in source) {
    const parent = parentId ? await getShared(parentId) : null;
    if (!parent) return NextResponse.json({ error: "ต้องเลือกหลักสูตรที่มีในระบบก่อน จึงจะเพิ่มรายชื่อวิชาเลือกให้คนอื่นใช้ได้" }, { status: 422 });
    // An owner-read curriculum never merges a link's list (see mergeElectives), so the read would be lost.
    if (parent.meta.provenance === "owner")
      return NextResponse.json({ error: "หลักสูตรนี้มาจากเอกสารของมหาวิทยาลัย เพิ่มรายชื่อวิชาเลือกได้เฉพาะในแผนของคุณ" }, { status: 422 });
  }

  let text: SourceText;
  try {
    if ("url" in source) text = await readUrl(source.url);
    else if ("text" in source) text = readPasted(source.text);
    else {
      const bytes = Buffer.from(source.pdfBase64, "base64");
      if (bytes.length > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "ไฟล์ใหญ่เกินไป" }, { status: 413 });
      text = await readPdf(bytes, source.name || "เอกสาร PDF");
    }
  } catch (e) {
    if (e instanceof SourceError) return NextResponse.json({ error: e.message }, { status: 422 });
    console.error("curriculum source failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "เปิดเอกสารนี้ไม่ได้ ลองใช้เอกสารอื่น" }, { status: 422 });
  }

  try {
    const preview = await readDocument(llm, kind, text, { university, faculty, major, cohort });
    const pendingId =
      "url" in source
        ? await savePending({
            kind,
            university,
            faculty: faculty || undefined,
            major: major || undefined,
            parentId: kind === "electives" ? parentId : undefined,
            data: preview.data,
            ...(preview.kind === "curriculum" ? { cohortFrom: preview.data.cohortFrom, cohortTo: preview.data.cohortTo } : {}),
            sourceUrl: source.url,
            sourceTitle: text.title,
          })
        : undefined;
    return NextResponse.json({ preview, sourceTitle: text.title, ...(pendingId ? { pendingId } : {}) });
  } catch (e) {
    if (e instanceof SourceError) return NextResponse.json({ error: e.message }, { status: 422 });
    if (!(e instanceof CurriculumError)) console.error("curriculum read failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "อ่านหลักสูตรจากเอกสารนี้ไม่ได้ ลองใช้เอกสารอื่น หรือวางเฉพาะส่วนแผนการศึกษา" }, { status: 502 });
  }
}
