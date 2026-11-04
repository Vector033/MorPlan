import { DAY_TH, fmtTime } from "./core/time";
import type { Conflict, ExamSlot, Meeting, Section } from "./core/types";

// Literal class strings so Tailwind picks them up.
export const COURSE_COLORS = [
  { block: "bg-teal-50 border-teal-300 text-teal-950", dot: "bg-teal-500" },
  { block: "bg-amber-50 border-amber-300 text-amber-950", dot: "bg-amber-500" },
  { block: "bg-sky-50 border-sky-300 text-sky-950", dot: "bg-sky-500" },
  { block: "bg-rose-50 border-rose-300 text-rose-950", dot: "bg-rose-500" },
  { block: "bg-lime-50 border-lime-300 text-lime-950", dot: "bg-lime-600" },
  { block: "bg-indigo-50 border-indigo-300 text-indigo-950", dot: "bg-indigo-500" },
  { block: "bg-orange-50 border-orange-300 text-orange-950", dot: "bg-orange-500" },
  { block: "bg-cyan-50 border-cyan-300 text-cyan-950", dot: "bg-cyan-600" },
  { block: "bg-fuchsia-50 border-fuchsia-300 text-fuchsia-950", dot: "bg-fuchsia-500" },
  { block: "bg-emerald-50 border-emerald-300 text-emerald-950", dot: "bg-emerald-600" },
];

export function colorFor(courseNo: string, order: string[]) {
  const i = order.indexOf(courseNo);
  const idx = i >= 0 ? i : [...courseNo].reduce((a, c) => a + c.charCodeAt(0), 0);
  return COURSE_COLORS[idx % COURSE_COLORS.length];
}

export function meetingLabel(m: Meeting): string {
  if (m.days.length === 0) return "TBA";
  return `${m.days.map((d) => DAY_TH[d]).join(" ")} ${fmtTime(m.start)}–${fmtTime(m.end)}${m.room ? ` · ${m.room}` : ""}`;
}

export function sectionLabel(s: Section): string {
  return s.lab !== "000" && s.lec === "000" ? `แล็บ ${s.lab}` : s.lab !== "000" ? `ตอน ${s.lec} / แล็บ ${s.lab}` : `ตอน ${s.lec}`;
}

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function thaiDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${TH_MONTHS[m - 1]} ${String(y + 543).slice(2)}`;
}

export function examLabel(slot?: ExamSlot): string {
  return slot ? `${thaiDate(slot.date)} ${fmtTime(slot.start)}–${fmtTime(slot.end)}` : "ไม่มีในตารางสอบกลาง";
}

export function conflictText(c: Conflict, byId: Map<string, Section>): string {
  const name = (id: string) => byId.get(id)?.courseNo ?? id.split("-")[0];
  switch (c.kind) {
    case "time":
      return `เวลาเรียนชน: ${name(c.a)} กับ ${name(c.b)} วัน${DAY_TH[c.day]} ${fmtTime(c.start)}–${fmtTime(c.end)}`;
    case "midterm":
      return `สอบกลางภาคชน: ${name(c.a)} กับ ${name(c.b)} ${thaiDate(c.date)} ${fmtTime(c.start)}–${fmtTime(c.end)}`;
    case "final":
      return `สอบปลายภาคชน: ${name(c.a)} กับ ${name(c.b)} ${thaiDate(c.date)} ${fmtTime(c.start)}–${fmtTime(c.end)}`;
    case "duplicate":
      return `เลือก ${c.courseNo} ซ้ำสองตอน`;
  }
}
