import "server-only";
import { db } from "@/db";
import { loadDocs, loadPages } from "./corpus";
import { getEmbedder } from "./embed";
import { PgDenseStore } from "./pg-store";
import { Retrieval } from "./retrieve";

const g = globalThis as unknown as { retrieval?: Retrieval };

/** One Retrieval per server process (pages, chunks and BM25 built once). */
export function getRetrieval(): Retrieval {
  g.retrieval ??= new Retrieval(loadPages(), loadDocs(), getEmbedder(), new PgDenseStore(db));
  return g.retrieval;
}
