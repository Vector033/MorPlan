export const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;
export type Day = (typeof DAYS)[number];

/** Minutes since midnight, e.g. 08:30 → 510. */
export type Minutes = number;

export type Meeting = {
  days: Day[];
  start: Minutes;
  end: Minutes;
  room?: string;
  kind?: "lec" | "lab";
};

export type ExamSlot = { date: string; start: Minutes; end: Minutes };

export type Section = {
  /** `${courseNo}-${lec}-${lab}`; unique within a term. */
  id: string;
  courseNo: string;
  title: string;
  credits?: number;
  lec: string;
  lab: string;
  meetings: Meeting[];
  instructors: string[];
  seats?: number;
  midterm?: ExamSlot;
  final?: ExamSlot;
  note?: string;
};

/** `courseNos` are the courses the student wants this term; `sectionIds` the ones placed on the calendar. */
export type Plan = { id: string; name: string; courseNos: string[]; sectionIds: string[] };

export type Workspace = {
  version: 1;
  term: string;
  /** Unset means มช.: exam dates and the regulations assistant only cover CMU. */
  university?: string;
  pool: Section[];
  plans: Plan[];
  activePlanId: string;
};

export type Conflict =
  | { kind: "time"; a: string; b: string; day: Day; start: Minutes; end: Minutes }
  | { kind: "midterm" | "final"; a: string; b: string; date: string; start: Minutes; end: Minutes }
  | { kind: "duplicate"; a: string; b: string; courseNo: string };

export function sectionId(courseNo: string, lec: string, lab: string): string {
  return `${courseNo}-${lec}-${lab}`;
}
