// Term dates from the CMU academic calendar 2569 (data/docs.json: calendar-2569).
export type TermInfo = {
  term: string;
  label: string;
  /** First day of classes. */
  start: string;
  /** Last day of classes. */
  end: string;
  /** Inclusive date ranges with no classes (midterm prep + midterm week). */
  noClass: [string, string][];
};

export const TERMS: Record<string, TermInfo> = {
  "2/2569": {
    term: "2/2569",
    label: "ภาคการศึกษาที่ 2/2569",
    start: "2026-11-16",
    end: "2027-03-14",
    noClass: [["2027-01-11", "2027-01-24"]],
  },
};

export const CURRENT_TERM = "2/2569";

export function termInfo(term: string): TermInfo {
  return TERMS[term] ?? TERMS[CURRENT_TERM];
}
