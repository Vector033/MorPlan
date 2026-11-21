import type { Embedder } from "./embed";
import { MemoryDenseStore, Retrieval } from "./retrieve";
import type { DocMeta, Page } from "./types";

/** A document added to one university's corpus: shared from a link, or private to one request. */
export type ScopedDoc = { id: string; title: string; kind: string; url: string; pages: { page: number; text: string }[] };

// Word search only: the embedding model is too big for a serverless function and these corpora are small.
const NO_EMBEDDER: Embedder = { model: "none", embed: async (texts) => texts.map(() => []) };

/**
 * A retrieval over exactly one university's documents: its bundled corpus (if any) plus the given documents.
 * Nothing from another university is ever in it, so an answer can only cite this university.
 */
export function scopedRetrieval(base: { pages: Page[]; docs: Map<string, DocMeta> } | null, extra: ScopedDoc[]): Retrieval {
  const pages = [...(base?.pages ?? [])];
  const docs = new Map(base?.docs ?? []);
  for (const d of extra) {
    docs.set(d.id, { id: d.id, title: d.title, kind: d.kind, url: d.url });
    for (const p of d.pages) pages.push({ docId: d.id, page: p.page, text: p.text });
  }
  return new Retrieval(pages, docs, NO_EMBEDDER, new MemoryDenseStore([]));
}
