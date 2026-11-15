"use client";

import { useId } from "react";
import { useWorkspace } from "@/components/planner/workspace-context";
import { currentTermView, type PlanCourse, type StudyPlan } from "@/lib/core/curriculum";
import { activePlan } from "@/lib/workspace/reducer";
import { SlotRow } from "./elective-list";

function Chips({ courses }: { courses: (PlanCourse & { done?: boolean })[] }) {
  return (
    <ul className="flex min-w-0 basis-full flex-wrap gap-2 sm:flex-1 sm:basis-0">
      {courses.map((c) => (
        <li key={c.courseNo} className={`chip ${c.done ? "text-muted line-through" : ""}`}>
          <span className="font-mono font-semibold">{c.courseNo}</span>&nbsp;{c.title} · {c.credits} นก.
          {c.done && <span className="sr-only"> (ผ่านแล้ว)</span>}
        </li>
      ))}
    </ul>
  );
}

/** "เทอมนี้ตามแผน": the plan's courses and elective slots for the term being viewed. */
export function TermView({ plan, say }: { plan: StudyPlan; say: (s: string) => void }) {
  const { ws, dispatch } = useWorkspace();
  const cur = ws.curriculum!;
  const uid = useId();
  const terms = [...plan.terms].sort((a, b) => a.year - b.year || a.semester - b.semester);
  const now = currentTermView(cur, ws.term);
  if (!now) return null;
  const { at, view } = now;
  const value = view.inPlan ? `${at.year}-${at.semester}` : "";
  const wanted = [...new Set([...view.overdue, ...view.required.filter((c) => !c.done)].map((c) => c.courseNo))];

  function addAll() {
    const have = new Set(activePlan(ws).courseNos);
    const fresh = wanted.filter((n) => !have.has(n)).length;
    dispatch({ type: "wantCourses", courseNos: wanted });
    say(fresh ? `เพิ่ม ${fresh} วิชาลงรายการแล้ว` : "วิชาเหล่านี้อยู่ในรายการแล้ว");
  }

  const addBtn = wanted.length > 0 && (
    <button type="button" className="btn min-h-8" onClick={addAll}>
      เพิ่มทั้งหมดลงรายการ
    </button>
  );

  return (
    <section className="card" aria-labelledby={`${uid}h`}>
      <div className="bar flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${uid}h`}>
          เทอมนี้ตามแผน (ปี {view.year} เทอม {view.semester}
          {view.inPlan ? ` · ${view.credits} หน่วยกิต` : ""})
        </h2>
        <label className="flex items-center gap-2 text-sm font-normal">
          ดูเทอม
          <select
            className="input w-auto"
            value={value}
            onChange={(e) => {
              const [year, semester] = e.target.value.split("-").map(Number);
              dispatch({ type: "setViewTerm", year, semester });
            }}
          >
            {!view.inPlan && (
              <option value="" disabled>
                เลือกเทอม
              </option>
            )}
            {terms.map((t) => (
              <option key={`${t.year}-${t.semester}`} value={`${t.year}-${t.semester}`}>
                ปี {t.year} เทอม {t.semester}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-col divide-y divide-line px-4">
        {!view.inPlan && <p className="py-3 text-sm text-muted">เทอมนี้ไม่อยู่ในแผนการเรียน เลือกเทอมที่ต้องการดูจากรายการด้านบน</p>}
        {view.overdue.length > 0 && (
          <div className="flex flex-wrap items-start gap-x-3 gap-y-2 py-3">
            <span className="w-full shrink-0 font-semibold sm:w-28">ค้างจากเทอมก่อน</span>
            <Chips courses={view.overdue} />
            {view.required.length === 0 && addBtn}
          </div>
        )}
        {view.required.length > 0 && (
          <div className="flex flex-wrap items-start gap-x-3 gap-y-2 py-3">
            <span className="w-full shrink-0 font-semibold sm:w-28">วิชาบังคับ</span>
            <Chips courses={view.required} />
            {addBtn}
          </div>
        )}
        {view.slots.map((s) => (
          <SlotRow key={s.id} slot={s} say={say} />
        ))}
      </div>
    </section>
  );
}
