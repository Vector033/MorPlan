import { parseDays, parseTimeRange } from "./time";
import { sectionId, type Meeting, type Section } from "./types";

export type ImportResult = { sections: Section[]; warnings: string[] };

const DAY_TIME =
  /(?<![A-Za-z])((?:Mo|Tu|We|Th|Fr|Sa|Su|TT|M|W|F)+|[A-Z][a-z]?-[A-Z][a-z]?)\s+(\d{1,2}[:.]?\d{2}\s*-\s*\d{1,2}[:.]?\d{2})/g;
const ROOM = /^(?:[A-Za-z]{0,8}\d[\w./-]*|TBA|ONLINE|Online|ห้อง\S*)$/;

/**
 * Turn a reg course-search result the student copied (text) or saved (HTML)
 * into sections. reg's logged-in layout is not public, so this does not rely
 * on column positions: a record starts at a 6-digit course number, the first
 * 3-digit numbers after it are the lecture and lab section, each
 * "<days> <HHMM-HHMM>" pair is a meeting (with the next token as the room),
 * and leftover text is the title and instructors. Lines without a course
 * number continue the previous record; lines that start with their own section
 * numbers are another section of the previous course. Anything that cannot be
 * read is reported in `warnings`, never dropped silently.
 */
export function parseRegImport(input: string): ImportResult {
  const rows = looksLikeHtml(input) ? htmlRows(input) : textRows(input);
  const warnings: string[] = [];
  const records: { courseNo: string; title: string; cells: string[]; line: number }[] = [];
  let last: { courseNo: string; title: string } | null = null;

  rows.forEach((cells, idx) => {
    const joined = cells.join(" ");
    if (!joined.trim()) return;
    // A 6-digit code anywhere, or a letters+digits code ("CS101") only at the start: rooms such as "RB5210" come later in the row.
    const course = /\b(\d{6})\b/.exec(joined) ?? /^\s*([A-Z]{2,5}\d{3,4}[A-Z]?)\b/.exec(joined);
    if (course) {
      const title = guessTitle(cells, course[1]);
      last = { courseNo: course[1], title };
      records.push({ courseNo: course[1], title, cells, line: idx + 1 });
      return;
    }
    if (!last) return; // page header, menus, etc.
    const startsWithSection = /^\s*\d{3}\s+\d{3}\b/.test(joined) || /^\d{3}$/.test(cells[0]?.trim() ?? "");
    if (startsWithSection) {
      records.push({ courseNo: last.courseNo, title: last.title, cells, line: idx + 1 });
    } else if (records.length && DAY_TIME.test(joined)) {
      records[records.length - 1].cells.push(...cells);
    } else if (records.length && /\p{L}/u.test(joined)) {
      // A wrapped instructor line.
      records[records.length - 1].cells.push(...cells);
    }
    DAY_TIME.lastIndex = 0;
  });

  const byId = new Map<string, Section>();
  for (const r of records) {
    const parsed = parseRecord(r.courseNo, r.title, r.cells);
    if ("header" in parsed) continue;
    if ("error" in parsed) {
      warnings.push(`บรรทัด ${r.line} (${r.courseNo}): ${parsed.error}`);
      continue;
    }
    const prev = byId.get(parsed.id);
    if (prev) {
      // Same section listed again (e.g. lab row): merge meetings.
      for (const m of parsed.meetings) if (!prev.meetings.some((p) => sameMeeting(p, m))) prev.meetings.push(m);
      for (const i of parsed.instructors) if (!prev.instructors.includes(i)) prev.instructors.push(i);
    } else {
      byId.set(parsed.id, parsed);
    }
  }
  if (records.length === 0) warnings.push("ไม่พบรหัสวิชาในข้อมูลที่วาง");
  return { sections: [...byId.values()], warnings };
}

function parseRecord(
  courseNo: string,
  title: string,
  cells: string[],
): Section | { error: string } | { header: true } {
  const text = cells.join("\t");
  const afterCourse = text.slice(Math.max(0, text.indexOf(courseNo) + (text.includes(courseNo) ? courseNo.length : 0)));
  const firstMeeting = afterCourse.search(DAY_TIME);
  DAY_TIME.lastIndex = 0;
  const head = firstMeeting >= 0 ? afterCourse.slice(0, firstMeeting) : afterCourse;
  const secs = head.match(/(?<!\d)\d{3}(?!\d)/g) ?? [];
  // A course heading row ("204211 OBJECT-ORIENTED PROGRAMMING 3") with its sections below.
  if (secs.length === 0 && firstMeeting < 0) return { header: true };
  if (secs.length === 0) return { error: "ไม่พบหมายเลขตอน (section)" };
  const lec = secs[0]!;
  const lab = secs[1] ?? "000";

  const credits = /(?<![\d.])(\d(?:\.\d)?)(?:\s*\(\d+-\d+-\d+\))?(?![\d.])/.exec(head.replace(/\d{3}/g, " "));

  const meetings: Meeting[] = [];
  const consumed: [number, number][] = [];
  for (const m of afterCourse.matchAll(DAY_TIME)) {
    let days;
    try {
      days = parseDays(m[1]);
    } catch {
      continue;
    }
    const range = parseTimeRange(m[2]);
    if (!range) continue;
    const rest = afterCourse.slice(m.index! + m[0].length);
    const roomTok = /^\s*(\S+)/.exec(rest)?.[1];
    const room = roomTok && ROOM.test(roomTok) ? roomTok : undefined;
    const end = m.index! + m[0].length + (room ? rest.indexOf(room) + room.length : 0);
    consumed.push([m.index!, end]);
    meetings.push({ days, ...range, ...(room ? { room } : {}), kind: meetings.length === 0 ? "lec" : "lab" });
  }
  const tba = /\bTBA\b/.test(afterCourse);
  if (meetings.length === 0 && !tba) return { error: "ไม่พบวันและเวลาเรียน" };

  let tail = afterCourse;
  if (consumed.length) tail = afterCourse.slice(consumed[consumed.length - 1][1]);
  const instructors = tail
    .split(/[\t\n,;]|\s{2,}/)
    .map((s) => s.trim())
    .filter((s) => /\p{L}{2,}/u.test(s) && !ROOM.test(s) && s !== title && !/^(TBA|เต็ม|FULL)$/i.test(s))
    .filter((s, i, a) => a.indexOf(s) === i);

  return {
    id: sectionId(courseNo, lec, lab),
    courseNo,
    title,
    ...(credits ? { credits: Number(credits[1]) } : {}),
    lec,
    lab,
    meetings,
    instructors,
    ...(meetings.length === 0 ? { note: "TBA" } : {}),
  };
}

function guessTitle(cells: string[], courseNo: string): string {
  // Prefer a whole cell of words (tabbed/HTML input); fall back to the words
  // right after the course number.
  const candidates = cells
    .map((c) => c.replace(courseNo, "").trim())
    .filter((c) => /\p{L}{3,}/u.test(c) && !DAY_TIME.test(c) && !ROOM.test(c) && !DAYS_ONLY.test(c));
  DAY_TIME.lastIndex = 0;
  if (cells.length > 1 && candidates.length) return clean(candidates[0]);
  const joined = cells.join(" ");
  const after = joined.slice(joined.indexOf(courseNo) + 6);
  const m = /^[\s\d]*?([A-Za-z฀-๿][A-Za-z฀-๿ .&()'/-]*?)(?=\s+\d{3}\b|\s+\d\b|$)/.exec(after);
  return m && !DAYS_ONLY.test(m[1].trim()) ? clean(m[1]) : "";
}

// A bare day code ("MTh", "TuF") is the DAY column, never a title.
const DAYS_ONLY = /^(?:Mo|Tu|We|Th|Fr|Sa|Su|TT|M|W|F)+$/;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

function sameMeeting(a: Meeting, b: Meeting) {
  return a.start === b.start && a.end === b.end && a.days.join() === b.days.join();
}

/** A pasted or saved page as plain text for the LLM path: table rows become tab-separated lines, other HTML loses its tags. */
export function pageText(input: string): string {
  if (looksLikeHtml(input)) return htmlRows(input).map((r) => r.join("\t")).filter(Boolean).join("\n");
  if (!/<[a-z][^>]*>/i.test(input)) return input;
  return decode(input.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, " "))
    .split("\n")
    .map(clean)
    .filter(Boolean)
    .join("\n");
}

function looksLikeHtml(s: string) {
  return /<\s*(table|tr|td)\b/i.test(s);
}

function htmlRows(html: string): string[][] {
  const body = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");
  return [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((tr) =>
    [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((td) =>
      decode(td[1].replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
        .split("\n")
        .map(clean)
        .filter(Boolean)
        .join("\n"),
    ),
  );
}

function textRows(text: string): string[][] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => (line.includes("\t") ? line.split("\t") : line.split(/\s{2,}/)).map((c) => c.trim()).filter(Boolean));
}

export function decode(s: string) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
