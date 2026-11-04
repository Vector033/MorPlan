import type { TermInfo } from "@/lib/terms";
import { DAYS, type Day, type ExamSlot, type Section } from "./types";

const BYDAY: Record<Day, string> = { Mo: "MO", Tu: "TU", We: "WE", Th: "TH", Fr: "FR", Sa: "SA", Su: "SU" };
const TZ = "Asia/Bangkok";

/**
 * iCalendar (RFC 5545) for the sections of one plan: each meeting is a weekly
 * series from the first class day to the last, skipping no-class weeks, plus
 * one event per midterm/final. Times are local Bangkok time (no DST, so a
 * fixed VTIMEZONE is exact).
 */
export function buildIcs(sections: Section[], term: TermInfo, opts: { now?: Date; planName?: string } = {}): string {
  const stamp = utcStamp(opts.now ?? new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MorPlan//CMU timetable//TH",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escape(`MorPlan ${term.term}${opts.planName ? ` ${opts.planName}` : ""}`)}`,
    "BEGIN:VTIMEZONE",
    `TZID:${TZ}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0700",
    "TZOFFSETTO:+0700",
    "TZNAME:ICT",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];

  for (const s of sections) {
    s.meetings.forEach((m, i) => {
      if (m.days.length === 0) return;
      const first = firstOnOrAfter(term.start, m.days);
      const exdates = dateRange(term.noClass)
        .filter((d) => m.days.includes(dayOf(d)))
        .map((d) => `${compact(d)}T${hhmm(m.start)}`);
      lines.push(
        "BEGIN:VEVENT",
        `UID:${s.id}-m${i}-${term.term.replace("/", "-")}@morplan`,
        `DTSTAMP:${stamp}`,
        `SUMMARY:${escape(`${s.courseNo} ${s.title}`.trim())}`,
        `DTSTART;TZID=${TZ}:${compact(first)}T${hhmm(m.start)}`,
        `DTEND;TZID=${TZ}:${compact(first)}T${hhmm(m.end)}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${DAYS.filter((d) => m.days.includes(d)).map((d) => BYDAY[d]).join(",")};UNTIL=${compact(term.end)}T235959`,
        ...(exdates.length ? [`EXDATE;TZID=${TZ}:${exdates.join(",")}`] : []),
        ...(m.room ? [`LOCATION:${escape(m.room)}`] : []),
        `DESCRIPTION:${escape(describe(s))}`,
        "END:VEVENT",
      );
    });
    for (const kind of ["midterm", "final"] as const) {
      const slot = s[kind];
      if (slot) lines.push(...examEvent(s, kind, slot, stamp));
    }
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

function examEvent(s: Section, kind: "midterm" | "final", slot: ExamSlot, stamp: string): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:${s.id}-${kind}@morplan`,
    `DTSTAMP:${stamp}`,
    `SUMMARY:${escape(`สอบ${kind === "midterm" ? "กลางภาค" : "ปลายภาค"} ${s.courseNo} ${s.title}`.trim())}`,
    `DTSTART;TZID=${TZ}:${compact(slot.date)}T${hhmm(slot.start)}`,
    `DTEND;TZID=${TZ}:${compact(slot.date)}T${hhmm(slot.end)}`,
    `DESCRIPTION:${escape("ตรวจสอบห้องสอบและเวลากับประกาศทางการอีกครั้ง")}`,
    "END:VEVENT",
  ];
}

function describe(s: Section): string {
  return [`ตอน ${s.lec}/${s.lab}`, s.instructors.join(", ")].filter(Boolean).join("\n");
}

function escape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold content lines at 75 octets without splitting a UTF-8 character. */
export function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = "";
  let curLen = 0;
  for (const ch of line) {
    const len = enc.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (curLen + len > limit) {
      parts.push(cur);
      cur = "";
      curLen = 0;
    }
    cur += ch;
    curLen += len;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}${String(min % 60).padStart(2, "0")}00`;
const compact = (iso: string) => iso.replaceAll("-", "");
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function dayOf(iso: string): Day {
  const js = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return DAYS[(js + 6) % 7];
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function firstOnOrAfter(iso: string, days: Day[]): string {
  let d = iso;
  for (let i = 0; i < 7 && !days.includes(dayOf(d)); i++) d = addDays(d, 1);
  return d;
}

function dateRange(ranges: [string, string][]): string[] {
  const out: string[] = [];
  for (const [from, to] of ranges) for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
