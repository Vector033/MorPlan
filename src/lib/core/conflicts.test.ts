import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { conflictedIds, findConflicts } from "./conflicts";
import { DAYS, type Day, type Section } from "./types";

function sec(id: string, meetings: [Day[], number, number][], extra: Partial<Section> = {}): Section {
  const [courseNo, lec = "001", lab = "000"] = id.split("-");
  return {
    id,
    courseNo,
    title: courseNo,
    lec,
    lab,
    instructors: [],
    meetings: meetings.map(([days, start, end]) => ({ days, start, end })),
    ...extra,
  };
}

describe("findConflicts", () => {
  it("reports overlapping meetings with the exact overlap window", () => {
    const a = sec("204111-001-000", [[["Tu", "Fr"], 480, 570]]);
    const b = sec("206111-001-000", [[["Fr"], 540, 630]]);
    expect(findConflicts([a, b])).toEqual([{ kind: "time", a: a.id, b: b.id, day: "Fr", start: 540, end: 570 }]);
  });

  it("does not report classes that only touch", () => {
    const a = sec("204111-001-000", [[["Mo"], 480, 570]]);
    const b = sec("206111-001-000", [[["Mo"], 570, 660]]);
    expect(findConflicts([a, b])).toEqual([]);
  });

  it("does not report the same time on different days", () => {
    const a = sec("204111-001-000", [[["Mo", "Th"], 480, 570]]);
    const b = sec("206111-001-000", [[["Tu", "Fr"], 480, 570]]);
    expect(findConflicts([a, b])).toEqual([]);
  });

  it("checks a section's lab meeting as well as its lecture", () => {
    const a = sec("204111-001-001", [
      [["Tu", "Fr"], 480, 570],
      [["We"], 780, 900],
    ]);
    const b = sec("206111-001-000", [[["We"], 840, 960]]);
    expect(findConflicts([a, b])).toEqual([{ kind: "time", a: a.id, b: b.id, day: "We", start: 840, end: 900 }]);
  });

  it("reports a clash on each shared day", () => {
    const a = sec("204111-001-000", [[["Tu", "Fr"], 480, 570]]);
    const b = sec("206111-001-000", [[["Tu", "Fr"], 480, 570]]);
    expect(findConflicts([a, b]).map((c) => c.kind === "time" && c.day)).toEqual(["Tu", "Fr"]);
  });

  it("reports midterm and final clashes only on the same date with overlapping time", () => {
    const a = sec("204111-001-000", [], {
      midterm: { date: "2027-01-18", start: 480, end: 660 },
      final: { date: "2027-03-20", start: 720, end: 900 },
    });
    const b = sec("206111-001-000", [], {
      midterm: { date: "2027-01-18", start: 600, end: 780 },
      final: { date: "2027-03-21", start: 720, end: 900 },
    });
    expect(findConflicts([a, b])).toEqual([
      { kind: "midterm", a: a.id, b: b.id, date: "2027-01-18", start: 600, end: 660 },
    ]);
  });

  it("flags the same course placed twice", () => {
    const a = sec("204111-001-000", [[["Mo"], 480, 570]]);
    const b = sec("204111-002-000", [[["We"], 480, 570]]);
    expect(findConflicts([a, b])).toEqual([{ kind: "duplicate", a: a.id, b: b.id, courseNo: "204111" }]);
  });

  it("ignores TBA sections and lists conflicted ids", () => {
    const tba = sec("204499-001-000", [[[], 0, 0]]);
    const a = sec("204111-001-000", [[["Mo"], 480, 570]]);
    const b = sec("206111-001-000", [[["Mo"], 500, 560]]);
    const conflicts = findConflicts([tba, a, b]);
    expect(conflicts).toHaveLength(1);
    expect([...conflictedIds(conflicts)].sort()).toEqual([a.id, b.id]);
  });

  describe("properties", () => {
    const meeting = fc
      .record({
        days: fc.subarray([...DAYS], { minLength: 1 }),
        start: fc.integer({ min: 7 * 60, max: 20 * 60 }),
        len: fc.integer({ min: 30, max: 240 }),
      })
      .map(({ days, start, len }) => [days as Day[], start, start + len] as [Day[], number, number]);
    const section = fc
      .record({
        course: fc.integer({ min: 100000, max: 100030 }),
        lec: fc.integer({ min: 1, max: 3 }),
        meetings: fc.array(meeting, { maxLength: 3 }),
      })
      .map(({ course, lec, meetings }) => sec(`${course}-00${lec}-000`, meetings));
    const unique = fc.uniqueArray(section, { selector: (s) => s.id, maxLength: 8 });
    const key = (cs: ReturnType<typeof findConflicts>) => cs.map((c) => JSON.stringify(c)).sort();

    it("never reports a section against itself and orders each pair", () => {
      fc.assert(
        fc.property(unique, (sections) => {
          for (const c of findConflicts(sections)) expect(c.a < c.b).toBe(true);
        }),
      );
    });

    it("does not depend on input order", () => {
      fc.assert(
        fc.property(unique, (sections) => {
          expect(key(findConflicts([...sections].reverse()))).toEqual(key(findConflicts(sections)));
        }),
      );
    });

    it("agrees with a brute-force minute-by-minute check", () => {
      fc.assert(
        fc.property(section, section, (a0, b0) => {
          const a = { ...a0, id: "A-001-000", courseNo: "A" };
          const b = { ...b0, id: "B-001-000", courseNo: "B" };
          let brute = false;
          for (const ma of a.meetings)
            for (const mb of b.meetings)
              for (const d of ma.days)
                if (mb.days.includes(d))
                  for (let t = ma.start; t < ma.end; t++) if (t >= mb.start && t < mb.end) brute = true;
          expect(findConflicts([a, b]).some((c) => c.kind === "time")).toBe(brute);
        }),
      );
    });
  });
});
