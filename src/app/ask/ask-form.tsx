"use client";

import { useState, type CSSProperties } from "react";
import { ArrowRightIcon, CheckIcon, WarningIcon } from "@/components/icons";
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
          <li key={turns.length - i} className={compact ? "anim-rise border-t border-line pt-4" : "anim-rise card p-4 sm:p-5"}>
            <p className={`max-w-[65ch] font-bold leading-[1.35] ${compact ? "text-lg" : "text-xl"}`}>{t.question}</p>
            {!t.answer && !t.error && (
              <div className="mt-3 max-w-[65ch] space-y-2.5" aria-busy="true">
                <p className="text-sm text-muted">
                  กำลังค้นในเอกสาร
                  <span className="animate-cursor ml-1 inline-block h-[1.1em] w-[0.5em] translate-y-[0.2em] rounded-sm bg-accent" aria-hidden />
                </p>
                <div className="space-y-2" aria-hidden="true">
                  <div className="h-3.5 w-11/12 animate-pulse rounded-full bg-canvas" />
                  <div className="h-3.5 w-4/5 animate-pulse rounded-full bg-canvas" />
                  <div className="h-3.5 w-3/5 animate-pulse rounded-full bg-canvas" />
                </div>
              </div>
            )}
            {t.error && (
              <p className="mt-3 inline-flex max-w-[65ch] items-center gap-1.5 text-sm font-medium text-danger" role="alert">
                <WarningIcon className="size-4 shrink-0" />
                <span>{t.error}</span>
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
    <div className="anim-rise mt-3 flex max-w-[65ch] flex-col gap-3 text-sm">
      {a.status === "not_found" ? (
        <div className="rounded-xl border border-line bg-canvas p-4 text-base leading-[1.65]">
          <p>
            <strong>ไม่พบ</strong> ในเอกสารที่ MorPlan มี
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-muted">
            <li className="flex items-start gap-2">
              <ArrowRightIcon className="mt-1 size-3.5 shrink-0 text-accent" />
              <span>ลองถามด้วยคำอื่น หรือระบุภาคการศึกษาที่ต้องการ</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRightIcon className="mt-1 size-3.5 shrink-0 text-accent" />
              <span>สอบถามสำนักทะเบียนฯ / คณะโดยตรงเพื่อคำตอบที่เป็นทางการ</span>
            </li>
          </ul>
        </div>
      ) : (
        <ChunkedAnswer text={a.text} />
      )}

      {a.citations.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="แหล่งอ้างอิง">
          {a.citations.map((c, i) => (
            <li key={`${c.docId}:${c.page}`} className="anim-rise" style={{ "--i": i + 1 } as CSSProperties}>
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
                  <blockquote className="text-xs leading-[1.65] text-muted">{c.snippet}</blockquote>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="link mt-2 inline-block text-xs font-semibold"
                  >
                    เปิดหน้าเอกสารต้นฉบับ
                  </a>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      <p className="rounded-xl bg-accent-soft px-3 py-2 text-xs leading-[1.6] text-ink">
        <strong>{a.notice}</strong> ข้อความมาจากการแปลงเอกสารด้วย OCR อาจมีตัวเลขหรือคำผิด ดูหน้าเอกสารต้นฉบับจากลิงก์ด้านบน
      </p>
      <p className="text-[11px] text-muted tabular-nums">
        {a.mode === "llm" ? "สรุปโดย AI จากข้อความที่อ้างอิง" : "แสดงข้อความจากเอกสารโดยตรง"} · {a.latencyMs} ms
        {a.costUsd > 0 ? ` · ~$${a.costUsd.toFixed(5)}` : ""}
      </p>
    </div>
  );
}

/** Splits AI answer text into scannable 50-75ch paragraphs and icon bullet lists. */
function ChunkedAnswer({ text }: { text: string }) {
  const blocks = parseAnswerBlocks(text);
  return (
    <div className="space-y-2.5 text-base leading-[1.65]">
      {blocks.map((block, i) =>
        block.kind === "list" ? (
          <ul key={i} className="space-y-1.5">
            {block.items.map((item, j) => (
              <li key={j} className="flex items-start gap-2">
                <CheckIcon className="mt-1.5 size-4 shrink-0 text-accent" />
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>{block.text}</p>
        ),
      )}
    </div>
  );
}

type AnswerBlock = { kind: "p"; text: string } | { kind: "list"; items: string[] };

const BULLET_LINE = /^(?:[-•*]|\d+[.)])\s+(.+)$/;

function parseAnswerBlocks(text: string): AnswerBlock[] {
  const out: AnswerBlock[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = BULLET_LINE.exec(line);
    if (match) {
      const prev = out.at(-1);
      if (prev?.kind === "list") prev.items.push(match[1]);
      else out.push({ kind: "list", items: [match[1]] });
    } else {
      out.push({ kind: "p", text: line });
    }
  }
  return out.length ? out : [{ kind: "p", text }];
}
