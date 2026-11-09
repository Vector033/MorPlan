import type { Plan, Section, Workspace } from "@/lib/core/types";

export const MAX_PLANS = 5;
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
  | { type: "replace"; workspace: Workspace };

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
