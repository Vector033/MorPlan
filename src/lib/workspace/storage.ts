import { z } from "zod";
import { DAYS, type Workspace } from "@/lib/core/types";
import { emptyWorkspace } from "./reducer";

export const STORAGE_KEY = "morplan:workspace:v1";

const slot = z.object({ date: z.string(), start: z.number(), end: z.number() });
export const sectionSchema = z.object({
  id: z.string(),
  courseNo: z.string().regex(/^\d{6}$/),
  title: z.string(),
  credits: z.number().optional(),
  lec: z.string(),
  lab: z.string(),
  meetings: z.array(
    z.object({
      days: z.array(z.enum(DAYS)),
      start: z.number(),
      end: z.number(),
      room: z.string().optional(),
      kind: z.enum(["lec", "lab"]).optional(),
    }),
  ),
  instructors: z.array(z.string()),
  seats: z.number().optional(),
  midterm: slot.optional(),
  final: slot.optional(),
  note: z.string().optional(),
});

export const workspaceSchema = z.object({
  version: z.literal(1),
  term: z.string(),
  pool: z.array(sectionSchema).max(3000),
  plans: z
    .array(z.object({ id: z.string(), name: z.string(), courseNos: z.array(z.string()), sectionIds: z.array(z.string()) }))
    .min(1)
    .max(5),
  activePlanId: z.string(),
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
