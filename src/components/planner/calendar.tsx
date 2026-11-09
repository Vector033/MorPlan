"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { DAY_TH, DAY_TH_SHORT, fmtTime } from "@/lib/core/time";
import { DAYS, type Conflict, type Day, type Meeting, type Section } from "@/lib/core/types";
import { colorFor, sectionLabel } from "@/lib/ui";

export type Ghost = { section: Section; clash: boolean; current: boolean };

type Props = {
  sections: Section[];
  order: string[];
  conflicts: Conflict[];
  /** Restrict to these days (mobile day view). Default: Mon–Fri plus any weekend day in use. */
  days?: Day[];
  ghosts?: Ghost[];
  interactive?: boolean;
  compact?: boolean;
  onBlockClick?: (s: Section) => void;
  /** Section just dropped: plays the snap once. */
  snapId?: string | null;
  /** Sections in a clash the user just created: shake once. */
  shakeIds?: ReadonlySet<string>;
};

type Item = { section: Section; meeting: Meeting; index: number; day: Day };

const HOUR_PX = 56;
const COMPACT_HOUR_PX = 22;

export const Calendar = forwardRef<HTMLDivElement, Props>(function Calendar(
  { sections, order, conflicts, days, ghosts = [], interactive = false, compact = false, onBlockClick, snapId, shakeIds },
  ref,
) {
  const items = toItems(sections);
  const ghostItems = ghosts.flatMap((g) => toItems([g.section]).map((it) => ({ ...it, ghost: g })));
  const shownDays = days ?? visibleDays([...items, ...ghostItems]);
  const [startHour, endHour] = hourRange([...items, ...ghostItems]);
  const hourPx = compact ? COMPACT_HOUR_PX : HOUR_PX;
  const height = (endHour - startHour) * hourPx;
  const top = (min: number) => ((min - startHour * 60) / 60) * hourPx;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const timeClashes = conflicts.filter((c) => c.kind === "time");
  // Every clash outlines its blocks; time clashes win the badge since they are visible on this grid.
  const clashed = new Map<string, string>();
  for (const c of conflicts) {
    const label = c.kind === "time" ? "ชน" : c.kind === "duplicate" ? "ซ้ำ" : "สอบชน";
    for (const id of [c.a, c.b]) if (clashed.get(id) !== "ชน") clashed.set(id, label);
  }

  return (
    <div ref={ref} className="bg-white" role="group" aria-label="ตารางเรียนรายสัปดาห์">
      <div className="grid" style={{ gridTemplateColumns: `${compact ? 28 : 44}px repeat(${shownDays.length}, minmax(0, 1fr))` }}>
        <div className="border-b border-line" />
        {shownDays.map((d) => (
          <div
            key={d}
            className={`border-b border-line text-left font-semibold text-muted ${compact ? "px-1 py-0.5 text-[10px]" : "px-2 py-2.5 text-sm"}`}
          >
            <span className="sm:hidden">{DAY_TH_SHORT[d]}</span>
            <span className="hidden sm:inline">{compact ? DAY_TH_SHORT[d] : DAY_TH[d]}</span>
          </div>
        ))}

        <div className="relative" style={{ height }} aria-hidden>
          {hours.map((h) => (
            <div
              key={h}
              className={`absolute right-1.5 -translate-y-1/2 font-mono font-medium text-muted ${compact ? "text-[8px]" : "text-[11px]"}`}
              style={{ top: top(h * 60) }}
            >
              {h > startHour && `${String(h).padStart(2, "0")}${compact ? "" : ":00"}`}
            </div>
          ))}
        </div>

        {shownDays.map((day) => {
          const dayItems = items.filter((it) => it.day === day);
          const lanes = assignLanes(dayItems);
          return (
            <div key={day} className="relative border-l border-line" style={{ height }} data-day={day}>
              {hours.map((h) => (
                <div key={h} className="absolute inset-x-0 border-t border-line" style={{ top: top(h * 60) }} />
              ))}
              {hours.map((h) => (
                <div key={`h${h}`} className="absolute inset-x-0 border-t border-dashed border-line/60" style={{ top: top(h * 60 + 30) }} />
              ))}

              {dayItems.map((it, i) => {
                const lane = lanes[i];
                const style: CSSProperties = {
                  top: top(it.meeting.start) + 1,
                  height: Math.max(top(it.meeting.end) - top(it.meeting.start) - 2, 14),
                  left: `calc(${(lane.lane / lane.of) * 100}% + 1px)`,
                  width: `calc(${100 / lane.of}% - 2px)`,
                };
                const block = (
                  <BlockView
                    item={it}
                    color={colorFor(it.section.courseNo, order).block}
                    clash={clashed.get(it.section.id)}
                    motion={shakeIds?.has(it.section.id) ? "shake" : snapId === it.section.id ? "snap" : null}
                    compact={compact}
                  />
                );
                const key = `${it.section.id}:${it.index}:${it.day}`;
                return interactive ? (
                  <DraggableBlock key={key} id={`block:${key}`} item={it} style={style} onClick={onBlockClick}>
                    {block}
                  </DraggableBlock>
                ) : (
                  <div key={key} className="absolute" style={style}>
                    {block}
                  </div>
                );
              })}

              {timeClashes
                .filter((c) => c.kind === "time" && c.day === day)
                .map((c, i) =>
                  c.kind === "time" ? (
                    <div
                      key={i}
                      className="clash-hatch pointer-events-none absolute inset-x-0 z-[5] border-y-2 border-danger"
                      style={{ top: top(c.start), height: top(c.end) - top(c.start) }}
                    />
                  ) : null,
                )}

              {ghostItems
                .filter((g) => g.day === day)
                .map((g) => (
                  <GhostSlot key={`${g.section.id}:${g.index}:${g.day}`} item={g} ghost={g.ghost} top={top} />
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
});

function BlockView({
  item,
  color,
  clash,
  motion,
  compact,
}: {
  item: Item;
  color: string;
  /** Badge text when this block is in a clash ("ชน", "สอบชน", "ซ้ำ"). */
  clash?: string;
  motion: "snap" | "shake" | null;
  compact: boolean;
}) {
  const { section: s, meeting: m } = item;
  const anim = motion === "shake" ? "animate-clash-shake" : motion === "snap" ? "animate-snap" : "";
  return (
    <div
      className={`${anim} relative h-full overflow-hidden text-left ${color} rounded-[3px] ${
        clash ? "outline-2 -outline-offset-2 outline-danger" : ""
      } ${compact ? "px-0.5 py-0 text-[8px] leading-tight" : "px-2 py-1.5 text-[11px] leading-snug"}`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className={`font-mono font-bold ${compact ? "" : "text-[13px]"}`}>{s.courseNo}</span>
        {clash && !compact && (
          <span className="shrink-0 rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">{clash}</span>
        )}
      </div>
      {!compact && (
        <>
          <div className="truncate font-medium">{s.title}</div>
          <div className="truncate opacity-85">
            {sectionLabel(s)}
            {m.room ? ` · ${m.room}` : ""}
          </div>
          <div className="truncate font-mono opacity-85">
            {fmtTime(m.start)}–{fmtTime(m.end)}
          </div>
        </>
      )}
    </div>
  );
}

function DraggableBlock({
  id,
  item,
  style,
  children,
  onClick,
}: {
  id: string;
  item: Item;
  style: CSSProperties;
  children: ReactNode;
  onClick?: (s: Section) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { courseNo: item.section.courseNo, sectionId: item.section.id, from: "calendar" },
    attributes: { roleDescription: "วิชาที่ลากได้" },
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`absolute touch-none select-none ${isDragging ? "opacity-30" : ""}`}
      style={style}
      {...listeners}
      {...attributes}
      aria-label={`${item.section.courseNo} ${item.section.title} ${sectionLabel(item.section)} วัน${DAY_TH[item.day]} ${fmtTime(item.meeting.start)} ถึง ${fmtTime(item.meeting.end)}`}
      onClick={() => onClick?.(item.section)}
    >
      {children}
    </button>
  );
}

function GhostSlot({ item, ghost, top }: { item: Item; ghost: Ghost; top: (m: number) => number }) {
  const label = `${sectionLabel(item.section)} วัน${DAY_TH[item.day]} ${fmtTime(item.meeting.start)}–${fmtTime(item.meeting.end)}`;
  const { setNodeRef, isOver } = useDroppable({
    id: `slot:${item.section.id}:${item.index}:${item.day}`,
    data: { sectionId: item.section.id, label, clash: ghost.clash },
  });
  return (
    <div
      ref={setNodeRef}
      className={`anim-fade absolute inset-x-0.5 z-10 flex flex-col justify-center rounded-[3px] border-2 px-1 text-center text-[11px] font-semibold ${
        ghost.clash ? "border-danger bg-danger-soft text-danger" : "border-accent/60 bg-white/90 text-accent"
      } ${isOver ? (ghost.clash ? "bg-danger text-white" : "border-accent bg-accent text-white") : "border-dashed"}`}
      style={{ top: top(item.meeting.start) + 1, height: Math.max(top(item.meeting.end) - top(item.meeting.start) - 2, 18) }}
    >
      <span>{sectionLabel(item.section)}</span>
      {ghost.current && <span className="text-[10px] opacity-80">(ตอนปัจจุบัน)</span>}
      {ghost.clash && <span className="text-[10px]">ชนกับวิชาอื่น</span>}
    </div>
  );
}

function toItems(sections: Section[]): Item[] {
  return sections.flatMap((section) =>
    section.meetings.flatMap((meeting, index) => meeting.days.map((day) => ({ section, meeting, index, day }))),
  );
}

function visibleDays(items: Item[]): Day[] {
  const weekend = DAYS.slice(5).filter((d) => items.some((it) => it.day === d));
  return [...DAYS.slice(0, 5), ...weekend];
}

function hourRange(items: Item[]): [number, number] {
  let start = 8;
  let end = 18;
  for (const it of items) {
    start = Math.min(start, Math.floor(it.meeting.start / 60));
    end = Math.max(end, Math.ceil(it.meeting.end / 60));
  }
  return [Math.max(6, start), Math.min(23, end)];
}

/** Side-by-side lanes for overlapping meetings in one day column. */
function assignLanes(items: Item[]): { lane: number; of: number }[] {
  const order = items.map((_, i) => i).sort((a, b) => items[a].meeting.start - items[b].meeting.start);
  const result: { lane: number; of: number }[] = items.map(() => ({ lane: 0, of: 1 }));
  let cluster: number[] = [];
  let clusterEnd = -1;
  let laneEnds: number[] = [];
  const flush = () => {
    for (const i of cluster) result[i].of = laneEnds.length;
    cluster = [];
    laneEnds = [];
  };
  for (const i of order) {
    const m = items[i].meeting;
    if (m.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= m.start);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(m.end);
    } else laneEnds[lane] = m.end;
    result[i].lane = lane;
    cluster.push(i);
    clusterEnd = Math.max(clusterEnd, m.end);
  }
  flush();
  return result;
}
