import {
  slotId,
  type Curriculum,
  type CurriculumState,
  type ElectiveCourse,
  type Minor,
  type SlotKind,
  type Source,
} from "@/lib/core/curriculum";
import type { Plan, Section, Workspace } from "@/lib/core/types";

export const MAX_PLANS = 5;
/** Bounds of a view position; the workspace schema uses the same ones. */
export const VIEW_YEAR_MAX = 20;
export const VIEW_SEMESTER_MAX = 9;
export const PLAN_NAMES = ["A", "B", "C", "D", "E"];

export type Action =
  /** `university`: a name sets it, null resets to มช., absent leaves it as is. */
  | { type: "import"; sections: Section[]; university?: string | null }
  | { type: "removeFromPool"; courseNo: string }
  | { type: "wantCourse"; courseNo: string }
  | { type: "unwantCourse"; courseNo: string }
  | { type: "place"; sectionId: string }
  | { type: "unplace"; courseNo: string }
  | { type: "addPlan"; copyFrom?: string }
  | { type: "renamePlan"; id: string; name: string }
  | { type: "deletePlan"; id: string }
  | { type: "setActive"; id: string }
  | { type: "replace"; workspace: Workspace }
  | { type: "setCurriculum"; curriculum: CurriculumState }
  | { type: "clearCurriculum" }
  | { type: "setStudyPlan"; planId: string }
  | { type: "setViewTerm"; year: number; semester: number }
  | { type: "togglePassed"; courseNo: string; credits: number }
  | { type: "toggleSlot"; slotId: string }
  | { type: "nameSlotCourse"; slotId: string; courseNo: string; credits: number }
  | { type: "removeNamed"; courseNo: string }
  | { type: "tickTerm"; year: number; semester: number }
  | { type: "setMinor"; minor: Minor | null; source?: Source }
  | { type: "addElectives"; kind: SlotKind; courses: ElectiveCourse[] }
  /** A new copy of the same curriculum: keeps progress and minor; keeps planId if it still exists, else the first plan. */
  | { type: "refreshCurriculum"; data: Curriculum; source: Source; ref?: string }
  | { type: "wantCourses"; courseNos: string[] };

export function emptyWorkspace(term = "2/2569"): Workspace {
  return { version: 1, term, pool: [], plans: [newPlan("A")], activePlanId: "A" };
}

function newPlan(id: string, from?: Plan): Plan {
  return { id, name: `แผน ${id}`, courseNos: [...(from?.courseNos ?? [])], sectionIds: [...(from?.sectionIds ?? [])] };
}

export function activePlan(ws: Workspace): Plan {
  return ws.plans.find((p) => p.id === ws.activePlanId) ?? ws.plans[0];
}

function updateActive(ws: Workspace, f: (p: Plan) => Plan): Workspace {
  const active = activePlan(ws);
  return { ...ws, plans: ws.plans.map((p) => (p.id === active.id ? f(p) : p)) };
}

/**
 * All workspace changes. Invariants: at least one plan, at most MAX_PLANS;
 * a plan holds at most one section per course, and every placed section's
 * course is in the plan's wanted list.
 */
export function workspaceReducer(ws: Workspace, action: Action): Workspace {
  switch (action.type) {
    case "import": {
      const byId = new Map(ws.pool.map((s) => [s.id, s]));
      for (const s of action.sections) byId.set(s.id, s);
      const next = { ...ws, pool: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)) };
      if (action.university === null) delete next.university;
      else if (action.university) next.university = action.university;
      return next;
    }
    case "removeFromPool": {
      const pool = ws.pool.filter((s) => s.courseNo !== action.courseNo);
      const plans = ws.plans.map((p) => ({
        ...p,
        courseNos: p.courseNos.filter((c) => c !== action.courseNo),
        sectionIds: p.sectionIds.filter((id) => pool.some((s) => s.id === id)),
      }));
      return { ...ws, pool, plans };
    }
    case "wantCourse":
      if (!ws.pool.some((s) => s.courseNo === action.courseNo)) return ws;
      return updateActive(ws, (p) =>
        p.courseNos.includes(action.courseNo) ? p : { ...p, courseNos: [...p.courseNos, action.courseNo] },
      );
    case "unwantCourse":
      return updateActive(ws, (p) => ({
        ...p,
        courseNos: p.courseNos.filter((c) => c !== action.courseNo),
        sectionIds: p.sectionIds.filter((id) => courseOf(ws, id) !== action.courseNo),
      }));
    case "place": {
      const section = ws.pool.find((s) => s.id === action.sectionId);
      if (!section) return ws;
      return updateActive(ws, (p) => ({
        ...p,
        courseNos: p.courseNos.includes(section.courseNo) ? p.courseNos : [...p.courseNos, section.courseNo],
        sectionIds: [...p.sectionIds.filter((id) => courseOf(ws, id) !== section.courseNo), section.id],
      }));
    }
    case "unplace":
      return updateActive(ws, (p) => ({
        ...p,
        sectionIds: p.sectionIds.filter((id) => courseOf(ws, id) !== action.courseNo),
      }));
    case "addPlan": {
      if (ws.plans.length >= MAX_PLANS) return ws;
      const id = PLAN_NAMES.find((n) => !ws.plans.some((p) => p.id === n))!;
      const from = action.copyFrom ? ws.plans.find((p) => p.id === action.copyFrom) : undefined;
      const plans = [...ws.plans, newPlan(id, from)].sort((a, b) => a.id.localeCompare(b.id));
      return { ...ws, plans, activePlanId: id };
    }
    case "renamePlan": {
      const name = action.name.trim().slice(0, 30);
      if (!name) return ws;
      return { ...ws, plans: ws.plans.map((p) => (p.id === action.id ? { ...p, name } : p)) };
    }
    case "deletePlan": {
      if (ws.plans.length <= 1) return ws;
      const plans = ws.plans.filter((p) => p.id !== action.id);
      const activePlanId = ws.activePlanId === action.id ? plans[0].id : ws.activePlanId;
      return { ...ws, plans, activePlanId };
    }
    case "setActive":
      return ws.plans.some((p) => p.id === action.id) ? { ...ws, activePlanId: action.id } : ws;
    case "replace":
      return action.workspace;
    case "setCurriculum":
      return { ...ws, curriculum: action.curriculum };
    case "clearCurriculum": {
      const next = { ...ws };
      delete next.curriculum;
      return next;
    }
    case "wantCourses":
      return updateActive(ws, (p) => {
        const courseNos = [...p.courseNos];
        for (const c of action.courseNos) if (courseNos.length < 80 && !courseNos.includes(c)) courseNos.push(c);
        return { ...p, courseNos };
      });
    default:
      return ws.curriculum ? curriculumReducer(ws, ws.curriculum, action) : ws;
  }
}

function curriculumReducer(ws: Workspace, cur: CurriculumState, action: Action): Workspace {
  const set = (patch: Partial<CurriculumState>): Workspace => ({ ...ws, curriculum: { ...cur, ...patch } });
  const plan = cur.data.plans.find((p) => p.id === cur.planId) ?? cur.data.plans[0];
  const requiredNos = new Set(plan?.terms.flatMap((t) => t.items.flatMap((i) => (i.type === "course" ? [i.courseNo] : []))));
  const without = (courseNo: string) => cur.passed.filter((p) => p.courseNo !== courseNo);
  switch (action.type) {
    case "setStudyPlan":
      if (!cur.data.plans.some((p) => p.id === action.planId)) return ws;
      return set({ planId: action.planId, doneSlots: [], passed: cur.passed.map((p) => ({ courseNo: p.courseNo, credits: p.credits })) });
    case "setViewTerm": {
      const { year, semester } = action;
      if (!Number.isInteger(year) || year < 1 || year > VIEW_YEAR_MAX) return ws;
      if (!Number.isInteger(semester) || semester < 1 || semester > VIEW_SEMESTER_MAX) return ws;
      return set({ viewTerm: { year, semester } });
    }
    case "togglePassed":
      return set({
        passed: cur.passed.some((p) => p.courseNo === action.courseNo)
          ? without(action.courseNo)
          : [...cur.passed, { courseNo: action.courseNo, credits: action.credits }],
      });
    case "toggleSlot":
      return set({
        doneSlots: cur.doneSlots.includes(action.slotId)
          ? cur.doneSlots.filter((s) => s !== action.slotId)
          : [...cur.doneSlots, action.slotId],
      });
    case "nameSlotCourse": {
      const entry = requiredNos.has(action.courseNo)
        ? { courseNo: action.courseNo, credits: action.credits }
        : { courseNo: action.courseNo, credits: action.credits, slotId: action.slotId };
      return set({ passed: [...without(action.courseNo), entry] });
    }
    case "removeNamed":
      return set({ passed: without(action.courseNo) });
    case "tickTerm": {
      const term = plan?.terms.find((t) => t.year === action.year && t.semester === action.semester);
      if (!plan || !term) return ws;
      let passed = [...cur.passed];
      const doneSlots = [...cur.doneSlots];
      term.items.forEach((item, i) => {
        if (item.type === "course") {
          // Required in this term: counts as required even if it was named for a slot before.
          passed = passed.filter((p) => p.courseNo !== item.courseNo);
          passed.push({ courseNo: item.courseNo, credits: item.credits });
        } else if (!doneSlots.includes(slotId(plan, term, i))) doneSlots.push(slotId(plan, term, i));
      });
      return set({ passed, doneSlots });
    }
    case "setMinor": {
      const next = { ...cur };
      delete next.minor;
      delete next.minorSource;
      if (action.minor) next.minor = action.minor;
      if (action.minor && action.source) next.minorSource = action.source;
      return { ...ws, curriculum: next };
    }
    case "addElectives": {
      const byNo = new Map((cur.data.electives[action.kind] ?? []).map((c) => [c.courseNo, c]));
      for (const c of action.courses) byNo.set(c.courseNo, c);
      return set({ data: { ...cur.data, electives: { ...cur.data.electives, [action.kind]: [...byNo.values()] } } });
    }
    case "refreshCurriculum":
      if (action.ref !== undefined && action.ref !== cur.ref) return ws; // a late reply for a curriculum that is no longer the chosen one
      return set({
        data: action.data,
        source: action.source,
        planId: action.data.plans.some((p) => p.id === cur.planId) ? cur.planId : (action.data.plans[0]?.id ?? cur.planId),
      });
    default:
      return ws;
  }
}

function courseOf(ws: Workspace, sectionId: string): string | undefined {
  return ws.pool.find((s) => s.id === sectionId)?.courseNo ?? sectionId.split("-")[0];
}

export function planSections(ws: Workspace, plan: Plan = activePlan(ws)): Section[] {
  return plan.sectionIds.map((id) => ws.pool.find((s) => s.id === id)).filter((s): s is Section => !!s);
}

export function sectionsOfCourse(ws: Workspace, courseNo: string): Section[] {
  return ws.pool.filter((s) => s.courseNo === courseNo);
}
