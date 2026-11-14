"use client";

import { useDeferredValue, useMemo, useState } from "react";
import type { Section } from "@/lib/core/types";
import { examLabel, meetingLabel, sectionLabel } from "@/lib/ui";
import { useWorkspace } from "./workspace-context";

type Course = { courseNo: string; title: string; credits?: number; sections: Section[] };

export function CourseSearch() {
  const { ws, plan, dispatch } = useWorkspace();
  const [q, setQ] = useState("");
  const query = useDeferredValue(q.trim().toLowerCase());
  const [open, setOpen] = useState<string | null>(null);

  const courses = useMemo(() => {
    const map = new Map<string, Course>();
    for (const s of ws.pool) {
      const c = map.get(s.courseNo) ?? { courseNo: s.courseNo, title: s.title, credits: s.credits, sections: [] };
      c.sections.push(s);
      map.set(s.courseNo, c);
    }
    return [...map.values()];
  }, [ws.pool]);

  const results = query
    ? courses.filter((c) => c.courseNo.startsWith(query) || c.title.toLowerCase().includes(query))
    : courses;

  return (
    <section className="card" aria-label="ค้นหาวิชา">
      <div className="p-3">
      <label htmlFor="course-q" className="label">
        ค้นหาด้วยรหัสหรือชื่อวิชา ({courses.length} วิชาในรายการของคุณ)
      </label>
      <input
        id="course-q"
        className="input"
        placeholder="เช่น 204 หรือ calculus"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        inputMode="search"
        autoComplete="off"
      />
      </div>
      <ul className="max-h-[30vh] divide-y divide-line overflow-y-auto border-t border-line lg:max-h-[38vh]" aria-live="polite">
        {results.length === 0 && <li className="p-3 text-sm text-muted">ไม่พบวิชาที่ตรงกับ “{q}”</li>}
        {results.slice(0, 60).map((c) => {
          const wanted = plan.courseNos.includes(c.courseNo);
          const expanded = open === c.courseNo;
          return (
            <li key={c.courseNo} className="hover:bg-canvas">
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : c.courseNo)}
                >
                  <span className="font-mono text-sm font-bold tabular-nums">{c.courseNo}</span>{" "}
                  <span className="text-xs text-muted tabular-nums">
                    {c.credits ? `${c.credits} นก. · ` : ""}
                    {c.sections.length} ตอน
                  </span>
                  <span className="block truncate text-sm" title={c.title}>{c.title}</span>
                </button>
                <button
                  type="button"
                  className={wanted ? "btn-ghost text-xs" : "btn min-h-8 text-xs"}
                  disabled={wanted}
                  onClick={() => dispatch({ type: "wantCourse", courseNo: c.courseNo })}
                >
                  {wanted ? "เพิ่มแล้ว" : "เพิ่ม"}
                </button>
              </div>
              {expanded && (
                <ul className="mx-3 mb-3 flex flex-col gap-2 border-t border-line pt-2 text-xs tabular-nums">
                  {c.sections.map((s) => (
                    <li key={s.id}>
                      <span className="font-medium">{sectionLabel(s)}</span>{" "}
                      <span className="text-muted">{s.meetings.map(meetingLabel).join(" / ") || "TBA"}</span>
                      {s.instructors.length > 0 && <span className="block text-muted">{s.instructors.join(", ")}</span>}
                      <span className="block text-muted">
                        <span className="whitespace-nowrap">กลางภาค {examLabel(s.midterm)}</span> ·{" "}
                        <span className="whitespace-nowrap">ปลายภาค {examLabel(s.final)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
