import { findConflicts } from "./conflicts";
import type { Section } from "./types";
export const SLOT_KINDS = ["major-elective", "minor", "ge", "free", "other"] as const;
export type SlotKind = (typeof SLOT_KINDS)[number];
export type PlanCourse = { type: "course"; courseNo: string; title: string; credits: number };
export type PlanSlot = { type: "slot"; kind: SlotKind; credits: number; note?: string };
export type PlanTerm = { year: number; semester: number; items: (PlanCourse | PlanSlot)[] };
export type StudyPlan = { id: string; name: string; minCredits?: number; terms: PlanTerm[] };
export type ElectiveCourse = { courseNo: string; title: string; credits?: number; level?: number };
export type Curriculum = {
  title: string;
  university: string;
  faculty: string;
  major: string;
  cohortFrom: number;
  cohortTo?: number; // two-digit Buddhist entry years, 64 = 2564
  plans: StudyPlan[];
  electives: Partial<Record<SlotKind, ElectiveCourse[]>>;
};
export type MinorGroup = { label: string; minCredits?: number; courseNos: string[] };
export type Minor = { name: string; faculty?: string; rules: string; groups: MinorGroup[] };
export type Source = { url?: string; title: string; readAt: string; provenance: "link" | "owner" | "private" };
/** A named passed course; `slotId` set when it was taken for an elective slot. */
export type Passed = { courseNo: string; credits: number; slotId?: string };
export type CurriculumState = {
  ref?: string;
  data: Curriculum;
  source: Source;
  cohort: number;
  planId: string;
  minor?: Minor;
  minorSource?: Source;
  passed: Passed[];
  doneSlots: string[];
  viewTerm?: { year: number; semester: number };
};

type Done = Pick<CurriculumState, "passed" | "doneSlots">;

/** Lower-case, strip a leading faculty/department word, keep only Thai letters, Latin letters and digits. */
export function normalizeKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/^(คณะ|สาขาวิชา|สาขา|ภาควิชา|faculty of|department of)/, "")
    .replace(/[^ก-๙a-z0-9]/g, "");
}

export function covers(c: { cohortFrom: number; cohortTo?: number }, cohort: number): boolean {
  return cohort >= c.cohortFrom && (c.cohortTo === undefined || cohort <= c.cohortTo);
}

/** `term` is `S/YYYY` in Buddhist years; entry year is 2500 + cohort. */
export function termPosition(cohort: number, term: string): { year: number; semester: number } {
  const [s, y] = term.split("/").map(Number);
  return { year: y - (2500 + cohort) + 1, semester: s };
}

export function slotId(plan: StudyPlan, term: PlanTerm, index: number): string {
  return `${plan.id}:${term.year}-${term.semester}-${index}`;
}

export type TermView = {
  year: number;
  semester: number;
  inPlan: boolean;
  credits: number;
  required: (PlanCourse & { done: boolean })[];
  slots: (PlanSlot & { id: string; doneCredits: number })[];
  overdue: PlanCourse[];
};

function doneCredits(id: string, slot: PlanSlot, state: Done): number {
  if (state.doneSlots.includes(id)) return slot.credits;
  const named = [...new Map(state.passed.filter((p) => p.slotId === id).map((p) => [p.courseNo, p.credits])).values()].reduce((n, c) => n + c, 0); // a course counts once
  return Math.min(named, slot.credits);
}

export function termView(plan: StudyPlan, at: { year: number; semester: number }, state: Done): TermView {
  const passedNos = new Set(state.passed.map((p) => p.courseNo));
  const term = plan.terms.find((t) => t.year === at.year && t.semester === at.semester);
  const overdue = plan.terms
    .filter((t) => t.year < at.year || (t.year === at.year && t.semester < at.semester))
    .flatMap((t) => t.items)
    .filter((i): i is PlanCourse => i.type === "course" && !passedNos.has(i.courseNo));
  const view: TermView = { year: at.year, semester: at.semester, inPlan: !!term, credits: 0, required: [], slots: [], overdue };
  term?.items.forEach((item, index) => {
    view.credits += item.credits;
    if (item.type === "course") view.required.push({ ...item, done: passedNos.has(item.courseNo) });
    else {
      const id = slotId(plan, term, index);
      view.slots.push({ ...item, id, doneCredits: doneCredits(id, item, state) });
    }
  });
  return view;
}

/** The student's chosen plan; an unknown id falls back to the first plan, undefined only when there are none. */
export function studyPlanOf(state: Pick<CurriculumState, "data" | "planId">): StudyPlan | undefined {
  return state.data.plans.find((p) => p.id === state.planId) ?? state.data.plans[0];
}

/** The plan, the term being viewed (explicit choice, else today's term) and that term's view; null when the curriculum has no plans. */
export function currentTermView(state: CurriculumState, term: string) {
  const plan = studyPlanOf(state);
  if (!plan) return null;
  const at = state.viewTerm ?? termPosition(state.cohort, term);
  return { plan, at, view: termView(plan, at, state) };
}

export type Progress = Record<"required" | SlotKind, { done: number; total: number }> & { all: { done: number; total: number } };

export function progress(plan: StudyPlan, state: Done): Progress {
  const out = { all: { done: 0, total: 0 }, required: { done: 0, total: 0 } } as Progress;
  for (const k of SLOT_KINDS) out[k] = { done: 0, total: 0 };
  const passed = new Map(state.passed.map((p) => [p.courseNo, p.credits])); // a course counts once
  for (const term of plan.terms) {
    term.items.forEach((item, index) => {
      if (item.type === "course") {
        out.required.total += item.credits;
        if (passed.has(item.courseNo)) out.required.done += item.credits;
      } else {
        out[item.kind].total += item.credits;
        out[item.kind].done += doneCredits(slotId(plan, term, index), item, state);
      }
    });
  }
  for (const k of ["required", ...SLOT_KINDS] as const) {
    out.all.done += out[k].done;
    out.all.total += out[k].total;
  }
  return out;
}

export type RankedCourse = ElectiveCourse & { offered: boolean; fits: boolean };

/** Not-yet-passed candidates: those with a section that fits the placed timetable first, then offered ones, then the rest; ties by courseNo. */
export function rankElectives(candidates: ElectiveCourse[], passedNos: ReadonlySet<string>, pool: Section[], placed: Section[]): RankedCourse[] {
  const rank = (c: RankedCourse) => (c.fits ? 0 : c.offered ? 1 : 2);
  return candidates
    .filter((c) => !passedNos.has(c.courseNo))
    .map((c) => {
      const secs = pool.filter((s) => s.courseNo === c.courseNo);
      const fits = secs.some((s) => !findConflicts([...placed, s]).some((x) => x.a === s.id || x.b === s.id));
      return { ...c, offered: secs.length > 0, fits };
    })
    .sort((a, b) => rank(a) - rank(b) || a.courseNo.localeCompare(b.courseNo));
}

export type MinorGroupProgress = MinorGroup & { done: string[]; left: string[] };

export function minorProgress(minor: Minor, passedNos: ReadonlySet<string>): MinorGroupProgress[] {
  return minor.groups.map((g) => ({
    ...g,
    done: g.courseNos.filter((n) => passedNos.has(n)),
    left: g.courseNos.filter((n) => !passedNos.has(n)),
  }));
}

export function passedNos(state: Pick<CurriculumState, "passed">): Set<string> {
  return new Set(state.passed.map((p) => p.courseNo));
}
