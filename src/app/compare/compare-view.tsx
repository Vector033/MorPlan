"use client";

import Link from "next/link";
import { Calendar } from "@/components/planner/calendar";
import { useWorkspace } from "@/components/planner/workspace-context";
import { findConflicts } from "@/lib/core/conflicts";
import { DAY_TH_SHORT, fmtTime } from "@/lib/core/time";
import { DAYS, type Section } from "@/lib/core/types";
import { planSections } from "@/lib/workspace/reducer";

export function CompareView() {
  const { ws, dispatch, ready } = useWorkspace();
  if (!ready) return <div className="mx-auto h-96 w-full max-w-7xl animate-pulse p-4" aria-busy />;

  const rows = ws.plans.map((plan) => {
    const sections = planSections(ws, plan);
    return { plan, sections, conflicts: findConflicts(sections), stats: stats(sections) };
  });

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 py-6 sm:px-4">
      <header className="flex flex-wrap items-end justify-between gap-2 pb-2">
        <div>
          <h1 className="text-title font-bold sm:text-display">เทียบแผน</h1>
          <p className="text-sm text-muted">ดูทุกแผนพร้อมกัน เลือกแผนที่ชอบแล้วกลับไปแก้ที่หน้าตาราง</p>
        </div>
        <Link href="/" className="btn">
          กลับไปหน้าตาราง
        </Link>
      </header>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-canvas/55 text-xs text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-medium" />
              {rows.map(({ plan }) => (
                <th key={plan.id} className="px-4 py-3 font-semibold text-ink">
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            <Row label="วิชา / หน่วยกิต" cells={rows.map((r) => `${r.sections.length} / ${r.stats.credits}`)} />
            <Row
              label="ชน"
              cells={rows.map((r) => (r.conflicts.length ? <span key={r.plan.id} className="font-bold text-danger">{r.conflicts.length} จุด</span> : <span key={r.plan.id} className="font-medium text-ink">✓ ไม่มี</span>))}
            />
            <Row label="วันที่ต้องมาเรียน" cells={rows.map((r) => r.stats.days.map((d) => DAY_TH_SHORT[d]).join(" ") || "–")} />
            <Row label="วันว่าง (จ.–ศ.)" cells={rows.map((r) => r.stats.freeDays.map((d) => DAY_TH_SHORT[d]).join(" ") || "–")} />
            <Row label="เข้าเร็วสุด" cells={rows.map((r) => (r.stats.earliest != null ? fmtTime(r.stats.earliest) : "–"))} />
            <Row label="เลิกช้าสุด" cells={rows.map((r) => (r.stats.latest != null ? fmtTime(r.stats.latest) : "–"))} />
            <Row label="ชั่วโมงเรียน/สัปดาห์" cells={rows.map((r) => (r.stats.minutes / 60).toFixed(1))} />
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ plan, sections, conflicts }) => (
          <section key={plan.id} className="card overflow-hidden">
            <div className="bar">
              <h2 className="text-sm font-semibold">{plan.name}</h2>
              <Link href="/" className="link text-xs" onClick={() => dispatch({ type: "setActive", id: plan.id })}>
                แก้แผนนี้
              </Link>
            </div>
            <Calendar sections={sections} order={plan.courseNos} conflicts={conflicts} compact />
          </section>
        ))}
      </div>
    </main>
  );
}

function Row({ label, cells }: { label: string; cells: React.ReactNode[] }) {
  return (
    <tr>
      <th scope="row" className="px-4 py-2.5 text-xs font-medium text-muted">
        {label}
      </th>
      {cells.map((c, i) => (
        <td key={i} className="px-4 py-2.5 tabular-nums">
          {c}
        </td>
      ))}
    </tr>
  );
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
