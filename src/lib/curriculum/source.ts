import { boundTitle } from "../core/curriculum-limits";
import { decode, pageText } from "../core/import-reg";
import { academicUrl, fetchAcademic } from "../core/university";

export const MAX_SOURCE_BYTES = 8_000_000;
export const MAX_UPLOAD_BYTES = 3_000_000;
export const MIN_TEXT_CHARS = 200;

const MESSAGES = {
  "not-academic": "รับเฉพาะลิงก์เว็บไซต์มหาวิทยาลัย (.ac.th หรือ .edu)",
  unreachable: "เปิดลิงก์นี้ไม่ได้ ลองอัปโหลดไฟล์หรือวางข้อความแทน",
  "too-large": "เอกสารใหญ่เกินไป ลองใช้ลิงก์หน้าเว็บของหลักสูตร หรือวางเฉพาะส่วนแผนการศึกษา",
  "no-text": "อ่านข้อความจากไฟล์นี้ไม่ได้ (อาจเป็นภาพสแกน) ลองใช้ลิงก์หน้าเว็บหรือวางข้อความแทน",
  unsupported: "รองรับเฉพาะหน้าเว็บและไฟล์ PDF",
} as const;

export class SourceError extends Error {
  constructor(public code: keyof typeof MESSAGES, message: string = MESSAGES[code]) {
    super(message);
  }
}

export type SourceText = { text: string; title: string; kind: "html" | "pdf" | "text" };

const lastSegment = (url: string) => decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() ?? new URL(url).hostname);

async function readBody(res: Response): Promise<Uint8Array> {
  if (Number(res.headers.get("content-length")) > MAX_SOURCE_BYTES) {
    await res.body?.cancel();
    throw new SourceError("too-large");
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.body?.getReader();
  try {
    for (let r = await reader?.read(); r && !r.done; r = await reader!.read()) {
      total += r.value.length;
      if (total > MAX_SOURCE_BYTES) throw new SourceError("too-large");
      chunks.push(r.value);
    }
  } catch (e) {
    await reader?.cancel().catch(() => {});
    throw e instanceof SourceError ? e : new SourceError("unreachable");
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.length;
  }
  return bytes;
}

export async function readUrl(url: string, fetchFn: typeof fetch = fetch): Promise<SourceText> {
  const safe = academicUrl(url);
  if (!safe) throw new SourceError("not-academic");
  const res = await fetchAcademic(safe, fetchFn, 15_000);
  if (!res) throw new SourceError("unreachable");
  const type = (res.headers.get("content-type") ?? "").toLowerCase();
  const typed = type !== "" && !type.includes("application/octet-stream");
  const known = /application\/pdf|text\/html|application\/xhtml\+xml/.test(type);
  if (typed && !known) {
    await res.body?.cancel();
    throw new SourceError("unsupported");
  }
  const bytes = await readBody(res);
  const sniffed = new TextDecoder("latin1").decode(bytes.slice(0, 2000));
  if (type.includes("application/pdf") || (!typed && sniffed.startsWith("%PDF"))) return readPdf(bytes, lastSegment(safe));
  if (!known && !/<(html|body|title|table|p|div)/i.test(sniffed)) throw new SourceError("unsupported");
  const label = /charset\s*=\s*["']?([\w-]+)/i.exec(type)?.[1] ?? /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(sniffed)?.[1];
  let decoder = new TextDecoder("utf-8");
  try {
    if (label) decoder = new TextDecoder(label);
  } catch {
    // unknown label: keep UTF-8
  }
  const html = decoder.decode(bytes);
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  return { kind: "html", text: pageText(html), title: boundTitle((title && decode(title).trim()) || lastSegment(safe)) };
}

export async function readPdf(bytes: Uint8Array, title: string): Promise<SourceText> {
  let pages: string[];
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    pages = (await extractText(pdf, { mergePages: false })).text;
  } catch {
    throw new SourceError("no-text");
  }
  const text = pages.map((t, i) => `--- page ${i + 1} ---\n${t}`).join("\n");
  if (pages.join("").trim().length < MIN_TEXT_CHARS) throw new SourceError("no-text");
  return { kind: "pdf", text, title: boundTitle(title) };
}

export function readPasted(text: string): SourceText {
  if (text.trim().length < MIN_TEXT_CHARS) throw new SourceError("no-text");
  return { kind: "text", text, title: boundTitle("ข้อความที่วาง") };
}

const LOOKS_LIKE_CURRICULUM = /หลักสูตร|แผนการ(ศึกษา|เรียน)|มคอ|curriculum|program|study[\s-]?plan|tqf/i;

/** Links on a page that look like curriculum pages or files (or whatever `looksLike` says): academic URLs only, deduplicated, at most 12. */
export function curriculumLinks(html: string, baseUrl: string, looksLike = LOOKS_LIKE_CURRICULUM): { url: string; label: string }[] {
  const out = new Map<string, string>();
  for (const m of html.matchAll(/<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi)) {
    let url: string | undefined;
    try {
      url = academicUrl(new URL((m[1] ?? m[2]).trim(), baseUrl).toString());
    } catch {
      continue;
    }
    const label = pageText(m[3]).replace(/\s+/g, " ").trim();
    if (url && !out.has(url) && looksLike.test(`${label} ${url}`)) out.set(url, label);
  }
  return [...out].slice(0, 12).map(([url, label]) => ({ url, label }));
}
