import { attachExams, type TermExams } from "./core/exams";
import { parseDays, parseTimeRange } from "./core/time";
import { sectionId, type Section } from "./core/types";

// Made-up sections for trying the planner without importing from reg. Course
// numbers are real so the public exam timetable applies, but titles, times,
// rooms and instructors are invented.
type Row = [courseNo: string, title: string, credits: number, lec: string, lab: string, ...meetings: string[]];

const ROWS: Row[] = [
  ["204101", "INTRO COMP PROG (ตัวอย่าง)", 3, "001", "000", "TuF 0800-0930 RB5210"],
  ["204101", "INTRO COMP PROG (ตัวอย่าง)", 3, "002", "000", "MTh 0930-1100 RB5205"],
  ["204101", "INTRO COMP PROG (ตัวอย่าง)", 3, "003", "000", "TuF 1300-1430 SCB1100"],
  ["204102", "PROG LAB (ตัวอย่าง)", 1, "000", "001", "We 0900-1200 CSB201"],
  ["204102", "PROG LAB (ตัวอย่าง)", 1, "000", "002", "We 1300-1600 CSB201"],
  ["204102", "PROG LAB (ตัวอย่าง)", 1, "000", "003", "Th 1300-1600 CSB202"],
  ["204217", "DATA STRUCTURES (ตัวอย่าง)", 3, "001", "000", "MTh 1300-1430 RB5210"],
  ["204217", "DATA STRUCTURES (ตัวอย่าง)", 3, "002", "000", "TuF 0930-1100 RB5210"],
  ["206111", "CALCULUS 1 (ตัวอย่าง)", 3, "001", "000", "MTh 0800-0930 SCB1200"],
  ["206111", "CALCULUS 1 (ตัวอย่าง)", 3, "002", "000", "TuF 0800-0930 SCB1200"],
  ["206111", "CALCULUS 1 (ตัวอย่าง)", 3, "003", "000", "MWF 1000-1100 SCB1300"],
  ["208101", "STATISTICS (ตัวอย่าง)", 3, "001", "000", "TuF 1100-1230 SCB2100"],
  ["208101", "STATISTICS (ตัวอย่าง)", 3, "002", "000", "MTh 1430-1600 SCB2100"],
  ["001101", "FUNDAMENTAL ENGLISH 1 (ตัวอย่าง)", 3, "001", "000", "TuF 1300-1430 HB7100"],
  ["001101", "FUNDAMENTAL ENGLISH 1 (ตัวอย่าง)", 3, "002", "000", "MTh 1100-1230 HB7100"],
  ["001101", "FUNDAMENTAL ENGLISH 1 (ตัวอย่าง)", 3, "003", "000", "We 0900-1200 HB7200"],
  ["140104", "CITIZENSHIP (ตัวอย่าง)", 3, "001", "000", "We 1300-1600 RB2100"],
  ["140104", "CITIZENSHIP (ตัวอย่าง)", 3, "002", "000", "Sa 0900-1200 RB2100"],
  ["888111", "DIGITAL LITERACY (ตัวอย่าง)", 2, "001", "000", "Fr 1500-1700 CAMT113"],
  ["888111", "DIGITAL LITERACY (ตัวอย่าง)", 2, "002", "000", "Mo 1600-1800 CAMT113"],
  ["206161", "LINEAR ALGEBRA (ตัวอย่าง)", 3, "001", "000", "TuF 1430-1600 SCB1100"],
  ["206161", "LINEAR ALGEBRA (ตัวอย่าง)", 3, "002", "000", "MTh 1100-1230 SCB1200"],
];

const INSTRUCTORS = ["อ.ตัวอย่าง หนึ่ง", "อ.ตัวอย่าง สอง", "อ.ตัวอย่าง สาม"];

export function demoSections(exams: Pick<TermExams, "midterm" | "final"> | null): Section[] {
  const sections = ROWS.map(([courseNo, title, credits, lec, lab, ...meetings], i): Section => ({
    id: sectionId(courseNo, lec, lab),
    courseNo,
    title,
    credits,
    lec,
    lab,
    instructors: [INSTRUCTORS[i % INSTRUCTORS.length]],
    meetings: meetings.map((m, j) => {
      const [days, time, room] = m.split(" ");
      return { days: parseDays(days), ...parseTimeRange(time)!, room, kind: j === 0 && lec !== "000" ? "lec" : "lab" };
    }),
    note: "ข้อมูลตัวอย่าง",
  }));
  return attachExams(sections, exams);
}
