"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch } from "react";
import { findConflicts } from "@/lib/core/conflicts";
import type { Conflict, Plan, Section, Workspace } from "@/lib/core/types";
import { activePlan, emptyWorkspace, planSections, workspaceReducer, type Action } from "@/lib/workspace/reducer";
import {
  clearAccountStorage,
  clearGuestStorage,
  hasNonEmptyWorkspace,
  loadGuestWorkspace,
  parseWorkspace,
  saveGuestWorkspace,
  storableJson,
} from "@/lib/workspace/storage";

type Ctx = {
  ws: Workspace;
  dispatch: Dispatch<Action>;
  plan: Plan;
  placed: Section[];
  conflicts: Conflict[];
  /** False until the workspace has been read, so the first paint never shows a wrong empty state. */
  ready: boolean;
  sync: SyncState;
  /** Deletes the signed-in account's saved workspace and starts empty; false when the server refused. */
  clearWorkspace: () => Promise<boolean>;
};

export type SyncState = "local" | "loading" | "saved" | "saving" | "error";

const WorkspaceContext = createContext<Ctx | null>(null);

/** owner: whose workspace this is (null = guest); saves go only to the owner it was loaded for. */
type Root = { ws: Workspace; ready: boolean; owner: string | null | undefined; sync: SyncState; pendingGuest: Workspace | null };
type RootAction =
  | Action
  | { type: "hydrate"; workspace: Workspace; owner: string | null; sync: SyncState; pendingGuest?: Workspace }
  | { type: "unload"; sync: SyncState }
  | { type: "sync"; sync: SyncState }
  | { type: "guestHandled" };

function rootReducer(state: Root, action: RootAction): Root {
  if (action.type === "hydrate")
    return { ws: action.workspace, ready: true, owner: action.owner, sync: action.sync, pendingGuest: action.pendingGuest ?? null };
  if (action.type === "unload") return { ws: emptyWorkspace(), ready: false, owner: undefined, sync: action.sync, pendingGuest: null };
  if (action.type === "sync") return { ...state, sync: action.sync };
  if (action.type === "guestHandled") return { ...state, pendingGuest: null };
  const ws = workspaceReducer(state.ws, action);
  return ws === state.ws ? state : { ...state, ws };
}

/**
 * Holds the student's workspace. Signed out, it lives in browser storage under the guest key.
 * Signed in, the database is the only copy: nothing of an account is written to browser storage,
 * so signing out or switching accounts never shows one account's plans to another.
 */
export function WorkspaceProvider({ children, userId }: { children: React.ReactNode; userId: string | null }) {
  const [{ ws, ready, owner, sync, pendingGuest }, rootDispatch] = useReducer(rootReducer, undefined, () => ({
    ws: emptyWorkspace(),
    ready: false,
    owner: undefined,
    sync: (userId ? "loading" : "local") as SyncState,
    pendingGuest: null,
  }));
  const dispatch = useCallback((action: Action) => rootDispatch(action), []);
  const setSync = (sync: SyncState) => rootDispatch({ type: "sync", sync });
  const lastSaved = useRef<string>("");
  // False when the server copy could not be read: saving then could overwrite plans we never saw.
  const canSave = useRef(false);
  const warned = useRef(false);

  useEffect(() => {
    lastSaved.current = "";
    canSave.current = false;
    if (userId === null) {
      const guest = loadGuestWorkspace(); // first, so a legacy guest copy moves before the cleanup below
      clearAccountStorage();
      rootDispatch({ type: "hydrate", workspace: guest, owner: null, sync: "local" });
      return;
    }
    rootDispatch({ type: "unload", sync: "loading" });
    clearAccountStorage(); // copies older versions left behind, whoever they belonged to
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/workspace");
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { workspace: unknown };
        if (cancelled) return;
        const remote = body.workspace == null ? null : parseWorkspace(body.workspace);
        const start = remote ?? emptyWorkspace();
        lastSaved.current = JSON.stringify(start); // a new account starts empty without writing an empty row
        canSave.current = true;
        const guest = remote ? null : loadGuestWorkspace();
        rootDispatch({
          type: "hydrate",
          workspace: start,
          owner: userId,
          sync: "saved",
          pendingGuest: guest && hasNonEmptyWorkspace(guest) ? guest : undefined,
        });
      } catch {
        if (cancelled) return;
        rootDispatch({ type: "hydrate", workspace: emptyWorkspace(), owner: userId, sync: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!ready || owner !== userId) return;
    if (userId === null) {
      if (!saveGuestWorkspace(ws)) warn();
      return;
    }
    const json = storableJson(ws);
    // Keep the last good copy on the server; a bad one would load back as an empty workspace.
    if (json === null) return warn();
    if (!canSave.current || json === lastSaved.current) return;
    setSync("saving");
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/workspace", { method: "PUT", headers: { "content-type": "application/json" }, body: json });
        if (!res.ok) throw new Error(String(res.status));
        lastSaved.current = json;
        setSync("saved");
      } catch {
        setSync("error");
      }
    }, 800);
    return () => clearTimeout(t);

    function warn() {
      if (!warned.current) console.warn("workspace: not saved, it does not pass validation");
      warned.current = true;
    }
  }, [ws, ready, owner, userId]);

  const acceptGuestImport = useCallback(() => {
    if (!pendingGuest || userId === null) return;
    rootDispatch({ type: "hydrate", workspace: pendingGuest, owner: userId, sync: "saved" }); // the save below sends it
    clearGuestStorage();
  }, [pendingGuest, userId]);

  const dismissGuestImport = useCallback(() => {
    clearGuestStorage();
    rootDispatch({ type: "guestHandled" });
  }, []);

  const clearWorkspace = useCallback(async () => {
    if (userId === null) {
      rootDispatch({ type: "hydrate", workspace: emptyWorkspace(), owner: null, sync: "local" });
      return true;
    }
    try {
      const res = await fetch("/api/workspace", { method: "DELETE", headers: { "content-type": "application/json" } });
      if (!res.ok) return false;
    } catch {
      return false;
    }
    const empty = emptyWorkspace();
    lastSaved.current = JSON.stringify(empty);
    canSave.current = true;
    rootDispatch({ type: "hydrate", workspace: empty, owner: userId, sync: "saved" });
    return true;
  }, [userId]);

  const value = useMemo(() => {
    const plan = activePlan(ws);
    const placed = planSections(ws, plan);
    return { ws, dispatch, plan, placed, conflicts: findConflicts(placed), ready, sync, clearWorkspace };
  }, [ws, ready, sync, dispatch, clearWorkspace]);

  return (
    <WorkspaceContext.Provider value={value}>
      {pendingGuest && <GuestImportBanner onAccept={acceptGuestImport} onDismiss={dismissGuestImport} />}
      {children}
    </WorkspaceContext.Provider>
  );
}

function GuestImportBanner({ onAccept, onDismiss }: { onAccept: () => void; onDismiss: () => void }) {
  return (
    <div role="region" aria-label="นำเข้าข้อมูลก่อนเข้าสู่ระบบ" className="relative z-20 border-b border-line bg-accent-soft px-4 py-3">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <p className="min-w-0 flex-1 font-medium">พบตารางหรือหลักสูตรที่ทำไว้ก่อนเข้าสู่ระบบ ต้องการนำเข้าบัญชีนี้ไหม?</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={onAccept}>
            นำเข้าบัญชีนี้
          </button>
          <button type="button" className="btn-ghost" onClick={onDismiss}>
            เริ่มใหม่ (ไม่นำเข้า)
          </button>
        </div>
      </div>
    </div>
  );
}

export function useWorkspace(): Ctx {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace outside WorkspaceProvider");
  return ctx;
}
