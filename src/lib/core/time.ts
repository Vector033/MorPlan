import { DAYS, type Day, type Minutes } from "./types";

const TWO_LETTER = new Set<string>(DAYS);
const ONE_LETTER: Record<string, Day> = { M: "Mo", W: "We", F: "Fr" };

/**
 * Registration-site day patterns → days. Handles two-letter codes (MoTh), single letters
 * (MWF), "TT" = Tu+Th (so MTT = Mo+Tu+Th, TTF = Tu+Th+Fr), ranges (M-F,
 * Tu-F, M-Su), Thai names and abbreviations (จ พ ศ, อังคาร, จ.-ศ.) and TBA.
 * Throws on anything else so imports can warn.
 */
export function parseDays(pattern: string): Day[] {
  const p = pattern.replace(/\s+/g, "");
  if (p === "" || /^TBA$/i.test(p)) return [];
  if (/[ก-๙]/.test(p)) return thaiDays(p);

  const range = /^([A-Z][a-z]?)-([A-Z][a-z]?)$/.exec(p);
  if (range) {
    const [from, to] = [codeToDay(range[1]), codeToDay(range[2])];
    const i = DAYS.indexOf(from);
    const j = DAYS.indexOf(to);
    if (j < i) throw new Error(`Bad day range: ${pattern}`);
    return DAYS.slice(i, j + 1);
  }

  const out: Day[] = [];
  let i = 0;
  while (i < p.length) {
    const two = p.slice(i, i + 2);
    if (TWO_LETTER.has(two)) {
      out.push(two as Day);
      i += 2;
    } else if (two === "TT") {
      out.push("Tu", "Th");
      i += 2;
    } else if (ONE_LETTER[p[i]]) {
      out.push(ONE_LETTER[p[i]]);
      i += 1;
    } else {
      throw new Error(`Unknown day pattern: ${pattern}`);
    }
  }
  return DAYS.filter((d) => out.includes(d));
}

// Longest first, so "อา" is Sunday before "อ" is Tuesday and "พฤ" is Thursday before "พ" is Wednesday.
const THAI_DAYS: [string, Day][] = [
  ["พฤหัสบดี", "Th"],
  ["อาทิตย์", "Su"],
  ["อังคาร", "Tu"],
  ["จันทร์", "Mo"],
  ["พฤหัส", "Th"],
  ["เสาร์", "Sa"],
  ["ศุกร์", "Fr"],
  ["พุธ", "We"],
  ["พฤ", "Th"],
  ["อา", "Su"],
  ["จ", "Mo"],
  ["อ", "Tu"],
  ["พ", "We"],
  ["ศ", "Fr"],
  ["ส", "Sa"],
];

function thaiDays(pattern: string): Day[] {
  const p = pattern.replace(/วัน/g, "").replace(/[,./]/g, "");
  const range = /^([^-]+)-([^-]+)$/.exec(p);
  if (range) {
    const [from, to] = [thaiDays(range[1]), thaiDays(range[2])];
    const i = DAYS.indexOf(from[0]);
    const j = DAYS.indexOf(to[0]);
    if (from.length !== 1 || to.length !== 1 || j < i) throw new Error(`Bad day range: ${pattern}`);
    return DAYS.slice(i, j + 1);
  }
  const out: Day[] = [];
  let rest = p;
  while (rest) {
    const hit = THAI_DAYS.find(([name]) => rest.startsWith(name));
    if (!hit) throw new Error(`Unknown day pattern: ${pattern}`);
    out.push(hit[1]);
    rest = rest.slice(hit[0].length);
  }
  return DAYS.filter((d) => out.includes(d));
}

function codeToDay(code: string): Day {
  if (TWO_LETTER.has(code)) return code as Day;
  if (ONE_LETTER[code]) return ONE_LETTER[code];
  throw new Error(`Unknown day code: ${code}`);
}

/** "0800-0930", "08:00 - 09:30" or "8.00-9.30" → minutes; null if not a range. */
export function parseTimeRange(s: string): { start: Minutes; end: Minutes } | null {
  const m = /^\s*(\d{1,2})[:.]?(\d{2})\s*-\s*(\d{1,2})[:.]?(\d{2})\s*$/.exec(s);
  if (!m) return null;
  const start = Number(m[1]) * 60 + Number(m[2]);
  const end = Number(m[3]) * 60 + Number(m[4]);
  if (start >= end || end > 24 * 60) return null;
  return { start, end };
}

export function fmtTime(min: Minutes): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export const DAY_TH: Record<Day, string> = {
  Mo: "จันทร์",
  Tu: "อังคาร",
  We: "พุธ",
  Th: "พฤหัสบดี",
  Fr: "ศุกร์",
  Sa: "เสาร์",
  Su: "อาทิตย์",
};

export const DAY_TH_SHORT: Record<Day, string> = {
  Mo: "จ.",
  Tu: "อ.",
  We: "พ.",
  Th: "พฤ.",
  Fr: "ศ.",
  Sa: "ส.",
  Su: "อา.",
};
