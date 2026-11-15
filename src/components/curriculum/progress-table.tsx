"use client";

import { useWorkspace } from "@/components/planner/workspace-context";
import { progress, SLOT_KINDS, slotId, type StudyPlan } from "@/lib/core/curriculum";
import { KIND_LABEL } from "./format";

/** "ความคืบหน้า": credits per kind, then the whole plan with a tick per course and slot. */
export function ProgressTable({ plan }: { plan: StudyPlan }) {
  const { ws, dispatch } = useWorkspace();
  const cur = ws.curriculum!;
  const p = progress(plan, cur);
  const passed = new Set(cur.passed.map((x) => x.courseNo));
  const terms = [...plan.terms].sort((a, b) => a.year - b.year || a.semester - b.semester);
  const lines = [["วิชาบังคับ", p.required] as const, ...SLOT_KINDS.map((k) => [KIND_LABEL[k], p[k]] as const)].filter(([, v]) => v.total > 0);

  return (
    <section className="card" aria-labelledby="progress-h">
      <div className="bar">
        <h2 id="progress-h">ความคืบหน้า</h2>
      </div>
      <div className="flex flex-col gap-4 p-4">
        <ul className="flex flex-col gap-1 text-sm tabular-nums">
          {lines.map(([label, v]) => (
            <li key={label}>
              {label} {v.done}/{v.total} นก.
            </li>
          ))}
          <li className="font-semibold">
            รวม {p.all.done}/{plan.minCredits ?? p.all.total} นก.
          </li>
        </ul>

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
