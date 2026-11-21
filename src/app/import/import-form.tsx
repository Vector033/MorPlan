"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { DISCLAIMER } from "@/components/curriculum/format";
import { SourceLine } from "@/components/curriculum/shared";
import { CheckIcon } from "@/components/icons";
import { useWorkspace } from "@/components/planner/workspace-context";
import { currentTermView } from "@/lib/core/curriculum";
import { attachExams } from "@/lib/core/exams";
import type { ExtractResult } from "@/lib/core/extract";
import { pageText, parseRegImport } from "@/lib/core/import-reg";
import { isCmu, type UniversityInfo } from "@/lib/core/university";
import { demoSections } from "@/lib/demo";
import { EXAMS } from "@/lib/exams-data";
import { meetingLabel, sectionLabel } from "@/lib/ui";
import { workspaceReducer } from "@/lib/workspace/reducer";
import universities from "../../../data/universities-th.json";
import { ManualForm } from "./manual-form";

const MAX_AI_CHARS = 40_000;

const SAMPLE_PASTE = [
  "CS101  INTRO COMP PROG  001  000  3  TuF  0800-0930  A101",
  "002  000  3  MTh  0930-1100  A102",
  "CS102  PROG LAB  000  001  1  We  0900-1200  LAB201",
  "MATH101  CALCULUS 1  001  000  3  MTh  0800-0930  B205",
  "003  000  3  MWF  1000-1100  B301",
  "STAT101  STATISTICS  001  000  3  TuF  1100-1230  B302",
].join("\n");

type Read = ExtractResult & { ai: boolean };

/** Waits for the saved workspace so the university picker starts on the student's own university. */
export function ImportForm() {
  const { ready } = useWorkspace();
  return ready ? <ImportFormReady /> : <div className="card h-64 animate-pulse" aria-busy="true" />;
}

function ImportFormReady() {
  const { ws, dispatch } = useWorkspace();
  const router = useRouter();
  const [name, setName] = useState(ws.university ?? "");
  const [mode, setMode] = useState<"paste" | "manual">("paste");
  const [text, setText] = useState("");
  const [result, setResult] = useState<Read | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copy, setCopy] = useState<"ok" | "fail" | null>(null);
  const cur = ws.curriculum;
  const toSearch = (cur ? currentTermView(cur, ws.term) : null)?.view;
  const codes = toSearch ? [...new Set([...toSearch.overdue, ...toSearch.required.filter((c) => !c.done)].map((c) => c.courseNo))] : [];
  const university = name.trim();

  /** The built-in table reader when it reads the paste cleanly; otherwise AI, which needs the university. */
  async function parse(input: string) {
    setError(null);
    setResult(null);
    const local = parseRegImport(input);
    if (local.sections.length > 0 && (local.warnings.length === 0 || isCmu(university))) {
      // Exam dates are known only for the university whose public exam table is bundled.
      setResult({ ...local, sections: isCmu(university) ? attachExams(local.sections, EXAMS) : local.sections, ai: false });
      return;
    }
    if (university.length < 2) {
      if (local.sections.length > 0) return setResult({ ...local, ai: false });
      return setError("เลือกมหาวิทยาลัยด้านบนก่อน แล้วกดอ่านข้อมูลอีกครั้ง");
    }
    const plain = pageText(input).trim();
    if (plain.length > MAX_AI_CHARS) return setError("ข้อความยาวเกินไป ลองค้นทีละกลุ่มวิชาแล้ววางทีละรอบ");
    setBusy(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: plain, university }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setError(body.error ?? "อ่านข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง");
      else setResult({ ...(body as ExtractResult), ai: true });
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  async function copyCodes() {
    try {
      await navigator.clipboard.writeText(codes.join(" "));
      setCopy("ok");
    } catch {
      setCopy("fail");
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 5_000_000) return setError("ไฟล์ใหญ่เกิน 5 MB");
    const content = await file.text();
    setText(content.slice(0, 2000) + (content.length > 2000 ? "\n…" : ""));
    void parse(content);
  }

  function confirm() {
    if (!result?.sections.length) return;
    dispatch({ type: "import", sections: result.sections, ...(university ? { university } : {}) });
    void fetch("/api/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "import_done", count: result.sections.length }),
    }).catch(() => {});
    router.push("/");
  }

  function applyPreset(compareDemo: boolean) {
    const demo = demoSections();
    let next = workspaceReducer(ws, { type: "import", sections: demo });
    const pickIds = (pairs: readonly (readonly [string, string])[]) =>
      pairs
        .map(([courseNo, sec]) => demo.find((s) => s.courseNo === courseNo && (s.lec === sec || (s.lec === "000" && s.lab === sec)))?.id)
        .filter((id): id is string => !!id);

    for (const id of pickIds([
      ["CS101", "001"],
      ["MATH101", "003"],
      ["STAT101", "001"],
    ]))
      next = workspaceReducer(next, { type: "place", sectionId: id });

    if (compareDemo) {
      next = next.plans.some((p) => p.id === "B")
        ? workspaceReducer(next, { type: "setActive", id: "B" })
        : workspaceReducer(next, { type: "addPlan", copyFrom: next.activePlanId });
      // Deliberate TuF 08:00 clash (CS101 001 vs MATH101 002) for instant /compare testing.
      for (const id of pickIds([
        ["CS101", "001"],
        ["MATH101", "002"],
        ["STAT101", "001"],
      ]))
        next = workspaceReducer(next, { type: "place", sectionId: id });
      next = workspaceReducer(next, { type: "setActive", id: "A" });
    }

    dispatch({ type: "replace", workspace: next });
    router.push(compareDemo ? "/compare" : "/");
  }

  return (
    <>
      <UniversityPicker name={name} onName={setName} />

      <Steps
        items={[
          {
            title: "เปิดเว็บลงทะเบียน",
            body: (
              <p>
                ล็อกอินที่เว็บของมหาวิทยาลัยเองในอีกแท็บ <span className="whitespace-nowrap">MorPlan ไม่ขอรหัสผ่านใดๆ</span>
              </p>
            ),
          },
          {
            title: "ค้นวิชาที่อยากลง",
            body: (
              <p>
                ให้หน้าผลค้นหามีรหัสวิชา ตอนเรียน <span className="whitespace-nowrap">วัน และเวลา</span>
              </p>
            ),
          },
          {
            title: "คัดลอกมาวางที่นี่",
            body: (
              <p>
                กด{" "}
                <span className="whitespace-nowrap">
                  <span className="kbd">Ctrl</span>+<span className="kbd">A</span>
                </span>{" "}
                แล้ว{" "}
                <span className="whitespace-nowrap">
                  <span className="kbd">Ctrl</span>+<span className="kbd">C</span>
                </span>{" "}
                หรือบันทึก<span className="whitespace-nowrap">หน้าเว็บ</span>แล้วอัปโหลดไฟล์
              </p>
            ),
          },
        ]}
      />

      <section className="card" aria-labelledby="preset-h">
        <h2 id="preset-h" className="bar">
          ลองชุดตัวอย่างใน 1 คลิก
        </h2>
        <div className="flex flex-wrap items-center gap-2 px-4 pt-1 pb-4">
          <button type="button" className="btn" onClick={() => applyPreset(false)}>
            ชุดตัวอย่างพื้นฐาน (3 วิชา ไม่ชน)
          </button>
          <button type="button" className="btn" onClick={() => applyPreset(true)}>
            ลองเทียบแผน A / B (มีจุดชน)
          </button>
        </div>
      </section>

      <div role="group" aria-label="วิธีเพิ่มวิชา" className="flex w-fit gap-0.5 rounded-full bg-white p-1 text-sm shadow-sm ring-1 ring-line">
        {(
          [
            ["paste", "วางข้อมูล / อัปโหลด"],
            ["manual", "+ เพิ่มวิชาเอง"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-full px-4 py-1.5 whitespace-nowrap ${mode === m ? "bg-ink font-semibold text-white" : "text-muted hover:bg-canvas hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "manual" ? (
        <ManualForm university={university || undefined} />
      ) : (
        <section className="card" aria-labelledby="paste-h">
          <div className="bar">
            <h2 id="paste-h">วางข้อมูล</h2>
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() => {
                setText(SAMPLE_PASTE);
                void parse(SAMPLE_PASTE);
              }}
            >
              ใส่ตัวอย่างข้อความ
            </button>
          </div>
          <div className="flex flex-col gap-3 p-4">
            {codes.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm">ค้นรหัสเหล่านี้ในเว็บลงทะเบียน:</p>
                <p className="flex flex-wrap gap-1.5 font-mono text-xs tabular-nums">
                  {codes.map((c) => (
                    <span key={c} className="chip">
                      {c}
                    </span>
                  ))}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="btn" onClick={copyCodes}>
                    คัดลอกรหัส
                  </button>
                  <span role="status" className="text-xs text-muted">
                    {copy === "ok" ? "คัดลอกแล้ว" : ""}
                  </span>
                </div>
                {copy === "fail" && <p className="error-note">คัดลอกไม่สำเร็จ เลือกรหัสแล้วคัดลอกเอง</p>}
                {cur && (
                  <p className="text-xs text-muted">
                    <SourceLine source={cur.source} /> · {DISCLAIMER}
                  </p>
                )}
              </div>
            )}
            <textarea
              className="input min-h-40 font-mono text-xs"
              placeholder={"วางหน้าผลค้นหารายวิชาจากเว็บลงทะเบียนของมหาวิทยาลัยคุณ ทั้งหน้าก็ได้\nCS101  INTRO COMP PROG  001  000  3  TuF  0800-0930  A101 …"}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setResult(null);
              }}
              aria-label="ข้อมูลที่คัดลอกจากเว็บลงทะเบียน"
            />
            <p className="text-xs text-muted">
              ตารางที่อ่านเองได้จะอ่านในเบราว์เซอร์นี้ ถ้าอ่านไม่ได้ ข้อความจะถูกส่งให้ Google Gemini แยกเป็นตอนเรียน
              (ลบอีเมล เลขบัตรประชาชน และเบอร์โทรออกก่อนส่ง){" "}
              <span className="whitespace-nowrap">MorPlan ไม่เก็บข้อความนี้ไว้</span> แต่อย่าวางหน้าที่มี
              <span className="whitespace-nowrap">ข้อมูลส่วนตัว</span> เช่น ผลการเรียน
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-primary" disabled={!text.trim() || busy} aria-busy={busy} onClick={() => parse(text)}>
                {busy ? "กำลังอ่าน…" : "อ่านข้อมูล"}
              </button>
              <label className="btn cursor-pointer">
                อัปโหลดไฟล์ .html / .txt
                <input
                  type="file"
                  accept=".html,.htm,.txt,text/html,text/plain"
                  className="sr-only"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
              </label>
            </div>

            {error && (
              <p role="alert" className="error-note">
                {error}
              </p>
            )}

            {result && <Preview result={result} onConfirm={confirm} onManual={() => setMode("manual")} />}
          </div>
        </section>
      )}
    </>
  );
}

function Preview({ result, onConfirm, onManual }: { result: Read; onConfirm: () => void; onManual: () => void }) {
  const exams = result.sections.some((s) => s.midterm || s.final);
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <p className="text-sm">
        พบ <strong>{result.sections.length}</strong> ตอนเรียน จาก <strong>{new Set(result.sections.map((s) => s.courseNo)).size}</strong> วิชา
      </p>
      {result.warnings.length > 0 && (
        <details className="rounded-xs bg-accent-soft p-3 text-sm text-ink" open={result.sections.length === 0}>
          <summary className="cursor-pointer font-medium">
            {result.ai ? `ไม่นำเข้า ${result.warnings.length} รายการ` : `อ่านไม่ได้ ${result.warnings.length} บรรทัด`}
          </summary>
          <ul className="mt-2 list-disc pl-5 text-xs">
            {result.warnings.slice(0, 30).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            ถ้าข้อมูลไม่ครบ{" "}
            <button type="button" className="link" onClick={onManual}>
              เพิ่มวิชาเอง
            </button>
          </p>
        </details>
      )}
      {result.sections.length > 0 && (
        <>
          <div className="max-h-80 overflow-auto rounded-xs border border-line">
            <table className="w-full text-left text-xs tabular-nums">
              <thead className="sticky top-0 bg-canvas text-muted">
                <tr>
                  <th className="p-2">วิชา</th>
                  <th className="p-2">ตอน</th>
                  <th className="p-2">เวลา</th>
                  <th className="p-2">อาจารย์</th>
                  {exams && <th className="p-2">สอบ</th>}
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
                    {exams && (
                      <td className="p-2">
                        {s.midterm || s.final ? (
                          <>
                            <CheckIcon className="size-3.5 text-ok" />
                            <span className="sr-only">มีวันสอบ</span>
                          </>
                        ) : (
                          "–"
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.ai && <p className="text-xs text-muted">อ่านโดย AI: เทียบเวลากับเว็บของมหาวิทยาลัยอีกครั้งก่อนลงทะเบียนจริง</p>}
          <button className="btn-primary self-start" onClick={onConfirm}>
            นำเข้า {result.sections.length} ตอน
          </button>
        </>
      )}
    </div>
  );
}

function Steps({ items }: { items: { title: string; body: ReactNode }[] }) {
  return (
    <ol className="card grid overflow-hidden text-sm sm:grid-cols-3">
      {items.map((it, i) => (
        <li key={it.title} className={`p-4 ${i > 0 ? "border-t border-line sm:border-t-0 sm:border-l" : ""}`}>
          <span className="block font-mono text-4xl font-bold">{i + 1}</span>
          <span className="font-semibold">{it.title}</span>
          <div className="text-muted">{it.body}</div>
        </li>
      ))}
    </ol>
  );
}

/** One university for the whole app: a chip once chosen, a searchable field while choosing. */
function UniversityPicker({ name, onName }: { name: string; onName: (n: string) => void }) {
  const { ws, dispatch } = useWorkspace();
  const id = useId();
  const [editing, setEditing] = useState(!ws.university);
  const [info, setInfo] = useState<UniversityInfo | null>(null);
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");
  const [message, setMessage] = useState("");

  function save(n: string) {
    onName(n);
    dispatch({ type: "setUniversity", university: n });
  }

  async function lookup() {
    const typed = name.trim();
    save(typed);
    setEditing(false);
    setStatus("busy");
    setInfo(null);
    try {
      const res = await fetch("/api/university", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: typed }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(body.error ?? "ค้นไม่สำเร็จ ข้ามขั้นนี้แล้ววางข้อมูลได้เลย");
        setStatus("error");
        return;
      }
      setInfo(body as UniversityInfo);
      // A name picked from the list is already the official one; a typed nickname takes the looked-up name.
      if (body.officialName && !universities.includes(typed)) save(body.officialName);
      setStatus("idle");
    } catch {
      setMessage("เชื่อมต่อไม่ได้ ข้ามขั้นนี้แล้ววางข้อมูลได้เลย");
      setStatus("error");
    }
  }

  const searchUrl = info?.courseSearchUrl ?? info?.registrarUrl ?? info?.homeUrl;
  return (
    <section className="card" aria-labelledby={`${id}h`}>
      <h2 id={`${id}h`} className="bar">
        มหาวิทยาลัยของคุณ
      </h2>
      <div className="flex flex-col gap-3 p-4">
        {!editing && ws.university ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip bg-accent-soft text-sm font-semibold text-ink">{ws.university}</span>
            <button type="button" className="btn-ghost" onClick={() => setEditing(true)}>
              เปลี่ยน
            </button>
            {!info && status !== "busy" && (
              <button type="button" className="btn-ghost" onClick={() => void lookup()}>
                ค้นหาหน้าลงทะเบียน
              </button>
            )}
          </div>
        ) : (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim().length >= 2) void lookup();
            }}
          >
            <label htmlFor={`${id}n`} className="sr-only">
              ชื่อมหาวิทยาลัย
            </label>
            <input
              id={`${id}n`}
              className="input max-w-sm flex-1"
              list={`${id}l`}
              placeholder="พิมพ์เพื่อค้นชื่อมหาวิทยาลัย"
              value={name}
              maxLength={100}
              autoComplete="off"
              onChange={(e) => onName(e.target.value)}
            />
            <datalist id={`${id}l`}>
              {universities.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            <button className="btn" disabled={name.trim().length < 2 || status === "busy"} aria-busy={status === "busy"}>
              ค้นหาหน้าลงทะเบียน
            </button>
          </form>
        )}
        {status === "busy" && <p className="text-sm text-muted">กำลังค้นหน้าลงทะเบียน…</p>}
        {status === "error" && <p className="text-sm text-muted">{message}</p>}
        {info && (
          <div className="rounded-xs bg-canvas p-3 text-sm" aria-live="polite">
            <p className="font-semibold">{info.officialName}</p>
            {searchUrl ? (
              <p>
                <a className="link" href={searchUrl} target="_blank" rel="noreferrer">
                  {info.courseSearchUrl ? "หน้าค้นหารายวิชา" : info.registrarUrl ? "เว็บสำนักทะเบียน" : "เว็บไซต์มหาวิทยาลัย"}
                </a>{" "}
                <span className="text-xs text-muted">({new URL(searchUrl).hostname})</span>
                {!info.courseSearchUrl && !info.registrarUrl && (
                  <span className="block text-xs text-muted">ยืนยันลิงก์หน้าลงทะเบียนไม่ได้ เข้าเว็บมหาวิทยาลัยแล้วหาเมนูลงทะเบียนจากที่นั่น</span>
                )}
              </p>
            ) : (
              <p className="text-muted">ไม่พบลิงก์ที่ยืนยันได้ ค้นหาเว็บลงทะเบียนของมหาวิทยาลัยเอง</p>
            )}
            {info.courseCodeExample && (
              <p className="text-xs text-muted">
                ตัวอย่างรหัสวิชา: <span className="font-mono">{info.courseCodeExample}</span>
              </p>
            )}
            <p className="mt-1 text-xs text-muted">
              แนะนำโดย AI (Gemini) และแสดงเฉพาะลิงก์ของมหาวิทยาลัยที่เปิดได้จริง ตรวจสอบลิงก์ก่อนล็อกอิน
              และอย่ากรอกรหัสผ่านที่ไหนนอกจากเว็บของมหาวิทยาลัยเอง
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
