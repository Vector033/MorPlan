import "server-only";
import { db } from "@/db";
import { isCmu } from "@/lib/core/university";
import { universityKey } from "@/lib/curriculum/rows";
import { sharedWithPages } from "@/lib/regulations/store";
import { loadDocs, loadPages } from "./corpus";
import { getEmbedder } from "./embed";
import { PgDenseStore } from "./pg-store";
import { Retrieval } from "./retrieve";
import { scopedRetrieval, type ScopedDoc } from "./scope";

const g = globalThis as unknown as { retrieval?: Retrieval; scoped?: Map<string, Retrieval> };

/** One Retrieval per server process over the bundled corpus (pages, chunks and BM25 built once). */
export function getRetrieval(): Retrieval {
  g.retrieval ??= new Retrieval(loadPages(), loadDocs(), getEmbedder(), new PgDenseStore(db));
  return g.retrieval;
}

export type UniversityRetrieval = { retrieval: Retrieval; lexical: boolean };

/**
 * The retrieval for one university's questions: the bundled corpus alone (eval-tuned settings) when that is all
 * there is, else a word-search index over that university's documents plus the student's private ones. Null when
 * the university has no documents at all.
 */
export async function retrievalFor(university: string, privateDocs: ScopedDoc[]): Promise<UniversityRetrieval | null> {
  const bundled = isCmu(university);
  const shared = await sharedWithPages(university);
  if (bundled && !shared.length && !privateDocs.length) return { retrieval: getRetrieval(), lexical: false };
  if (!shared.length && !privateDocs.length) return null;

  const docs: ScopedDoc[] = shared.map((d) => ({ id: `reg-${d.id}`, title: d.title, kind: d.kind, url: d.sourceUrl ?? "", pages: d.pages }));
  const base = bundled ? { pages: loadPages(), docs: loadDocs() } : null;
  if (privateDocs.length) return { retrieval: scopedRetrieval(base, [...docs, ...privateDocs]), lexical: true };

  // Shared documents change only when someone confirms a new one: keep the index per university and document set.
  const key = `${universityKey(university)}|${shared.map((d) => d.id).join(",")}`;
  g.scoped ??= new Map();
  let r = g.scoped.get(key);
  if (!r) {
    r = scopedRetrieval(base, docs);
    if (g.scoped.size >= 16) g.scoped.delete(g.scoped.keys().next().value!);
    g.scoped.set(key, r);
  }
  return { retrieval: r, lexical: true };
}
