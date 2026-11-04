"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWorkspace } from "@/components/planner/workspace-context";
import { attachExams } from "@/lib/core/exams";
import { parseRegImport, type ImportResult } from "@/lib/core/import-reg";
import { EXAMS } from "@/lib/exams-data";
import { meetingLabel, sectionLabel } from "@/lib/ui";

export function ImportForm() {
  const { dispatch } = useWorkspace();
  const router = useRouter();
  const [text, setText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  function parse(input: string) {
    const r = parseRegImport(input);
    setResult({ ...r, sections: attachExams(r.sections, EXAMS) });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 5_000_000) {
      setResult({ sections: [], warnings: ["ไฟล์ใหญ่เกิน 5 MB"] });
      return;
    }
    const content = await file.text();
    setText(content.slice(0, 2000) + (content.length > 2000 ? "\n…" : ""));
    parse(content);
  }

  function confirm() {
    if (!result?.sections.length) return;
    dispatch({ type: "import", sections: result.sections });
    void fetch("/api/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "import_done", count: result.sections.length }),
    }).catch(() => {});
    router.push("/");
  }

  return (
    <section className="card flex flex-col gap-3 p-4" aria-labelledby="paste-h">
      <h2 id="paste-h" className="font-semibold">
        วางข้อมูล
      </h2>
      <textarea
        className="input min-h-40 font-mono text-xs"
        placeholder={"วางตารางผลค้นหาจาก reg ที่นี่\n204111  FUND OF COMP SCIENCE  001  000  3  TuF  0800-0930  RB5210 …"}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
        }}
        aria-label="ข้อมูลที่คัดลอกจาก reg"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" disabled={!text.trim()} onClick={() => parse(text)}>
          อ่านข้อมูล
        </button>
        <label className="btn cursor-pointer">
          อัปโหลดไฟล์ .html / .txt
          <input type="file" accept=".html,.htm,.txt,text/html,text/plain" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </div>

      {result && (
        <div className="flex flex-col gap-3" aria-live="polite">
          <p className="text-sm">
            พบ <strong>{result.sections.length}</strong> ตอนเรียน จาก{" "}
            <strong>{new Set(result.sections.map((s) => s.courseNo)).size}</strong> วิชา
          </p>
          {result.warnings.length > 0 && (
            <details className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900" open={result.sections.length === 0}>
              <summary className="cursor-pointer font-medium">อ่านไม่ได้ {result.warnings.length} บรรทัด</summary>
              <ul className="mt-2 list-disc pl-5 text-xs">
                {result.warnings.slice(0, 30).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs">ถ้าข้อมูลไม่ครบ เพิ่มเองได้ด้วยฟอร์มด้านล่าง</p>
            </details>
          )}
          {result.sections.length > 0 && (
            <>
              <div className="max-h-80 overflow-auto rounded-lg border border-line">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-stone-50 text-muted">
                    <tr>
                      <th className="p-2">วิชา</th>
                      <th className="p-2">ตอน</th>
                      <th className="p-2">เวลา</th>
                      <th className="p-2">อาจารย์</th>
                      <th className="p-2">สอบ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {result.sections.map((s) => (
                      <tr key={s.id}>
                        <td className="p-2">
                          <span className="font-mono font-semibold">{s.courseNo}</span> {s.title}
                        </td>
                        <td className="p-2">{sectionLabel(s)}</td>
                        <td className="p-2">{s.meetings.map(meetingLabel).join(" / ") || "TBA"}</td>
                        <td className="p-2">{s.instructors.join(", ")}</td>
                        <td className="p-2">{s.midterm || s.final ? "✓" : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="btn-primary self-start" onClick={confirm}>
                นำเข้า {result.sections.length} ตอน
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
