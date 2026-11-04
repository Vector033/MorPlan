"use client";

import { useState } from "react";
import type { Answer } from "@/lib/rag/types";

const EXAMPLES = [
  "เทอม 2/2569 ถอนวิชาแบบได้ W ได้ถึงวันไหน",
  "เกรดเฉลี่ยต่ำกว่าเท่าไหร่ถึงพ้นสภาพนักศึกษา",
  "ต้องเข้าเรียนกี่เปอร์เซ็นต์ถึงมีสิทธิ์สอบ",
  "ลงทะเบียนได้มากที่สุดเทอมละกี่หน่วยกิต",
];

type Turn = { question: string; answer?: Answer; error?: string };

export function AskForm() {
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
        className="flex flex-col gap-3 border-2 border-ink p-3"
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
      >
        <label htmlFor="ask-q" className="sr-only">
          คำถาม
        </label>
        <textarea
          id="ask-q"
          className="min-h-24 w-full resize-y border-0 bg-white p-1 text-lg outline-none placeholder:text-muted"
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
              <button key={ex} type="button" className="border border-line px-2.5 py-1 text-xs text-ink hover:border-ink hover:bg-ink hover:text-white" onClick={() => ask(ex)}>
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
          <li key={turns.length - i} className="border-t-4 border-ink pt-4">
            <p className="text-xl font-bold">{t.question}</p>
            {!t.answer && !t.error && <p className="mt-3 animate-pulse text-sm text-muted">กำลังค้นในเอกสาร…</p>}
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
    <div className="mt-3 flex flex-col gap-3 text-sm">
      {a.status === "not_found" ? (
        <p className="bg-[#f4f4f4] p-4 text-base">
          <strong>ไม่พบ</strong> ในเอกสารที่ MorPlan มี ลองถามด้วยคำอื่น หรือสอบถามสำนักทะเบียนฯ / คณะโดยตรง
        </p>
      ) : (
        <p className="whitespace-pre-line text-base leading-relaxed">{a.text}</p>
      )}

      {a.citations.length > 0 && (
        <ul className="flex flex-col gap-2">
          {a.citations.map((c) => (
            <li key={`${c.docId}:${c.page}`} className="border border-ink p-3">
              <a href={c.url} target="_blank" rel="noreferrer" className="font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4 hover:text-accent">
                [{c.n}] {c.title} · หน้า {c.page}
              </a>
              <blockquote className="mt-2 text-xs text-muted">{c.snippet}</blockquote>
            </li>
          ))}
        </ul>
      )}

      <p className="border-t-2 border-accent bg-accent-soft px-3 py-2 text-xs text-ink">
        <strong>{a.notice}</strong> ข้อความมาจากการแปลงเอกสารด้วย OCR อาจมีตัวเลขหรือคำผิด ดูหน้าเอกสารต้นฉบับจากลิงก์ด้านบน
      </p>
      <p className="text-[11px] text-muted">
        {a.mode === "llm" ? "สรุปโดย AI จากข้อความที่อ้างอิง" : "แสดงข้อความจากเอกสารโดยตรง"} · {a.latencyMs} ms
        {a.costUsd > 0 ? ` · ~$${a.costUsd.toFixed(5)}` : ""}
      </p>
    </div>
  );
}
