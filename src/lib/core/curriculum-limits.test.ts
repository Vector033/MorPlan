import { describe, expect, it } from "vitest";
import { emptyWorkspace, workspaceReducer } from "@/lib/workspace/reducer";
import { curriculumSchema, electiveCourseSchema, minorSchema, parseWorkspace } from "@/lib/workspace/storage";
import { checkCurriculum, checkElectives, checkMinors } from "./curriculum-extract";
import { LIMITS } from "./curriculum-limits";

const codes = (n: number, from = 100000) => Array.from({ length: n }, (_, i) => String(from + i));
const source = (list: string[]) => list.join("\n");
const meta = { university: "u".repeat(300), faculty: "f", major: "m", cohort: 67 };
const item = (courseNo: string) => ({ courseNo, title: "x".repeat(300), credits: 3, slot: null, note: null });

describe("check functions fit the storage limits", () => {
  it("checkCurriculum caps plans, terms and items, truncates text, and the result survives the workspace round trip", () => {
    const all = codes(25 * 30);
    const reply = {
      title: "t".repeat(300),
      cohortFrom: 640,
      cohortTo: 70.5,
      plans: Array.from({ length: 10 }, (_, p) => ({
        name: "แผน".repeat(150) + p,
        minCredits: 9999,
        terms: Array.from({ length: 25 }, (_, t) => ({ year: 1 + (t % 8), semester: 1 + (t % 3), items: all.slice(0, 25).map(item) })),
      })),
    };
    const { curriculum, dropped } = checkCurriculum(source(all), reply, meta);
    expect(curriculumSchema.safeParse(curriculum).success).toBe(true);
    expect(curriculum.plans).toHaveLength(LIMITS.plans);
    expect(curriculum.plans[0].terms).toHaveLength(LIMITS.terms);
    expect(curriculum.plans[0].terms[0].items).toHaveLength(LIMITS.items);
    expect(curriculum.cohortFrom).toBe(67);
    expect(dropped.join("\n")).toMatch(/แผนการศึกษา.*10 > 8/);
    expect(dropped.join("\n")).toMatch(/ภาคเรียน.*25 > 20/);
    expect(dropped.join("\n")).toMatch(/รายการ.*25 > 20/);

    const state = { data: curriculum, source: { title: "s", readAt: "2026-11-15", provenance: "link" as const }, cohort: 67, planId: curriculum.plans[0].id, passed: [], doneSlots: [] };
    const ws = workspaceReducer(emptyWorkspace(), { type: "setCurriculum", curriculum: state });
    expect(parseWorkspace(JSON.parse(JSON.stringify(ws)))).not.toBeNull();
  });

  it("checkElectives caps at the storage limit", () => {
    const all = codes(450);
    const { courses, dropped } = checkElectives(source(all), { courses: all.map((c) => ({ courseNo: c, title: "x".repeat(300), credits: 3 })) });
    expect(courses).toHaveLength(LIMITS.electives);
    expect(courses.every((c) => electiveCourseSchema.safeParse(c).success)).toBe(true);
    expect(dropped.join("\n")).toMatch(/วิชาเลือก.*450 > 400/);
  });

  it("checkMinors caps groups and truncates text", () => {
    const all = codes(15);
    const minor = {
      name: "ก".repeat(300),
      faculty: null,
      rules: "r".repeat(5000),
      groups: all.map((c, i) => ({ label: `กลุ่ม ${i}`, minCredits: 99, courses: [{ prefix: c.slice(0, 3), numbers: [c.slice(3)] }] })),
    };
    const { minors, dropped } = checkMinors(source(all), { minors: [minor] });
    expect(minors[0].groups).toHaveLength(LIMITS.groups);
    expect(minorSchema.safeParse(minors[0]).success).toBe(true);
    expect(dropped.join("\n")).toContain("ตัดกลุ่มวิชาโทเกิน 12 กลุ่ม");
  });
});
