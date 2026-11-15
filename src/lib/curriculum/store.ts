import "server-only";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { curricula } from "@/db/schema";
import { normalizeKey, type Curriculum, type ElectiveCourse, type Minor } from "@/lib/core/curriculum";
import type { DocKind } from "./read";

export type Meta = {
  id: string;
  kind: DocKind;
  title: string;
  university: string;
  faculty?: string;
  major?: string;
  cohortFrom?: number;
  cohortTo?: number;
  sourceUrl?: string;
  sourceTitle: string;
  provenance: "link" | "owner";
  readAt: string;
};

type Row = typeof curricula.$inferSelect;

const opt = <T>(v: T | null): T | undefined => v ?? undefined;

function toMeta(r: Row): Meta {
  const title = r.kind === "curriculum" ? (r.data as Curriculum).title : "";
  return {
    id: r.id,
    kind: r.kind as DocKind,
    title: title || r.sourceTitle,
    university: r.university,
    faculty: opt(r.faculty),
    major: opt(r.major),
    cohortFrom: opt(r.cohortFrom),
    cohortTo: opt(r.cohortTo),
    sourceUrl: opt(r.sourceUrl),
    sourceTitle: r.sourceTitle,
    provenance: r.provenance as "link" | "owner",
    readAt: r.readAt.toISOString(),
  };
}

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
  return rows.map(toMeta);
}

export async function getShared(id: string): Promise<{ meta: Meta; curriculum: Curriculum } | null> {
  const [row] = await db.select().from(curricula).where(and(eq(curricula.id, id), shared("curriculum"))).limit(1);
  if (!row) return null;
  const curriculum = row.data as Curriculum;
  const children = await db.select().from(curricula).where(and(eq(curricula.parentId, id), shared("electives")));
  const merged = new Map<string, ElectiveCourse>();
  for (const c of [...(curriculum.electives["major-elective"] ?? []), ...children.flatMap((c) => c.data as ElectiveCourse[])]) {
    if (!merged.has(c.courseNo)) merged.set(c.courseNo, c);
  }
  return { meta: toMeta(row), curriculum: { ...curriculum, electives: { ...curriculum.electives, ...(merged.size ? { "major-elective": [...merged.values()] } : {}) } } };
}

export async function minorCatalogs(university: string): Promise<{ meta: Meta; minors: Minor[] }[]> {
  const rows = await db
    .select()
    .from(curricula)
    .where(and(shared("minors"), eq(curricula.uniKey, normalizeKey(university))))
    .orderBy(desc(curricula.createdAt));
  return rows.map((r) => ({ meta: toMeta(r), minors: r.data as Minor[] }));
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
    data: row.data,
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

/** Pending -> shared; false when the row is missing or already shared. */
export async function confirm(id: string, cohortFrom?: number, cohortTo?: number): Promise<boolean> {
  const set = { status: "shared", ...(cohortFrom != null ? { cohortFrom } : {}), ...(cohortTo != null ? { cohortTo } : {}) };
  const rows = await db.update(curricula).set(set).where(and(eq(curricula.id, id), eq(curricula.status, "pending"))).returning({ id: curricula.id });
  return rows.length > 0;
}

export async function replaceData(id: string, data: unknown): Promise<void> {
  await db.update(curricula).set({ data, readAt: sql`now()` }).where(eq(curricula.id, id));
}

export async function saveOwner(row: Omit<NewRow, "sourceUrl"> & { sourceUrl?: string }): Promise<string> {
  return insert(row, "shared", "owner");
}
