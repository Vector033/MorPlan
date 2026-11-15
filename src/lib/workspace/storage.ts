import { z } from "zod";
import { SLOT_KINDS } from "@/lib/core/curriculum";
import { DAYS, type Workspace } from "@/lib/core/types";
import { emptyWorkspace, VIEW_SEMESTER_MAX, VIEW_YEAR_MAX } from "./reducer";

export const STORAGE_KEY = "morplan:workspace:v1";

// Every field is bounded: this schema guards the share and workspace APIs as
// well as browser storage, so nothing unbounded reaches the database.
const minutes = z.number().int().min(0).max(24 * 60);
const slot = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: minutes, end: minutes });
const text = (max: number) => z.string().max(max);
// มช. codes are 6 digits; other universities use 7–8 digits or letters ("01204111", "ITCS101").
const courseNo = z.string().regex(/^[0-9A-Z]{2,12}$/);
const sectionNo = z.string().regex(/^[0-9A-Z]{1,6}$/);
export const sectionSchema = z.object({
  id: z.string().regex(/^[0-9A-Z]{2,12}-[0-9A-Z]{1,6}-[0-9A-Z]{1,6}$/),
  courseNo,
  title: text(200),
  credits: z.number().min(0).max(30).optional(),
  lec: sectionNo,
  lab: sectionNo,
  meetings: z
    .array(
      z.object({
        days: z.array(z.enum(DAYS)).max(7),
        start: minutes,
        end: minutes,
        room: text(60).optional(),
        kind: z.enum(["lec", "lab"]).optional(),
      }),
    )
    .max(8),
  instructors: z.array(text(150)).max(12),
  seats: z.number().int().min(0).max(10_000).optional(),
  midterm: slot.optional(),
  final: slot.optional(),
  note: text(200).optional(),
});

const credits = z.number().min(0).max(30);
const source = z.object({
  url: text(500).optional(),
  title: text(200),
  readAt: text(200),
  provenance: z.enum(["link", "owner", "private"]),
});
const planItem = z.discriminatedUnion("type", [
  z.object({ type: z.literal("course"), courseNo, title: text(200), credits }),
  z.object({ type: z.literal("slot"), kind: z.enum(SLOT_KINDS), credits, note: text(200).optional() }),
]);
export const electiveCourseSchema = z.object({
  courseNo,
  title: text(200),
  credits: credits.optional(),
  level: z.number().int().min(0).max(9).optional(),
});
export const minorSchema = z.object({
  name: text(200),
  faculty: text(200).optional(),
  rules: text(4000),
  groups: z
    .array(z.object({ label: text(200), minCredits: credits.optional(), courseNos: z.array(courseNo).max(200) }))
    .max(12),
});
export const curriculumSchema = z.object({
  title: text(200),
  university: text(200),
  faculty: text(200),
  major: text(200),
  cohortFrom: z.number().int().min(0).max(99),
  cohortTo: z.number().int().min(0).max(99).optional(),
  plans: z
    .array(
      z.object({
        id: text(200),
        name: text(200),
        minCredits: z.number().min(0).max(500).optional(),
        terms: z
          .array(
            z.object({
              year: z.number().int().min(1).max(20),
              semester: z.number().int().min(0).max(9),
              items: z.array(planItem).max(20),
            }),
          )
          .max(20),
      }),
    )
    .max(8),
  electives: z.object(Object.fromEntries(SLOT_KINDS.map((k) => [k, z.array(electiveCourseSchema).max(400).optional()]))),
});
export const curriculumStateSchema = z.object({
  ref: text(200).optional(),
  data: curriculumSchema,
  source,
  cohort: z.number().int().min(0).max(99),
  planId: text(200),
  minor: minorSchema.optional(),
  minorSource: source.optional(),
  passed: z.array(z.object({ courseNo, credits, slotId: text(200).optional() })).max(400),
  doneSlots: z.array(text(200)).max(200),
  viewTerm: z.object({ year: z.number().int().min(1).max(VIEW_YEAR_MAX), semester: z.number().int().min(1).max(VIEW_SEMESTER_MAX) }).optional(),
});

const planId = z.string().max(4);
export const workspaceSchema = z.object({
  version: z.literal(1),
  term: z.string().regex(/^[123]\/\d{4}$/),
  university: text(100).optional(),
  pool: z.array(sectionSchema).max(3000),
  plans: z
    .array(
      z.object({
        id: planId,
        name: text(30),
        courseNos: z.array(courseNo).max(80),
        sectionIds: z.array(z.string().max(30)).max(80),
      }),
    )
    .min(1)
    .max(5),
  activePlanId: planId,
  curriculum: curriculumStateSchema.optional(),
});

/** Validate untrusted JSON (browser storage, server rows, share snapshots). */
export function parseWorkspace(raw: unknown): Workspace | null {
  const r = workspaceSchema.safeParse(raw);
  return r.success ? (r.data as Workspace) : null;
}

/** Never throws: private mode, blocked storage or corrupt JSON give an empty workspace. */
export function loadWorkspace(storage: Pick<Storage, "getItem"> | undefined = safeLocalStorage()): Workspace {
  try {
    const text = storage?.getItem(STORAGE_KEY);
    if (!text) return emptyWorkspace();
    return parseWorkspace(JSON.parse(text)) ?? emptyWorkspace();
  } catch {
    return emptyWorkspace();
  }
}

export function saveWorkspace(ws: Workspace, storage: Pick<Storage, "setItem"> | undefined = safeLocalStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(ws));
  } catch {
    // Quota or blocked storage: the session keeps working in memory.
  }
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
