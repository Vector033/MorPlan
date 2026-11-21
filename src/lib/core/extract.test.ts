import { describe, expect, it } from "vitest";
import { checkExtraction, redact, type Extracted } from "./extract";
import { pageText } from "./import-reg";

const PASTE = `รายวิชาที่เปิดสอน ภาค 2/2569
ITCS 101  Intro to Programming  3  Sec 1  จ พ 9.00-10.30  IT-201  Dr. Somchai
ITCS 101  Intro to Programming  3  Sec 2  อ พฤ 13:00-14:30  IT-305
01204111  Computer Programming  3  sec ๑  ศ ๐๘:๐๐-๑๑:๐๐  LH4-101`;

const row = (over: Partial<Extracted["sections"][number]>): Extracted["sections"][number] => ({
  courseNo: "ITCS 101",
  title: "Intro to Programming",
  credits: 3,
  section: "1",
  lab: null,
  meetings: [{ days: ["Mo", "We"], start: "09:00", end: "10:30", room: "IT-201" }],
  instructors: ["Dr. Somchai"],
  ...over,
});

describe("checkExtraction", () => {
  it("keeps rows whose code and times are in the paste, normalising codes", () => {
    const r = checkExtraction(PASTE, {
      sections: [
        row({}),
        row({ section: "2", meetings: [{ days: ["Tu", "Th"], start: "13:00", end: "14:30", room: "IT-305" }], instructors: [] }),
        row({ courseNo: "01204111", title: "Computer Programming", section: "1", meetings: [{ days: ["Fr"], start: "08:00", end: "11:00" }] }),
      ],
    });
    expect(r.warnings).toEqual([]);
    expect(r.sections.map((s) => s.id)).toEqual(["ITCS101-1-000", "ITCS101-2-000", "01204111-1-000"]);
    expect(r.sections[0].meetings[0]).toEqual({ days: ["Mo", "We"], start: 540, end: 630, room: "IT-201" });
  });

  it("keeps exam dates found in the paste and drops invented ones without dropping the section", () => {
    const paste = `${PASTE}
ITCS 101 Sec 1 สอบกลางภาค 12 ม.ค. 2570 09:00-12:00 สอบปลายภาค 16/03/2027 13.00-16.00`;
    const r = checkExtraction(paste, {
      sections: [
        row({
          midterm: { date: "2027-01-12", start: "09:00", end: "12:00" },
          final: { date: "2027-03-16", start: "13:00", end: "16:00" },
        }),
        row({ section: "2", meetings: [{ days: ["Tu", "Th"], start: "13:00", end: "14:30" }], midterm: { date: "2027-02-20", start: "09:00", end: "12:00" }, final: null }),
      ],
    });
    expect(r.sections[0].midterm).toEqual({ date: "2027-01-12", start: 540, end: 720 });
    expect(r.sections[0].final).toEqual({ date: "2027-03-16", start: 780, end: 960 });
    expect(r.sections[1].midterm).toBeUndefined();
    expect(r.sections).toHaveLength(2);
    expect(r.warnings).toEqual(["ITCS101 ตอน 2: ไม่พบวันสอบ 2027-02-20 09:00–12:00 ในข้อความที่วาง จึงไม่ใส่วันสอบนี้"]);
  });

  it("drops a course the model invented", () => {
    const r = checkExtraction(PASTE, { sections: [row({ courseNo: "MATH200" })] });
    expect(r.sections).toEqual([]);
    expect(r.warnings[0]).toMatch(/MATH200: ไม่พบรหัสวิชา/);
  });

  it("drops a section whose time is not in the paste", () => {
    const r = checkExtraction(PASTE, { sections: [row({ meetings: [{ days: ["Mo"], start: "15:00", end: "16:30" }] })] });
    expect(r.sections).toEqual([]);
    expect(r.warnings[0]).toMatch(/ไม่พบเวลา 15:00–16:30/);
  });

  it("rejects impossible times and unreadable codes", () => {
    const r = checkExtraction(PASTE, {
      sections: [row({ meetings: [{ days: ["Mo"], start: "10:30", end: "09:00" }] }), row({ courseNo: "!!" })],
    });
    expect(r.sections).toEqual([]);
    expect(r.warnings).toHaveLength(2);
  });

  it("merges a section listed twice and skips meetings without days", () => {
    const r = checkExtraction(PASTE, {
      sections: [row({}), row({ meetings: [{ days: [], start: "13:00", end: "14:30" }, { days: ["Mo", "We"], start: "09:00", end: "10:30" }] })],
    });
    expect(r.sections).toHaveLength(1);
    expect(r.sections[0].meetings).toHaveLength(1);
  });
});

describe("redact", () => {
  it("removes emails, national IDs and phone numbers but keeps course codes", () => {
    const out = redact("a.b@mail.ac.th 1-1234-56789-12-3 081-234-5678 01204111 0800-0930");
    expect(out).toBe("[อีเมล] [เลขบัตร] [เบอร์โทร] 01204111 0800-0930");
  });
});

describe("pageText", () => {
  it("flattens tables to tab rows and strips other HTML", () => {
    expect(pageText("<table><tr><td>ITCS101</td><td>9:00-10:30</td></tr></table>")).toBe("ITCS101\t9:00-10:30");
    expect(pageText("<div><script>x()</script><p>ITCS101 &amp; lab</p><span>Mon</span></div>")).toBe("ITCS101 & lab\nMon");
    expect(pageText("plain text")).toBe("plain text");
  });
});
