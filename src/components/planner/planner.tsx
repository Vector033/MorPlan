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
import { useEffect, useMemo, useRef, useState } from "react";
import { VolumeOffIcon, VolumeOnIcon, WarningIcon } from "@/components/icons";
import { conflictedIds, findConflicts } from "@/lib/core/conflicts";
import { DAY_TH_SHORT } from "@/lib/core/time";
import { DAYS, type Day, type Section } from "@/lib/core/types";
import { demoSections } from "@/lib/demo";
import { EXAMS } from "@/lib/exams-data";
import { playClashSound, playSnapSound, useMicroSound } from "@/lib/sound";
import { colorFor, conflictText } from "@/lib/ui";
import { sectionsOfCourse } from "@/lib/workspace/reducer";
import { AskDrawer } from "./ask-drawer";
import { Calendar, type Ghost } from "./calendar";
import { CourseDragOverlayCard } from "./course-card";
import { CourseSearch } from "./course-search";
import { announcements, collision, resetKeyboardTarget, screenReaderInstructions, slotKeyboardCoordinates } from "./dnd";
import { ExportBar } from "./export-bar";
import { IssuesPanel } from "./issues-panel";
import { useCountUp, usePlacementMotion } from "./motion";
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

  const motion = usePlacementMotion(plan.id, placed, conflicts);
  const [soundOn, toggleSound] = useMicroSound();
  const clashSet = useMemo(() => conflictedIds(conflicts), [conflicts]);
  const credits = placed.reduce((sum, s) => sum + (s.credits ?? 0), 0);
  const shownCredits = useCountUp(credits);

  useEffect(() => {
    if (!soundOn) return;
    if (motion.shakeIds.size > 0) playClashSound();
    else if (motion.snapId) playSnapSound();
  }, [motion, soundOn]);

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

  const byId = new Map(ws.pool.map((s) => [s.id, s]));
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
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* On phones the timetable leads once it has something on it; search and tray follow. */}
        <aside className={`flex flex-col gap-4 ${placed.length ? "order-last lg:order-none" : ""} lg:sticky lg:top-18 lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto lg:pr-1`}>
          {ws.pool.length === 0 ? (
            <EmptyPool onDemo={() => dispatch({ type: "import", sections: demoSections(EXAMS), university: null })} />
          ) : (
            <CourseSearch />
          )}
          <Tray
            courseNos={plan.courseNos}
            placedByCourse={placedByCourse}
            clashIds={clashSet}
            titleOf={titleOf}
            onPick={setPicking}
            onRemove={(c) => dispatch({ type: "unwantCourse", courseNo: c })}
            dragging={!!dragCourse && dragFromCalendar(dragCourse, placedByCourse)}
          />
        </aside>

        <main className="flex min-w-0 flex-col gap-4">
          <header className="order-1 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pb-2 md:order-none">
            <div>
              <p className="eyebrow">ภาคการศึกษา {ws.term}</p>
              <h1 className="mt-1 text-title font-bold sm:text-display">ตารางเรียน</h1>
            </div>
            {/* Three giant zeros say nothing on an empty plan; the summary appears with the first course. */}
            {placed.length > 0 && (
              <dl className="flex items-end gap-6 sm:gap-8" aria-label="สรุปแผนนี้">
                <Stat value={placed.length} label="วิชา" />
                <Stat value={shownCredits} label="หน่วยกิต" />
                <Stat value={conflicts.length} label={conflicts.length ? "จุดที่ชน" : "ไม่มีวิชาชน"} alert={conflicts.length > 0} />
              </dl>
            )}
          </header>

          <div className="contents md:flex md:flex-col md:gap-3">
            <div className="order-2 min-w-0 md:order-none">
              <PlanTabs />
            </div>
            <div className="order-6 flex flex-wrap items-center justify-between gap-2 max-md:sticky max-md:bottom-20 max-md:z-20 max-md:mx-auto max-md:w-fit max-md:rounded-full max-md:border max-md:border-line max-md:bg-white/95 max-md:px-2 max-md:py-1.5 max-md:shadow-lg max-md:backdrop-blur md:order-none">
              <button
                type="button"
                onClick={toggleSound}
                aria-pressed={soundOn}
                title={soundOn ? "ปิดเสียงสัมผัสเวลาวางวิชา" : "เปิดเสียงสัมผัสเวลาวางวิชา"}
                className={`btn-ghost hidden px-2.5 py-1.5 text-xs md:inline-flex ${soundOn ? "font-medium text-accent" : "text-muted"}`}
              >
                {soundOn ? <VolumeOnIcon className="size-3.5" /> : <VolumeOffIcon className="size-3.5" />}
                <span>{soundOn ? "เสียงสัมผัส: เปิด" : "เสียงสัมผัส: ปิด"}</span>
              </button>
              <div className="flex flex-wrap items-center gap-2">
                {/* The regulations corpus is CMU's only. */}
                {!ws.university && <AskDrawer />}
                <ExportBar calendarRef={calendarRef} />
              </div>
            </div>
          </div>

          <div className="order-3 grid grid-cols-5 gap-1.5 md:hidden" role="tablist" aria-label="เลือกวัน">
            {days.map((d) => (
              <button
                key={d}
                role="tab"
                aria-selected={mobileDay === d}
                onClick={() => setMobileDay(d)}
                className={`rounded-full py-2 text-sm font-semibold ${
                  mobileDay === d ? "bg-accent text-white shadow-sm" : "border border-line bg-white text-ink"
                }`}
              >
                {DAY_TH_SHORT[d]}
              </button>
            ))}
          </div>

          {conflicts.length > 0 && (
            // Top-of-timetable alert pill: exact conflicting sections; full list sits below.
            <a
              href="#clash-h"
              className="anim-rise order-4 flex items-center gap-3 rounded-2xl border border-danger/35 bg-danger-soft p-2 text-sm font-semibold text-danger hover:border-danger/60 sm:rounded-full sm:p-1.5 sm:pr-4 md:order-none"
            >
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-danger px-2.5 py-0.5 font-mono text-xs font-bold text-white tabular-nums">
                <WarningIcon className="size-3" />
                ชน {conflicts.length}
              </span>
              <span className="line-clamp-2 min-w-0 flex-1 tabular-nums sm:truncate">{conflictText(conflicts[0], byId)}</span>
              {conflicts.length > 1 && <span className="shrink-0 text-xs font-medium text-danger/80">ดูทั้งหมด ↓</span>}
            </a>
          )}

          <div className="card order-5 overflow-hidden md:order-none" style={{ viewTransitionName: "plan-calendar" }}>
            <div className="hidden md:block">
              <Calendar
                ref={calendarRef}
                sections={placed}
                order={plan.courseNos}
                conflicts={conflicts}
                ghosts={ghosts}
                snapId={motion.snapId}
                shakeIds={motion.shakeIds}
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
                snapId={motion.snapId}
                shakeIds={motion.shakeIds}
                onBlockClick={(s) => setPicking(s.courseNo)}
                interactive={false}
              />
              <MobileDayList day={mobileDay} sections={placed} onPick={setPicking} />
            </div>
          </div>
          <p className="hidden text-xs text-muted md:block">
            ลากวิชาจากรายการทางซ้ายมาวางบนช่องตอนเรียน หรือกด <span className="kbd">Space</span> บนวิชาแล้วใช้ลูกศรเลือกตอน ·{" "}
            <span className="whitespace-nowrap">ลากกลับไปที่รายการเพื่อเอาออก</span>
          </p>

          <div className="order-7 md:order-none">
            <IssuesPanel />
          </div>
        </main>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragCourse ? (
          <CourseDragOverlayCard
            courseNo={dragCourse}
            title={titleOf(dragCourse)}
            palette={colorFor(dragCourse, plan.courseNos)}
            placedSection={placedByCourse.get(dragCourse)}
          />
        ) : null}
      </DragOverlay>

      {picking && <SectionPicker courseNo={picking} onClose={() => setPicking(null)} />}
    </DndContext>
  );
}

function Stat({ value, label, alert = false }: { value: number; label: string; alert?: boolean }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className={`mt-1.5 text-xs font-semibold ${alert ? "text-danger" : "text-muted"}`}>{label}</dt>
      <dd className={`font-mono text-title leading-none font-bold tabular-nums sm:text-display ${alert ? "text-danger" : ""}`}>{value}</dd>
    </div>
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
  clashIds,
  titleOf,
  onPick,
  onRemove,
  dragging,
}: {
  courseNos: string[];
  placedByCourse: Map<string, Section>;
  clashIds: ReadonlySet<string>;
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
      className={`card overflow-hidden ${dragging ? "outline-2 outline-offset-2 outline-accent outline-dashed" : ""} ${isOver ? "bg-accent-soft" : ""}`}
    >
      <h2 className="bar">
        วิชาที่จะลง
        <span className="chip tabular-nums">{courseNos.length} วิชา</span>
      </h2>
      {courseNos.length === 0 ? (
        <p className="p-4 text-sm text-muted">
          ค้นหา กด “เพิ่ม” วิชาที่ต้องการ{" "}
          <span className="whitespace-nowrap">แล้วลากลงตาราง</span>
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {courseNos.map((c) => {
            const placed = placedByCourse.get(c);
            return (
              <TrayItem
                key={c}
                courseNo={c}
                order={courseNos}
                title={titleOf(c)}
                placed={placed}
                clashed={placed ? clashIds.has(placed.id) : false}
                onPick={() => onPick(c)}
                onRemove={() => onRemove(c)}
              />
            );
          })}
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
  clashed,
  onPick,
  onRemove,
}: {
  courseNo: string;
  order: string[];
  title: string;
  placed?: Section;
  clashed: boolean;
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
    <li className={`flex items-center gap-1 bg-white px-2 py-2 hover:bg-canvas ${isDragging ? "opacity-30" : ""}`}>
      <button
        ref={setNodeRef}
        type="button"
        className="flex min-w-0 flex-1 cursor-grab touch-none items-center gap-3 py-0.5 text-left active:cursor-grabbing"
        aria-label={`${courseNo} ${title} ${placed ? `วางแล้ว ตอน ${placed.lec}` : "ยังไม่ได้วาง"}`}
        {...listeners}
        {...attributes}
      >
        {/* Subway-line bullet: the course colour with its line number (order in this plan). */}
        <span className={`grid size-9 shrink-0 place-items-center rounded-full font-mono text-xs font-bold tabular-nums ${color.dot}`} aria-hidden>
          {order.indexOf(courseNo) + 1}
        </span>
        <span className="min-w-0">
          <span className="block font-mono text-sm font-bold tabular-nums">{courseNo}</span>
          <span className="block truncate text-xs text-muted" title={title}>{title}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={onPick}
        className={
          placed
            ? clashed
              ? "btn-ghost inline-flex items-center gap-1 rounded-full border border-danger/40 bg-danger-soft px-2 py-1 text-xs font-semibold text-danger tabular-nums"
              : "btn-ghost px-2 text-xs text-ink tabular-nums"
            : "btn min-h-8 px-2 text-xs"
        }
      >
        {clashed && placed && <WarningIcon className="size-3 shrink-0" />}
        {placed ? `ตอน ${placed.lec === "000" ? placed.lab : placed.lec}` : "เลือกตอน"}
      </button>
      <button type="button" onClick={onRemove} className="btn-ghost min-w-8 px-1.5 text-xs" aria-label={`เอา ${courseNo} ออก`}>
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
    <section className="card">
      <h2 className="bar">จัดตารางแบบไม่พลาดวิชาชนหรือสอบซ้อน</h2>
      <div className="space-y-3 px-4 pt-2 text-sm text-muted">
        <ol className="flex flex-col gap-1.5 text-xs text-ink">
          <li className="flex items-center gap-2">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-canvas font-mono text-[11px] font-bold">1</span>
            <span>นำเข้าผลค้นหารายวิชาจาก reg</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-canvas font-mono text-[11px] font-bold">2</span>
            <span>ลากวางลงตาราง เห็นเวลาและวันสอบชนทันที</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-canvas font-mono text-[11px] font-bold">3</span>
            <span>เทียบแผน A / B / C แล้วส่งออกรูปหรือแชร์ลิงก์</span>
          </li>
        </ol>
        <p className="text-xs text-muted">
          คัดลอกผลค้นหาจาก <span className="whitespace-nowrap">reg ของ มช.</span> มาวางเองได้เลย{" "}
          <strong className="font-medium text-ink">MorPlan ไม่เคยขอรหัสผ่าน reg</strong>
        </p>
      </div>
      <div className="flex flex-wrap gap-2 p-4">
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
