import { z } from "zod";
import { LIMITS } from "@/lib/core/curriculum-limits";
import type { curricula } from "@/db/schema";
import type { Curriculum, ElectiveCourse, Minor } from "@/lib/core/curriculum";
import { curriculumSchema, electiveCourseSchema, minorSchema } from "@/lib/workspace/storage";
import type { DocKind, ReadResult } from "./read";

/** Pure row helpers, kept apart from store.ts so they run without a database. */

export type Row = typeof curricula.$inferSelect;
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

const schemas = {
  curriculum: curriculumSchema,
  electives: z.array(electiveCourseSchema).max(LIMITS.electives),
  minors: z.array(minorSchema).max(200),
} satisfies Record<DocKind, z.ZodType>;

/** Parse a jsonb payload for its kind; throws when it does not match. */
export function parseData(kind: "curriculum", data: unknown): Curriculum;
export function parseData(kind: "electives", data: unknown): ElectiveCourse[];
export function parseData(kind: "minors", data: unknown): Minor[];
export function parseData(kind: DocKind, data: unknown): ReadResult["data"];
export function parseData(kind: DocKind, data: unknown): ReadResult["data"] {
  return schemas[kind].parse(data) as ReadResult["data"];
}

const opt = <T>(v: T | null): T | undefined => v ?? undefined;

export function toMeta(r: Row, data: unknown): Meta {
  const title = r.kind === "curriculum" ? (data as Curriculum).title : "";
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

/** Validate a stored row; a malformed or older-shape row is skipped and logged by id only. */
export function readRow(row: Row): { meta: Meta; data: ReadResult["data"] } | null {
  const parsed = schemas[row.kind as DocKind]?.safeParse(row.data);
  if (!parsed?.success) {
    console.warn(`curricula: skipping unreadable row ${row.id}`);
    return null;
  }
  return { meta: toMeta(row, parsed.data), data: parsed.data as ReadResult["data"] };
}

type Range = { from?: number | null; to?: number | null };

/** The cohort range after applying `given` over `current`; null when it would end before it starts. `to` may stay absent (open-ended). */
export function mergeRange(current: Range, given: Range): { from?: number; to?: number } | null {
  const from = given.from ?? current.from ?? undefined;
  const to = given.to ?? current.to ?? undefined;
  return from != null && to != null && to < from ? null : { from, to };
}
