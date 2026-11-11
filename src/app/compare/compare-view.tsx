"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CheckIcon, WarningIcon } from "@/components/icons";
import { Calendar } from "@/components/planner/calendar";
import { useWorkspace } from "@/components/planner/workspace-context";
import { findConflicts } from "@/lib/core/conflicts";
import { DAY_TH_SHORT, fmtTime } from "@/lib/core/time";
import { DAYS, type Conflict, type Plan, type Section } from "@/lib/core/types";
import { planSections } from "@/lib/workspace/reducer";

type Stats = ReturnType<typeof stats>;
type PlanRow = { plan: Plan; sections: Section[]; conflicts: Conflict[]; stats: Stats };

export function CompareView() {
  const { ws, dispatch, ready } = useWorkspace();
  if (!ready) return <div className="mx-auto h-96 w-full max-w-7xl animate-pulse p-4" aria-busy />;

  const rows: PlanRow[] = ws.plans.map((plan) => {
    const sections = planSections(ws, plan);
    return { plan, sections, conflicts: findConflicts(sections), stats: stats(sections) };
  });

  const nonEmpty = rows.filter((r) => r.sections.length > 0);
  const clashFree = nonEmpty.filter((r) => r.conflicts.length === 0);
  const bestId = nonEmpty.length > 1 ? pickBestPlanId(nonEmpty) : null;
  const maxFreeDays = clashFree.reduce((best, r) => Math.max(best, r.stats.freeDays.length), 0);
  const showFreeBadge =
    clashFree.length > 1 && maxFreeDays > 0 && clashFree.some((r) => r.stats.freeDays.length < maxFreeDays);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">เทียบทุกแผนพร้อมกัน</p>
          <h1 className="text-title font-bold sm:text-display">เทียบแผน</h1>
          <p className="mt-2 max-w-[65ch] text-sm text-muted">
            ดูจุดชน วันว่าง และชั่วโมงเรียนของทุกแผน{" "}
            <span className="whitespace-nowrap">แล้วเลือกแผนที่ลงตัวที่สุด</span>
          </p>
        </div>
        <Link href="/" className="btn-primary shrink-0">
          กลับไปหน้าตาราง
        </Link>
      </header>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[580px] text-left text-sm">
          <thead className="border-b border-line bg-canvas/55 text-xs text-muted">
            <tr>
              <th className="w-44 px-4 py-3.5 font-semibold text-muted">หัวข้อเปรียบเทียบ</th>
              {rows.map((r) => {
                const isBest = r.plan.id === bestId;
                return (
                  <th key={r.plan.id} className={`px-4 py-3.5 align-bottom font-semibold text-ink ${isBest ? "bg-accent-soft/30" : ""}`}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold text-ink">{r.plan.name}</span>
                      <PlanStatusBadge row={r} isBest={isBest} />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            <Row label="วิชา / หน่วยกิต" bestId={bestId} rows={rows} render={(r) => `${r.sections.length} วิชา / ${r.stats.credits} นก.`} />
            <Row
              label="เวลาเรียนและวันสอบชน"
              bestId={bestId}
              rows={rows}
              render={(r) =>
                r.conflicts.length ? (
                  <span className="inline-flex items-center gap-1.5 font-bold text-danger">
                    <WarningIcon className="size-4 shrink-0" />
                    ชน {r.conflicts.length} จุด
                  </span>
                ) : r.sections.length ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#14603a]">
                    <CheckIcon className="size-4 shrink-0" />
                    ไม่มีชน
                  </span>
                ) : (
                  <span className="text-muted">ยังไม่มีวิชา</span>
                )
              }
            />
            <Row
              label="วันว่าง (จ.–ศ.)"
              bestId={bestId}
              rows={rows}
              render={(r) => {
                const free = r.stats.freeDays.map((d) => DAY_TH_SHORT[d]).join(" ") || "–";
                const topFree = showFreeBadge && r.conflicts.length === 0 && r.stats.freeDays.length === maxFreeDays;
                return (
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span>{free}</span>
                    {topFree && (
                      <span className="rounded-full bg-[#e6f6ec] px-2 py-0.5 text-[11px] font-semibold text-[#14603a]">
                        ว่าง {r.stats.freeDays.length} วัน
                      </span>
                    )}
                  </span>
                );
              }}
            />
            <Row label="วันที่ต้องมาเรียน" bestId={bestId} rows={rows} render={(r) => r.stats.days.map((d) => DAY_TH_SHORT[d]).join(" ") || "–"} />
            <Row label="เข้าเร็วสุด" bestId={bestId} rows={rows} render={(r) => (r.stats.earliest != null ? fmtTime(r.stats.earliest) : "–")} />
            <Row label="เลิกช้าสุด" bestId={bestId} rows={rows} render={(r) => (r.stats.latest != null ? fmtTime(r.stats.latest) : "–")} />
            <Row label="ชั่วโมงเรียน/สัปดาห์" bestId={bestId} rows={rows} render={(r) => `${(r.stats.minutes / 60).toFixed(1)} ชม.`} />
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => {
          const isBest = r.plan.id === bestId;
          return (
            <section key={r.plan.id} className={`card overflow-hidden ${isBest ? "border-accent/40 ring-1 ring-accent/30" : ""}`}>
              <div className="bar pb-3">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <h2 className="text-sm font-bold text-ink">{r.plan.name}</h2>
                  <PlanStatusBadge row={r} isBest={isBest} />
                </div>
                <Link
                  href="/"
                  className={isBest ? "btn-primary min-h-8 shrink-0 px-3.5 py-1 text-xs" : "btn min-h-8 shrink-0 px-3.5 py-1 text-xs"}
                  onClick={() => dispatch({ type: "setActive", id: r.plan.id })}
                >
                  แก้แผนนี้
                </Link>
              </div>
              <Calendar sections={r.sections} order={r.plan.courseNos} conflicts={r.conflicts} compact />
            </section>
          );
        })}
      </div>
    </main>
  );
}

function PlanStatusBadge({ row, isBest }: { row: PlanRow; isBest: boolean }) {
  if (row.sections.length === 0) return null;
  if (row.conflicts.length > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-bold text-danger tabular-nums">
        <WarningIcon className="size-3" />
        ชน {row.conflicts.length}
      </span>
    );
  }
  return (
    <span
      className={
        isBest
          ? "inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent"
          : "inline-flex items-center gap-1 rounded-full bg-[#e6f6ec] px-2 py-0.5 text-[11px] font-semibold text-[#14603a]"
      }
    >
      <CheckIcon className="size-3" />
      {isBest ? "แนะนำ · ไม่ชน" : "ไม่มีชน"}
    </span>
  );
}

function Row({ label, rows, bestId, render }: { label: string; rows: PlanRow[]; bestId: string | null; render: (r: PlanRow) => ReactNode }) {
  return (
    <tr>
      <th scope="row" className="px-4 py-3 text-xs font-semibold text-muted">
        {label}
      </th>
      {rows.map((r) => (
        <td key={r.plan.id} className={`px-4 py-3 tabular-nums ${r.plan.id === bestId ? "bg-accent-soft/20 font-medium text-ink" : ""}`}>
          {render(r)}
        </td>
      ))}
    </tr>
  );
}

/** Ranks clash-free plans first, then prefers most free weekdays, lowest conflict count, and credits. */
function pickBestPlanId(nonEmpty: PlanRow[]): string {
  const ranked = [...nonEmpty].sort((a, b) => {
    const clashDiff = (a.conflicts.length > 0 ? 1 : 0) - (b.conflicts.length > 0 ? 1 : 0);
    if (clashDiff !== 0) return clashDiff;
    if (a.conflicts.length !== b.conflicts.length) return a.conflicts.length - b.conflicts.length;
    if (a.stats.freeDays.length !== b.stats.freeDays.length) return b.stats.freeDays.length - a.stats.freeDays.length;
    return b.stats.credits - a.stats.credits;
  });
  return ranked[0].plan.id;
}

function stats(sections: Section[]) {
  const meetings = sections.flatMap((s) => s.meetings).filter((m) => m.days.length > 0);
  const days = DAYS.filter((d) => meetings.some((m) => m.days.includes(d)));
  return {
    credits: sections.reduce((n, s) => n + (s.credits ?? 0), 0),
    days,
    freeDays: DAYS.slice(0, 5).filter((d) => !days.includes(d)),
    earliest: meetings.length ? Math.min(...meetings.map((m) => m.start)) : null,
    latest: meetings.length ? Math.max(...meetings.map((m) => m.end)) : null,
    minutes: meetings.reduce((n, m) => n + (m.end - m.start) * m.days.length, 0),
  };
}
