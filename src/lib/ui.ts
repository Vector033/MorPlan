import { DAY_TH, fmtTime } from "./core/time";
import type { Conflict, ExamSlot, Meeting, Section } from "./core/types";

// Pastel course colours: a pale fill, a saturated left edge and a dark ink of the same hue.
// Text colour is chosen per fill for >= 4.5:1 contrast. Red is reserved for clashes.
// Literal class strings so Tailwind picks them up.
export const COURSE_COLORS = [
  { block: "bg-[#eaf0ff] text-[#1f3a99] border-l-4 border-[#3d6bf0]", dot: "bg-[#eaf0ff] text-[#1f3a99] ring-1 ring-inset ring-[#3d6bf0]" },
  { block: "bg-[#fff1e6] text-[#8a3d00] border-l-4 border-[#f08a2c]", dot: "bg-[#fff1e6] text-[#8a3d00] ring-1 ring-inset ring-[#f08a2c]" },
  { block: "bg-[#e6f6ec] text-[#14603a] border-l-4 border-[#2fa46a]", dot: "bg-[#e6f6ec] text-[#14603a] ring-1 ring-inset ring-[#2fa46a]" },
  { block: "bg-[#fff7d6] text-[#6b5200] border-l-4 border-[#d9ad00]", dot: "bg-[#fff7d6] text-[#6b5200] ring-1 ring-inset ring-[#d9ad00]" },
  { block: "bg-[#f1ecff] text-[#45289e] border-l-4 border-[#7b5cf0]", dot: "bg-[#f1ecff] text-[#45289e] ring-1 ring-inset ring-[#7b5cf0]" },
  { block: "bg-[#e2f5fa] text-[#0b5a70] border-l-4 border-[#1aa3c7]", dot: "bg-[#e2f5fa] text-[#0b5a70] ring-1 ring-inset ring-[#1aa3c7]" },
  { block: "bg-[#f6eee5] text-[#6a4116] border-l-4 border-[#b07a45]", dot: "bg-[#f6eee5] text-[#6a4116] ring-1 ring-inset ring-[#b07a45]" },
  { block: "bg-[#eef8e0] text-[#3d6512] border-l-4 border-[#6fb22a]", dot: "bg-[#eef8e0] text-[#3d6512] ring-1 ring-inset ring-[#6fb22a]" },
  { block: "bg-[#eef0f4] text-[#353b48] border-l-4 border-[#6b7486]", dot: "bg-[#eef0f4] text-[#353b48] ring-1 ring-inset ring-[#6b7486]" },
  { block: "bg-[#e1f4f0] text-[#0d5a50] border-l-4 border-[#1f9c8a]", dot: "bg-[#e1f4f0] text-[#0d5a50] ring-1 ring-inset ring-[#1f9c8a]" },
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
  // Name the exact section, not just the course: the fix is usually picking another section.
  const name = (id: string) => {
    const s = byId.get(id);
    return s ? `${s.courseNo} ${sectionLabel(s)}` : id.split("-")[0];
  };
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
