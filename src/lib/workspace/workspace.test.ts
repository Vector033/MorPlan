import { describe, expect, it } from "vitest";
import { demoSections } from "@/lib/demo";
import { activePlan, emptyWorkspace, MAX_PLANS, planSections, workspaceReducer, type Action } from "./reducer";
import { progress } from "@/lib/core/curriculum";
import { STATE } from "@/lib/core/__fixtures__/coop-plan";
import { loadWorkspace, parseWorkspace, saveWorkspace, storableJson, STORAGE_KEY } from "./storage";
import { COURSE_NO } from "@/lib/core/curriculum-limits";
import { key } from "@/lib/core/extract";
import { toMeta, type Row } from "@/lib/curriculum/rows";
import { sharedSource } from "@/components/curriculum/shared";
import type { Workspace } from "@/lib/core/types";

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
  it("refreshCurriculum ignores data for a different curriculum", () => {
    const ws = workspaceReducer(emptyWorkspace(), { type: "setCurriculum", curriculum: { ...STATE, ref: "abcdefghi1" } });
    const late = { type: "refreshCurriculum", ref: "zzzzzzzzz9", data: { ...STATE.data, title: "อื่น" }, source: STATE.source } as const;
    expect(workspaceReducer(ws, late)).toBe(ws);
    expect(workspaceReducer(ws, { ...late, ref: "abcdefghi1" }).curriculum!.data.title).toBe("อื่น");
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
  it("setViewTerm ignores positions outside the schema bounds, so the saved workspace stays valid", () => {
    const ws = workspaceReducer(emptyWorkspace(), { type: "setCurriculum", curriculum: STATE });
    for (const [year, semester] of [[0, 1], [-2, 1], [25, 1], [1, 0], [1.5, 1]])
      expect(workspaceReducer(ws, { type: "setViewTerm", year, semester })).toBe(ws);
    const ok = workspaceReducer(ws, { type: "setViewTerm", year: 4, semester: 2 });
    expect(ok.curriculum!.viewTerm).toEqual({ year: 4, semester: 2 });
    expect(parseWorkspace(JSON.parse(JSON.stringify(ok)))).toEqual(ok);
  });
  it("tickTerm turns a slot-attributed required course into a plain required one", () => {
    const start = { ...emptyWorkspace(), curriculum: { ...STATE, passed: [{ courseNo: "204321", credits: 3, slotId: "coop:3-2-3" }] } };
    const ws = workspaceReducer(start, { type: "tickTerm", year: 3, semester: 1 });
    expect(ws.curriculum!.passed.every((x) => x.slotId === undefined)).toBe(true);
    expect(ws.curriculum!.passed.find((x) => x.courseNo === "204321")).toEqual({ courseNo: "204321", credits: 3 });
    const p = progress(STATE.data.plans[0], ws.curriculum!);
    expect(p["major-elective"].done).toBe(0);
    expect(p.required.done).toBe(12);
  });
  it("togglePassed never stores a slotId", () => {
    let ws = workspaceReducer(emptyWorkspace(), { type: "setCurriculum", curriculum: STATE });
    ws = workspaceReducer(ws, { type: "togglePassed", courseNo: "204321", credits: 3 });
    expect(ws.curriculum!.passed).toEqual([{ courseNo: "204321", credits: 3 }]);
  });
});

describe("every curriculum action leaves a workspace that loads back", () => {
  const start = (over: Partial<typeof STATE> = {}) => workspaceReducer(emptyWorkspace(), { type: "setCurriculum", curriculum: { ...STATE, ...over } });
  const loadsBack = (ws: Workspace) => expect(parseWorkspace(JSON.parse(JSON.stringify(ws)))).not.toBeNull();
  const long = "ก".repeat(300);
  const codes = (n: number, from = 0) => Array.from({ length: n }, (_, i) => `X${from + i}`);

  it("nameSlotCourse ignores codes and credits storage would refuse; the form normalises typed codes", () => {
    const ws = start();
    for (const [courseNo, credits] of [["cs101", 3], ["CS-101", 3], ["ab", 3], ["204311", 99], ["204311", -1]] as const)
      expect(workspaceReducer(ws, { type: "nameSlotCourse", slotId: "coop:3-2-3", courseNo, credits })).toBe(ws);
    for (const typed of ["cs101", "CS-101", "ab"]) {
      const next = workspaceReducer(ws, { type: "nameSlotCourse", slotId: "coop:3-2-3", courseNo: key(typed), credits: 3 });
      expect(next.curriculum!.passed).toHaveLength(1);
      loadsBack(next);
    }
    expect(COURSE_NO.test(key("ก"))).toBe(false);
  });
  it("togglePassed and wantCourses ignore codes storage would refuse", () => {
    const ws = start();
    expect(workspaceReducer(ws, { type: "togglePassed", courseNo: "cs-101", credits: 3 })).toBe(ws);
    expect(workspaceReducer(ws, { type: "togglePassed", courseNo: "204311", credits: 31 })).toBe(ws);
    const want = workspaceReducer(ws, { type: "wantCourses", courseNos: ["cs101", "204311"] });
    expect(activePlan(want).courseNos).toEqual(["204311"]);
    loadsBack(want);
  });
  it("addElectives caps the merged list at the storage limit", () => {
    let ws = start();
    ws = workspaceReducer(ws, { type: "addElectives", kind: "major-elective", courses: codes(300).map((courseNo) => ({ courseNo, title: "a" })) });
    ws = workspaceReducer(ws, { type: "addElectives", kind: "major-elective", courses: codes(300, 300).map((courseNo) => ({ courseNo, title: "b" })) });
    expect(ws.curriculum!.data.electives["major-elective"]).toHaveLength(400);
    loadsBack(ws);
  });
  it("setMinor bounds an over-long source title", () => {
    const ws = workspaceReducer(start(), { type: "setMinor", minor: { name: "m", rules: "r", groups: [] }, source: { ...STATE.source, title: long } });
    expect(ws.curriculum!.minorSource!.title).toHaveLength(200);
    loadsBack(ws);
  });
  it("setCurriculum from a shared row with an over-long source title", () => {
    const row = { id: "abcdefghi1", kind: "curriculum", status: "shared", uniKey: "u", facultyKey: "f", majorKey: "m", university: "u", faculty: "f", major: "m", cohortFrom: 64, cohortTo: null, parentId: null, data: STATE.data, sourceUrl: null, sourceTitle: long, provenance: "link", createdAt: new Date(), readAt: new Date() } as Row;
    const source = sharedSource(toMeta(row, STATE.data));
    loadsBack(workspaceReducer(emptyWorkspace(), { type: "setCurriculum", curriculum: { ...STATE, ref: row.id, source } }));
    loadsBack(start({ source: { ...STATE.source, title: long, url: `https://x.ac.th/${"a".repeat(600)}` } }));
  });
  it("togglePassed, nameSlotCourse, toggleSlot and tickTerm stop at the caps", () => {
    const full = start({ passed: codes(400).map((courseNo) => ({ courseNo, credits: 3 })), doneSlots: codes(200) });
    expect(workspaceReducer(full, { type: "togglePassed", courseNo: "204311", credits: 3 })).toBe(full);
    expect(workspaceReducer(full, { type: "nameSlotCourse", slotId: "coop:3-2-3", courseNo: "204311", credits: 3 })).toBe(full);
    expect(workspaceReducer(full, { type: "toggleSlot", slotId: "coop:3-2-3" })).toBe(full);
    const ticked = workspaceReducer(full, { type: "tickTerm", year: 3, semester: 2 });
    expect(ticked.curriculum!.passed).toHaveLength(400);
    expect(ticked.curriculum!.doneSlots).toHaveLength(200);
    loadsBack(ticked);
    const near = start({ passed: codes(399).map((courseNo) => ({ courseNo, credits: 3 })), doneSlots: codes(199) });
    const some = workspaceReducer(near, { type: "tickTerm", year: 3, semester: 2 });
    expect(some.curriculum!.passed).toHaveLength(400);
    expect(some.curriculum!.doneSlots).toHaveLength(200);
    loadsBack(some);
  });
  it("setViewTerm round-trips", () => {
    loadsBack(workspaceReducer(start(), { type: "setViewTerm", year: 20, semester: 9 }));
  });
});

describe("save guard", () => {
  it("never writes a workspace that would load back as empty", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const good = workspaceReducer(emptyWorkspace(), { type: "setCurriculum", curriculum: STATE });
    expect(saveWorkspace(good, storage)).toBe(true);
    const bad = { ...good, curriculum: { ...STATE, passed: [{ courseNo: "cs-101", credits: 3 }] } };
    expect(storableJson(bad)).toBeNull();
    expect(saveWorkspace(bad, storage)).toBe(false);
    expect(loadWorkspace(storage)).toEqual(good);
    expect(storableJson(good)).toBe(JSON.stringify(good));
  });
});

describe("refreshCurriculum keeps the plan by name", () => {
  const plans = (...names: string[]) => names.map((name, i) => ({ ...STATE.data.plans[0], id: `p${i + 1}`, name }));
  const at = (ws: Workspace) => workspaceReducer(ws, { type: "nameSlotCourse", slotId: "p2:3-2-3", courseNo: "204311", credits: 3 });
  const base = () => {
    let ws = workspaceReducer(emptyWorkspace(), { type: "setCurriculum", curriculum: { ...STATE, planId: "p2", data: { ...STATE.data, plans: plans("แผนปกติ", "แผนสหกิจศึกษา") } } });
    ws = workspaceReducer(ws, { type: "tickTerm", year: 3, semester: 2 });
    return at(ws);
  };
  it("follows the plan to its new position and moves its slot progress along", () => {
    const ws = workspaceReducer(base(), { type: "refreshCurriculum", data: { ...STATE.data, plans: plans("แผนสหกิจศึกษา", "แผนปกติ") }, source: STATE.source });
    expect(ws.curriculum!.planId).toBe("p1");
    expect(ws.curriculum!.doneSlots.sort()).toEqual(["p1:3-2-3", "p1:3-2-4", "p1:3-2-5"]);
    expect(ws.curriculum!.passed.find((p) => p.courseNo === "204311")!.slotId).toBe("p1:3-2-3");
  });
  it("falls back to the first plan and clears slot progress when the name is gone", () => {
    const ws = workspaceReducer(base(), { type: "refreshCurriculum", data: { ...STATE.data, plans: plans("แผน ก", "แผน ข") }, source: STATE.source });
    expect(ws.curriculum!.planId).toBe("p1");
    expect(ws.curriculum!.doneSlots).toEqual([]);
    expect(ws.curriculum!.passed.every((p) => p.slotId === undefined)).toBe(true);
    expect(ws.curriculum!.passed.map((p) => p.courseNo)).toContain("204311");
  });
});
