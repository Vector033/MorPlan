"use client";

import { WarningIcon } from "@/components/icons";
import { fmtTime } from "@/lib/core/time";
import type { Meeting, Section } from "@/lib/core/types";
import { colorFor, sectionLabel } from "@/lib/ui";

type CoursePalette = ReturnType<typeof colorFor>;

type BlockProps = {
  section: Section;
  meeting: Meeting;
  palette: CoursePalette;
  /** Badge text when this block is in a clash ("ชน", "สอบชน", "ซ้ำ"). */
  clash?: string;
  motion: "snap" | "shake" | null;
  compact: boolean;
};

/**
 * Solid physical timetable course tile rendered inside a day column.
 * Separates normal 1px hairline + 4px left transit edge from bold 2px Danger Red clash borders.
 */
export function CourseBlockCard({ section: s, meeting: m, palette, clash, motion, compact }: BlockProps) {
  const anim = motion === "shake" ? "animate-clash-shake" : motion === "snap" ? "animate-snap" : "";
  const frame = clash
    ? `${palette.fill} border-2 border-danger`
    : `${palette.block} border-y border-r border-y-ink/12 border-r-ink/12 shadow-sm`;

  return (
    <div
      className={`${anim} @container relative h-full overflow-hidden rounded-[4px] text-left ${frame} ${
        compact ? "px-0.5 py-0 text-[8px] leading-tight" : "px-2 py-1.5 text-[11px] leading-snug"
      }`}
    >
      {/* Clashing blocks share a lane and get narrow: one header row, so the time line never drops out of view. */}
      <div className={compact ? "flex items-center gap-0.5" : "flex items-center justify-between gap-1"}>
        {clash && compact && <WarningIcon className="absolute top-px right-px size-2 text-danger" aria-label={clash} />}
        <span
          className={`font-mono font-bold tabular-nums ${
            compact ? (clash ? "pr-2 text-[7px] leading-none break-all" : "") : `min-w-0 truncate ${clash ? "text-xs" : "text-[13px]"}`
          }`}
        >
          {s.courseNo}
        </span>
        {clash && !compact && (
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-[2px] bg-danger px-1 py-0.5 text-[9.5px] leading-none font-bold whitespace-nowrap text-white">
            <WarningIcon className="size-2.5 shrink-0" />
            {/* Icon-only badge in a narrow block; the label stays for screen readers. */}
            <span className="sr-only @min-[6.5rem]:not-sr-only">{clash}</span>
          </span>
        )}
      </div>
      {!compact && (
        <>
          <div className="truncate font-medium">{s.title}</div>
          <div className="truncate tabular-nums opacity-90">
            {sectionLabel(s)}
            {m.room ? ` · ${m.room}` : ""}
          </div>
          <div className="truncate font-mono tabular-nums opacity-90">
            {fmtTime(m.start)}–{fmtTime(m.end)}
          </div>
        </>
      )}
    </div>
  );
}

type OverlayProps = {
  courseNo: string;
  title: string;
  palette: CoursePalette;
  placedSection?: Section;
};

/**
 * Floating course card rendered inside <DragOverlay> while dragging from tray or grid.
 * Elevates slightly (`scale-[1.02] shadow-lg`) with a crisp 1px perimeter border.
 */
export function CourseDragOverlayCard({ courseNo, title, palette, placedSection }: OverlayProps) {
  return (
    <div
      className={`anim-lift max-w-72 scale-[1.02] rounded-[4px] border-y border-r border-y-ink/25 border-r-ink/25 px-3 py-2 text-sm shadow-lg ring-1 ring-accent/45 ${palette.block}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono font-bold tabular-nums">{courseNo}</span>
        {placedSection && (
          <span className="shrink-0 font-mono text-xs font-medium tabular-nums opacity-85">
            {sectionLabel(placedSection)}
          </span>
        )}
      </div>
      {title && <div className="truncate text-xs font-semibold">{title}</div>}
    </div>
  );
}
