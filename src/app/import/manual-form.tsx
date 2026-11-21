"use client";

import { useId, useState } from "react";
import { useWorkspace } from "@/components/planner/workspace-context";
import { submitKeepingValues } from "@/components/submit-keeping-values";
import { attachExams } from "@/lib/core/exams";
import { DAY_TH_SHORT } from "@/lib/core/time";
import { DAYS, sectionId, type Day, type ExamSlot, type Meeting, type Section } from "@/lib/core/types";
import { isCmu } from "@/lib/core/university";
import { EXAMS } from "@/lib/exams-data";

const MAX_ROWS = 6;
type Row = { key: number; days: Day[]; start: string; end: string; room: string; kind: "lec" | "lab" };
const newRow = (key: number, kind: Row["kind"] = "lec"): Row => ({ key, days: [], start: "", end: "", room: "", kind });

/** "08:00" → minutes; NaN when empty or malformed. */
const toMinutes = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

/** One section at a time, for any university: codes are letters and digits, days are toggles, times are pickers. */
export function ManualForm({ university }: { university?: string }) {
  const { dispatch } = useWorkspace();
  const id = useId();
  const [rows, setRows] = useState<Row[]>([newRow(0)]);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function submit(fd: FormData) {
    setError(null);
    setAdded(null);
    // Letters and digits only, spaces and dashes dropped ("ITCS 101" → "ITCS101").
    const norm = (v: FormDataEntryValue | null, fallback: string) => String(v ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "") || fallback;
    const courseNo = norm(fd.get("courseNo"), "");
    const lec = norm(fd.get("lec"), "001");
    const lab = norm(fd.get("lab"), "000");
    if (!/^[0-9A-Z]{2,12}$/.test(courseNo)) return setError("รหัสวิชาใช้ตัวอักษรอังกฤษและตัวเลข 2–12 ตัว");
    if (!/^[0-9A-Z]{1,6}$/.test(lec) || !/^[0-9A-Z]{1,6}$/.test(lab)) return setError("ตอนใช้ตัวอักษรอังกฤษและตัวเลขไม่เกิน 6 ตัว");

    const meetings: Meeting[] = [];
    for (const [i, r] of rows.entries()) {
      if (!r.days.length && !r.start && !r.end) continue;
      const [start, end] = [toMinutes(r.start), toMinutes(r.end)];
      if (!r.days.length) return setError(`ช่วงเวลาที่ ${i + 1}: เลือกวันเรียนอย่างน้อย 1 วัน`);
      if (!(start < end)) return setError(`ช่วงเวลาที่ ${i + 1}: ใส่เวลาเริ่มและเวลาเลิก โดยเวลาเลิกต้องหลังเวลาเริ่ม`);
      const room = r.room.trim().slice(0, 60);
      meetings.push({ days: DAYS.filter((d) => r.days.includes(d)), start, end, ...(room ? { room } : {}), kind: r.kind });
    }

    const exam = (which: "mid" | "fin", label: string): ExamSlot | undefined | string => {
      const date = String(fd.get(`${which}Date`) ?? "");
      const [start, end] = [toMinutes(String(fd.get(`${which}Start`) ?? "")), toMinutes(String(fd.get(`${which}End`) ?? ""))];
      if (!date && Number.isNaN(start) && Number.isNaN(end)) return undefined;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !(start < end)) return `${label}: ใส่วันที่ เวลาเริ่ม และเวลาเลิกให้ครบ`;
      return { date, start, end };
    };
    const midterm = exam("mid", "สอบกลางภาค");
    const final = exam("fin", "สอบปลายภาค");
    if (typeof midterm === "string") return setError(midterm);
    if (typeof final === "string") return setError(final);

    const credits = Number(fd.get("credits"));
    const section: Section = {
      id: sectionId(courseNo, lec, lab),
      courseNo,
      title: String(fd.get("title") ?? "").trim().slice(0, 200) || courseNo,
      ...(credits > 0 && credits <= 30 ? { credits } : {}),
      lec,
      lab,
      meetings,
      instructors: String(fd.get("instructors") ?? "")
        .split(",")
        .map((s) => s.trim().slice(0, 150))
        .filter(Boolean)
        .slice(0, 12),
      ...(midterm ? { midterm } : {}),
      ...(final ? { final } : {}),
    };
    // Exam dates typed here win; otherwise the bundled public exam table fills them where it applies.
    const sections = isCmu(university) && !midterm && !final ? attachExams([section], EXAMS) : [section];
    dispatch({ type: "import", sections, ...(university ? { university } : {}) });
    setAdded(`เพิ่ม ${courseNo} ตอน ${lec}/${lab} แล้ว`);
  }

  return (
    <section className="card" aria-labelledby={`${id}h`}>
      <h2 id={`${id}h`} className="bar">
        + เพิ่มวิชาเอง
      </h2>
      <form onSubmit={submitKeepingValues(submit)} className="grid gap-3 p-4 text-sm sm:grid-cols-6">
        <Field label="รหัสวิชา" name="courseNo" placeholder="CS101" className="sm:col-span-2" required autoCapitalize="characters" />
        <Field label="ชื่อวิชา" name="title" placeholder="INTRO COMP PROG" className="sm:col-span-4" />
        <Field label="ตอนบรรยาย" name="lec" placeholder="001" />
        <Field label="ตอนแล็บ" name="lab" placeholder="000" />
        <Field label="หน่วยกิต" name="credits" placeholder="3" inputMode="decimal" />
        <Field label="อาจารย์ (คั่นด้วย ,)" name="instructors" className="sm:col-span-3" />

        {rows.map((r, i) => (
          <fieldset key={r.key} className="grid gap-3 rounded-xs border border-line p-3 sm:col-span-6 sm:grid-cols-6">
            <legend className="label px-1">ช่วงเวลาเรียนที่ {i + 1}</legend>
            <div role="group" aria-label={`วันเรียน ช่วงที่ ${i + 1}`} className="flex flex-wrap gap-1.5 sm:col-span-6">
              {DAYS.map((d) => {
                const on = r.days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => update(r.key, { days: on ? r.days.filter((x) => x !== d) : [...r.days, d] })}
                    className={`min-h-9 min-w-11 rounded-full border px-3 text-sm font-medium ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink/25"}`}
                  >
                    {DAY_TH_SHORT[d].replace(".", "")}
                  </button>
                );
              })}
            </div>
            <Field label="เริ่ม" type="time" value={r.start} onChange={(e) => update(r.key, { start: e.target.value })} />
            <Field label="เลิก" type="time" value={r.end} onChange={(e) => update(r.key, { end: e.target.value })} />
            <Field label="ห้อง" placeholder="A101" className="sm:col-span-2" value={r.room} onChange={(e) => update(r.key, { room: e.target.value })} />
            <label>
              <span className="label">ประเภท</span>
              <select className="input" value={r.kind} onChange={(e) => update(r.key, { kind: e.target.value as Row["kind"] })}>
                <option value="lec">บรรยาย</option>
                <option value="lab">แล็บ</option>
              </select>
            </label>
            {rows.length > 1 && (
              <div className="flex items-end">
                <button type="button" className="btn-ghost" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                  ลบช่วงนี้
                </button>
              </div>
            )}
          </fieldset>
        ))}
        {rows.length < MAX_ROWS && (
          <div className="sm:col-span-6">
            <button
              type="button"
              className="btn"
              onClick={() => setRows((rs) => [...rs, newRow(Math.max(...rs.map((x) => x.key)) + 1, "lab")])}
            >
              + เพิ่มช่วงเวลาเรียน
            </button>
          </div>
        )}

        {(
          [
            ["mid", "สอบกลางภาค (ไม่บังคับ)"],
            ["fin", "สอบปลายภาค (ไม่บังคับ)"],
          ] as const
        ).map(([k, label]) => (
          <fieldset key={k} className="grid gap-3 sm:col-span-3 sm:grid-cols-3">
            <legend className="label">{label}</legend>
            <Field label="วันที่" name={`${k}Date`} type="date" />
            <Field label="เริ่ม" name={`${k}Start`} type="time" />
            <Field label="เลิก" name={`${k}End`} type="time" />
          </fieldset>
        ))}

        <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
          <button className="btn-primary">เพิ่มวิชา</button>
          {error && (
            <p className="error-note" role="alert">
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
    </section>
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
