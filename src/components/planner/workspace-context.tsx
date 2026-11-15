"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type Dispatch } from "react";
import { findConflicts } from "@/lib/core/conflicts";
import type { Conflict, Plan, Section, Workspace } from "@/lib/core/types";
import { activePlan, emptyWorkspace, planSections, workspaceReducer, type Action } from "@/lib/workspace/reducer";
import { loadWorkspace, parseWorkspace, saveWorkspace } from "@/lib/workspace/storage";

type Ctx = {
  ws: Workspace;
  dispatch: Dispatch<Action>;
  plan: Plan;
  placed: Section[];
  conflicts: Conflict[];
  /** False until browser storage has been read, so the first paint never shows a wrong empty state. */
  ready: boolean;
  sync: SyncState;
};

export type SyncState = "local" | "loading" | "saved" | "saving" | "error";

const WorkspaceContext = createContext<Ctx | null>(null);

type Root = { ws: Workspace; ready: boolean };
type RootAction = Action | { type: "hydrate"; workspace: Workspace };

function rootReducer(state: Root, action: RootAction): Root {
  if (action.type === "hydrate") return { ws: action.workspace, ready: true };
  const ws = workspaceReducer(state.ws, action);
  return ws === state.ws ? state : { ...state, ws };
}

/**
 * Holds the student's workspace. It lives in browser storage; when signed in
 * it is also mirrored to /api/workspace (server copy wins on first load, and
 * a server with nothing stored receives the browser copy).
 */
export function WorkspaceProvider({ children, signedIn }: { children: React.ReactNode; signedIn: boolean }) {
  const [{ ws, ready }, rootDispatch] = useReducer(rootReducer, undefined, () => ({ ws: emptyWorkspace(), ready: false }));
  const dispatch = useCallback((action: Action) => rootDispatch(action), []);
  const [sync, setSync] = useState<SyncState>(signedIn ? "loading" : "local");
  const lastSaved = useRef<string>("");
  const warned = useRef(false);

  useEffect(() => {
    const local = loadWorkspace();
    if (!signedIn) {
      rootDispatch({ type: "hydrate", workspace: local });
      return;
    }
    (async () => {
      let remote: Workspace | null = null;
      try {
        const res = await fetch("/api/workspace");
        const body = res.ok ? ((await res.json()) as { workspace: unknown }) : null;
        remote = body ? parseWorkspace(body.workspace) : null;
        if (remote) lastSaved.current = JSON.stringify(remote);
        setSync("saved");
      } catch {
        setSync("error");
      }
      rootDispatch({ type: "hydrate", workspace: remote ?? local });
    })();
  }, [signedIn]);

  useEffect(() => {
    if (!ready) return;
    if (!saveWorkspace(ws)) {
      // Keep the last good copy in storage and on the server; a bad one would load back as an empty workspace.
      if (!warned.current) console.warn("workspace: not saved, it does not pass validation");
      warned.current = true;
      return;
    }
    if (!signedIn) return;
    const json = JSON.stringify(ws);
    if (json === lastSaved.current) return;
    setSync("saving");
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/workspace", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: json,
        });
        if (!res.ok) throw new Error(String(res.status));
        lastSaved.current = json;
        setSync("saved");
      } catch {
        setSync("error");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [ws, ready, signedIn]);

  const value = useMemo(() => {
    const plan = activePlan(ws);
    const placed = planSections(ws, plan);
    return { ws, dispatch, plan, placed, conflicts: findConflicts(placed), ready, sync };
  }, [ws, ready, sync, dispatch]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Ctx {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace outside WorkspaceProvider");
  return ctx;
}
