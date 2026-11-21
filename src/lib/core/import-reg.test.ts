import { describe, expect, it } from "vitest";
import { parseRegImport } from "./import-reg";

// reg's logged-in result layout is not public, so these fixtures are modelled on
// the old public searchcourse table (NO, COURSE NO, TITLE, LEC, LAB, CREDIT,
// DAY, TIME, ROOM, INSTRUCTOR, SEAT). A real saved page in samples/ should be
// added as a fixture once available.
const HTML = `
<html><body><table>
<tr><th>NO.</th><th>COURSE NO</th><th>TITLE</th><th>LEC</th><th>LAB</th><th>CREDIT</th><th>DAY</th><th>TIME</th><th>ROOM</th><th>INSTRUCTOR</th><th>SEAT</th></tr>
<tr><td>1</td><td>204111</td><td>FUND OF COMP SCIENCE</td><td>001</td><td>000</td><td>3</td><td>TuF</td><td>0800-0930</td><td>RB5210</td><td>ASST.PROF.DR. SOMCHAI JAIDEE<br>DR. MALEE SUKSAN</td><td>120</td></tr>
<tr><td>2</td><td>204111</td><td>FUND OF COMP SCIENCE</td><td>002</td><td>000</td><td>3</td><td>MTh</td><td>1300-1430</td><td>SCB1100</td><td>DR. MALEE SUKSAN</td><td>120</td></tr>
<tr><td>3</td><td>204112</td><td>COMP PROGRAMMING LAB</td><td>001</td><td>001</td><td>1</td><td>We</td><td>1300-1600</td><td>CSB201</td><td>DR. ANAN WONGSA</td><td>40</td></tr>
<tr><td>4</td><td>206111</td><td>CALCULUS 1</td><td>001</td><td>000</td><td>3</td><td>TBA</td><td>TBA</td><td>TBA</td><td>STAFF</td><td>200</td></tr>
</table></body></html>`;

// What a browser puts on the clipboard when the student selects that table:
// cells separated by tabs, <br> inside a cell becoming a new line.
const TSV = [
  "NO.\tCOURSE NO\tTITLE\tLEC\tLAB\tCREDIT\tDAY\tTIME\tROOM\tINSTRUCTOR\tSEAT",
  "1\t204111\tFUND OF COMP SCIENCE\t001\t000\t3\tTuF\t0800-0930\tRB5210\tASST.PROF.DR. SOMCHAI JAIDEE",
  "DR. MALEE SUKSAN\t120",
  "2\t204111\tFUND OF COMP SCIENCE\t002\t000\t3\tMTh\t1300-1430\tSCB1100\tDR. MALEE SUKSAN\t120",
  "3\t204112\tCOMP PROGRAMMING LAB\t001\t001\t1\tWe\t1300-1600\tCSB201\tDR. ANAN WONGSA\t40",
  "4\t206111\tCALCULUS 1\t001\t000\t3\tTBA\tTBA\tTBA\tSTAFF\t200",
].join("\n");

describe("parseRegImport", () => {
  it("reads sections from a saved HTML page", () => {
    const { sections, warnings } = parseRegImport(HTML);
    expect(warnings).toEqual([]);
    expect(sections.map((s) => s.id)).toEqual(["204111-001-000", "204111-002-000", "204112-001-001", "206111-001-000"]);
    expect(sections[0]).toMatchObject({
      courseNo: "204111",
      title: "FUND OF COMP SCIENCE",
      credits: 3,
      meetings: [{ days: ["Tu", "Fr"], start: 480, end: 570, room: "RB5210" }],
      instructors: ["ASST.PROF.DR. SOMCHAI JAIDEE", "DR. MALEE SUKSAN"],
    });
    expect(sections[3]).toMatchObject({ meetings: [], note: "TBA" });
  });

  it("reads the same sections from copied text with wrapped cells", () => {
    const fromHtml = parseRegImport(HTML).sections;
    const { sections, warnings } = parseRegImport(TSV);
    expect(warnings).toEqual([]);
    expect(sections).toEqual(fromHtml);
  });

  it("handles a course header followed by section-only rows", () => {
    const text = [
      "204211  OBJECT-ORIENTED PROGRAMMING  3",
      "001  000  MTh  0930-1100  RB5205  DR. ANAN WONGSA",
      "002  000  TuF  1100-1230  RB5205  DR. MALEE SUKSAN",
    ].join("\n");
    const { sections, warnings } = parseRegImport(text);
    expect(warnings).toEqual([]);
    expect(sections.map((s) => [s.id, s.title, s.meetings[0].days])).toEqual([
      ["204211-001-000", "OBJECT-ORIENTED PROGRAMMING", ["Mo", "Th"]],
      ["204211-002-000", "OBJECT-ORIENTED PROGRAMMING", ["Tu", "Fr"]],
    ]);
  });

  it("joins a lab meeting listed on its own line to the section", () => {
    const text = [
      "1\t204252\tDATA STRUCTURES\t001\t001\t3\tTuF\t0930-1100\tRB5210\tDR. A",
      "\t\t\t\t\t\tWe\t1300-1600\tCSB201",
    ].join("\n");
    const [s] = parseRegImport(text).sections;
    expect(s.meetings).toEqual([
      { days: ["Tu", "Fr"], start: 570, end: 660, room: "RB5210", kind: "lec" },
      { days: ["We"], start: 780, end: 960, room: "CSB201", kind: "lab" },
    ]);
  });

  it("tolerates repeated spaces and Windows line endings", () => {
    const { sections } = parseRegImport("1   204111   FUND OF COMP SCIENCE   001   000   3   TuF   08:00 - 09:30   RB5210   DR. A\r\n");
    expect(sections[0].meetings[0]).toMatchObject({ days: ["Tu", "Fr"], start: 480, end: 570 });
  });

  it("warns instead of dropping rows it cannot read", () => {
    const { sections, warnings } = parseRegImport("1\t204111\tFUND OF COMP SCIENCE\t001\t000\t3\tXyz\tsoon\n");
    expect(sections).toEqual([]);
    expect(warnings[0]).toContain("204111");
  });

  it("leaves the title empty instead of using the day code or room", () => {
    const { sections, warnings } = parseRegImport(
      "204490  001  000  3  MTh  0930-1100\n204306\t001\t000\t3\tTh\t0830-0930\tRB5210\n",
    );
    expect(warnings).toEqual([]);
    expect(sections.map((s) => s.title)).toEqual(["", ""]);
    expect(sections[0].meetings[0]).toMatchObject({ days: ["Mo", "Th"], start: 570, end: 660 });
  });

  it("explains when nothing looks like a course list", () => {
    expect(parseRegImport("hello world").warnings).toEqual(["ไม่พบรหัสวิชาในข้อมูลที่วาง"]);
  });

  it("reads letters-and-digits codes at the start of a row, never a room later in it", () => {
    const r = parseRegImport(["CS101  INTRO COMP PROG  001  000  3  TuF  0800-0930  A101", "002  000  3  MTh  0930-1100  RB5205"].join("\n"));
    expect(r.warnings).toEqual([]);
    expect(r.sections.map((s) => s.id)).toEqual(["CS101-001-000", "CS101-002-000"]);
    expect(r.sections[1].meetings[0].room).toBe("RB5205");
  });
});
