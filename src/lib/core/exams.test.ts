import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { attachExams, parseExamTimetable, parseTerm } from "./exams";
import type { Section } from "./types";

const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

describe("parseTerm", () => {
  it("builds reg's term code", () => expect(parseTerm("2/2569")).toEqual({ semester: 2, beYear: 2569, code: "269" }));
  it("rejects junk", () => expect(() => parseTerm("2569")).toThrow());
});

describe("parseExamTimetable", () => {
  const midterm = parseExamTimetable(fixture("exam-MIDTERM-269.html"), "2/2569");

  it("maps course numbers to the date and slot of their row and column", () => {
    // From the real 2/2569 page: JAN 18, first column (0800-1100).
    expect(midterm["001101"]).toEqual({ date: "2027-01-18", start: 480, end: 660 });
    // JAN 23, third column (1530-1830).
    expect(midterm["204101"]).toEqual({ date: "2027-01-23", start: 930, end: 1110 });
    // JAN 19, second column (1200-1500).
    expect(midterm["019106"]).toEqual({ date: "2027-01-19", start: 720, end: 900 });
  });

  it("reads every listed course", () => {
    expect(Object.keys(midterm).length).toBeGreaterThan(100);
  });

  it("puts June–December dates in the first Gregorian year of the academic year", () => {
    const html = `<table><tr><th>0800-1100</th></tr><tr><td>OCT  5</td><td>204111, </td></tr></table>`;
    expect(parseExamTimetable(html, "1/2569")["204111"]).toEqual({ date: "2026-10-05", start: 480, end: 660 });
  });

  it("throws when the page has no slot header", () => {
    expect(() => parseExamTimetable("<html>maintenance</html>", "2/2569")).toThrow();
  });
});

describe("attachExams", () => {
  const s: Section = { id: "204101-001-000", courseNo: "204101", title: "", lec: "001", lab: "000", meetings: [], instructors: [] };

  it("fills missing exam slots and keeps imported ones", () => {
    const exams = { midterm: { "204101": { date: "2027-01-23", start: 930, end: 1110 } }, final: {} };
    expect(attachExams([s], exams)[0].midterm).toEqual({ date: "2027-01-23", start: 930, end: 1110 });
    const own = { ...s, midterm: { date: "2027-01-01", start: 0, end: 60 } };
    expect(attachExams([own], exams)[0].midterm).toEqual(own.midterm);
  });
});
