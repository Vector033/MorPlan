import type { Hit } from "./types";

/**
 * Reciprocal-rank fusion: score(d) = Σ 1 / (k + rank_i(d)), rank starting at 1.
 * Rank-based, so BM25 and cosine scores need no common scale.
 */
export function rrf(lists: Hit[][], k = 60, limit = 10): Hit[] {
  const acc = new Map<string, Hit>();
  for (const list of lists) {
    list.forEach((hit, i) => {
      const prev = acc.get(hit.chunk.id);
      const add = 1 / (k + i + 1);
      acc.set(hit.chunk.id, { chunk: hit.chunk, score: (prev?.score ?? 0) + add });
    });
  }
  return [...acc.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
