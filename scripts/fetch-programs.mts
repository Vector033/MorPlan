// Fetch the public TCAS program list (course.mytcas.com, run by ทปอ.) once and keep only
// university → faculty → majors as data/programs-th.json for the curriculum setup form.
// Usage: npx tsx scripts/fetch-programs.mts   (re-run about once a year, when a new TCAS round opens)
import { readFileSync, writeFileSync } from "node:fs";
import { normalizeKey } from "../src/lib/core/curriculum";
import { buildPrograms, type ProgramRow } from "../src/lib/core/programs";

const url = "https://my-tcas.s3.ap-southeast-1.amazonaws.com/mytcas/courses.json";
const UA = "MorPlan/0.1 (student project; github.com/Vector033/MorPlan)";

const res = await fetch(url, { headers: { "user-agent": UA } });
if (!res.ok) throw new Error(`${url}: ${res.status}`);
const rows = (await res.json()) as ProgramRow[];
if (!Array.isArray(rows) || rows.length < 1000) throw new Error(`${url}: expected thousands of programs, got ${Array.isArray(rows) ? rows.length : typeof rows}`);

const programs = buildPrograms(rows);
const out = { source: "https://course.mytcas.com", fetchedAt: new Date().toISOString().slice(0, 10), programs };
writeFileSync("data/programs-th.json", JSON.stringify(out) + "\n");
// The setup form's university list: keep the hand-made list and add any TCAS name it lacks.
const listFile = "data/universities-th.json";
const list = JSON.parse(readFileSync(listFile, "utf8")) as string[];
const known = new Set(list.map(normalizeKey));
const added = Object.keys(programs).filter((u) => !known.has(normalizeKey(u)));
writeFileSync(listFile, JSON.stringify([...list, ...added], null, 2) + "\n");
if (added.length) console.log(`${listFile}: added ${added.join(", ")}`);

const faculties = Object.values(programs).reduce((n, f) => n + Object.keys(f).length, 0);
console.log(`data/programs-th.json: ${Object.keys(programs).length} universities, ${faculties} faculties from ${rows.length} programs`);
