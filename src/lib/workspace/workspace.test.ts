import { describe, expect, it } from "vitest";
import { demoSections } from "@/lib/demo";
import { activePlan, emptyWorkspace, MAX_PLANS, planSections, workspaceReducer, type Action } from "./reducer";
import { loadWorkspace, saveWorkspace, STORAGE_KEY } from "./storage";

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
