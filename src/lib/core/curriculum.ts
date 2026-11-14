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
  const named = state.passed.filter((p) => p.slotId === id).reduce((n, p) => n + p.credits, 0);
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
