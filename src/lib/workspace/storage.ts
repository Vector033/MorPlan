import { z } from "zod";
import { SLOT_KINDS } from "@/lib/core/curriculum";
import { COURSE_NO, LIMITS } from "@/lib/core/curriculum-limits";
import { DAYS, type Workspace } from "@/lib/core/types";
import { emptyWorkspace, TERM, VIEW_SEMESTER_MAX, VIEW_YEAR_MAX } from "./reducer";

/** The signed-out workspace. A signed-in workspace lives in memory and the database only. */
export const GUEST_KEY = "morplan:workspace:guest:v1";
/** Before accounts were kept apart: one key for everyone, so it may hold a signed-in account's copy. */
export const LEGACY_KEY = "morplan:workspace:v1";
/** Per-account copies; never written now, removed wherever they are found. */
export const ACCOUNT_PREFIX = "morplan:workspace:u:";

// Every field is bounded: this schema guards the share and workspace APIs as
// well as browser storage, so nothing unbounded reaches the database.
const minutes = z.number().int().min(0).max(24 * 60);
const slot = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: minutes, end: minutes });
const text = (max: number) => z.string().max(max);
const courseNo = z.string().regex(COURSE_NO);
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

const credits = z.number().min(0).max(LIMITS.credits);
const source = z.object({
  url: text(LIMITS.url).optional(),
  title: text(LIMITS.text),
  readAt: text(200),
  provenance: z.enum(["link", "owner", "private"]),
});
const planItem = z.discriminatedUnion("type", [
  z.object({ type: z.literal("course"), courseNo, title: text(LIMITS.text), credits }),
  z.object({ type: z.literal("slot"), kind: z.enum(SLOT_KINDS), credits, note: text(LIMITS.text).optional() }),
]);
export const electiveCourseSchema = z.object({
  courseNo,
  title: text(LIMITS.text),
  credits: credits.optional(),
  level: z.number().int().min(0).max(900).optional() // hundreds, as levelOf returns (300 = third-year),
});
export const minorSchema = z.object({
  name: text(LIMITS.text),
  faculty: text(LIMITS.text).optional(),
  rules: text(LIMITS.rules),
  groups: z
    .array(z.object({ label: text(LIMITS.text), minCredits: credits.optional(), courseNos: z.array(courseNo).max(LIMITS.groupCodes) }))
    .max(LIMITS.groups),
});
export const curriculumSchema = z.object({
  title: text(LIMITS.text),
  university: text(LIMITS.text),
  faculty: text(LIMITS.text),
  major: text(LIMITS.text),
  cohortFrom: z.number().int().min(0).max(LIMITS.cohort),
  cohortTo: z.number().int().min(0).max(LIMITS.cohort).optional(),
  plans: z
    .array(
      z.object({
        id: text(LIMITS.text),
        name: text(LIMITS.text),
        minCredits: z.number().min(0).max(LIMITS.planCredits).optional(),
        terms: z
          .array(
            z.object({
              year: z.number().int().min(1).max(20),
              semester: z.number().int().min(0).max(9),
              items: z.array(planItem).max(LIMITS.items),
            }),
          )
          .max(LIMITS.terms),
      }),
    )
    .max(LIMITS.plans),
  electives: z.object(Object.fromEntries(SLOT_KINDS.map((k) => [k, z.array(electiveCourseSchema).max(LIMITS.electives).optional()]))),
});
export const curriculumStateSchema = z.object({
  ref: text(200).optional(),
  data: curriculumSchema,
  source,
  cohort: z.number().int().min(0).max(99),
  planId: text(200),
  minor: minorSchema.optional(),
  minorSource: source.optional(),
  passed: z.array(z.object({ courseNo, credits, slotId: text(200).optional() })).max(LIMITS.passed),
  doneSlots: z.array(text(200)).max(LIMITS.doneSlots),
  viewTerm: z.object({ year: z.number().int().min(1).max(VIEW_YEAR_MAX), semester: z.number().int().min(1).max(VIEW_SEMESTER_MAX) }).optional(),
});

const planId = z.string().max(4);
export const workspaceSchema = z.object({
  version: z.literal(1),
  term: z.string().regex(TERM),
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

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * The guest workspace. Never throws: private mode, blocked storage or corrupt JSON give an empty workspace.
 * Moves a legacy copy to the guest key once; call it only while signed out, as the legacy key may hold an account's copy.
 */
export function loadGuestWorkspace(storage: Store | undefined = safeLocalStorage()): Workspace {
  try {
    const legacy = storage?.getItem(LEGACY_KEY);
    if (legacy != null) {
      if (!storage?.getItem(GUEST_KEY)) storage?.setItem(GUEST_KEY, legacy);
      storage?.removeItem(LEGACY_KEY);
    }
    const text = storage?.getItem(GUEST_KEY);
    if (!text) return emptyWorkspace();
    return parseWorkspace(JSON.parse(text)) ?? emptyWorkspace();
  } catch {
    return emptyWorkspace();
  }
}

/** The JSON to persist, or null when it would not load back: saving it would replace the last good copy with one that reads as empty. */
export function storableJson(ws: Workspace): string | null {
  const json = JSON.stringify(ws);
  return parseWorkspace(JSON.parse(json)) ? json : null;
}

/** Writes only a workspace that loads back; returns false (and writes nothing) otherwise. */
export function saveGuestWorkspace(ws: Workspace, storage: Pick<Storage, "setItem"> | undefined = safeLocalStorage()): boolean {
  const json = storableJson(ws);
  if (json === null) return false;
  try {
    storage?.setItem(GUEST_KEY, json);
  } catch {
    // Quota or blocked storage: the session keeps working in memory.
  }
  return true;
}

export function clearGuestStorage(storage: Pick<Storage, "removeItem"> | undefined = safeLocalStorage()): void {
  try {
    storage?.removeItem(GUEST_KEY);
  } catch {
    // Blocked storage holds nothing to clear.
  }
}

/** Removes every copy that may belong to an account: per-account keys and the legacy shared key. */
export function clearAccountStorage(storage: Pick<Storage, "length" | "key" | "removeItem"> | undefined = safeLocalStorage()): void {
  try {
    if (!storage) return;
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((k): k is string => !!k?.startsWith(ACCOUNT_PREFIX));
    for (const k of [...keys, LEGACY_KEY]) storage.removeItem(k);
  } catch {
    // Blocked storage holds nothing to clear.
  }
}

/** True when there is anything worth offering to carry into an account. */
export function hasNonEmptyWorkspace(ws: Workspace): boolean {
  return ws.pool.length > 0 || ws.curriculum != null || ws.plans.some((p) => p.courseNos.length > 0 || p.sectionIds.length > 0);
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
