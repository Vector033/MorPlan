import { z } from "zod";
import { chunks } from "@/lib/core/curriculum-extract";

/** Regulation documents as pages; the same bounds guard the database rows and a student's private documents. */
export const REG_KINDS = ["regulation", "calendar", "announcement", "guide"] as const;
export type RegKind = (typeof REG_KINDS)[number];
export const REG_LIMITS = { pages: 300, pageChars: 12_000, privateDocs: 3, privateChars: 600_000 } as const;

export const pageSchema = z.object({ page: z.number().int().min(1).max(5000), text: z.string().max(REG_LIMITS.pageChars) });
export const pagesSchema = z.array(pageSchema).min(1).max(REG_LIMITS.pages);
export type RegPage = z.infer<typeof pageSchema>;

/** A PDF keeps its own page numbers ("--- page N ---" from readPdf); a web page or pasted text is cut into ~4,000-character parts. */
export function toPages(text: string): RegPage[] {
  const marked = [...text.matchAll(/--- page (\d+) ---\n([\s\S]*?)(?=\n--- page \d+ ---|$)/g)].map((m) => ({ page: Number(m[1]), text: m[2] }));
  const raw = marked.length ? marked : chunks(text, 4000).map((t, i) => ({ page: i + 1, text: t }));
  return raw
    .map((p) => ({ page: p.page, text: p.text.trim().slice(0, REG_LIMITS.pageChars) }))
    .filter((p) => p.text.length > 0)
    .slice(0, REG_LIMITS.pages);
}
