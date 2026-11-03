import { describe, expect, it } from "vitest";
import { fmtTime, parseDays, parseTimeRange } from "./time";

describe("parseDays", () => {
  // Every pattern offered by reg's "search by time" form.
  const cases: Record<string, string[]> = {
    Su: ["Su"], Mo: ["Mo"], Tu: ["Tu"], We: ["We"], Th: ["Th"], Fr: ["Fr"], Sa: ["Sa"],
    MWF: ["Mo", "We", "Fr"],
    TT: ["Tu", "Th"],
    "M-F": ["Mo", "Tu", "We", "Th", "Fr"],
    "M-Sa": ["Mo", "Tu", "We", "Th", "Fr", "Sa"],
    "M-Su": ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
    MW: ["Mo", "We"], WF: ["We", "Fr"], MTu: ["Mo", "Tu"], TuW: ["Tu", "We"], WTh: ["We", "Th"],
    ThF: ["Th", "Fr"], MF: ["Mo", "Fr"], MTT: ["Mo", "Tu", "Th"], MTuW: ["Mo", "Tu", "We"],
    MWTh: ["Mo", "We", "Th"], MTuWF: ["Mo", "Tu", "We", "Fr"], "M-Th": ["Mo", "Tu", "We", "Th"],
    TuWTh: ["Tu", "We", "Th"], MTuThF: ["Mo", "Tu", "Th", "Fr"], TTF: ["Tu", "Th", "Fr"],
    MWThF: ["Mo", "We", "Th", "Fr"], TuF: ["Tu", "Fr"], FSa: ["Fr", "Sa"], "Tu-F": ["Tu", "We", "Th", "Fr"],
    WThF: ["We", "Th", "Fr"], MTh: ["Mo", "Th"], TuSa: ["Tu", "Sa"], TuWF: ["Tu", "We", "Fr"],
    SaSu: ["Sa", "Su"], MSu: ["Mo", "Su"], FSu: ["Fr", "Su"], MTuTh: ["Mo", "Tu", "Th"],
    TBA: [], "": [],
  };
  for (const [pattern, days] of Object.entries(cases)) {
    it(`${pattern || "(empty)"} -> ${days.join(",") || "none"}`, () => {
      expect(parseDays(pattern)).toEqual(days);
    });
  }

  it("ignores spaces", () => expect(parseDays(" Tu F ")).toEqual(["Tu", "Fr"]));
  it("rejects unknown codes", () => {
    expect(() => parseDays("Xy")).toThrow();
    expect(() => parseDays("T")).toThrow();
    expect(() => parseDays("F-M")).toThrow();
  });
});

describe("parseTimeRange", () => {
  it("parses reg format", () => expect(parseTimeRange("0800-0930")).toEqual({ start: 480, end: 570 }));
  it("parses colon and dot formats", () => {
    expect(parseTimeRange("08:00 - 09:30")).toEqual({ start: 480, end: 570 });
    expect(parseTimeRange("8.00-9.30")).toEqual({ start: 480, end: 570 });
  });
  it("rejects reversed or junk ranges", () => {
    expect(parseTimeRange("0930-0800")).toBeNull();
    expect(parseTimeRange("TBA")).toBeNull();
    expect(parseTimeRange("2300-2500")).toBeNull();
  });
  it("formats minutes", () => {
    expect(fmtTime(480)).toBe("08:00");
    expect(fmtTime(1110)).toBe("18:30");
  });
});
