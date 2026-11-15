"use client";

import { useState } from "react";
import { useWorkspace } from "@/components/planner/workspace-context";
import { CurriculumHeader } from "./header";
import { MinorPicker } from "./minor-picker";
import { ProgressTable } from "./progress-table";
import { SetupForm } from "./setup-form";
import { TermView } from "./term-view";

/** Waits for the saved workspace, then shows the setup form or the chosen curriculum. */
export function CurriculumGate() {
  const { ws, ready } = useWorkspace();
  const [status, setStatus] = useState("");
  if (!ready) return <div className="card h-64 animate-pulse" aria-busy="true" />;
  const c = ws.curriculum;
  if (!c) return <SetupForm onDone={() => {}} />;
  const plan = c.data.plans.find((p) => p.id === c.planId) ?? c.data.plans[0];
  return (
    <>
      <CurriculumHeader say={setStatus} />
      <p role="status" className="text-sm font-medium empty:hidden">
        {status}
      </p>
      <TermView plan={plan} say={setStatus} />
      <ProgressTable plan={plan} />
      <MinorPicker say={setStatus} />
    </>
  );
}
