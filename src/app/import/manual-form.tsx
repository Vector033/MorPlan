"use client";

import { useState } from "react";
import { useWorkspace } from "@/components/planner/workspace-context";
import { attachExams } from "@/lib/core/exams";
import { parseDays, parseTimeRange } from "@/lib/core/time";
import { sectionId, type Meeting } from "@/lib/core/types";
import { EXAMS } from "@/lib/exams-data";

/** Fallback when the paste cannot be read: one section at a time. */
export function ManualForm() {
  const { dispatch } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  function submit(fd: FormData) {
    setError(null);
    setAdded(null);
    const courseNo = String(fd.get("courseNo")).trim();
    const lec = String(fd.get("lec") || "001").trim().padStart(3, "0");
    const lab = String(fd.get("lab") || "000").trim().padStart(3, "0");
    if (!/^\d{6}$/.test(courseNo)) return setError("รหัสวิชาต้องเป็นตัวเลข 6 หลัก");
    if (!/^\d{3}$/.test(lec) || !/^\d{3}$/.test(lab)) return setError("ตอนต้องเป็นตัวเลข 3 หลัก");

    const meetings: Meeting[] = [];
    for (const n of [1, 2]) {
      const days = String(fd.get(`days${n}`) ?? "").trim();
      const time = String(fd.get(`time${n}`) ?? "").trim();
      if (!days && !time) continue;
      let parsedDays;
      try {
        parsedDays = parseDays(days);
      } catch {
        return setError(`รูปแบบวัน “${days}” ไม่ถูกต้อง ใช้แบบ reg เช่น TuF, MTh, MWF, We`);
      }
      const range = parseTimeRange(time);
      if (!range) return setError(`เวลา “${time}” ไม่ถูกต้อง ใช้แบบ 0800-0930`);
      const room = String(fd.get(`room${n}`) ?? "").trim();
      meetings.push({ days: parsedDays, ...range, ...(room ? { room } : {}), kind: n === 1 ? "lec" : "lab" });
    }

    const credits = Number(fd.get("credits"));
    const section = {
      id: sectionId(courseNo, lec, lab),
      courseNo,
      title: String(fd.get("title")).trim() || courseNo,
      ...(credits > 0 ? { credits } : {}),
      lec,
      lab,
      meetings,
      instructors: String(fd.get("instructors") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    dispatch({ type: "import", sections: attachExams([section], EXAMS) });
    setAdded(`เพิ่ม ${courseNo} ตอน ${lec}/${lab} แล้ว`);
  }

  return (
    <details className="card">
      <summary className="bar cursor-pointer">เพิ่มวิชาเอง</summary>
      <form action={submit} className="grid gap-3 p-4 text-sm sm:grid-cols-6">
        <Field label="รหัสวิชา" name="courseNo" placeholder="204111" className="sm:col-span-2" required inputMode="numeric" />
        <Field label="ชื่อวิชา" name="title" placeholder="FUND OF COMP SCIENCE" className="sm:col-span-4" />
        <Field label="ตอนบรรยาย" name="lec" placeholder="001" />
        <Field label="ตอนแล็บ" name="lab" placeholder="000" />
        <Field label="หน่วยกิต" name="credits" placeholder="3" inputMode="decimal" />
        <Field label="อาจารย์ (คั่นด้วย ,)" name="instructors" className="sm:col-span-3" />
        {[1, 2].map((n) => (
          <fieldset key={n} className="grid gap-3 sm:col-span-6 sm:grid-cols-6">
            <legend className="label">{n === 1 ? "เวลาเรียน" : "เวลาเรียนที่ 2 (เช่น แล็บ ไม่บังคับ)"}</legend>
            <Field label="วัน" name={`days${n}`} placeholder="TuF" className="sm:col-span-2" />
            <Field label="เวลา" name={`time${n}`} placeholder="0800-0930" className="sm:col-span-2" />
            <Field label="ห้อง" name={`room${n}`} placeholder="RB5210" className="sm:col-span-2" />
          </fieldset>
        ))}
        <div className="flex items-center gap-3 sm:col-span-6">
          <button className="btn-primary">เพิ่ม</button>
          {error && (
            <p className="text-danger" role="alert">
              {error}
            </p>
          )}
          {added && (
            <p className="font-semibold text-ink" role="status">
              {added}
            </p>
          )}
        </div>
      </form>
    </details>
  );
}

function Field({ label, className = "", ...props }: { label: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={className}>
      <span className="label">{label}</span>
      <input className="input" {...props} />
    </label>
  );
}
