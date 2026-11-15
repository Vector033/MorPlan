"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CheckIcon } from "@/components/icons";
import { useWorkspace } from "@/components/planner/workspace-context";
import { attachExams } from "@/lib/core/exams";
import type { ExtractResult } from "@/lib/core/extract";
import { pageText, parseRegImport } from "@/lib/core/import-reg";
import { termPosition, termView } from "@/lib/core/curriculum";
import { isCmu, type UniversityInfo } from "@/lib/core/university";
import { demoSections } from "@/lib/demo";
import { EXAMS } from "@/lib/exams-data";
import { meetingLabel, sectionLabel } from "@/lib/ui";
import { workspaceReducer } from "@/lib/workspace/reducer";
import { ManualForm } from "./manual-form";

const MAX_AI_CHARS = 40_000;

const SAMPLE_REG_PASTE = [
  "204101  INTRO COMP PROG  001  000  3  TuF  0800-0930  RB5210",
  "002  000  3  MTh  0930-1100  RB5205",
  "204102  PROG LAB  000  001  1  We  0900-1200  CSB201",
  "206111  CALCULUS 1  001  000  3  MTh  0800-0930  SCB1200",
  "003  000  3  MWF  1000-1100  SCB1300",
  "208101  STATISTICS  001  000  3  TuF  1100-1230  SCB2100",
].join("\n");

/** Waits for the saved workspace so the university picker starts on the student's own university. */
export function ImportForm() {
  const { ready } = useWorkspace();
  return ready ? (
    <ImportFormReady />
  ) : (
    <div className="card h-64 animate-pulse" aria-busy="true" />
  );
}

function ImportFormReady() {
  const { ws, dispatch } = useWorkspace();
  const router = useRouter();
  const [other, setOther] = useState(!isCmu(ws.university));
  const [name, setName] = useState(
    isCmu(ws.university) ? "" : (ws.university ?? ""),
  );
  const [text, setText] = useState("");
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copy, setCopy] = useState<"ok" | "fail" | null>(null);
  const cur = ws.curriculum;
  const curPlan = cur?.data.plans.find((p) => p.id === cur.planId);
  const toSearch = cur && curPlan ? termView(curPlan, cur.viewTerm ?? termPosition(cur.cohort, ws.term), cur) : null;
  const codes = toSearch ? [...new Set([...toSearch.overdue, ...toSearch.required.filter((c) => !c.done)].map((c) => c.courseNo))] : [];
  // Typing "มช." under "other" still gets the CMU parser; an empty name does not.
  const cmu = !other || (name.trim() !== "" && isCmu(name));

  async function parse(input: string) {
    setError(null);
    setResult(null);
    if (cmu) {
      const r = parseRegImport(input);
      setResult({ ...r, sections: attachExams(r.sections, EXAMS) });
      return;
    }
    if (name.trim().length < 2) return setError("พิมพ์ชื่อมหาวิทยาลัยก่อน");
    const plain = pageText(input).trim();
    if (plain.length > MAX_AI_CHARS)
      return setError("ข้อความยาวเกินไป ลองค้นทีละกลุ่มวิชาแล้ววางทีละรอบ");
    setBusy(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: plain, university: name.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok)
        setError(body.error ?? "อ่านข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง");
      else setResult(body as ExtractResult);
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
    dispatch({
      type: "import",
      sections: result.sections,
      university: cmu ? null : name.trim(),
    });
    void fetch("/api/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "import_done",
        count: result.sections.length,
      }),
    }).catch(() => {});
    router.push("/");
  }

  function applyPreset(compareDemo: boolean) {
    const demo = demoSections(EXAMS);
    let next = workspaceReducer(ws, { type: "import", sections: demo, university: null });
    const pickIds = (pairs: readonly (readonly [string, string])[]) =>
      pairs
        .map(([courseNo, sec]) => demo.find((s) => s.courseNo === courseNo && (s.lec === sec || (s.lec === "000" && s.lab === sec)))?.id)
        .filter((id): id is string => !!id);

    const planAIds = pickIds([
      ["204101", "001"],
      ["206111", "003"],
      ["208101", "001"],
    ]);
    for (const id of planAIds) next = workspaceReducer(next, { type: "place", sectionId: id });

    if (compareDemo) {
      if (!next.plans.some((p) => p.id === "B")) {
        next = workspaceReducer(next, { type: "addPlan", copyFrom: next.activePlanId });
      } else {
        next = workspaceReducer(next, { type: "setActive", id: "B" });
      }
      // Deliberate TuF 08:00 clash (204101 001 vs 206111 002) for instant /compare testing.
      const planBIds = pickIds([
        ["204101", "001"],
        ["206111", "002"],
        ["208101", "001"],
      ]);
      for (const id of planBIds) next = workspaceReducer(next, { type: "place", sectionId: id });
      next = workspaceReducer(next, { type: "setActive", id: "A" });
    }

    dispatch({ type: "replace", workspace: next });
    router.push(compareDemo ? "/compare" : "/");
  }

  return (
    <>
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="label">มหาวิทยาลัย</legend>
        {[
          { value: false, label: "มช." },
          { value: true, label: "มหาวิทยาลัยอื่น" },
        ].map((o) => (
          <label
            key={o.label}
            className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium has-focus-visible:outline-2 has-focus-visible:outline-accent ${
              other === o.value
                ? "border-ink bg-ink text-white"
                : "border-line bg-white text-ink hover:border-ink/25"
            }`}
          >
            <input
              type="radio"
              name="uni"
              className="sr-only"
              checked={other === o.value}
              onChange={() => {
                setOther(o.value);
                setResult(null);
                setError(null);
              }}
            />
            {o.label}
          </label>
        ))}
      </fieldset>

      {other ? <OtherUniversity name={name} onName={setName} /> : <CmuSteps />}

      {cmu && (
        <section className="card" aria-labelledby="preset-h">
          <h2 id="preset-h" className="bar">
            ลองชุดตัวอย่าง มช. ใน 1 คลิก
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
      )}

      <section className="card" aria-labelledby="paste-h">
        <div className="bar">
          <h2 id="paste-h">วางข้อมูล</h2>
          {cmu && (
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() => {
                setText(SAMPLE_REG_PASTE);
                void parse(SAMPLE_REG_PASTE);
              }}
            >
              ใส่ตัวอย่างข้อความ reg
            </button>
          )}
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
            </div>
          )}
          <textarea
            className="input min-h-40 font-mono text-xs"
            placeholder={
              cmu
                ? "วางตารางผลค้นหาจาก reg ที่นี่\n204111  FUND OF COMP SCIENCE  001  000  3  TuF  0800-0930  RB5210 …"
                : "วางหน้าผลค้นหารายวิชาจากเว็บลงทะเบียนของมหาวิทยาลัยคุณ ทั้งหน้าก็ได้"
            }
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
            }}
            aria-label={
              cmu ? "ข้อมูลที่คัดลอกจาก reg" : "ข้อมูลที่คัดลอกจากเว็บลงทะเบียน"
            }
          />
          {!cmu && (
            <p className="text-xs text-muted">
              ข้อความที่วางจะถูกส่งให้ Google Gemini อ่านแล้วแยกเป็นตอนเรียน (ลบอีเมล เลขบัตรประชาชน และเบอร์โทรออกก่อนส่ง){" "}
              <span className="whitespace-nowrap">MorPlan ไม่เก็บข้อความนี้ไว้</span> แต่อย่าวางหน้าที่มี
              <span className="whitespace-nowrap">ข้อมูลส่วนตัว</span> เช่น ผลการเรียน{" "}
              ทุกวิชาที่อ่านได้จะถูกเช็กว่ารหัสและเวลามีอยู่จริงในข้อความ
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn-primary"
              disabled={!text.trim() || busy}
              aria-busy={busy}
              onClick={() => parse(text)}
            >
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
            <p
              role="alert"
              className="error-note"
            >
              {error}
            </p>
          )}

          {result && <Preview result={result} cmu={cmu} onConfirm={confirm} />}
        </div>
      </section>

      <ManualForm cmu={cmu} university={cmu ? null : name.trim()} />
    </>
  );
}

function Preview({
  result,
  cmu,
  onConfirm,
}: {
  result: ExtractResult;
  cmu: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <p className="text-sm">
        พบ <strong>{result.sections.length}</strong> ตอนเรียน จาก{" "}
        <strong>{new Set(result.sections.map((s) => s.courseNo)).size}</strong>{" "}
        วิชา
      </p>
      {result.warnings.length > 0 && (
        <details
          className="rounded-xs bg-accent-soft p-3 text-sm text-ink"
          open={result.sections.length === 0}
        >
          <summary className="cursor-pointer font-medium">
            {cmu
              ? `อ่านไม่ได้ ${result.warnings.length} บรรทัด`
              : `ไม่นำเข้า ${result.warnings.length} รายการ`}
          </summary>
          <ul className="mt-2 list-disc pl-5 text-xs">
            {result.warnings.slice(0, 30).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            ถ้าข้อมูลไม่ครบ เพิ่มเองได้ด้วยฟอร์มด้านล่าง
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
                  {cmu && <th className="p-2">สอบ</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.sections.map((s) => (
                  <tr key={s.id}>
                    <td className="p-2">
                      <span className="font-mono font-semibold">
                        {s.courseNo}
                      </span>{" "}
                      {s.title}
                    </td>
                    <td className="p-2">{sectionLabel(s)}</td>
                    <td className="p-2">
                      {s.meetings.map(meetingLabel).join(" / ") || "TBA"}
                    </td>
                    <td className="p-2">{s.instructors.join(", ")}</td>
                    {cmu && (
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
          {!cmu && (
            <p className="text-xs text-muted">
              อ่านโดย AI:
              เทียบเวลากับเว็บของมหาวิทยาลัยอีกครั้งก่อนลงทะเบียนจริง
            </p>
          )}
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
        <li
          key={it.title}
          className={`p-4 ${i > 0 ? "border-t border-line sm:border-t-0 sm:border-l" : ""}`}
        >
          <span className="block font-mono text-4xl font-bold">{i + 1}</span>
          <span className="font-semibold">{it.title}</span>
          <div className="text-muted">{it.body}</div>
        </li>
      ))}
    </ol>
  );
}

function CmuSteps() {
  return (
    <Steps
      items={[
        {
          title: "เปิด reg ในอีกแท็บ",
          body: (
            <p>
              เปิด{" "}
              <a
                className="link whitespace-nowrap"
                href="https://www1.reg.cmu.ac.th/registrationoffice/searchcourse.php"
                target="_blank"
                rel="noreferrer"
              >
                หน้าค้นหากระบวนวิชา
              </a>{" "}
              แล้วล็อกอินที่<span className="whitespace-nowrap">เว็บ reg เอง</span>
            </p>
          ),
        },
        {
          title: "ค้นวิชาที่อยากลง",
          body: (
            <p>
              ค้นทีละวิชาหรือทั้งกลุ่ม เช่น <span className="whitespace-nowrap">รหัส 204</span> ให้
              <span className="whitespace-nowrap">ตารางผลลัพธ์</span>มี section,{" "}
              <span className="whitespace-nowrap">วัน และเวลา</span>
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
              หรือบันทึก<span className="whitespace-nowrap">หน้าเว็บ</span> (
              <span className="whitespace-nowrap">
                <span className="kbd">Ctrl</span>+<span className="kbd">S</span>
              </span>
              ) แล้วอัปโหลดไฟล์
            </p>
          ),
        },
      ]}
    />
  );
}

function OtherUniversity({
  name,
  onName,
}: {
  name: string;
  onName: (n: string) => void;
}) {
  const [info, setInfo] = useState<UniversityInfo | null>(null);
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");
  const [message, setMessage] = useState("");

  async function lookup() {
    setStatus("busy");
    setInfo(null);
    try {
      const res = await fetch("/api/university", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(body.error ?? "ค้นไม่สำเร็จ ข้ามขั้นนี้แล้ววางข้อมูลได้เลย");
        setStatus("error");
        return;
      }
      setInfo(body as UniversityInfo);
      if (body.officialName) onName(body.officialName);
      setStatus("idle");
    } catch {
      setMessage("เชื่อมต่อไม่ได้ ข้ามขั้นนี้แล้ววางข้อมูลได้เลย");
      setStatus("error");
    }
  }

  const searchUrl = info?.courseSearchUrl ?? info?.registrarUrl ?? info?.homeUrl;
  return (
    <>
      <section className="card" aria-labelledby="uni-h">
        <h2 id="uni-h" className="bar">
          มหาวิทยาลัยของคุณ
        </h2>
        <div className="flex flex-col gap-3 p-4">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim().length >= 2) void lookup();
            }}
          >
            <label htmlFor="uni-name" className="sr-only">
              ชื่อมหาวิทยาลัย
            </label>
            <input
              id="uni-name"
              className="input max-w-sm flex-1"
              placeholder="เช่น มหาวิทยาลัยเกษตรศาสตร์"
              value={name}
              maxLength={100}
              onChange={(e) => onName(e.target.value)}
            />
            <button
              className="btn"
              disabled={name.trim().length < 2 || status === "busy"}
              aria-busy={status === "busy"}
            >
              {status === "busy" ? "กำลังค้น…" : "ค้นหาหน้าลงทะเบียน"}
            </button>
          </form>
          {status === "error" && (
            <p className="text-sm text-muted">{message}</p>
          )}
          {info && (
            <div
              className="rounded-xs bg-canvas p-3 text-sm"
              aria-live="polite"
            >
              <p className="font-semibold">{info.officialName}</p>
              {searchUrl ? (
                <p>
                  <a
                    className="link"
                    href={searchUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {info.courseSearchUrl
                      ? "หน้าค้นหารายวิชา"
                      : info.registrarUrl
                        ? "เว็บสำนักทะเบียน"
                        : "เว็บไซต์มหาวิทยาลัย"}
                  </a>{" "}
                  <span className="text-xs text-muted">
                    ({new URL(searchUrl).hostname})
                  </span>
                  {!info.courseSearchUrl && !info.registrarUrl && (
                    <span className="block text-xs text-muted">
                      ยืนยันลิงก์หน้าลงทะเบียนไม่ได้ เข้าเว็บมหาวิทยาลัยแล้วหาเมนูลงทะเบียนจากที่นั่น
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-muted">
                  ไม่พบลิงก์ที่ยืนยันได้ ค้นหาเว็บลงทะเบียนของมหาวิทยาลัยเอง
                </p>
              )}
              {info.courseCodeExample && (
                <p className="text-xs text-muted">
                  ตัวอย่างรหัสวิชา:{" "}
                  <span className="font-mono">{info.courseCodeExample}</span>
                </p>
              )}
              <p className="mt-1 text-xs text-muted">
                แนะนำโดย AI (Gemini) และแสดงเฉพาะลิงก์โดเมน .ac.th ที่เปิดได้จริง{" "}
                ตรวจสอบลิงก์ก่อนล็อกอิน
                และอย่ากรอกรหัสผ่านที่ไหนนอกจากเว็บของมหาวิทยาลัยเอง
              </p>
            </div>
          )}
        </div>
      </section>
      <Steps
        items={[
          {
            title: "เปิดเว็บลงทะเบียน",
            body: (
              <p>
                ล็อกอินที่เว็บของมหาวิทยาลัยเองในอีกแท็บ{" "}
                <span className="whitespace-nowrap">MorPlan ไม่ขอรหัสผ่านใดๆ</span>
              </p>
            ),
          },
          {
            title: "ค้นวิชาที่อยากลง",
            body: (
              <p>
                ให้หน้าผลค้นหามีรหัสวิชา ตอนเรียน{" "}
                <span className="whitespace-nowrap">วัน และเวลา</span>
              </p>
            ),
          },
          {
            title: "คัดลอกมาวางที่นี่",
            body: (
              <p>
                คัดลอกทั้งหน้าหรือบันทึกหน้าเว็บแล้วอัปโหลด{" "}
                <span className="whitespace-nowrap">AI จะแยกเป็นตอนเรียนให้</span>
              </p>
            ),
          },
        ]}
      />
    </>
  );
}
