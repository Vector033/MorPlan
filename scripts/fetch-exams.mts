// Fetch reg's public midterm/final timetables for a term and cache them as
// data/exams/<term>.json. Usage: npx tsx scripts/fetch-exams.mts 2/2569
import { mkdirSync, writeFileSync } from "node:fs";
import { parseExamTimetable, parseTerm, type TermExams } from "../src/lib/core/exams";

const term = process.argv[2] ?? "2/2569";
const { code } = parseTerm(term);
const UA = "MorPlan/0.1 (student project; github.com/Vector033/MorPlan)";
const base = "https://www1.reg.cmu.ac.th/registrationoffice/timetable_exam.php";

async function get(type: "MIDTERM" | "FINAL") {
  const url = `${base}?type=${type}&term=${code}`;
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const table = parseExamTimetable(await res.text(), term);
  await new Promise((r) => setTimeout(r, 2000));
  return { url, table };
}

const mid = await get("MIDTERM");
const fin = await get("FINAL");
const out: TermExams = {
  term,
  midterm: mid.table,
  final: fin.table,
  fetchedAt: new Date().toISOString(),
  source: [mid.url, fin.url],
};
mkdirSync("data/exams", { recursive: true });
const file = `data/exams/${term.replace("/", "-")}.json`;
writeFileSync(file, JSON.stringify(out, null, 1) + "\n");
console.log(`${file}: ${Object.keys(out.midterm).length} midterm, ${Object.keys(out.final).length} final courses`);
