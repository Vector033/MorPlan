import type { SlotKind } from "@/lib/core/curriculum";

export const KIND_LABEL: Record<SlotKind, string> = {
  "major-elective": "เอกเลือก",
  minor: "วิชาโท",
  ge: "ศึกษาทั่วไป",
  free: "เลือกเสรี",
  other: "อื่น ๆ",
};

export const DISCLAIMER = "อ่านโดย AI ตรวจสอบกับเอกสารของคณะอีกครั้ง";

export function rangeLabel(c: { cohortFrom?: number; cohortTo?: number }): string {
  if (c.cohortFrom === undefined) return "";
  return c.cohortTo === undefined ? `ใช้กับรหัส ${c.cohortFrom} เป็นต้นไป` : `รหัส ${c.cohortFrom}–${c.cohortTo}`;
}

export function thaiDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}
