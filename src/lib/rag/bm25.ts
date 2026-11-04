import { tokenize } from "./tokenize";
import type { Chunk, Hit } from "./types";

/** Okapi BM25 over Thai word tokens, in memory (the corpus is a few hundred chunks). */
export class Bm25Index {
  private docs: { chunk: Chunk; tf: Map<string, number>; len: number }[] = [];
  private df = new Map<string, number>();
  private avgLen = 0;

  constructor(
    chunks: Chunk[],
    private k1 = 1.2,
    private b = 0.75,
    textOf: (c: Chunk) => string = (c) => c.text,
  ) {
    for (const chunk of chunks) {
      const tokens = tokenize(textOf(chunk));
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      this.docs.push({ chunk, tf, len: tokens.length });
    }
    this.avgLen = this.docs.reduce((n, d) => n + d.len, 0) / Math.max(1, this.docs.length);
  }

  /**
   * Share of the query's IDF weight whose terms appear in the chunk (0–1).
   * Terms the corpus has never seen count with the highest IDF, so questions
   * about things the documents never mention ("หอพัก") score low.
   */
  coverage(query: string, chunkId: string): number {
    const doc = this.docs.find((d) => d.chunk.id === chunkId);
    const terms = [...new Set(tokenize(query))];
    if (!doc || terms.length === 0) return 0;
    const N = this.docs.length;
    const idf = (t: string) => {
      const n = this.df.get(t) ?? 0;
      return Math.log(1 + (N - n + 0.5) / (n + 0.5));
    };
    let total = 0;
    let hit = 0;
    for (const t of terms) {
      const w = idf(t);
      total += w;
      if (doc.tf.has(t)) hit += w;
    }
    return total ? hit / total : 0;
  }

  search(query: string, k = 10): Hit[] {
    const terms = [...new Set(tokenize(query))];
    const N = this.docs.length;
    const hits: Hit[] = [];
    for (const d of this.docs) {
      let score = 0;
      for (const t of terms) {
        const f = d.tf.get(t);
        if (!f) continue;
        const n = this.df.get(t)!;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        score += (idf * f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * d.len) / this.avgLen));
      }
      if (score > 0) hits.push({ chunk: d.chunk, score });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, k);
  }
}
