import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_UPLOAD_BYTES, readPasted, readPdf, readUrl, SourceError, type SourceText } from "@/lib/curriculum/source";
import { REG_KINDS, toPages } from "@/lib/regulations/pages";
import { savePending, sharedByUrl } from "@/lib/regulations/store";
import { guardMutation, LIMITS } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const body = z.object({
  university: z.string().trim().min(2).max(100),
  kind: z.enum(REG_KINDS).default("regulation"),
  source: z.union([
    z.object({ url: z.string().trim().url().max(500) }),
    z.object({ text: z.string().max(200_000) }),
    z.object({ pdfBase64: z.string().max(Math.ceil((MAX_UPLOAD_BYTES * 4) / 3) + 8), name: z.string().trim().max(200) }),
  ]),
});

/**
 * Turn a regulation document into pages. A university link is stored as pending until the student confirms it,
 * then every student of that university can ask from it. An upload or paste comes back to the student only.
 * No model reads the document: it is searched as written.
 */
export async function POST(request: Request) {
  const blocked = await guardMutation(request, LIMITS.regulationsRead);
  if (blocked) return blocked;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง ตรวจชื่อมหาวิทยาลัยและเอกสารที่ใส่" }, { status: 400 });
  const { university, kind, source } = parsed.data;

  if ("url" in source) {
    const existing = await sharedByUrl(university, source.url);
    if (existing) return NextResponse.json({ existing });
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
    console.error("regulation source failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "เปิดเอกสารนี้ไม่ได้ ลองใช้เอกสารอื่น" }, { status: 422 });
  }

  const pages = toPages(text.text);
  if (!pages.length) return NextResponse.json({ error: "ไม่พบข้อความในเอกสารนี้" }, { status: 422 });
  const preview = { title: text.title, pageCount: pages.length, sample: pages[0].text.slice(0, 300) };
  if ("url" in source) {
    const pendingId = await savePending({ university, title: text.title, kind, sourceUrl: source.url, pages });
    return NextResponse.json({ preview, pendingId });
  }
  return NextResponse.json({ preview, doc: { title: text.title, pages } });
}
