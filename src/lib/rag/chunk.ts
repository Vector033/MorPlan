import type { Chunk, Page, Strategy } from "./types";

const FIXED_SIZE = 700;
const FIXED_OVERLAP = 150;
const CLAUSE_MIN = 250;
const CLAUSE_MAX = 1200;
const PARA_TARGET = 550;

/**
 * Split pages into retrieval chunks. Chunks never cross a page boundary, so
 * every chunk cites exactly one page.
 * - fixed: ~700-char windows with 150 overlap, cut at whitespace.
 * - clause: one chunk per regulation clause ("ข้อ ๑๒"), small clauses merged,
 *   long ones windowed.
 * - paragraph: blank-line/line blocks packed to ~550 chars.
 */
export function chunkPages(pages: Page[], strategy: Strategy): Chunk[] {
  const out: Chunk[] = [];
  for (const p of pages) {
    const text = p.text.trim();
    if (text.length < 20) continue;
    const pieces =
      strategy === "fixed" ? windows(text, FIXED_SIZE, FIXED_OVERLAP) : strategy === "clause" ? clauses(text) : paragraphs(text);
    pieces.forEach((t, i) => out.push({ id: `${p.docId}:${p.page}:${i}`, strategy, docId: p.docId, page: p.page, text: t }));
  }
  return out;
}

export function windows(text: string, size: number, overlap: number): string[] {
  if (text.length <= size) return [text];
  const out: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const cut = Math.max(text.lastIndexOf("\n", end), text.lastIndexOf(" ", end));
      if (cut > start + size / 2) end = cut;
    }
    out.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
    const ws = text.indexOf(" ", start);
    if (ws > 0 && ws < end) start = ws + 1;
  }
  return out.filter(Boolean);
}

// "ข้อ ๑๒", "ข้อ 12", "ข้อ ๑๒/๑" at the start of a line.
const CLAUSE_START = /^(?=ข้อ\s*[๐-๙0-9]+)/m;

export function clauses(text: string): string[] {
  const parts = text.split(CLAUSE_START).map((s) => s.trim()).filter(Boolean);
  const merged: string[] = [];
  for (const part of parts) {
    const last = merged[merged.length - 1];
    if (last !== undefined && (last.length < CLAUSE_MIN || part.length < 80) && last.length + part.length <= CLAUSE_MAX) {
      merged[merged.length - 1] = `${last}\n${part}`;
    } else merged.push(part);
  }
  return merged.flatMap((c) => (c.length > CLAUSE_MAX ? windows(c, FIXED_SIZE, FIXED_OVERLAP) : [c]));
}

export function paragraphs(text: string): string[] {
  const blocks = text.split(/\n\s*\n/).flatMap((b) => (b.length > PARA_TARGET * 1.6 ? b.split("\n") : [b]));
  const out: string[] = [];
  let cur = "";
  for (const b of blocks.map((s) => s.trim()).filter(Boolean)) {
    if (cur && cur.length + b.length > PARA_TARGET) {
      out.push(cur);
      cur = b;
    } else cur = cur ? `${cur}\n${b}` : b;
  }
  if (cur) out.push(cur);
  return out.flatMap((c) => (c.length > PARA_TARGET * 2 ? windows(c, FIXED_SIZE, FIXED_OVERLAP) : [c]));
}
