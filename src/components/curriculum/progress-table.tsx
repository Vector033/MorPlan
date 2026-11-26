"use client";

import { useWorkspace } from "@/components/planner/workspace-context";
import { progress, SLOT_KINDS, slotId, type StudyPlan } from "@/lib/core/curriculum";
import { KIND_LABEL } from "./format";

const RING_R = 46;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

/** "ความคืบหน้า": Swiss-precision degree audit ring, category progress bars, and per-course tick table. */
export function ProgressTable({ plan }: { plan: StudyPlan }) {
  const { ws, dispatch } = useWorkspace();
  const cur = ws.curriculum!;
  const p = progress(plan, cur);
  const passed = new Set(cur.passed.map((x) => x.courseNo));
  const terms = [...plan.terms].sort((a, b) => a.year - b.year || a.semester - b.semester);
  const lines = [["วิชาบังคับ", p.required] as const, ...SLOT_KINDS.map((k) => [KIND_LABEL[k], p[k]] as const)].filter(([, v]) => v.total > 0);
  const targetCredits = plan.minCredits ?? p.all.total;
  const doneCredits = p.all.done;
  const ratio = targetCredits > 0 ? Math.min(1, doneCredits / targetCredits) : 0;
  const pct = targetCredits > 0 ? Math.min(100, Math.round((doneCredits / targetCredits) * 100)) : 0;
  const targetReached = targetCredits > 0 && doneCredits >= targetCredits;

  return (
    <section className="card" aria-labelledby="progress-h">
      <div className="bar">
        <h2 id="progress-h">ความคืบหน้า</h2>
      </div>
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-5 rounded-xs border border-line bg-canvas/55 p-4 sm:flex-row sm:items-center">
          <div
            className="relative grid size-28 shrink-0 place-items-center self-center sm:self-auto"
            role="progressbar"
            aria-valuenow={doneCredits}
            aria-valuemin={0}
            aria-valuemax={targetCredits}
            aria-label={`ความคืบหน้ารวม ${doneCredits} จาก ${targetCredits} หน่วยกิต`}
          >
            <svg viewBox="0 0 112 112" className="size-full -rotate-90" aria-hidden="true">
              <circle cx="56" cy="56" r={RING_R} fill="none" stroke="var(--color-line)" strokeWidth={8} />
              <circle
                cx="56"
                cy="56"
                r={RING_R}
                fill="none"
                stroke={targetReached ? "var(--color-ok)" : "var(--color-accent)"}
                strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - ratio)}
                className="progress-ring-arc"
              />
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center tabular-nums">
              <span className="font-mono text-xl leading-none font-bold text-ink">{doneCredits}</span>
              <span className="mt-0.5 font-mono text-[11px] font-medium text-muted">/ {targetCredits} นก.</span>
              <span className={`mt-1 font-mono text-[11px] font-semibold ${targetReached ? "text-ok" : "text-accent"}`}>{pct}%</span>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <ul className="flex flex-col gap-2 text-xs tabular-nums">
              {lines.map(([label, v]) => {
                const linePct = v.total > 0 ? Math.min(100, Math.round((v.done / v.total) * 100)) : 0;
                const lineReached = v.total > 0 && v.done >= v.total;
                return (
                  <li key={label} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-ink">{label}</span>{" "}
                      <span className="font-mono font-semibold text-ink">
                        {v.done}/{v.total} นก.
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
                      <div
                        className={`progress-bar-fill h-full rounded-full ${lineReached ? "bg-ok" : "bg-accent"}`}
                        style={{ width: `${linePct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="border-t border-line pt-2 text-xs font-semibold tabular-nums text-ink">
              รวม {doneCredits}/{targetCredits} นก.
            </p>
          </div>
        </div>

        <table className="w-full text-left text-sm">
          <caption className="sr-only">แผนการเรียน {plan.name} ติ๊กวิชาที่ผ่านแล้ว</caption>
          {terms.map((t) => (
            <tbody key={`${t.year}-${t.semester}`} className="border-t border-line">
              <tr>
                <th scope="colgroup" colSpan={2} className="pt-3 pb-1 font-semibold">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    ปี {t.year} เทอม {t.semester}
                    <button
                      type="button"
                      className="btn-ghost min-h-6 font-normal"
                      aria-label={`ติ๊กทั้งเทอม ปี ${t.year} เทอม ${t.semester}`}
                      onClick={() => dispatch({ type: "tickTerm", year: t.year, semester: t.semester })}
                    >
                      ติ๊กทั้งเทอม
                    </button>
                  </span>
                </th>
              </tr>
              {t.items.map((item, i) => {
                const id = slotId(plan, t, i);
                const checked = item.type === "course" ? passed.has(item.courseNo) : cur.doneSlots.includes(id);
                return (
                  <tr key={i}>
                    <td className="py-0.5 pr-2">
                      <label className="flex min-h-6 items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1 accent-accent"
                          checked={checked}
                          onChange={() =>
                            dispatch(item.type === "course" ? { type: "togglePassed", courseNo: item.courseNo, credits: item.credits } : { type: "toggleSlot", slotId: id })
                          }
                        />
                        {item.type === "course" ? (
                          <span className="min-w-0">
                            <span className="font-mono font-semibold">{item.courseNo}</span> {item.title}
                          </span>
                        ) : (
                          <span className="min-w-0 text-muted">
                            {KIND_LABEL[item.kind]} {item.credits} นก.
                          </span>
                        )}
                      </label>
                    </td>
                    <td className="py-0.5 text-right align-top tabular-nums">{item.credits}</td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
}
