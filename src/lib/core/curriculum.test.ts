import { describe, expect, it } from "vitest";
import { covers, minorProgress, normalizeKey, passedNos, progress, rankElectives, termPosition, termView } from "./curriculum";
import { COOP } from "./__fixtures__/coop-plan";
import type { Section } from "./types";

describe("normalizeKey", () => {
  it("drops prefixes, spaces and case", () => {
    expect(normalizeKey(" คณะวิทยาศาสตร์ ")).toBe(normalizeKey("วิทยาศาสตร์"));
    expect(normalizeKey("สาขาวิชาวิทยาการคอมพิวเตอร์")).toBe(normalizeKey("วิทยาการ คอมพิวเตอร์"));
    expect(normalizeKey("Computer  Science")).toBe("computerscience");
    expect(normalizeKey("มหาวิทยาลัยเชียงใหม่")).not.toBe(normalizeKey("มหาวิทยาลัยขอนแก่น"));
  });
});
describe("covers", () => {
  it("handles open and closed ranges", () => {
    expect(covers({ cohortFrom: 64 }, 67)).toBe(true);
    expect(covers({ cohortFrom: 64 }, 63)).toBe(false);
    expect(covers({ cohortFrom: 59, cohortTo: 62 }, 62)).toBe(true);
    expect(covers({ cohortFrom: 59, cohortTo: 62 }, 63)).toBe(false);
  });
});
describe("termPosition", () => {
  it("maps cohort and term to year and semester", () => {
    expect(termPosition(67, "2/2569")).toEqual({ year: 3, semester: 2 });
    expect(termPosition(67, "1/2567")).toEqual({ year: 1, semester: 1 });
    expect(termPosition(69, "3/2569")).toEqual({ year: 1, semester: 3 });
    expect(termPosition(70, "2/2569")).toEqual({ year: 0, semester: 2 }); // before entry: still a value, no throw
  });
});
describe("termView", () => {
  const none = { passed: [], doneSlots: [] };
  it("shows year 3 semester 2 of the co-op plan", () => {
    const v = termView(COOP, { year: 3, semester: 2 }, none);
    expect(v.inPlan).toBe(true);
    expect(v.credits).toBe(19);
    expect(v.required.map((c) => c.courseNo)).toEqual(["204306", "204315", "204490"]);
    expect(v.slots.map((s) => [s.kind, s.credits, s.doneCredits])).toEqual([["major-elective", 3, 0], ["minor", 6, 0], ["free", 3, 0]]);
    expect(v.slots[0].id).toBe("coop:3-2-3");
  });
  it("lists earlier required courses not passed as overdue", () => {
    const passed = ["204321", "204341", "204361"].map((courseNo) => ({ courseNo, credits: 3 }));
    expect(termView(COOP, { year: 3, semester: 2 }, { passed, doneSlots: [] }).overdue.map((c) => c.courseNo)).toEqual(["204451"]);
  });
  it("marks passed courses and slot credits", () => {
    const v = termView(COOP, { year: 3, semester: 2 }, { passed: [{ courseNo: "204315", credits: 3 }, { courseNo: "208263", credits: 3, slotId: "coop:3-2-4" }], doneSlots: ["coop:3-2-5"] });
    expect(v.required.find((c) => c.courseNo === "204315")!.done).toBe(true);
    expect(v.slots.map((s) => s.doneCredits)).toEqual([0, 3, 3]);
  });
  it("returns an empty view for a term outside the plan", () => {
    for (const at of [{ year: 0, semester: 2 }, { year: 5, semester: 1 }, { year: 3, semester: 3 }]) {
      const v = termView(COOP, at, none);
      expect(v).toMatchObject({ inPlan: false, credits: 0, required: [], slots: [] });
    }
  });
});
describe("progress", () => {
  it("sums credits by kind and counts a course once", () => {
    const state = { passed: [{ courseNo: "204321", credits: 3 }, { courseNo: "204321", credits: 3 }, { courseNo: "204311", credits: 3, slotId: "coop:3-2-3" }], doneSlots: ["coop:3-1-4"] };
    const p = progress(COOP, state);
    expect(p.required).toEqual({ done: 3, total: 26 });
    expect(p["major-elective"]).toEqual({ done: 3, total: 3 });
    expect(p.ge).toEqual({ done: 3, total: 3 });
    expect(p.minor).toEqual({ done: 0, total: 9 });
    expect(p.all).toEqual({ done: 9, total: 44 });
  });
  it("caps a slot at its own credits", () => {
    const state = { passed: [{ courseNo: "A1", credits: 3, slotId: "coop:3-2-3" }, { courseNo: "A2", credits: 3, slotId: "coop:3-2-3" }], doneSlots: [] };
    expect(progress(COOP, state)["major-elective"]).toEqual({ done: 3, total: 3 });
  });
  it("counts a course listed twice in one slot once", () => {
    const state = { passed: [{ courseNo: "A1", credits: 3, slotId: "coop:3-2-4" }, { courseNo: "A1", credits: 3, slotId: "coop:3-2-4" }], doneSlots: [] };
    expect(termView(COOP, { year: 3, semester: 2 }, state).slots[1].doneCredits).toBe(3);
    expect(progress(COOP, state).minor).toEqual({ done: 3, total: 9 });
  });
});
describe("rankElectives", () => {
  const sec = (courseNo: string, days: string[], start: number, end: number) =>
    ({ id: `${courseNo}-001-000`, courseNo, title: courseNo, lec: "001", lab: "000", meetings: [{ days, start, end }], instructors: [] }) as unknown as Section;
  const placed = [sec("204315", ["Mo"], 540, 630)];
  const pool = [...placed, sec("204311", ["Mo"], 540, 630), sec("204333", ["Tu"], 540, 630)];
  const candidates = [{ courseNo: "204311", title: "a" }, { courseNo: "204333", title: "b" }, { courseNo: "204362", title: "c" }, { courseNo: "204365", title: "d" }];
  it("puts courses that fit first, then offered, then unknown, and hides passed ones", () => {
    const r = rankElectives(candidates, new Set(["204365"]), pool, placed);
    expect(r.map((c) => [c.courseNo, c.offered, c.fits])).toEqual([["204333", true, true], ["204311", true, false], ["204362", false, false]]);
  });
  it("with an empty pool keeps list order by courseNo and marks nothing offered", () => {
    const r = rankElectives([...candidates].reverse(), new Set(), [], []);
    expect(r.every((c) => !c.offered && !c.fits)).toBe(true);
    expect(r.map((c) => c.courseNo)).toEqual(["204311", "204333", "204362", "204365"]);
  });
});
describe("minorProgress", () => {
  it("splits each group into done and left", () => {
    const minor = { name: "ภาษาญี่ปุ่น", rules: "…", groups: [{ label: "วิชาบังคับ", minCredits: 12, courseNos: ["018131", "018132", "018133", "018134"] }] };
    expect(minorProgress(minor, new Set(["018131", "018999"]))[0]).toMatchObject({ done: ["018131"], left: ["018132", "018133", "018134"] });
  });
});
describe("passedNos", () => {
  it("collects distinct course numbers", () => {
    expect([...passedNos({ passed: [{ courseNo: "A1", credits: 3 }, { courseNo: "A1", credits: 3 }, { courseNo: "B2", credits: 3 }] })]).toEqual(["A1", "B2"]);
  });
});
