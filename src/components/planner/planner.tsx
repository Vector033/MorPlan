"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { findConflicts } from "@/lib/core/conflicts";
import { DAY_TH_SHORT } from "@/lib/core/time";
import { DAYS, type Day, type Section } from "@/lib/core/types";
import { demoSections } from "@/lib/demo";
import { EXAMS } from "@/lib/exams-data";
import { colorFor } from "@/lib/ui";
import { sectionsOfCourse } from "@/lib/workspace/reducer";
import { Calendar, type Ghost } from "./calendar";
import { CourseSearch } from "./course-search";
import { announcements, collision, resetKeyboardTarget, screenReaderInstructions, slotKeyboardCoordinates } from "./dnd";
import { ExportBar } from "./export-bar";
import { IssuesPanel } from "./issues-panel";
import { PlanTabs } from "./plan-tabs";
import { SectionPicker } from "./section-picker";
import { useWorkspace } from "./workspace-context";

export function Planner() {
  const { ws, dispatch, plan, placed, conflicts, ready } = useWorkspace();
  const [dragCourse, setDragCourse] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [mobileDay, setMobileDay] = useState<Day>(todayDay());
  const calendarRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: slotKeyboardCoordinates }),
  );

  const placedByCourse = useMemo(() => new Map(placed.map((s) => [s.courseNo, s])), [placed]);
  const titleOf = (courseNo: string) => ws.pool.find((s) => s.courseNo === courseNo)?.title ?? "";
  const courseFromId = (id: string | number) => String(id).replace(/^(course|block):/, "").split(/[-:]/)[0];

  const ghosts: Ghost[] = useMemo(() => {
    if (!dragCourse) return [];
    return sectionsOfCourse(ws, dragCourse).map((section) => ({
      section,
      current: placedByCourse.get(dragCourse)?.id === section.id,
      clash: wouldClash(placed, section),
    }));
  }, [dragCourse, ws, placed, placedByCourse]);

  function onDragStart(e: DragStartEvent) {
    resetKeyboardTarget();
    setDragCourse((e.active.data.current as { courseNo: string }).courseNo);
  }
  function onDragEnd(e: DragEndEvent) {
    const data = e.active.data.current as { courseNo: string; from: string };
    const overId = e.over ? String(e.over.id) : null;
    if (overId?.startsWith("slot:")) dispatch({ type: "place", sectionId: (e.over!.data.current as { sectionId: string }).sectionId });
    else if (overId === "tray" && data.from === "calendar") dispatch({ type: "unplace", courseNo: data.courseNo });
    setDragCourse(null);
  }

  if (!ready) return <PlannerSkeleton />;

  const credits = placed.reduce((sum, s) => sum + (s.credits ?? 0), 0);
  const days = [...DAYS.slice(0, 5), ...DAYS.slice(5).filter((d) => placed.some((s) => s.meetings.some((m) => m.days.includes(d))))];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      // Ghost slots mount after a drag starts, so they must be measured as they appear.
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragCourse(null)}
      accessibility={{ screenReaderInstructions, announcements: announcements((id) => courseFromId(id)) }}
    >
      <div className="mx-auto grid w-full max-w-7xl gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-18 lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto">
          {ws.pool.length === 0 ? (
            <EmptyPool onDemo={() => dispatch({ type: "import", sections: demoSections(EXAMS) })} />
          ) : (
            <CourseSearch />
          )}
          <Tray
            courseNos={plan.courseNos}
            placedByCourse={placedByCourse}
            titleOf={titleOf}
            onPick={setPicking}
            onRemove={(c) => dispatch({ type: "unwantCourse", courseNo: c })}
            dragging={!!dragCourse && dragFromCalendar(dragCourse, placedByCourse)}
          />
        </aside>

        <main className="flex min-w-0 flex-col gap-3">
          <PlanTabs />
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-muted">
              {placed.length} วิชา · {credits} หน่วยกิต
              {conflicts.length > 0 ? (
                <span className="ml-2 font-medium text-danger">· ชน {conflicts.length} จุด</span>
              ) : placed.length > 0 ? (
                <span className="ml-2 font-medium text-accent">· ไม่มีวิชาชน</span>
              ) : null}
            </p>
            <ExportBar calendarRef={calendarRef} />
          </div>

          <div className="flex gap-1 md:hidden" role="tablist" aria-label="เลือกวัน">
            {days.map((d) => (
              <button
                key={d}
                role="tab"
                aria-selected={mobileDay === d}
                onClick={() => setMobileDay(d)}
                className={`flex-1 rounded-lg py-1.5 text-sm ${mobileDay === d ? "bg-ink text-white" : "bg-white text-muted"}`}
              >
                {DAY_TH_SHORT[d]}
              </button>
            ))}
          </div>

          <div className="card overflow-hidden">
            <div className="hidden md:block">
              <Calendar
                ref={calendarRef}
                sections={placed}
                order={plan.courseNos}
                conflicts={conflicts}
                ghosts={ghosts}
                interactive
                onBlockClick={(s) => setPicking(s.courseNo)}
              />
            </div>
            <div className="md:hidden">
              <Calendar
                sections={placed}
                order={plan.courseNos}
                conflicts={conflicts}
                days={[mobileDay]}
                onBlockClick={(s) => setPicking(s.courseNo)}
                interactive={false}
              />
              <MobileDayList day={mobileDay} sections={placed} onPick={setPicking} />
            </div>
          </div>
          <p className="hidden text-xs text-muted md:block">
            ลากวิชาจากรายการทางซ้ายมาวางบนช่องตอนเรียน หรือกด <span className="kbd">Space</span> บนวิชาแล้วใช้ลูกศรเลือกตอน
            ลากกลับไปที่รายการเพื่อเอาออก
          </p>

          <IssuesPanel />
        </main>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragCourse ? (
          <div className={`rounded-lg border px-3 py-2 text-sm font-medium shadow-xl ${colorFor(dragCourse, plan.courseNos).block}`}>
            <span className="font-mono">{dragCourse}</span> {titleOf(dragCourse)}
          </div>
        ) : null}
      </DragOverlay>

      {picking && <SectionPicker courseNo={picking} onClose={() => setPicking(null)} />}
    </DndContext>
  );
}

function wouldClash(placed: Section[], candidate: Section): boolean {
  const others = placed.filter((s) => s.courseNo !== candidate.courseNo);
  return findConflicts([...others, candidate]).some((c) => c.a === candidate.id || c.b === candidate.id);
}

function dragFromCalendar(courseNo: string, placed: Map<string, Section>) {
  return placed.has(courseNo);
}

function Tray({
  courseNos,
  placedByCourse,
  titleOf,
  onPick,
  onRemove,
  dragging,
}: {
  courseNos: string[];
  placedByCourse: Map<string, Section>;
  titleOf: (c: string) => string;
  onPick: (c: string) => void;
  onRemove: (c: string) => void;
  dragging: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "tray" });
  return (
    <section
      ref={setNodeRef}
      aria-label="วิชาที่จะลง"
      className={`card p-3 transition ${dragging ? "border-dashed border-accent" : ""} ${isOver ? "bg-accent-soft/50" : ""}`}
    >
      <h2 className="mb-2 flex items-center justify-between text-sm font-semibold">
        วิชาที่จะลง
        <span className="text-xs font-normal text-muted">{courseNos.length} วิชา</span>
      </h2>
      {courseNos.length === 0 ? (
        <p className="text-sm text-muted">ค้นหาแล้วกด “เพิ่ม” วิชาที่อยากลง แล้วลากมาวางบนตาราง</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {courseNos.map((c) => (
            <TrayItem
              key={c}
              courseNo={c}
              order={courseNos}
              title={titleOf(c)}
              placed={placedByCourse.get(c)}
              onPick={() => onPick(c)}
              onRemove={() => onRemove(c)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function TrayItem({
  courseNo,
  order,
  title,
  placed,
  onPick,
  onRemove,
}: {
  courseNo: string;
  order: string[];
  title: string;
  placed?: Section;
  onPick: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `course:${courseNo}`,
    data: { courseNo, from: "tray" },
    attributes: { roleDescription: "วิชาที่ลากได้" },
  });
  const color = colorFor(courseNo, order);
  return (
    <li className={`flex items-center gap-2 rounded-lg border border-line bg-white p-1.5 ${isDragging ? "opacity-40" : ""}`}>
      <button
        ref={setNodeRef}
        type="button"
        className="flex min-w-0 flex-1 touch-none items-center gap-2 rounded-md px-1 py-0.5 text-left"
          aria-label={`${courseNo} ${title} ${placed ? `วางแล้ว ตอน ${placed.lec}` : "ยังไม่ได้วาง"}`}
        {...listeners}
        {...attributes}
      >
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color.dot}`} aria-hidden />
        <span className="min-w-0">
          <span className="block font-mono text-xs font-semibold">{courseNo}</span>
          <span className="block truncate text-xs text-muted">{title}</span>
        </span>
      </button>
      <button type="button" onClick={onPick} className={placed ? "btn-ghost px-2 text-xs" : "btn px-2 text-xs"}>
        {placed ? `ตอน ${placed.lec === "000" ? placed.lab : placed.lec}` : "เลือกตอน"}
      </button>
      <button type="button" onClick={onRemove} className="btn-ghost px-1.5 text-xs" aria-label={`เอา ${courseNo} ออก`}>
        ✕
      </button>
    </li>
  );
}

function MobileDayList({ day, sections, onPick }: { day: Day; sections: Section[]; onPick: (c: string) => void }) {
  const tba = sections.filter((s) => s.meetings.every((m) => m.days.length === 0));
  if (sections.some((s) => s.meetings.some((m) => m.days.includes(day))) && tba.length === 0) return null;
  return (
    <div className="border-t border-line p-3 text-sm text-muted">
      {tba.length > 0 ? (
        <p>
          ไม่มีเวลาเรียนในตาราง (TBA):{" "}
          {tba.map((s) => (
            <button key={s.id} className="mr-1 underline" onClick={() => onPick(s.courseNo)}>
              {s.courseNo}
            </button>
          ))}
        </p>
      ) : (
        <p>ไม่มีเรียนวันนี้</p>
      )}
    </div>
  );
}

function EmptyPool({ onDemo }: { onDemo: () => void }) {
  return (
    <section className="card p-4">
      <h2 className="text-base font-semibold">เริ่มจากรายชื่อวิชาของคุณ</h2>
      <p className="mt-1 text-sm text-muted">
        เปิดผลค้นหากระบวนวิชาใน reg ของ มช. (ล็อกอินที่เว็บ reg เอง) แล้วคัดลอกมาวางใน MorPlan
        MorPlan ไม่เคยขอรหัสผ่าน reg ของคุณ
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/import" className="btn-primary">
          นำเข้าจาก reg
        </Link>
        <button className="btn" onClick={onDemo}>
          ลองด้วยข้อมูลตัวอย่าง
        </button>
      </div>
    </section>
  );
}

function PlannerSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[320px_minmax(0,1fr)]" aria-busy>
      <div className="card h-64 animate-pulse" />
      <div className="card h-[560px] animate-pulse" />
    </div>
  );
}

function todayDay(): Day {
  const js = new Date().getDay();
  const d = DAYS[(js + 6) % 7];
  return d === "Sa" || d === "Su" ? "Mo" : d;
}
