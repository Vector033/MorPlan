import { z } from "zod";
import { DAYS, type Workspace } from "@/lib/core/types";
import { emptyWorkspace } from "./reducer";

export const STORAGE_KEY = "morplan:workspace:v1";

// Every field is bounded: this schema guards the share and workspace APIs as
// well as browser storage, so nothing unbounded reaches the database.
const minutes = z.number().int().min(0).max(24 * 60);
const slot = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: minutes, end: minutes });
const text = (max: number) => z.string().max(max);
export const sectionSchema = z.object({
  id: z.string().regex(/^\d{6}-\d{3}-\d{3}$/),
  courseNo: z.string().regex(/^\d{6}$/),
  title: text(200),
  credits: z.number().min(0).max(30).optional(),
  lec: z.string().regex(/^\d{3}$/),
  lab: z.string().regex(/^\d{3}$/),
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

const planId = z.string().max(4);
export const workspaceSchema = z.object({
  version: z.literal(1),
  term: z.string().regex(/^[123]\/\d{4}$/),
  pool: z.array(sectionSchema).max(3000),
  plans: z
    .array(
      z.object({
        id: planId,
        name: text(30),
        courseNos: z.array(z.string().regex(/^\d{6}$/)).max(80),
        sectionIds: z.array(z.string().max(20)).max(80),
      }),
    )
    .min(1)
    .max(5),
  activePlanId: planId,
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
