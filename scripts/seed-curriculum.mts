// Owner-only: read a trusted curriculum document and write ONE shared record.
// Needs the react-server condition because the store imports "server-only":
//   npx tsx --conditions=react-server scripts/seed-curriculum.mts --kind curriculum|electives|minors --university U \
//     [--faculty F --major M] [--cohort-from N] [--cohort-to N] [--parent ID] \
//     (--url URL | --file PATH --title "...") [--yes] [--replace] [--allow-remote]
// Without --yes: prints a preview, writes nothing. DATABASE_URL comes from the environment, else .env.local;
// a non-local host is refused unless --allow-remote. An existing shared row for the same
// kind + university + faculty + major + source is skipped unless --replace.
import { readFileSync } from "node:fs";
import { assertWritable, parseSeedArgs } from "./seed-args";

process.loadEnvFile(".env.local");
const a = parseSeedArgs(process.argv.slice(2));
if (a.yes) assertWritable(process.env.DATABASE_URL, a.allowRemote);

const { and, eq } = await import("drizzle-orm");
const { db } = await import("../src/db");
const { curricula } = await import("../src/db/schema");
const { normalizeKey } = await import("../src/lib/core/curriculum");
const { readUrl, readPdf } = await import("../src/lib/curriculum/source");
const { readDocument } = await import("../src/lib/curriculum/read");
const { saveOwner } = await import("../src/lib/curriculum/store");
const { getLlm } = await import("../src/lib/rag/llm");

const llm = getLlm();
if (!llm) throw new Error("no LLM configured (GEMINI_API_KEY in .env.local)");
const source = a.url ? await readUrl(a.url) : await readPdf(new Uint8Array(readFileSync(a.file!)), a.title!);
const sourceTitle = a.title ?? source.title;
console.log(`source: ${sourceTitle} (${source.kind}, ${source.text.length} chars)`);

const meta = { university: a.university, faculty: a.faculty ?? "", major: a.major ?? "", cohort: a.cohortFrom ?? 0 };
let result;
for (let i = 1; ; i++) {
  try {
    result = await readDocument(llm, a.kind, source, meta);
    break;
  } catch (e) {
    if (i >= 4) throw e;
    console.log(`read failed (${(e as Error).message.slice(0, 80)}), retry ${i} in ${i * 20}s`);
    await new Promise((r) => setTimeout(r, i * 20_000));
  }
}

if (result.kind === "curriculum") {
  const c = result.data;
  console.log(`title: ${c.title}  cohort ${c.cohortFrom}-${c.cohortTo ?? "?"}`);
  for (const p of c.plans) {
    console.log(`  plan "${p.name}": ${p.terms.length} terms, minCredits ${p.minCredits ?? "?"}`);
    for (const t of p.terms) {
      const codes = t.items.flatMap((i) => (i.type === "course" ? [i.courseNo] : []));
      const slots = t.items.flatMap((i) => (i.type === "slot" ? [`${i.kind}${i.credits}`] : []));
      const total = t.items.reduce((n, i) => n + i.credits, 0);
      console.log(`    Y${t.year}S${t.semester} ${total}cr  ${codes.join(" ")}  [${slots.join(" ")}]`);
    }
  }
} else console.log(`${result.kind}: ${result.data.length}`);
console.log(`dropped: ${result.dropped.length}${result.dropped.length ? " " + result.dropped.join(", ") : ""}`);

if (!a.yes) {
  console.log("preview only; add --yes to write");
  process.exit(0);
}

const same = await db.select({ id: curricula.id }).from(curricula).where(
  and(
    eq(curricula.status, "shared"),
    eq(curricula.kind, a.kind),
    eq(curricula.uniKey, normalizeKey(a.university)),
    ...(a.faculty ? [eq(curricula.facultyKey, normalizeKey(a.faculty))] : []),
    ...(a.major ? [eq(curricula.majorKey, normalizeKey(a.major))] : []),
    a.url ? eq(curricula.sourceUrl, a.url) : eq(curricula.sourceTitle, sourceTitle),
  ),
);
if (same.length && !a.replace) {
  console.log(`already seeded as ${same.map((r) => r.id).join(", ")}; pass --replace to add a new row and remove the old one`);
  process.exit(0);
}
const id = await saveOwner({
  kind: a.kind, university: a.university, faculty: a.faculty, major: a.major, parentId: a.parent,
  data: result.data, cohortFrom: a.cohortFrom, cohortTo: a.cohortTo, sourceUrl: a.url, sourceTitle,
});
for (const r of same) await db.delete(curricula).where(eq(curricula.id, r.id));
console.log(`seeded ${a.kind}: ${id}`);
process.exit(0);
