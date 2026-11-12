"use client";

import { useState } from "react";
import type { Answer } from "@/lib/rag/types";

const EXAMPLES = [
  "เทอม 2/2569 ถอนวิชาแบบได้ W ได้ถึงวันไหน",
  "ภาคฤดูร้อนลงทะเบียนได้กี่หน่วยกิต",
  "ต้องเข้าเรียนกี่เปอร์เซ็นต์ถึงมีสิทธิ์สอบ",
  "ลงทะเบียนได้มากที่สุดเทอมละกี่หน่วยกิต",
];

type Turn = { question: string; answer?: Answer; error?: string };

/** The question box and answers. `compact` is the slide-over drawer on the planner. */
export function AskForm({ compact = false }: { compact?: boolean }) {
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);

  async function ask(question: string) {
    const text = question.trim();
    if (text.length < 3 || busy) return;
    setBusy(true);
    setQ("");
    setTurns((t) => [{ question: text }, ...t]);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const body = await res.json();
      setTurns((t) => [{ question: text, ...(res.ok ? { answer: body as Answer } : { error: body.error ?? "เกิดข้อผิดพลาด" }) }, ...t.slice(1)]);
    } catch {
      setTurns((t) => [{ question: text, error: "เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง" }, ...t.slice(1)]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        className="card flex flex-col gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
      >
        <label htmlFor={compact ? "ask-q-drawer" : "ask-q"} className="sr-only">
          คำถาม
        </label>
        <textarea
          id={compact ? "ask-q-drawer" : "ask-q"}
          className={`w-full resize-y border-0 bg-white p-1 outline-none placeholder:text-muted ${compact ? "min-h-20 text-base" : "min-h-24 text-lg"}`}
          placeholder="เช่น ถอนวิชาได้ถึงวันไหน"
          value={q}
          maxLength={500}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              ask(q);
            }
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" className="rounded-full border border-line bg-white px-3 py-1 text-xs text-ink hover:border-accent/40 hover:bg-accent-soft" onClick={() => ask(ex)}>
                {ex}
              </button>
            ))}
          </div>
          <button className="btn-primary" disabled={busy || q.trim().length < 3}>
            {busy ? "กำลังค้น…" : "ถาม"}
          </button>
        </div>
      </form>

      <ol className="flex flex-col gap-4" aria-live="polite">
        {turns.map((t, i) => (
          <li key={turns.length - i} className="anim-rise border-t border-line pt-4">
            <p className={`font-bold ${compact ? "text-lg" : "text-xl"}`}>{t.question}</p>
            {!t.answer && !t.error && (
              <p className="mt-3 text-sm text-muted">
                กำลังค้นในเอกสาร
                <span className="animate-cursor ml-1 inline-block h-[1.1em] w-[0.5em] translate-y-[0.2em] rounded-sm bg-accent" aria-hidden />
              </p>
            )}
            {t.error && (
              <p className="mt-3 text-sm text-danger" role="alert">
                {t.error}
              </p>
            )}
            {t.answer && <AnswerView a={t.answer} />}
          </li>
        ))}
      </ol>
    </div>
  );
}

function AnswerView({ a }: { a: Answer }) {
  return (
    <div className="anim-rise mt-3 flex flex-col gap-3 text-sm">
      {a.status === "not_found" ? (
        <p className="rounded-xl bg-canvas p-4 text-base">
          <strong>ไม่พบ</strong> ในเอกสารที่ MorPlan มี ลองถามด้วยคำอื่น หรือสอบถามสำนักทะเบียนฯ / คณะโดยตรง
        </p>
      ) : (
        <p className="whitespace-pre-line text-base leading-relaxed">{a.text}</p>
      )}

      {a.citations.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="แหล่งอ้างอิง">
          {a.citations.map((c, i) => (
            <li key={`${c.docId}:${c.page}`} className="anim-rise" style={{ "--i": i + 1 } as React.CSSProperties}>
              {/* Citation chip: number, document, page. Opens to the quoted passage. */}
              <details className="group overflow-hidden rounded-xl border border-line bg-white open:border-accent/40">
                <summary className="flex cursor-pointer list-none items-stretch text-xs hover:bg-canvas [&::-webkit-details-marker]:hidden">
                  <span className="grid w-7 shrink-0 place-items-center bg-accent-soft font-mono font-bold text-accent">{c.n}</span>
                  <span className="min-w-0 flex-1 truncate px-2 py-1.5 font-semibold" title={c.title}>
                    {c.title}
                  </span>
                  <span className="shrink-0 border-l border-line px-2 py-1.5 font-mono">หน้า {c.page}</span>
                  <span className="grid w-7 shrink-0 place-items-center border-l border-line group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <div className="border-t border-line p-3">
                  <blockquote className="text-xs text-muted">{c.snippet}</blockquote>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs link font-semibold"
                  >
                    เปิดหน้าเอกสารต้นฉบับ
                  </a>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      <p className="rounded-xl bg-accent-soft px-3 py-2 text-xs text-ink">
        <strong>{a.notice}</strong> ข้อความมาจากการแปลงเอกสารด้วย OCR อาจมีตัวเลขหรือคำผิด ดูหน้าเอกสารต้นฉบับจากลิงก์ด้านบน
      </p>
      <p className="text-[11px] text-muted">
        {a.mode === "llm" ? "สรุปโดย AI จากข้อความที่อ้างอิง" : "แสดงข้อความจากเอกสารโดยตรง"} · {a.latencyMs} ms
        {a.costUsd > 0 ? ` · ~$${a.costUsd.toFixed(5)}` : ""}
      </p>
    </div>
  );
}
