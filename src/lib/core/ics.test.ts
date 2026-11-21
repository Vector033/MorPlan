import { describe, expect, it } from "vitest";
import { termDefaults, TERMS } from "@/lib/terms";
import { buildIcs, fold } from "./ics";
import type { Section } from "./types";

const section: Section = {
  id: "204101-001-000",
  courseNo: "204101",
  title: "INTRO COMP PROG",
  lec: "001",
  lab: "000",
  instructors: ["อ.ตัวอย่าง หนึ่ง"],
  meetings: [{ days: ["Tu", "Fr"], start: 480, end: 570, room: "RB5210" }],
  midterm: { date: "2027-01-23", start: 930, end: 1110 },
};

const ics = buildIcs([section], TERMS["2/2569"], { now: new Date("2026-11-04T00:00:00Z") });
const unfolded = ics.replace(/\r\n /g, "");

describe("buildIcs", () => {
  it("uses CRLF line endings and wraps in a VCALENDAR", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("starts the weekly series on the first matching class day", () => {
    // Term starts Monday 2026-11-16, so the first Tuesday is the 17th.
    expect(unfolded).toContain("DTSTART;TZID=Asia/Bangkok:20261117T080000");
    expect(unfolded).toContain("DTEND;TZID=Asia/Bangkok:20261117T093000");
    expect(unfolded).toContain("RRULE:FREQ=WEEKLY;BYDAY=TU,FR;UNTIL=20270314T235959");
  });

  it("skips classes in midterm weeks", () => {
    const ex = /EXDATE;TZID=Asia\/Bangkok:(.*)/.exec(unfolded)![1].split(",");
    expect(ex).toEqual([
      "20270112T080000", "20270115T080000", "20270119T080000", "20270122T080000",
    ]);
  });

  it("adds exam events and escapes text", () => {
    expect(unfolded).toContain("UID:204101-001-000-midterm@morplan");
    expect(unfolded).toContain("DTSTART;TZID=Asia/Bangkok:20270123T153000");
    expect(unfolded).toContain("LOCATION:RB5210");
    const withComma = buildIcs([{ ...section, title: "A, B; C" }], TERMS["2/2569"]);
    expect(withComma.replace(/\r\n /g, "")).toContain("SUMMARY:204101 A\\, B\\; C");
  });

  it("skips TBA meetings", () => {
    const tba = buildIcs([{ ...section, meetings: [{ days: [], start: 0, end: 0 }], midterm: undefined }], TERMS["2/2569"]);
    expect(tba).not.toContain("RRULE");
  });
});

describe("fold", () => {
  it("keeps every physical line within 75 octets without breaking Thai characters", () => {
    const line = "SUMMARY:" + "สอบกลางภาค".repeat(10);
    const folded = fold(line);
    for (const l of folded.split("\r\n")) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });
});

describe("termDefaults", () => {
  it("uses the known calendar only for its university, a typical Thai one otherwise", () => {
    expect(termDefaults("2/2569", "มช")).toBe(TERMS["2/2569"]);
    expect(termDefaults("2/2569", "มหาวิทยาลัยมหิดล")).toMatchObject({ start: "2026-11-23", end: "2027-03-19", noClass: [] });
    expect(termDefaults("1/2570")).toMatchObject({ start: "2027-08-03", end: "2027-11-27", label: "ภาคการศึกษาที่ 1/2570" });
    expect(termDefaults("3/2569")).toMatchObject({ start: "2027-04-05", label: "ภาคฤดูร้อน 2569" });
  });
});
