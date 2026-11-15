"use client";

import { useId, useMemo, useState } from "react";
import { useWorkspace } from "@/components/planner/workspace-context";
import { passedNos, rankElectives, type ElectiveCourse, type PlanSlot, type RankedCourse } from "@/lib/core/curriculum";
import { DocumentAdd } from "./document-add";
import { KIND_LABEL } from "./format";

const SHOWN = 30;

/** Candidate courses with their fit badge; `onDone` is left out for a minor's courses, which are not tied to one slot. */
export function CandidateRows({ ranked, onAdd, onDone }: { ranked: RankedCourse[]; onAdd: (c: RankedCourse) => void; onDone?: (c: RankedCourse) => void }) {
  return (
    <>
      <ul className="flex flex-col divide-y divide-line">
        {ranked.slice(0, SHOWN).map((c) => (
          <li key={c.courseNo} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
            <span className="font-mono font-semibold">{c.courseNo}</span>
            <span className="min-w-0 flex-1">{c.title}</span>
            {c.fits ? (
              <span className="rounded-full bg-ok-soft px-2 py-0.5 text-xs font-medium text-ok">ลงได้ ไม่ชน</span>
            ) : c.offered ? (
              <span className="chip">เปิดเทอมนี้</span>
            ) : null}
            <button type="button" className="btn-ghost min-h-6" onClick={() => onAdd(c)}>
              เพิ่มลงรายการ
            </button>
            {onDone && (
              <button type="button" className="btn-ghost min-h-6" onClick={() => onDone(c)}>
                เรียนแล้ว
              </button>
            )}
          </li>
        ))}
      </ul>
      {ranked.length > SHOWN && <p className="pt-1 text-xs text-muted">และอีก {ranked.length - SHOWN} วิชา</p>}
    </>
  );
}

type Slot = PlanSlot & { id: string; doneCredits: number };

/** One elective slot of the term: summary line plus an expander with candidates, a manual entry and a plain "done" tick. */
export function SlotRow({ slot, say }: { slot: Slot; say: (s: string) => void }) {
  const { ws, dispatch, placed } = useWorkspace();
  const cur = ws.curriculum!;
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState("");
  const [credits, setCredits] = useState("3");

  const candidates: ElectiveCourse[] = useMemo(() => {
    if (slot.kind !== "minor") return cur.data.electives[slot.kind] ?? [];
    return (cur.minor?.groups ?? []).flatMap((g) => g.courseNos.map((courseNo) => ({ courseNo, title: "" })));
  }, [slot.kind, cur.data.electives, cur.minor]);
  const ranked = useMemo(() => rankElectives(candidates, passedNos(cur), ws.pool, placed), [candidates, cur, ws.pool, placed]);
  const named = cur.passed.filter((p) => p.slotId === slot.id);
  const needsMinor = slot.kind === "minor" && !cur.minor;
  const noList = !needsMinor && candidates.length === 0;
  const name = (courseNo: string, cr: number) => dispatch({ type: "nameSlotCourse", slotId: slot.id, courseNo, credits: cr });
  const validCode = /^[\w-]{1,20}$/.test(code.trim());
  const cr = Number(credits);

  return (
    <div className="py-3" role="group" aria-label={`${KIND_LABEL[slot.kind]} ${slot.credits} นก.`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="w-28 shrink-0 font-semibold">{KIND_LABEL[slot.kind]} {slot.credits} นก.</span>
        <span className="min-w-0 flex-1 text-sm text-muted">
          {slot.note}
          {slot.doneCredits > 0 && (
            <span className="tabular-nums">
              {slot.note ? " · " : ""}ทำแล้ว {slot.doneCredits}/{slot.credits} นก.
            </span>
          )}
        </span>
        <button type="button" className="btn-ghost min-h-6" aria-expanded={open} aria-controls={`${uid}p`} onClick={() => setOpen(!open)}>
          {needsMinor ? "ยังไม่ได้เลือกวิชาโท" : candidates.length ? `ดูวิชาที่เลือกได้ ${ranked.length} วิชา` : "ระบุวิชา"} {open ? "▾" : "▸"}
        </button>
      </div>
      {open && (
        <div id={`${uid}p`} className="mt-3 flex flex-col gap-3 rounded-xs bg-canvas p-3">
          {needsMinor && (
            <p className="text-sm">
              ยังไม่ได้เลือกวิชาโท{" "}
              <a className="link" href="#minor">
                เลือกจากหัวข้อวิชาโทด้านล่าง
              </a>
            </p>
          )}
          {noList && <p className="text-sm text-muted">ยังไม่มีรายการวิชาของช่องนี้</p>}
          {ranked.length > 0 && (
            <>
              {ws.pool.length === 0 && <p className="text-xs text-muted">วางผลค้นหาจากเว็บลงทะเบียนในหน้า &quot;นำเข้า&quot; แล้วระบบจะบอกว่าวิชาไหนเปิดและไม่ชน</p>}
              <CandidateRows
                ranked={ranked}
                onAdd={(c) => {
                  dispatch({ type: "wantCourses", courseNos: [c.courseNo] });
                  say("เพิ่ม 1 วิชาลงรายการแล้ว");
                }}
                onDone={(c) => name(c.courseNo, c.credits ?? 3)}
              />
            </>
          )}
          {named.length > 0 && (
            <ul className="flex flex-wrap gap-2 text-sm">
              {named.map((p) => (
                <li key={p.courseNo} className="chip">
                  <span className="font-mono">{p.courseNo}</span> · {p.credits} นก.{" "}
                  <button type="button" className="link min-h-6" aria-label={`เอา ${p.courseNo} ออก`} onClick={() => dispatch({ type: "removeNamed", courseNo: p.courseNo })}>
                    เอาออก
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!validCode || !(cr > 0)) return;
              name(code.trim(), cr);
              setCode("");
            }}
          >
            <span className="label w-full">ระบุวิชาเอง</span>
            <label className="flex flex-col gap-1 text-sm">
              รหัสวิชา
              <input className="input w-32 font-mono" value={code} maxLength={20} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              หน่วยกิต
              <input className="input w-20 tabular-nums" type="number" min={1} max={12} value={credits} onChange={(e) => setCredits(e.target.value)} />
            </label>
            <button type="submit" className="btn min-h-8" disabled={!validCode || !(cr > 0)}>
              บันทึกวิชา
            </button>
          </form>
          <div>
            <label className="flex min-h-6 items-center gap-2 text-sm">
              <input type="checkbox" className="accent-accent" checked={cur.doneSlots.includes(slot.id)} onChange={() => dispatch({ type: "toggleSlot", slotId: slot.id })} />
              เรียนแล้ว (ไม่ระบุวิชา)
            </label>
            <p className="pl-6 text-xs text-muted">ระบุวิชาเพื่อให้คำแนะนำแม่นขึ้น</p>
          </div>
          {noList && slot.kind !== "minor" && (
            <div className="flex flex-col gap-2">
              {!adding && (
                <div>
                  <button type="button" className="btn" onClick={() => setAdding(true)}>
                    เพิ่มเอกสาร
                  </button>
                </div>
              )}
              {adding && (
                <DocumentAdd
                  kind="electives"
                  parentId={cur.ref}
                  scope={{ university: cur.data.university, faculty: cur.data.faculty, major: cur.data.major, cohort: cur.cohort }}
                  onAccept={(courses) => dispatch({ type: "addElectives", kind: slot.kind, courses })}
                  onClose={() => setAdding(false)}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
