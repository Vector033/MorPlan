import { parseTimeRange } from "./time";
import type { ExamSlot, Section } from "./types";

export type ExamTable = Record<string, ExamSlot>;
export type TermExams = { term: string; midterm: ExamTable; final: ExamTable; fetchedAt: string; source: string[] };

const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

/** "2/2569" → { semester: 2, beYear: 2569, code: "269" } (reg's term code). */
export function parseTerm(term: string): { semester: number; beYear: number; code: string } {
  const m = /^([123])\/(\d{4})$/.exec(term);
  if (!m) throw new Error(`Bad term: ${term}`);
  const semester = Number(m[1]);
  const beYear = Number(m[2]);
  return { semester, beYear, code: `${semester}${String(beYear).slice(2)}` };
}

/**
 * Parse reg's public exam timetable page (timetable_exam.php). Rows are dates
 * like "JAN  18", header columns are time slots like "0800-1100", and each cell
 * lists course numbers. An academic year starts in June, so Jan–May dates fall
 * in the following Gregorian year.
 */
export function parseExamTimetable(html: string, term: string): ExamTable {
  const { beYear } = parseTerm(term);
  const ceYear = beYear - 543;
  const slots = [...html.matchAll(/<th>\s*(\d{4}-\d{4})\s*<\/th>/g)].map((m) => parseTimeRange(m[1]));
  if (slots.length === 0 || slots.some((s) => !s)) throw new Error("No time-slot header found in exam timetable");

  const out: ExamTable = {};
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1].replace(/<[^>]+>/g, " ").trim());
    if (cells.length < 2) continue;
    const dm = /^([A-Z]{3})\s+(\d{1,2})$/.exec(cells[0].replace(/\s+/g, " "));
    if (!dm || !MONTHS[dm[1]]) continue;
    const month = MONTHS[dm[1]];
    const year = month >= 6 ? ceYear : ceYear + 1;
    const date = `${year}-${String(month).padStart(2, "0")}-${dm[2].padStart(2, "0")}`;
    cells.slice(1).forEach((cell, i) => {
      const slot = slots[i];
      if (!slot) return;
      for (const courseNo of cell.match(/\b\d{6}\b/g) ?? []) out[courseNo] = { date, ...slot };
    });
  }
  return out;
}

/** Fill in midterm/final from the public timetable unless the import already had them. */
export function attachExams(sections: Section[], exams: Pick<TermExams, "midterm" | "final"> | null): Section[] {
  if (!exams) return sections;
  return sections.map((s) => ({
    ...s,
    midterm: s.midterm ?? exams.midterm[s.courseNo],
    final: s.final ?? exams.final[s.courseNo],
  }));
}
