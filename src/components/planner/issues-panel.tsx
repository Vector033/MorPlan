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
          <span className={conflicts.length ? "chip bg-danger-soft text-danger" : "chip"}>{conflicts.length}</span>
        </h2>
        <div className="p-4">
        {conflicts.length === 0 ? (
          <p className="text-sm text-muted">{placed.length ? "ไม่มีเวลาเรียนหรือวันสอบชนกัน" : "ยังไม่มีวิชาในตาราง"}</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {conflicts.map((c, i) => (
              <li key={i} className="border-l-0 border-t border-line pt-1.5 font-medium text-danger first:border-t-0 first:pt-0">
                {conflictText(c, byId)}
              </li>
            ))}
          </ul>
        )}
        </div>
      </section>

      <section className="card" aria-labelledby="exam-h">
        <h2 id="exam-h" className="bar">
          ตารางสอบ
        </h2>
        <div className="p-4">
        {placed.length === 0 ? (
          <p className="text-sm text-muted">วันสอบจะแสดงเมื่อวางวิชาลงตาราง</p>
        ) : (
          <div className="grid gap-3 text-sm sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
            {(["midterm", "final"] as const).map((kind) => {
              const clash = clashIds(kind);
              return (
                <div key={kind}>
                  <h3 className="mb-1.5 border-b border-line pb-1 text-xs font-bold">{kind === "midterm" ? "กลางภาค" : "ปลายภาค"}</h3>
                  <ul className="flex flex-col gap-0.5">
                    {exams(kind).map((s) => (
                      <li key={s.id} className={clash.has(s.id) ? "font-medium text-danger" : ""}>
                        <span className="font-mono text-xs">{s.courseNo}</span> {examLabel(s[kind])}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-xs text-muted">
          วันสอบมาจากตารางสอบสาธารณะของสำนักทะเบียนฯ วิชาที่ภาควิชากำหนดเองอาจไม่มีในตารางนี้
          ตรวจสอบกับประกาศทางการอีกครั้ง
        </p>
        </div>
      </section>
    </div>
  );
}
