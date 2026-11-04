import { DAY_TH, fmtTime } from "./core/time";
import type { Conflict, ExamSlot, Meeting, Section } from "./core/types";

// Transit-line colours (one per course, like subway lines on a Vignelli map).
// Text colour is chosen per fill for >= 4.5:1 contrast. Red is reserved for clashes.
// Literal class strings so Tailwind picks them up.
export const COURSE_COLORS = [
  { block: "bg-[#0039a6] text-white", dot: "bg-[#0039a6] text-white" },
  { block: "bg-[#ff6319] text-ink", dot: "bg-[#ff6319] text-ink" },
  { block: "bg-[#007a33] text-white", dot: "bg-[#007a33] text-white" },
  { block: "bg-[#fccc0a] text-ink", dot: "bg-[#fccc0a] text-ink" },
  { block: "bg-[#b933ad] text-white", dot: "bg-[#b933ad] text-white" },
  { block: "bg-[#00a1de] text-ink", dot: "bg-[#00a1de] text-ink" },
  { block: "bg-[#996633] text-white", dot: "bg-[#996633] text-white" },
  { block: "bg-[#6cbe45] text-ink", dot: "bg-[#6cbe45] text-ink" },
  { block: "bg-[#5c5c5c] text-white", dot: "bg-[#5c5c5c] text-white" },
  { block: "bg-[#006983] text-white", dot: "bg-[#006983] text-white" },
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
