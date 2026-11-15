"use client";

import { useWorkspace } from "@/components/planner/workspace-context";
import { DISCLAIMER, thaiDate } from "./format";
import { SetupForm } from "./setup-form";

/** Waits for the saved workspace, then shows setup or (until the term view lands) the chosen curriculum. */
export function CurriculumGate() {
  const { ws, ready } = useWorkspace();
  if (!ready) return <div className="card h-64 animate-pulse" aria-busy="true" />;
  const c = ws.curriculum;
  if (!c) return <SetupForm onDone={() => {}} />;
  return (
    <section className="card p-4">
      <h2 className="text-heading font-bold">เทอมนี้ตามแผน</h2>
      <p className="mt-2 text-sm text-muted">
        {c.source.title} · อ่านเมื่อ {thaiDate(c.source.readAt)}
      </p>
      <p className="text-xs text-muted">{DISCLAIMER}</p>
    </section>
  );
}
