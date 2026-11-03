import type { Conflict, ExamSlot, Section } from "./types";

/**
 * Every pairwise clash among the sections of one plan: overlapping class
 * meetings (per day), overlapping midterm or final slots, and the same course
 * placed twice. Intervals are half-open, so a class ending at 09:30 does not
 * clash with one starting at 09:30. Each pair is reported with a.id < b.id.
 */
export function findConflicts(sections: Section[]): Conflict[] {
  const sorted = [...sections].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  const out: Conflict[] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      if (a.id === b.id) continue;
      if (a.courseNo === b.courseNo) out.push({ kind: "duplicate", a: a.id, b: b.id, courseNo: a.courseNo });
      out.push(...timeClashes(a, b));
      for (const kind of ["midterm", "final"] as const) {
        const clash = examOverlap(a[kind], b[kind]);
        if (clash) out.push({ kind, a: a.id, b: b.id, ...clash });
      }
    }
  }
  return out;
}

function timeClashes(a: Section, b: Section): Conflict[] {
  const out: Conflict[] = [];
  for (const ma of a.meetings) {
    for (const mb of b.meetings) {
      const start = Math.max(ma.start, mb.start);
      const end = Math.min(ma.end, mb.end);
      if (start >= end) continue;
      for (const day of ma.days) {
        if (!mb.days.includes(day)) continue;
        // One report per day+window even if both sections have several matching meetings.
        if (!out.some((c) => c.kind === "time" && c.day === day && c.start === start && c.end === end)) {
          out.push({ kind: "time", a: a.id, b: b.id, day, start, end });
        }
      }
    }
  }
  return out;
}

function examOverlap(x?: ExamSlot, y?: ExamSlot): ExamSlot | null {
  if (!x || !y || x.date !== y.date) return null;
  const start = Math.max(x.start, y.start);
  const end = Math.min(x.end, y.end);
  return start < end ? { date: x.date, start, end } : null;
}

/** Section ids involved in at least one conflict. */
export function conflictedIds(conflicts: Conflict[]): Set<string> {
  const s = new Set<string>();
  for (const c of conflicts) {
    s.add(c.a);
    s.add(c.b);
  }
  return s;
}
