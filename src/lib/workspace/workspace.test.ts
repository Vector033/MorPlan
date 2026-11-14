import { describe, expect, it } from "vitest";
import { demoSections } from "@/lib/demo";
import { activePlan, emptyWorkspace, MAX_PLANS, planSections, workspaceReducer, type Action } from "./reducer";
import { STATE } from "@/lib/core/__fixtures__/coop-plan";
import { loadWorkspace, parseWorkspace, saveWorkspace, STORAGE_KEY } from "./storage";

const run = (...actions: Action[]) => actions.reduce(workspaceReducer, emptyWorkspace());
const seeded = () => run({ type: "import", sections: demoSections(null) });

describe("workspaceReducer", () => {
  it("keeps one section per course when placing", () => {
    const ws = workspaceReducer(
      workspaceReducer(seeded(), { type: "place", sectionId: "204101-001-000" }),
      { type: "place", sectionId: "204101-002-000" },
    );
    expect(activePlan(ws).sectionIds).toEqual(["204101-002-000"]);
    expect(activePlan(ws).courseNos).toEqual(["204101"]);
  });

  it("removing a wanted course also unplaces it", () => {
    let ws = workspaceReducer(seeded(), { type: "place", sectionId: "206111-001-000" });
    ws = workspaceReducer(ws, { type: "unwantCourse", courseNo: "206111" });
    expect(activePlan(ws)).toMatchObject({ courseNos: [], sectionIds: [] });
  });

  it("ignores courses and sections that are not in the pool", () => {
    const ws = seeded();
    expect(workspaceReducer(ws, { type: "wantCourse", courseNo: "999999" })).toBe(ws);
    expect(workspaceReducer(ws, { type: "place", sectionId: "999999-001-000" })).toBe(ws);
  });

  it("caps plans at five and copies the source plan", () => {
    let ws = workspaceReducer(seeded(), { type: "place", sectionId: "206111-001-000" });
    ws = workspaceReducer(ws, { type: "addPlan", copyFrom: "A" });
    expect(ws.activePlanId).toBe("B");
    expect(activePlan(ws).sectionIds).toEqual(["206111-001-000"]);
    for (let i = 0; i < 10; i++) ws = workspaceReducer(ws, { type: "addPlan" });
    expect(ws.plans).toHaveLength(MAX_PLANS);
  });

  it("deleting the active plan selects another and never deletes the last one", () => {
    let ws = run({ type: "addPlan" });
    ws = workspaceReducer(ws, { type: "deletePlan", id: "B" });
    expect(ws.activePlanId).toBe("A");
    expect(workspaceReducer(ws, { type: "deletePlan", id: "A" }).plans).toHaveLength(1);
  });

  it("re-importing replaces sections by id and removing a course cleans plans", () => {
    let ws = workspaceReducer(seeded(), { type: "place", sectionId: "204217-001-000" });
    const changed = { ...ws.pool.find((s) => s.id === "204217-001-000")!, title: "NEW" };
    ws = workspaceReducer(ws, { type: "import", sections: [changed] });
    expect(planSections(ws)[0].title).toBe("NEW");
    ws = workspaceReducer(ws, { type: "removeFromPool", courseNo: "204217" });
    expect(activePlan(ws)).toMatchObject({ courseNos: [], sectionIds: [] });
  });

  it("rejects empty plan names", () => {
    const ws = run({ type: "renamePlan", id: "A", name: "   " });
    expect(activePlan(ws).name).toBe("แผน A");
  });
});

describe("storage", () => {
  it("round-trips a workspace", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const ws = workspaceReducer(seeded(), { type: "place", sectionId: "204101-001-000" });
    saveWorkspace(ws, storage);
    expect(loadWorkspace(storage)).toEqual(ws);
  });

  it("falls back to an empty workspace on corrupt or foreign data", () => {
    const of = (v: string | null) => ({ getItem: () => v });
    expect(loadWorkspace(of("{not json"))).toEqual(emptyWorkspace());
    expect(loadWorkspace(of(JSON.stringify({ version: 2 })))).toEqual(emptyWorkspace());
    expect(loadWorkspace(of(null))).toEqual(emptyWorkspace());
    expect(loadWorkspace({ getItem: () => { throw new Error("SecurityError"); } })).toEqual(emptyWorkspace());
    expect(loadWorkspace(undefined)).toEqual(emptyWorkspace());
    expect(STORAGE_KEY).toMatch(/v1$/);
  });
});

describe("other universities", () => {
  const ku = { id: "01204111-1-000", courseNo: "01204111", title: "Computer Programming", lec: "1", lab: "000", meetings: [], instructors: [] };

  it("import sets, keeps and resets the university", () => {
    let ws = run({ type: "import", sections: [ku], university: "มหาวิทยาลัยเกษตรศาสตร์" });
    expect(ws.university).toBe("มหาวิทยาลัยเกษตรศาสตร์");
    ws = workspaceReducer(ws, { type: "import", sections: [] });
    expect(ws.university).toBe("มหาวิทยาลัยเกษตรศาสตร์");
    ws = workspaceReducer(ws, { type: "import", sections: [], university: null });
    expect(ws.university).toBeUndefined();
  });

  it("storage round-trips non-CMU codes and sections", () => {
    let saved = "";
    const ws = workspaceReducer(run({ type: "import", sections: [ku], university: "KU" }), { type: "place", sectionId: ku.id });
    saveWorkspace(ws, { setItem: (_k, v) => (saved = v) });
    expect(loadWorkspace({ getItem: () => saved })).toEqual(ws);
  });
});

describe("curriculum state", () => {
  it("parses a workspace saved before the curriculum feature, unchanged", () => {
    const old = emptyWorkspace();
    expect(parseWorkspace(JSON.parse(JSON.stringify(old)))).toEqual(old);
  });
  it("round-trips a workspace with curriculum state and rejects an oversized one", () => {
    const ws = workspaceReducer(emptyWorkspace(), { type: "setCurriculum", curriculum: STATE });
    expect(parseWorkspace(JSON.parse(JSON.stringify(ws)))).toEqual(ws);
    const big = { ...ws, curriculum: { ...STATE, passed: Array.from({ length: 401 }, (_, i) => ({ courseNo: `X${i}`, credits: 3 })) } };
    expect(parseWorkspace(big)).toBeNull();
  });
  it("togglePassed adds then removes a course", () => {
    let ws = workspaceReducer(emptyWorkspace(), { type: "setCurriculum", curriculum: STATE });
    ws = workspaceReducer(ws, { type: "togglePassed", courseNo: "204315", credits: 3 });
    expect(ws.curriculum!.passed).toEqual([{ courseNo: "204315", credits: 3 }]);
    ws = workspaceReducer(ws, { type: "togglePassed", courseNo: "204315", credits: 3 });
    expect(ws.curriculum!.passed).toEqual([]);
  });
  it("naming a course that is required in the plan records it as required, not against the slot", () => {
    let ws = workspaceReducer(emptyWorkspace(), { type: "setCurriculum", curriculum: STATE });
    ws = workspaceReducer(ws, { type: "nameSlotCourse", slotId: "coop:3-2-3", courseNo: "204490", credits: 3 });
    expect(ws.curriculum!.passed).toEqual([{ courseNo: "204490", credits: 3 }]);
    ws = workspaceReducer(ws, { type: "nameSlotCourse", slotId: "coop:3-2-3", courseNo: "204311", credits: 3 });
    ws = workspaceReducer(ws, { type: "nameSlotCourse", slotId: "coop:3-2-3", courseNo: "204311", credits: 3 });
    expect(ws.curriculum!.passed.filter((p) => p.courseNo === "204311")).toHaveLength(1);
    expect(ws.curriculum!.passed.find((p) => p.courseNo === "204311")!.slotId).toBe("coop:3-2-3");
    ws = workspaceReducer(ws, { type: "removeNamed", courseNo: "204311" });
    expect(ws.curriculum!.passed.some((p) => p.courseNo === "204311")).toBe(false);
  });
  it("tickTerm marks every required course passed and every slot done, and is idempotent", () => {
    let ws = workspaceReducer(emptyWorkspace(), { type: "setCurriculum", curriculum: STATE });
    ws = workspaceReducer(ws, { type: "tickTerm", year: 3, semester: 2 });
    ws = workspaceReducer(ws, { type: "tickTerm", year: 3, semester: 2 });
    expect(ws.curriculum!.passed.map((p) => p.courseNo).sort()).toEqual(["204306", "204315", "204490"]);
    expect(ws.curriculum!.doneSlots.sort()).toEqual(["coop:3-2-3", "coop:3-2-4", "coop:3-2-5"]);
  });
  it("wantCourses adds codes that are not in the pool, once each", () => {
    const ws = workspaceReducer(emptyWorkspace(), { type: "wantCourses", courseNos: ["204306", "204315", "204306"] });
    expect(activePlan(ws).courseNos).toEqual(["204306", "204315"]);
  });
  it("refreshCurriculum swaps the data and keeps progress; addElectives merges by code", () => {
    let ws = workspaceReducer(emptyWorkspace(), { type: "setCurriculum", curriculum: STATE });
    ws = workspaceReducer(ws, { type: "togglePassed", courseNo: "204315", credits: 3 });
    ws = workspaceReducer(ws, { type: "refreshCurriculum", data: { ...STATE.data, title: "ใหม่" }, source: { ...STATE.source, readAt: "2026-12-01" } });
    expect(ws.curriculum).toMatchObject({ data: { title: "ใหม่" }, planId: "coop", passed: [{ courseNo: "204315", credits: 3 }] });
    ws = workspaceReducer(ws, { type: "addElectives", kind: "major-elective", courses: [{ courseNo: "204311", title: "a" }] });
    ws = workspaceReducer(ws, { type: "addElectives", kind: "major-elective", courses: [{ courseNo: "204311", title: "a" }, { courseNo: "204333", title: "b" }] });
    expect(ws.curriculum!.data.electives["major-elective"]!.map((c) => c.courseNo)).toEqual(["204311", "204333"]);
  });
  it("setStudyPlan clears slot progress, ignores unknown ids; setMinor and clearCurriculum work", () => {
    const two = { ...STATE, data: { ...STATE.data, plans: [...STATE.data.plans, { ...STATE.data.plans[0], id: "std" }] } };
    let ws = workspaceReducer(emptyWorkspace(), { type: "setCurriculum", curriculum: two });
    ws = workspaceReducer(ws, { type: "tickTerm", year: 3, semester: 2 });
    ws = workspaceReducer(ws, { type: "nameSlotCourse", slotId: "coop:3-2-3", courseNo: "204311", credits: 3 });
    expect(workspaceReducer(ws, { type: "setStudyPlan", planId: "nope" })).toBe(ws);
    ws = workspaceReducer(ws, { type: "setStudyPlan", planId: "std" });
    expect(ws.curriculum).toMatchObject({ planId: "std", doneSlots: [] });
    expect(ws.curriculum!.passed.find((p) => p.courseNo === "204311")).toEqual({ courseNo: "204311", credits: 3 });
    const minor = { name: "m", rules: "r", groups: [] };
    ws = workspaceReducer(ws, { type: "setMinor", minor, source: STATE.source });
    expect(ws.curriculum).toMatchObject({ minor, minorSource: STATE.source });
    ws = workspaceReducer(ws, { type: "setMinor", minor: null });
    expect(ws.curriculum!.minor).toBeUndefined();
    expect(workspaceReducer(ws, { type: "clearCurriculum" }).curriculum).toBeUndefined();
  });
  it("curriculum actions are no-ops when no curriculum is set", () => {
    const ws = emptyWorkspace();
    expect(workspaceReducer(ws, { type: "togglePassed", courseNo: "204315", credits: 3 })).toBe(ws);
  });
});
