"use client";

import { conflictText, examLabel } from "@/lib/ui";
import { useWorkspace } from "./workspace-context";

export function IssuesPanel() {
  const { ws, placed, conflicts } = useWorkspace();
  const byId = new Map(ws.pool.map((s) => [s.id, s]));
  const clashIds = (kind: "midterm" | "final") =>
    new Set(conflicts.filter((c) => c.kind === kind).flatMap((c) => [c.a, c.b]));
  const exams = (kind: "midterm" | "final") =>
    [...placed].sort((a, b) => (a[kind]?.date ?? "9").localeCompare(b[kind]?.date ?? "9") || (a[kind]?.start ?? 0) - (b[kind]?.start ?? 0));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="card" aria-labelledby="clash-h" aria-live="polite">
        <h2 id="clash-h" className="bar">
          สิ่งที่ชนกัน
          <span className={conflicts.length ? "chip bg-danger-soft font-mono text-danger tabular-nums" : "chip font-mono tabular-nums"}>
            {conflicts.length}
          </span>
        </h2>
        <div className="p-4">
        {conflicts.length === 0 ? (
          <p className="text-sm text-muted">{placed.length ? "ไม่มีเวลาเรียนหรือวันสอบชนกัน" : "ยังไม่มีวิชาในตาราง"}</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {conflicts.map((c, i) => {
              const text = conflictText(c, byId);
              const splitAt = c.kind === "time" ? text.lastIndexOf(" วัน") : c.kind === "duplicate" ? -1 : text.lastIndexOf(" ", text.lastIndexOf(" ") - 1);
              return (
                <li key={i} className="border-l-0 border-t border-line pt-1.5 font-medium text-danger first:border-t-0 first:pt-0">
                  {splitAt > 0 ? (
                    <>
                      {text.slice(0, splitAt)}{" "}
                      <span className="whitespace-nowrap">{text.slice(splitAt + 1)}</span>
                    </>
                  ) : (
                    text
                  )}
                </li>
              );
            })}
          </ul>
        )}
        </div>
      </section>

      <section className="card" aria-labelledby="exam-h">
        <h2 id="exam-h" className="bar">
          ตารางสอบ
        </h2>
        <div className="p-4">
        {ws.university ? (
          // Exam dates come from CMU's public exam table only.
          <p className="text-sm text-muted">ยังไม่มีวันสอบของ{ws.university} ตรวจสอบจากเว็บของมหาวิทยาลัย</p>
        ) : placed.length === 0 ? (
          <p className="text-sm text-muted">วันสอบจะแสดงเมื่อวางวิชาลงตาราง</p>
        ) : (
          <div className="grid gap-4 text-sm sm:grid-cols-2 md:grid-cols-1">
            {(["midterm", "final"] as const).map((kind) => {
              const clash = clashIds(kind);
              return (
                <div key={kind}>
                  <h3 className="mb-1.5 border-b border-line pb-1 text-xs font-bold">{kind === "midterm" ? "กลางภาค" : "ปลายภาค"}</h3>
                  <ul className="flex flex-col gap-1">
                    {exams(kind).map((s) => (
                      <li key={s.id} className={`flex flex-wrap items-baseline justify-between gap-x-2 tabular-nums ${clash.has(s.id) ? "font-medium text-danger" : ""}`}>
                        <span className="font-mono text-xs font-semibold tabular-nums">{s.courseNo}</span>
                        <span className="whitespace-nowrap">{examLabel(s[kind])}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
        {!ws.university && (
          <p className="mt-3 text-xs text-muted">
            วันสอบมาจากตารางสอบสาธารณะของ<span className="whitespace-nowrap">สำนักทะเบียนฯ มช.</span>{" "}
            วิชาที่ภาควิชากำหนดเองอาจไม่มีในตารางนี้{" "}
            <span className="inline-block">ตรวจสอบกับประกาศทางการอีกครั้ง</span>
          </p>
        )}
        </div>
      </section>
    </div>
  );
}
