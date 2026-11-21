import { parseDays, parseTimeRange } from "./core/time";
import { sectionId, type Section } from "./core/types";

// Made-up sections for trying the planner before importing anything. Codes, titles, times,
// rooms, instructors and exam dates are all invented and belong to no university.
type Row = [courseNo: string, title: string, credits: number, lec: string, lab: string, ...meetings: string[]];

const ROWS: Row[] = [
  ["CS101", "INTRO COMP PROG (ตัวอย่าง)", 3, "001", "000", "TuF 0800-0930 A101"],
  ["CS101", "INTRO COMP PROG (ตัวอย่าง)", 3, "002", "000", "MTh 0930-1100 A102"],
  ["CS101", "INTRO COMP PROG (ตัวอย่าง)", 3, "003", "000", "TuF 1300-1430 B204"],
  ["CS102", "PROG LAB (ตัวอย่าง)", 1, "000", "001", "We 0900-1200 LAB201"],
  ["CS102", "PROG LAB (ตัวอย่าง)", 1, "000", "002", "We 1300-1600 LAB201"],
  ["CS102", "PROG LAB (ตัวอย่าง)", 1, "000", "003", "Th 1300-1600 LAB202"],
  ["CS201", "DATA STRUCTURES (ตัวอย่าง)", 3, "001", "000", "MTh 1300-1430 A101"],
  ["CS201", "DATA STRUCTURES (ตัวอย่าง)", 3, "002", "000", "TuF 0930-1100 A101"],
  ["MATH101", "CALCULUS 1 (ตัวอย่าง)", 3, "001", "000", "MTh 0800-0930 B205"],
  ["MATH101", "CALCULUS 1 (ตัวอย่าง)", 3, "002", "000", "TuF 0800-0930 B205"],
  ["MATH101", "CALCULUS 1 (ตัวอย่าง)", 3, "003", "000", "MWF 1000-1100 B301"],
  ["STAT101", "STATISTICS (ตัวอย่าง)", 3, "001", "000", "TuF 1100-1230 B302"],
  ["STAT101", "STATISTICS (ตัวอย่าง)", 3, "002", "000", "MTh 1430-1600 B302"],
  ["ENG101", "FUNDAMENTAL ENGLISH 1 (ตัวอย่าง)", 3, "001", "000", "TuF 1300-1430 C101"],
  ["ENG101", "FUNDAMENTAL ENGLISH 1 (ตัวอย่าง)", 3, "002", "000", "MTh 1100-1230 C101"],
  ["ENG101", "FUNDAMENTAL ENGLISH 1 (ตัวอย่าง)", 3, "003", "000", "We 0900-1200 C102"],
  ["GEN101", "CITIZENSHIP (ตัวอย่าง)", 3, "001", "000", "We 1300-1600 A201"],
  ["GEN101", "CITIZENSHIP (ตัวอย่าง)", 3, "002", "000", "Sa 0900-1200 A201"],
  ["GEN102", "DIGITAL LITERACY (ตัวอย่าง)", 2, "001", "000", "Fr 1500-1700 LAB101"],
  ["GEN102", "DIGITAL LITERACY (ตัวอย่าง)", 2, "002", "000", "Mo 1600-1800 LAB101"],
  ["MATH102", "LINEAR ALGEBRA (ตัวอย่าง)", 3, "001", "000", "TuF 1430-1600 B204"],
  ["MATH102", "LINEAR ALGEBRA (ตัวอย่าง)", 3, "002", "000", "MTh 1100-1230 B205"],
];

// Invented exam slots: [midterm, final] as "YYYY-MM-DD HHMM-HHMM".
const EXAMS: Record<string, [string, string]> = {
  CS101: ["2027-01-11 0900-1200", "2027-03-15 0900-1200"],
  CS201: ["2027-01-12 1300-1600", "2027-03-16 1300-1600"],
  MATH101: ["2027-01-13 0900-1200", "2027-03-17 0900-1200"],
  STAT101: ["2027-01-14 1300-1600", "2027-03-18 1300-1600"],
  ENG101: ["2027-01-15 0900-1200", "2027-03-19 0900-1200"],
};

export const DEMO_NOTE = "ข้อมูลตัวอย่าง";

const INSTRUCTORS = ["อ.ตัวอย่าง หนึ่ง", "อ.ตัวอย่าง สอง", "อ.ตัวอย่าง สาม"];

const slot = (s: string) => {
  const [date, time] = s.split(" ");
  return { date, ...parseTimeRange(time)! };
};

export function demoSections(): Section[] {
  return ROWS.map(([courseNo, title, credits, lec, lab, ...meetings], i): Section => {
    const exam = EXAMS[courseNo];
    return {
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
      ...(exam ? { midterm: slot(exam[0]), final: slot(exam[1]) } : {}),
      note: DEMO_NOTE,
    };
  });
}
