import { Bm25Index } from "./bm25";
import { chunkPages } from "./chunk";
import { cosine, type Embedder } from "./embed";
import { rrf } from "./fuse";
import type { Chunk, DocMeta, Hit, Page, Retriever, Strategy } from "./types";

/** Vector search backend: pgvector in the app, in-memory in tests. */
export interface DenseStore {
  search(strategy: Strategy, model: string, query: number[], k: number): Promise<{ id: string; score: number }[]>;
}

/** The text that gets indexed: document title as context, then the chunk. */
export function indexText(chunk: Chunk, docs: Map<string, DocMeta>): string {
  return `${docs.get(chunk.docId)?.title ?? ""}\n${chunk.text}`;
}

/** Confidence signals for answering vs. "ไม่พบ". */
export type Signals = { dense: number; coverage: number; combined: number };
export type Signal = keyof Signals;

export type RetrieveResult = { hits: Hit[]; dense: Hit[]; bm25: Hit[]; signals: Signals };

/**
 * Chunks + BM25 for every strategy, built once from the committed pages and
 * shared by the app and the eval runner.
 */
export class Retrieval {
  private chunks = new Map<Strategy, Chunk[]>();
  private byId = new Map<string, Chunk>();
  private bm25 = new Map<Strategy, Bm25Index>();

  constructor(
    private pages: Page[],
    readonly docs: Map<string, DocMeta>,
    private embedder: Embedder,
    private dense: DenseStore,
  ) {}

  chunksFor(strategy: Strategy): Chunk[] {
    let c = this.chunks.get(strategy);
    if (!c) {
      c = chunkPages(this.pages, strategy);
      this.chunks.set(strategy, c);
      for (const chunk of c) this.byId.set(`${strategy}|${chunk.id}`, chunk);
    }
    return c;
  }

  private bm25For(strategy: Strategy): Bm25Index {
    let idx = this.bm25.get(strategy);
    if (!idx) {
      idx = new Bm25Index(this.chunksFor(strategy), 1.2, 0.75, (c) => indexText(c, this.docs));
      this.bm25.set(strategy, idx);
    }
    return idx;
  }

  async retrieve(question: string, strategy: Strategy, retriever: Retriever, k = 10, queryVector?: number[]): Promise<RetrieveResult> {
    this.chunksFor(strategy);
    const wantDense = retriever !== "bm25";
    const wantBm25 = retriever !== "dense";
    const pool = Math.max(k, 20);

    const bm25 = wantBm25 ? this.bm25For(strategy).search(question, pool) : [];
    let dense: Hit[] = [];
    if (wantDense) {
      const q = queryVector ?? (await this.embedder.embed([question], "query"))[0];
      const rows = await this.dense.search(strategy, this.embedder.model, q, pool);
      dense = rows
        .map((r) => ({ chunk: this.byId.get(`${strategy}|${r.id}`), score: r.score }))
        .filter((h): h is Hit => !!h.chunk);
    }
    const hits = retriever === "bm25" ? bm25.slice(0, k) : retriever === "dense" ? dense.slice(0, k) : rrf([bm25, dense], 60, k);
    const index = this.bm25For(strategy);
    const coverage = Math.max(0, ...hits.slice(0, 3).map((h) => index.coverage(question, h.chunk.id)));
    const top = dense[0]?.score ?? 0;
    return { hits, dense, bm25, signals: { dense: top, coverage, combined: coverage * top } };
  }

  get embedderModel() {
    return this.embedder.model;
  }

  embedQuery(question: string) {
    return this.embedder.embed([question], "query").then((v) => v[0]);
  }
}

/** Brute-force cosine search over vectors held in memory. */
export class MemoryDenseStore implements DenseStore {
  constructor(private rows: { strategy: Strategy; model: string; id: string; embedding: number[] }[]) {}

  async search(strategy: Strategy, model: string, query: number[], k: number) {
    return this.rows
      .filter((r) => r.strategy === strategy && r.model === model)
      .map((r) => ({ id: r.id, score: cosine(query, r.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}
