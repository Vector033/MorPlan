import { describe, expect, it } from "vitest";
import { abstention, bestThreshold, firstGoldRank, mrr, percentile, recallAt, split } from "./metrics";

describe("eval metrics", () => {
  const r = (docId: string, page: number) => ({ docId, page, text: "" });

  it("finds the first result on any gold page", () => {
    expect(firstGoldRank([r("a", 1), r("b", 2), r("b", 3)], { docId: "b", pages: [3, 2] })).toBe(2);
    expect(firstGoldRank([r("a", 1)], { docId: "b", pages: [1] })).toBeNull();
  });

  it("computes recall@k and MRR", () => {
    const ranks = [1, 3, null, 6];
    expect(recallAt(ranks, 1)).toBe(0.25);
    expect(recallAt(ranks, 5)).toBe(0.5);
    expect(mrr(ranks)).toBeCloseTo((1 + 1 / 3 + 1 / 6) / 4);
  });

  it("scores abstention and picks a separating threshold", () => {
    const cases = [
      { score: 0.9, answerable: true },
      { score: 0.85, answerable: true },
      { score: 0.8, answerable: false },
      { score: 0.7, answerable: false },
    ];
    expect(bestThreshold(cases)).toBe(0.85);
    expect(abstention(cases, 0.85)).toMatchObject({ accuracy: 1, correctRefusal: 1, falseRefusal: 0 });
  });

  it("percentile and split are deterministic", () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(split("A001")).toBe(split("A001"));
    expect(new Set(["A001", "A002", "A003", "A004", "B001", "B002"].map(split)).size).toBe(2);
  });
});
