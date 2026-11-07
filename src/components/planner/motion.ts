"use client";

import { useEffect, useRef, useState } from "react";
import type { Conflict, Section } from "@/lib/core/types";

type Snapshot = { planId: string; placed: Set<string>; conflicts: Set<string> };
type Motion = { snapId: string | null; shakeIds: ReadonlySet<string> };

const NONE: Motion = { snapId: null, shakeIds: new Set() };
const conflictKey = (c: Conflict) => `${c.kind}:${[c.a, c.b].sort().join("|")}`;

/**
 * Which blocks should snap or shake right now. Only edits inside one plan count:
 * first load and plan switches record the state without animating anything.
 */
export function usePlacementMotion(planId: string, placed: Section[], conflicts: Conflict[]): Motion {
  const placedIds = placed.map((s) => s.id);
  const conflictKeys = conflicts.map(conflictKey);
  const sig = `${planId}#${placedIds.join(",")}#${conflictKeys.join(",")}`;

  const [seen, setSeen] = useState<{ sig: string; snap: Snapshot } | null>(null);
  const [motion, setMotion] = useState<Motion>(NONE);

  // Derived-state update during render (React's "store previous props" pattern).
  if (seen?.sig !== sig) {
    const snap: Snapshot = { planId, placed: new Set(placedIds), conflicts: new Set(conflictKeys) };
    if (seen && seen.snap.planId === planId) {
      const added = placedIds.filter((id) => !seen.snap.placed.has(id));
      const fresh = conflicts.filter((c) => !seen.snap.conflicts.has(conflictKey(c)));
      if (added.length || fresh.length) {
        setMotion({ snapId: added.at(-1) ?? null, shakeIds: new Set(fresh.flatMap((c) => [c.a, c.b])) });
      }
    }
    setSeen({ sig, snap });
  }

  useEffect(() => {
    if (motion === NONE) return;
    const t = setTimeout(() => setMotion(NONE), 450);
    return () => clearTimeout(t);
  }, [motion]);

  return motion;
}

/** Eases a number toward its new value (ease-out, 300ms). Instant under reduced motion and on first paint. */
export function useCountUp(value: number, ms = 300): number {
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    const from = current.current;
    if (from === value) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let start = 0;
    let id = 0;
    const step = (now: number) => {
      start ||= now;
      const t = reduce ? 1 : Math.min(1, (now - start) / ms);
      const v = t >= 1 ? value : Math.round(from + (value - from) * (1 - Math.pow(1 - t, 3)));
      current.current = v;
      setShown(v);
      if (t < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [value, ms]);
  return shown;
}
