// Turns TCAS program rows (course.mytcas.com, run by ทปอ.) into university → faculty → majors for the curriculum setup form.

export type ProgramRow = { university_name_th: string; faculty_name_th: string; program_name_th: string; field_name_th: string };
export type Programs = Record<string, Record<string, string[]>>;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Drops a leading "คณะ" so a faculty reads the way students type it ("วิทยาศาสตร์"). */
export const facultyName = (name: string): string => clean(name).replace(/^คณะ\s*/, "");

// Bracketed notes that describe the program track, not the major.
const NOTE = /\s*\((?=[^)]*(หลักสูตร|นานาชาติ|ภาค|ปี|ภาษาอังกฤษ|ภาษาไทย ปกติ|โครงการ|พิเศษ|ทวิ|ต่อเนื่อง|วิทยาเขต|ศูนย์|ศึกษาที่|ปริญญา|ปรับปรุง|รูปแบบ|\.บ))[^)]*\)/g;
// Latin or number tags such as "(SIIT)", "(BC/BBA)", "(4)".
const TAG = /\s*\([A-Za-z0-9 ,&/.\-]*\)/g;
// Where one row names several programs: "…/…", or "… และ วิศวกรรมศาสตรบัณฑิต …" for a double degree.
const JOIN = /\/|\s(?:และ\s)?(?=\S*บัณฑิต[\s(])|\sและ\s(?=[ก-ฮ]{1,3}\.[ก-ฮ]{0,2}\.?บ)/;
// "… และ ร.ม. รัฐศาสตร์": the master\'s half of a bachelor–master program.
const MASTER = /\sและ\s[ก-ฮ]{1,4}\.[ก-ฮ]{0,2}\.?ม.*$/;
// Degree abbreviations such as "วศ.บ.", "วท.บ.", "บธ.บ.", "ค.บ.".
const ABBR = /^[ก-ฮ]{1,3}\.[ก-ฮ]{0,2}\.?บ\.\s*/;
// "หลักสูตรวิทยาศาสตรบัณฑิต", "ศิลปศาสตรบัณฑิต" and the like.
const DEGREE = /^(หลักสูตร)?\S*บัณฑิต\s*/;

function majorOf(part: string): string | undefined {
  let s = clean(part);
  if ((s.match(/\(/g) ?? []).length !== (s.match(/\)/g) ?? []).length) s = s.replace(/[()]/g, " "); // a "/" split inside brackets
  s = clean(s);
  const i = s.indexOf("สาขาวิชา");
  if (i >= 0) s = s.slice(i + "สาขาวิชา".length);
  else {
    s = s.replace(DEGREE, "").replace(ABBR, "");
    const inner = /^\(([^)]+)\)$/.exec(s); // "ครุศาสตรบัณฑิต (การศึกษาปฐมวัย)" leaves "(การศึกษาปฐมวัย)"
    if (inner) s = inner[1];
  }
  s = clean(s.split(/\s(?:แขนงวิชา|วิชาเอก|กลุ่มวิชา|ปริญญาตรี)/)[0])
    .replace(/^(\d+\s*ปี|สาขา|กลุ่มวิชาเอก|กลุ่มวิชา|วิชาเอก)\s*/, "")
    .replace(/\s*\(.*\.บ\..*\)$/, "") // "(วศ.บ. (วิศวกรรมสิ่งแวดล้อม))" repeats the degree
    .replace(/\s+\d+\s*ปี$/, "");
  // A part that is only a degree name, a track note or nothing at all says nothing about the major.
  if (!s || /บัณฑิต$/.test(s) || !/^[ก-๙]/.test(s) || /^(หลักสูตร|และ)/.test(s) || /ปริญญา/.test(s)) return undefined;
  return s;
}

/** The majors one TCAS row names; several when the row joins programs. Falls back to the TCAS field. */
export function majorsOf(row: Pick<ProgramRow, "program_name_th" | "field_name_th">): string[] {
  const found = clean(row.program_name_th).replace(TAG, "").replace(NOTE, "").replace(MASTER, "").split(JOIN).flatMap((p) => majorOf(p) ?? []);
  return found.length ? found : [clean(row.field_name_th)].filter(Boolean);
}

// Misspelt university names seen in the TCAS data, mapped to the real name.
const UNIVERSITY_TYPO: Record<string, string> = {
  มหาวิทยาลัยราคำแหง: "มหาวิทยาลัยรามคำแหง",
  "มหาวิทยาลัย วงษ์ลิตกุล": "มหาวิทยาลัยวงษ์ชวลิตกุล",
};

export function buildPrograms(rows: ProgramRow[]): Programs {
  const out: Programs = {};
  for (const r of rows) {
    const name = clean(r.university_name_th);
    const uni = UNIVERSITY_TYPO[name] ?? name;
    const fac = facultyName(r.faculty_name_th);
    if (!uni || !fac) continue;
    const list = ((out[uni] ??= {})[fac] ??= []);
    for (const m of majorsOf(r)) if (!list.includes(m)) list.push(m);
  }
  const th = (a: string, b: string) => a.localeCompare(b, "th");
  return Object.fromEntries(
    Object.keys(out)
      .sort(th)
      .map((u) => [u, Object.fromEntries(Object.keys(out[u]).sort(th).map((f) => [f, out[u][f].sort(th)]))]),
  );
}
