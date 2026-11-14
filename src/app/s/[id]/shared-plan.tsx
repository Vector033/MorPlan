"use client";

import { useRouter } from "next/navigation";
import { WarningIcon } from "@/components/icons";
import { Calendar } from "@/components/planner/calendar";
import { useWorkspace } from "@/components/planner/workspace-context";
import { findConflicts } from "@/lib/core/conflicts";
import type { Section } from "@/lib/core/types";
import { conflictText, examLabel, meetingLabel, sectionLabel, thaiDate } from "@/lib/ui";
import { MAX_PLANS } from "@/lib/workspace/reducer";

export function SharedPlan({ term, name, sections, createdAt }: { term: string; name: string; sections: Section[]; createdAt: string }) {
  const { ws, dispatch, ready } = useWorkspace();
  const router = useRouter();
  const conflicts = findConflicts(sections);
  const byId = new Map(sections.map((s) => [s.id, s]));
  const order = sections.map((s) => s.courseNo);
  const full = ws.plans.length >= MAX_PLANS;

  function copy() {
    dispatch({ type: "import", sections });
    dispatch({ type: "addPlan" });
    for (const s of sections) dispatch({ type: "place", sectionId: s.id });
    router.push("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 py-6 sm:px-4">
      <div className="flex flex-wrap items-end justify-between gap-3 pb-2">
        <div>
          <p className="eyebrow">ตารางที่แชร์ · อ่านอย่างเดียว</p>
          <h1 className="text-title font-bold sm:text-display">{name}</h1>
          <p className="flex flex-wrap gap-x-1.5 text-sm text-muted tabular-nums">
            <span className="whitespace-nowrap">ภาคการศึกษา {term}</span>
            <span aria-hidden>·</span>
            <span className="whitespace-nowrap">{sections.length} วิชา</span>
            <span aria-hidden>·</span>
            <span className="whitespace-nowrap">{sections.reduce((n, s) => n + (s.credits ?? 0), 0)} หน่วยกิต</span>
            <span aria-hidden>·</span>
            <span className="whitespace-nowrap">สร้างเมื่อ {thaiDate(createdAt.slice(0, 10))}</span>
          </p>
        </div>
        <button className="btn-primary" onClick={copy} disabled={!ready || full} title={full ? "มีแผนครบ 5 แผนแล้ว" : undefined}>
          คัดลอกเป็นแผนของฉัน
        </button>
      </div>

      <div className="card overflow-x-auto">
        <div className="min-w-[640px]">
          <Calendar sections={sections} order={order} conflicts={conflicts} />
        </div>
      </div>

      {conflicts.length > 0 && (
        <ul className="card flex flex-col gap-2 p-4 text-sm font-medium text-danger tabular-nums">
          {conflicts.map((c, i) => (
            <li key={i} className="flex items-start gap-2">
              <WarningIcon className="mt-0.5 size-4 shrink-0" />
              <span>{conflictText(c, byId)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-canvas text-xs text-muted">
            <tr>
              <th className="p-3">วิชา</th>
              <th className="p-3">ตอน</th>
              <th className="p-3">เวลาเรียน</th>
              <th className="p-3">สอบกลางภาค</th>
              <th className="p-3">สอบปลายภาค</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sections.map((s) => (
              <tr key={s.id}>
                <td className="p-3">
                  <span className="font-mono text-xs font-semibold tabular-nums">{s.courseNo}</span>
                  <span className="block text-xs text-muted">{s.title}</span>
                </td>
                <td className="p-3 whitespace-nowrap tabular-nums">{sectionLabel(s)}</td>
                <td className="p-3 text-xs tabular-nums">{s.meetings.map(meetingLabel).join(" / ") || "TBA"}</td>
                <td className="p-3 text-xs whitespace-nowrap tabular-nums">{examLabel(s.midterm)}</td>
                <td className="p-3 text-xs whitespace-nowrap tabular-nums">{examLabel(s.final)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
