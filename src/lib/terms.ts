import { isCmu } from "./core/university";

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

/** Calendars known for sure, by university: Chiang Mai University's 2569 calendar (data/docs.json: calendar-2569). */
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

export const termLabel = (term: string) => {
  const [semester, year] = term.split("/");
  return semester === "3" ? `ภาคฤดูร้อน ${year}` : `ภาคการศึกษาที่ ${semester}/${year}`;
};

/**
 * Class dates for an .ics export: the university's own calendar when it is known, else a typical
 * Thai calendar for that semester (the student adjusts both dates before downloading).
 * shortcut: one generic calendar for every other university; add known calendars to TERMS when they are read.
 */
export function termDefaults(term: string, university?: string): TermInfo {
  if (isCmu(university) && TERMS[term]) return TERMS[term];
  const [semester, beYear] = term.split("/").map(Number);
  const ce = beYear - 543; // academic year 2569 starts in 2026
  const [start, end] =
    semester === 1 ? [`${ce}-08-03`, `${ce}-11-27`] : semester === 2 ? [`${ce}-11-23`, `${ce + 1}-03-19`] : [`${ce + 1}-04-05`, `${ce + 1}-05-28`];
  return { term, label: termLabel(term), start, end, noClass: [] };
}
