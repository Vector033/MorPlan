import "server-only";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { curricula } from "@/db/schema";
import { LIMITS } from "@/lib/core/curriculum-limits";
import { normalizeKey, type Curriculum, type ElectiveCourse, type Minor } from "@/lib/core/curriculum";
import type { DocKind } from "./read";
import { mergeRange, parseData, readRow, type Meta } from "./rows";

export type { Meta };

const shared = (kind: DocKind) => and(eq(curricula.status, "shared"), eq(curricula.kind, kind));

/** Distinct faculty names of a university, or major names of one faculty, among shared curricula. */
export async function options(university: string, faculty?: string): Promise<string[]> {
  const uni = and(shared("curriculum"), eq(curricula.uniKey, normalizeKey(university)));
  const rows = faculty
    ? await db.select({ name: curricula.major }).from(curricula).where(and(uni, eq(curricula.facultyKey, normalizeKey(faculty))))
    : await db.select({ name: curricula.faculty }).from(curricula).where(uni);
  return [...new Set(rows.map((r) => r.name).filter((n): n is string => !!n))].sort((a, b) => a.localeCompare(b, "th"));
}

export async function candidates(university: string, faculty: string, major: string): Promise<Meta[]> {
  const rows = await db
    .select()
    .from(curricula)
    .where(
      and(
        shared("curriculum"),
        eq(curricula.uniKey, normalizeKey(university)),
        eq(curricula.facultyKey, normalizeKey(faculty)),
        eq(curricula.majorKey, normalizeKey(major)),
      ),
    )
    .orderBy(desc(curricula.cohortFrom), desc(curricula.createdAt));
  return rows.flatMap((r) => readRow(r)?.meta ?? []);
}

export async function getShared(id: string): Promise<{ meta: Meta; curriculum: Curriculum } | null> {
  const [row] = await db.select().from(curricula).where(and(eq(curricula.id, id), shared("curriculum"))).limit(1);
  if (!row) return null;
  const parsed = readRow(row);
  if (!parsed) return null;
  const curriculum = parsed.data as Curriculum;
  const children = await db.select().from(curricula).where(and(eq(curricula.parentId, id), shared("electives")));
  const merged = new Map<string, ElectiveCourse>();
  for (const c of [...(curriculum.electives["major-elective"] ?? []), ...children.flatMap((c) => (readRow(c)?.data as ElectiveCourse[] | undefined) ?? [])]) {
    if (!merged.has(c.courseNo)) merged.set(c.courseNo, c);
  }
  return { meta: parsed.meta, curriculum: { ...curriculum, electives: { ...curriculum.electives, ...(merged.size ? { "major-elective": [...merged.values()].slice(0, LIMITS.electives) } : {}) } } };
}

export async function minorCatalogs(university: string): Promise<{ meta: Meta; minors: Minor[] }[]> {
  const rows = await db
    .select()
    .from(curricula)
    .where(and(shared("minors"), eq(curricula.uniKey, normalizeKey(university))))
    .orderBy(desc(curricula.createdAt));
  return rows.flatMap((r) => {
    const p = readRow(r);
    return p ? [{ meta: p.meta, minors: p.data as Minor[] }] : [];
  });
}

type NewRow = {
  kind: DocKind;
  university: string;
  faculty?: string;
  major?: string;
  parentId?: string;
  data: unknown;
  cohortFrom?: number;
  cohortTo?: number;
  sourceUrl: string;
  sourceTitle: string;
};

async function insert(row: Omit<NewRow, "sourceUrl"> & { sourceUrl?: string }, status: "pending" | "shared", provenance: "link" | "owner"): Promise<string> {
  const id = nanoid(10);
  await db.insert(curricula).values({
    id,
    kind: row.kind,
    status,
    uniKey: normalizeKey(row.university),
    facultyKey: row.faculty ? normalizeKey(row.faculty) : null,
    majorKey: row.major ? normalizeKey(row.major) : null,
    university: row.university,
    faculty: row.faculty ?? null,
    major: row.major ?? null,
    cohortFrom: row.cohortFrom ?? null,
    cohortTo: row.cohortTo ?? null,
    parentId: row.parentId ?? null,
    data: parseData(row.kind, row.data),
    sourceUrl: row.sourceUrl ?? null,
    sourceTitle: row.sourceTitle,
    provenance,
  });
  return id;
}

export async function savePending(row: NewRow): Promise<string> {
  // Opportunistic clean-up of abandoned reads, as rate-limit.ts does for old windows.
  await db.delete(curricula).where(and(eq(curricula.status, "pending"), lt(curricula.createdAt, sql`now() - interval '1 day'`)));
  return insert(row, "pending", "link");
}

/** Pending -> shared. "missing" when the row is absent or already shared; "range" when the cohort range would end before it starts. */
export async function confirm(id: string, cohortFrom?: number, cohortTo?: number): Promise<"ok" | "missing" | "range"> {
  const [row] = await db.select({ from: curricula.cohortFrom, to: curricula.cohortTo }).from(curricula).where(and(eq(curricula.id, id), eq(curricula.status, "pending"))).limit(1);
  if (!row) return "missing";
  const range = mergeRange(row, { from: cohortFrom, to: cohortTo });
  if (!range) return "range";
  const set = { status: "shared", ...(range.from != null ? { cohortFrom: range.from } : {}), ...(range.to != null ? { cohortTo: range.to } : {}) };
  const rows = await db.update(curricula).set(set).where(and(eq(curricula.id, id), eq(curricula.status, "pending"))).returning({ id: curricula.id });
  return rows.length > 0 ? "ok" : "missing";
}

export async function replaceData(id: string, data: unknown): Promise<void> {
  const [row] = await db.select({ kind: curricula.kind }).from(curricula).where(eq(curricula.id, id)).limit(1);
  if (!row) return;
  await db.update(curricula).set({ data: parseData(row.kind as DocKind, data), readAt: sql`now()` }).where(eq(curricula.id, id));
}

export async function saveOwner(row: Omit<NewRow, "sourceUrl"> & { sourceUrl?: string }): Promise<string> {
  return insert(row, "shared", "owner");
}
