import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkCurriculum, checkElectives, checkMinors, chunks, codeInSource, CurriculumError, levelOf, studyPlanChunks } from "./curriculum-extract";

const PLAN = readFileSync(new URL("./__fixtures__/cs-cmu-64-plan.txt", import.meta.url), "utf8");
const MINORS = readFileSync(new URL("./__fixtures__/cmu-minors-2565.txt", import.meta.url), "utf8");
const meta = { university: "มหาวิทยาลัยเชียงใหม่", faculty: "วิทยาศาสตร์", major: "วิทยาการคอมพิวเตอร์", cohort: 67 };
const term = (items: unknown[]) => ({ title: "t", cohortFrom: 64, cohortTo: null, plans: [{ name: "แผนสหกิจศึกษา", minCredits: 135, terms: [{ year: 3, semester: 2, items }] }] });
const course = (courseNo: string) => ({ courseNo, title: "x", credits: 3, slot: null, note: null });

describe("codeInSource", () => {
  it("accepts loose spellings and rejects absent codes", () => {
    expect(codeInSource("CS 101 Intro", "CS101")).toBe(true);
    expect(codeInSource("รหัส ๒๐๔๓๑๕", "204315")).toBe(true);
    expect(codeInSource("JA (018) 131, 132, 133", "018132", "018", "132")).toBe(true);
    expect(codeInSource("JA (018) 131, 132, 133", "018999", "018", "999")).toBe(false);
    expect(codeInSource("204315", "204316")).toBe(false);
  });
  it("keeps the digit boundary and the paragraph limit", () => {
    expect(codeInSource("ENGL (001) 1230, 2305", "001230", "001", "230")).toBe(false);
    expect(codeInSource("ENGL (001) 230\n\n250", "001250", "001", "250")).toBe(false);
  });
});
describe("checkCurriculum", () => {
  it("keeps real courses and slots, drops an invented course", () => {
    const { curriculum, dropped } = checkCurriculum(PLAN, term([course("204315"), course("999999"), { courseNo: null, title: "วิชาโท", credits: 6, slot: "minor", note: null }]) as never, meta);
    expect(curriculum.plans[0].terms[0].items).toEqual([{ type: "course", courseNo: "204315", title: "x", credits: 3 }, { type: "slot", kind: "minor", credits: 6 }]);
    expect(dropped).toEqual([expect.stringContaining("999999")]);
    expect(curriculum).toMatchObject({ cohortFrom: 64, university: meta.university, plans: [{ id: "p1", minCredits: 135 }] });
  });
  it("throws when nothing usable is left", () => {
    expect(() => checkCurriculum(PLAN, term([course("999999")]) as never, meta)).toThrow(CurriculumError);
  });
  it("uses the student's cohort when the document states none", () => {
    const reply = { ...term([course("204315")]), cohortFrom: null };
    expect(checkCurriculum(PLAN, reply as never, meta).curriculum.cohortFrom).toBe(67);
  });
  it("keeps two slots of one kind separate and drops a row with neither code nor slot", () => {
    const slot = (credits: number, note: string) => ({ courseNo: null, title: "เอก", credits, slot: "major-elective", note });
    const bad = { courseNo: null, title: "?", credits: 3, slot: null, note: null };
    const { curriculum, dropped } = checkCurriculum(PLAN, term([slot(3, "300 or 400"), slot(6, "400"), bad]) as never, meta);
    expect(curriculum.plans[0].terms[0].items).toEqual([
      { type: "slot", kind: "major-elective", credits: 3, note: "300 or 400" },
      { type: "slot", kind: "major-elective", credits: 6, note: "400" },
    ]);
    expect(dropped).toHaveLength(1);
  });
});
describe("checkElectives", () => {
  it("keeps real courses with their level and drops invented ones", () => {
    const { courses, dropped } = checkElectives(PLAN, { courses: [{ courseNo: "204315", title: "a", credits: 3 }, { courseNo: "999999", title: "b", credits: null }] });
    expect(courses).toEqual([{ courseNo: "204315", title: "a", credits: 3, level: 300 }]);
    expect(dropped).toEqual([expect.stringContaining("999999")]);
  });
});
describe("checkMinors", () => {
  it("builds full codes from prefix and number and drops invented ones", () => {
    const reply = { minors: [{ name: "ภาษาญี่ปุ่น", faculty: "มนุษยศาสตร์", rules: "r", groups: [{ label: "วิชาบังคับ", minCredits: 12, courses: [{ prefix: "018", numbers: ["131", "132", "777"] }] }] }] };
    const { minors, dropped } = checkMinors(MINORS, reply);
    expect(minors[0].groups[0].courseNos).toEqual(["018131", "018132"]);
    expect(dropped).toHaveLength(1);
  });
});
describe("levelOf and chunking", () => {
  it("reads the level from the last three digits", () => {
    expect(levelOf("204311")).toBe(300);
    expect(levelOf("ITCS451")).toBe(400);
    expect(levelOf("AB")).toBeUndefined();
  });
  it("never cuts a line and keeps study-plan chunks only", () => {
    const text = ["ปรัชญาของหลักสูตร ".repeat(50), "ชั้นปีที่ 1 ภาคการศึกษาที่ 1\n204111 Programming 3", "ภาคผนวก ".repeat(50)].join("\n\n");
    expect(chunks(text, 400).join("")).toContain("204111 Programming 3");
    const kept = studyPlanChunks(text, 400, 5);
    expect(kept.some((c) => c.includes("204111"))).toBe(true);
    expect(kept.some((c) => c.includes("ภาคผนวก"))).toBe(false);
  });
  it("splits an oversize paragraph on line breaks only", () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line-${i}-xxxxxxxx`);
    const parts = chunks(lines.join("\n"), 50);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.flatMap((p) => p.split("\n")).sort()).toEqual(lines.slice().sort());
  });
});
