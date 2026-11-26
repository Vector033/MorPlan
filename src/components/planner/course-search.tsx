"use client";

import { useDraggable } from "@dnd-kit/core";
import { useDeferredValue, useMemo, useState } from "react";
import { CheckIcon, GripIcon, WarningIcon, XIcon } from "@/components/icons";
import { findConflicts } from "@/lib/core/conflicts";
import type { Section } from "@/lib/core/types";
import { DEMO_NOTE } from "@/lib/demo";
import { examLabel, meetingLabel, sectionLabel } from "@/lib/ui";
import { useWorkspace } from "./workspace-context";

type Course = { courseNo: string; title: string; credits?: number; sections: Section[] };

export function CourseSearch() {
  const { ws, plan, placed, dispatch } = useWorkspace();
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

  const placedById = useMemo(() => new Map(placed.map((s) => [s.id, s])), [placed]);

  const results = query
    ? courses.filter((c) => c.courseNo.toLowerCase().includes(query) || c.title.toLowerCase().includes(query))
    : courses;
  const demo = courses.filter((c) => c.sections.every((s) => s.note === DEMO_NOTE)).map((c) => c.courseNo);

  function remove(courseNos: string[], question: string) {
    if (!window.confirm(question)) return;
    for (const courseNo of courseNos) dispatch({ type: "removeFromPool", courseNo });
  }

  return (
    <section className="card" aria-label="ค้นหาวิชา">
      <div className="p-3">
        <label htmlFor="course-q" className="label">
          ค้นหาด้วยรหัสหรือชื่อวิชา ({courses.length} วิชาในรายการของคุณ)
        </label>
        <input
          id="course-q"
          className="input"
          placeholder="เช่น CS101 หรือ calculus"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          inputMode="search"
          autoComplete="off"
        />
      </div>
      <ul className="max-h-[30vh] divide-y divide-line overflow-y-auto border-t border-line lg:max-h-[38vh]" aria-live="polite">
        {results.length === 0 && <li className="p-3 text-sm text-muted">ไม่พบวิชาที่ตรงกับ “{q}”</li>}
        {results.slice(0, 60).map((c) => (
          <SearchCourseRow
            key={c.courseNo}
            course={c}
            wanted={plan.courseNos.includes(c.courseNo)}
            expanded={open === c.courseNo}
            placed={placed}
            placedById={placedById}
            onToggle={() => setOpen(open === c.courseNo ? null : c.courseNo)}
            onWant={() => dispatch({ type: "wantCourse", courseNo: c.courseNo })}
            onRemove={() => remove([c.courseNo], `ลบ ${c.courseNo} ออกจากรายการและทุกแผน?`)}
          />
        ))}
      </ul>
      {courses.length > 0 && (
        <div className="flex flex-wrap gap-1 border-t border-line px-2 py-1.5">
          {demo.length > 0 && demo.length < courses.length && (
            <button type="button" className="btn-ghost text-xs" onClick={() => remove(demo, `ลบวิชาตัวอย่าง ${demo.length} วิชาออกจากรายการและทุกแผน?`)}>
              ล้างวิชาตัวอย่าง
            </button>
          )}
          <button
            type="button"
            className="btn-ghost text-xs"
            onClick={() => remove(courses.map((c) => c.courseNo), `ลบทั้ง ${courses.length} วิชาออกจากรายการและทุกแผน?`)}
          >
            ล้างรายการทั้งหมด
          </button>
        </div>
      )}
    </section>
  );
}

function SearchCourseRow({
  course: c,
  wanted,
  expanded,
  placed,
  placedById,
  onToggle,
  onWant,
  onRemove,
}: {
  course: Course;
  wanted: boolean;
  expanded: boolean;
  placed: Section[];
  placedById: ReadonlyMap<string, Section>;
  onToggle: () => void;
  onWant: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `search-course:${c.courseNo}`,
    data: { courseNo: c.courseNo, from: "search" },
    attributes: { roleDescription: "วิชาจากผลค้นหาที่ลากได้" },
  });

  const others = useMemo(() => placed.filter((p) => p.courseNo !== c.courseNo), [placed, c.courseNo]);

  return (
    <li className={`hover:bg-canvas ${isDragging ? "opacity-40" : ""}`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          ref={setNodeRef}
          type="button"
          className="flex min-w-0 flex-1 cursor-grab touch-pan-y items-start gap-1.5 text-left active:cursor-grabbing lg:touch-none"
          aria-expanded={expanded}
          onClick={onToggle}
          {...listeners}
          {...attributes}
        >
          <GripIcon className="mt-1 size-3.5 shrink-0 text-muted/60" />
          <span className="min-w-0 flex-1">
            <span className="font-mono text-sm font-bold tabular-nums">{c.courseNo}</span>{" "}
            <span className="text-xs text-muted tabular-nums">
              {c.credits ? `${c.credits} นก. · ` : ""}
              {c.sections.length} ตอน
            </span>
            <span className="block truncate text-sm" title={c.title}>
              {c.title}
            </span>
          </span>
        </button>
        <button
          type="button"
          className={wanted ? "btn-ghost text-xs" : "btn min-h-8 text-xs"}
          disabled={wanted}
          onClick={onWant}
        >
          {wanted ? "เพิ่มแล้ว" : "เพิ่ม"}
        </button>
        <button
          type="button"
          className="btn-ghost min-h-8 px-2 text-muted"
          aria-label={`ลบ ${c.courseNo} ออกจากรายการ`}
          title="ลบออกจากรายการ"
          onClick={onRemove}
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
      {expanded && (
        <ul className="mx-3 mb-3 flex flex-col gap-1.5 border-t border-line pt-2 text-xs tabular-nums">
          {c.sections.map((s) => (
            <SearchSectionRow key={s.id} section={s} others={others} placedById={placedById} />
          ))}
        </ul>
      )}
    </li>
  );
}

function SearchSectionRow({
  section: s,
  others,
  placedById,
}: {
  section: Section;
  others: Section[];
  placedById: ReadonlyMap<string, Section>;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `search-section:${s.id}`,
    data: { courseNo: s.courseNo, sectionId: s.id, from: "search-section" },
    attributes: { roleDescription: "ตอนเรียนจากผลค้นหาที่ลากได้" },
  });

  const clashCourses = useMemo(() => {
    const conflicts = findConflicts([...others, s]).filter((cf) => cf.a === s.id || cf.b === s.id);
    return [
      ...new Set(
        conflicts.map((cf) => {
          const otherId = cf.a === s.id ? cf.b : cf.a;
          return placedById.get(otherId)?.courseNo ?? otherId.split("-")[0];
        }),
      ),
    ];
  }, [others, s, placedById]);

  const isPlaced = placedById.has(s.id);

  return (
    <li>
      <button
        ref={setNodeRef}
        type="button"
        {...listeners}
        {...attributes}
        aria-label={`${s.courseNo} ${sectionLabel(s)} ลากเพื่อวางลงตาราง`}
        className={`flex w-full cursor-grab touch-pan-y items-start gap-1.5 rounded-xs border border-transparent px-1.5 py-1 text-left hover:border-line hover:bg-white active:cursor-grabbing lg:touch-none ${
          isDragging ? "opacity-40" : ""
        }`}
      >
        <GripIcon className="mt-0.5 size-3 shrink-0 text-muted/55" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-ink">{sectionLabel(s)}</span>
            {isPlaced && <span className="text-[11px] font-medium text-accent">(ในตาราง)</span>}
            {clashCourses.length > 0 ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-danger-soft px-1.5 py-0.5 text-[10px] font-bold text-danger tabular-nums">
                <WarningIcon className="size-2.5 shrink-0" />
                ชน {clashCourses.join(", ")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-ok-soft px-1.5 py-0.5 text-[10px] font-semibold text-ok">
                <CheckIcon className="size-2.5 shrink-0" />
                ว่าง
              </span>
            )}
          </span>
          <span className="block text-muted">{s.meetings.map(meetingLabel).join(" / ") || "TBA"}</span>
          {s.instructors.length > 0 && <span className="block text-muted">{s.instructors.join(", ")}</span>}
          <span className="block text-muted">
            <span className="whitespace-nowrap">กลางภาค {examLabel(s.midterm)}</span> ·{" "}
            <span className="whitespace-nowrap">ปลายภาค {examLabel(s.final)}</span>
          </span>
        </span>
      </button>
    </li>
  );
}
