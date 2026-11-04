// Pure metric helpers for the eval runner (unit-tested in metrics.test.ts).

export type Gold = { docId: string | null; pages: number[] };
export type Ranked = { docId: string; page: number; text: string }[];

/** 1-based rank of the first result on a gold page, or null. */
export function firstGoldRank(ranked: Ranked, gold: Gold): number | null {
  const i = ranked.findIndex((r) => r.docId === gold.docId && gold.pages.includes(r.page));
  return i < 0 ? null : i + 1;
}

export function recallAt(ranks: (number | null)[], k: number): number {
  return ranks.filter((r) => r !== null && r <= k).length / Math.max(1, ranks.length);
}

export function mrr(ranks: (number | null)[], cutoff = 10): number {
  return ranks.reduce<number>((s, r) => s + (r !== null && r <= cutoff ? 1 / r : 0), 0) / Math.max(1, ranks.length);
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}

export type AbstainCase = { score: number; answerable: boolean };

/**
 * Abstention at a threshold: answer when score >= t. Accuracy counts an
 * answerable question answered and an unanswerable one refused as correct.
 */
export function abstention(cases: AbstainCase[], t: number) {
  const ans = cases.filter((c) => c.answerable);
  const un = cases.filter((c) => !c.answerable);
  const answeredOk = ans.filter((c) => c.score >= t).length;
  const refusedOk = un.filter((c) => c.score < t).length;
  return {
    threshold: t,
    accuracy: (answeredOk + refusedOk) / Math.max(1, cases.length),
    balancedAccuracy: (answeredOk / Math.max(1, ans.length) + refusedOk / Math.max(1, un.length)) / 2,
    correctRefusal: refusedOk / Math.max(1, un.length),
    falseRefusal: 1 - answeredOk / Math.max(1, ans.length),
  };
}

/** Threshold with the best balanced accuracy over the candidate scores (ties → lower threshold). */
export function bestThreshold(cases: AbstainCase[]): number {
  const candidates = [...new Set(cases.map((c) => c.score))].sort((a, b) => a - b);
  let best = { t: 0, v: -1 };
  for (const t of candidates) {
    const v = abstention(cases, t).balancedAccuracy;
    if (v > best.v) best = { t, v };
  }
  return best.t;
}

/** Stable dev/test split by id so the threshold is never tuned on the questions it is scored on. */
export function split(id: string): "dev" | "test" {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 2 === 0 ? "dev" : "test";
}
