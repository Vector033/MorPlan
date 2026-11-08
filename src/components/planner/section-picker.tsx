"use client";

import { useEffect, useRef } from "react";
import { findConflicts } from "@/lib/core/conflicts";
import { conflictText, examLabel, meetingLabel, sectionLabel } from "@/lib/ui";
import { sectionsOfCourse } from "@/lib/workspace/reducer";
import { useWorkspace } from "./workspace-context";

/** Tap/keyboard alternative to dragging: pick a section from a list with clash previews. */
export function SectionPicker({ courseNo, onClose }: { courseNo: string; onClose: () => void }) {
  const { ws, placed, dispatch } = useWorkspace();
  const ref = useRef<HTMLDialogElement>(null);
  const sections = sectionsOfCourse(ws, courseNo);
  const current = placed.find((s) => s.courseNo === courseNo);
  const others = placed.filter((s) => s.courseNo !== courseNo);
  const byId = new Map([...ws.pool].map((s) => [s.id, s]));

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      className="anim-modal m-auto w-[min(560px,calc(100vw-1.5rem))] rounded-2xl border border-line bg-white p-0 text-ink shadow-lg backdrop:bg-ink/40"
      aria-labelledby="picker-title"
    >
      <div className="flex items-start justify-between gap-3 border-b border-line p-4">
        <div>
          <h2 id="picker-title" className="text-lg font-bold">
            เลือกตอนเรียน <span className="font-mono">{courseNo}</span>
          </h2>
          <p className="text-sm text-muted">{sections[0]?.title}</p>
        </div>
        <button className="btn-ghost" onClick={() => ref.current?.close()} aria-label="ปิด">
          ✕
        </button>
      </div>
      <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
        {sections.map((s) => {
          const clashes = findConflicts([...others, s]).filter((c) => c.a === s.id || c.b === s.id);
          const isCurrent = current?.id === s.id;
          return (
            <li key={s.id} className={`p-4 ${isCurrent ? "bg-canvas" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 text-sm">
                  <p className="font-medium">
                    {sectionLabel(s)} {isCurrent && <span className="text-xs font-semibold">(ในตารางตอนนี้)</span>}
                  </p>
                  {s.meetings.length === 0 && <p className="text-muted">TBA</p>}
                  {s.meetings.map((m, i) => (
                    <p key={i} className="text-muted">
                      {meetingLabel(m)}
                    </p>
                  ))}
                  {s.instructors.length > 0 && <p className="text-muted">{s.instructors.join(", ")}</p>}
                  <p className="text-xs text-muted">
                    กลางภาค {examLabel(s.midterm)} · ปลายภาค {examLabel(s.final)}
                  </p>
                  {clashes.map((c, i) => (
                    <p key={i} className="mt-1 text-xs font-medium text-danger">
                      {conflictText(c, byId)}
                    </p>
                  ))}
                </div>
                <button
                  className={isCurrent ? "btn" : "btn-primary"}
                  onClick={() => {
                    if (isCurrent) dispatch({ type: "unplace", courseNo });
                    else dispatch({ type: "place", sectionId: s.id });
                    ref.current?.close();
                  }}
                >
                  {isCurrent ? "เอาออก" : clashes.length ? "วาง (ชน)" : "วาง"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </dialog>
  );
}
