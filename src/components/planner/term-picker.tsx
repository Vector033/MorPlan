"use client";

import { useId } from "react";
import { CURRENT_TERM } from "@/lib/terms";
import { useWorkspace } from "./workspace-context";

const THIS_YEAR = Number(CURRENT_TERM.split("/")[1]);
const YEARS = Array.from({ length: 6 }, (_, i) => THIS_YEAR - 2 + i);

/** The term being planned, editable: semester 1, 2 or 3 (summer / third trimester) and the Buddhist-era year. */
export function TermPicker() {
  const { ws, dispatch } = useWorkspace();
  const id = useId();
  const [semester, year] = ws.term.split("/");
  const years = YEARS.includes(Number(year)) ? YEARS : [...YEARS, Number(year)].sort();
  const set = (s: string, y: string) => dispatch({ type: "setTerm", term: `${s}/${y}` });
  return (
    <div role="group" aria-labelledby={`${id}l`} className="eyebrow flex flex-wrap items-center gap-1.5">
      <span id={`${id}l`}>ภาคการศึกษา</span>
      <select aria-label="ภาค" className="rounded-xs border border-line bg-white px-1.5 py-0.5 text-ink" value={semester} onChange={(e) => set(e.target.value, year)}>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3" title="ภาคฤดูร้อน หรือภาคที่ 3 ของระบบไตรภาค">3</option>
      </select>
      <span aria-hidden>/</span>
      <select aria-label="ปีการศึกษา" className="rounded-xs border border-line bg-white px-1.5 py-0.5 text-ink" value={year} onChange={(e) => set(semester, e.target.value)}>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
