"use client";

import { useCallback, useEffect, useId, useState, type CSSProperties } from "react";
import { SourceInput } from "@/components/curriculum/source-input";
import { Radio } from "@/components/curriculum/shared";
import { ArrowRightIcon, CheckIcon, XIcon } from "@/components/icons";
import { useWorkspace } from "@/components/planner/workspace-context";
import type { Answer } from "@/lib/rag/types";
import type { RegPage } from "@/lib/regulations/pages";
import universities from "../../../data/universities-th.json";

const EXAMPLES = [
  "ถอนวิชาแบบได้ W ได้ถึงวันไหน",
  "ภาคฤดูร้อนลงทะเบียนได้กี่หน่วยกิต",
  "ต้องเข้าเรียนกี่เปอร์เซ็นต์ถึงมีสิทธิ์สอบ",
  "ลงทะเบียนได้มากที่สุดเทอมละกี่หน่วยกิต",
];

type Turn = { question: string; answer?: Answer; error?: string };
type Doc = { id: string; title: string; kind: string; sourceUrl: string | null };
type PrivateDoc = { title: string; pages: RegPage[] };
type Preview = { title: string; pageCount: number; sample: string };

/** The question box and answers for the student's own university. `compact` is the slide-over drawer on the planner. */
export function AskForm({ compact = false }: { compact?: boolean }) {
  const { ws, ready } = useWorkspace();
  if (!ready) return <div className="card h-40 animate-pulse" aria-busy="true" />;
  const university = ws.university ?? "";
  return (
    <div className="flex flex-col gap-4">
      <UniversityBar />
      {/* Keyed by university: documents, private files and answers never carry over to another university. */}
      {university ? <Questions key={university} university={university} compact={compact} /> : null}
    </div>
  );
}

/** One university for the whole app, chosen here or on any other page. */
function UniversityBar() {
  const { ws, dispatch } = useWorkspace();
  const id = useId();
  const [editing, setEditing] = useState(!ws.university);
  const [name, setName] = useState(ws.university ?? "");
  if (!editing && ws.university)
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">ระเบียบของ</span>
        <span className="chip bg-accent-soft font-semibold text-ink">{ws.university}</span>
        <button type="button" className="btn-ghost" onClick={() => setEditing(true)}>
          เปลี่ยน
        </button>
      </div>
    );
  return (
    <form
      className="card flex flex-wrap items-end gap-2 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim().length < 2) return;
        dispatch({ type: "setUniversity", university: name });
        setEditing(false);
      }}
    >
      <label className="min-w-0 flex-1" htmlFor={`${id}u`}>
        <span className="label">มหาวิทยาลัยของคุณ</span>
        <input
          id={`${id}u`}
          className="input"
          list={`${id}l`}
          placeholder="พิมพ์เพื่อค้นชื่อมหาวิทยาลัย"
          value={name}
          maxLength={100}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <datalist id={`${id}l`}>
        {universities.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <button className="btn-primary" disabled={name.trim().length < 2}>
        ใช้มหาวิทยาลัยนี้
      </button>
    </form>
  );
}

function Questions({ university, compact }: { university: string; compact: boolean }) {
  const id = useId();
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [privateDocs, setPrivateDocs] = useState<PrivateDoc[]>([]);
  const [adding, setAdding] = useState(false);

  const load = useCallback(
    () =>
      fetch(`/api/regulations?university=${encodeURIComponent(university)}`)
        .then((r) => r.json())
        .then((b: { docs?: Doc[] }) => setDocs(b.docs ?? []))
        .catch(() => setDocs([])),
    [university],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const none = docs !== null && docs.length === 0 && privateDocs.length === 0;

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
        body: JSON.stringify({ question: text, university, privateDocs }),
      });
      const body = await res.json();
      const turn: Turn = !res.ok
        ? { question: text, error: body.error ?? "เกิดข้อผิดพลาด" }
        : body.status === "no_docs"
          ? { question: text, error: "ยังไม่มีเอกสารระเบียบของมหาวิทยาลัยนี้ เพิ่มเอกสารด้านบนก่อน แล้วถามอีกครั้ง" }
          : { question: text, answer: body as Answer };
      if (body.status === "no_docs") setAdding(true);
      setTurns((t) => [turn, ...t.slice(1)]);
    } catch {
      setTurns((t) => [{ question: text, error: "เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง" }, ...t.slice(1)]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="flex flex-col gap-2 text-sm" aria-label="เอกสารที่ใช้ตอบ">
        <div className="flex flex-wrap items-center gap-2">
          {docs === null ? (
            <span className="text-muted">กำลังดูเอกสาร…</span>
          ) : docs.length > 0 ? (
            <details className="min-w-0 flex-1">
              <summary className="cursor-pointer text-muted">
                ตอบจากเอกสาร <strong className="text-ink">{docs.length}</strong> ฉบับของมหาวิทยาลัยนี้
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                {docs.map((d) => (
                  <li key={d.id}>
                    {d.sourceUrl ? (
                      <a className="link" href={d.sourceUrl} target="_blank" rel="noreferrer">
                        {d.title}
                      </a>
                    ) : (
                      d.title
                    )}
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            <span className="min-w-0 flex-1 text-muted">ยังไม่มีเอกสารระเบียบของมหาวิทยาลัยนี้ในระบบ</span>
          )}
          {!adding && !none && (
            <button type="button" className="btn" onClick={() => setAdding(true)}>
              + เพิ่มเอกสารระเบียบ
            </button>
          )}
        </div>
        {privateDocs.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="เอกสารเฉพาะคุณ">
            {privateDocs.map((d, i) => (
              <li key={i} className="chip inline-flex items-center gap-1">
                <span className="max-w-60 truncate">{d.title}</span>
                <span className="text-muted">· เฉพาะคุณ</span>
                <button
                  type="button"
                  className="grid size-5 place-items-center rounded-full hover:bg-canvas"
                  aria-label={`เอา ${d.title} ออก`}
                  onClick={() => setPrivateDocs((p) => p.filter((_, j) => j !== i))}
                >
                  <XIcon className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(adding || none) && (
        <RegulationAdder
          university={university}
          onClose={none ? undefined : () => setAdding(false)}
          onPrivate={(d) => {
            setPrivateDocs((p) => [...p.slice(-2), d]);
            setAdding(false);
          }}
          onShared={() => {
            void load();
            setAdding(false);
          }}
        />
      )}

      <form
        className="card flex flex-col gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
      >
        <label htmlFor={`${id}q`} className="sr-only">
          คำถาม
        </label>
        <textarea
          id={`${id}q`}
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
          <button className="btn-primary ml-auto" disabled={busy || q.trim().length < 3}>
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
              <p className="error-note mt-3 max-w-[65ch]" role="alert">
                {t.error}
              </p>
            )}
            {t.answer && <AnswerView a={t.answer} />}
          </li>
        ))}
      </ol>
    </>
  );
}

/**
 * Add a regulation document: links found on the university's own site, a pasted link (shared after the student
 * confirms what was read), or an upload / pasted text that stays with this student.
 */
function RegulationAdder({
  university,
  onClose,
  onPrivate,
  onShared,
}: {
  university: string;
  onClose?: () => void;
  onPrivate: (d: PrivateDoc) => void;
  onShared: () => void;
}) {
  const id = useId();
  const [finding, setFinding] = useState(false);
  const [links, setLinks] = useState<{ url: string; label: string }[] | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [reading, setReading] = useState(false);
  const [pending, setPending] = useState<{ id: string; preview: Preview } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const post = (path: string, payload: unknown) =>
    fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }).then(async (res) => ({
      ok: res.ok,
      body: await res.json().catch(() => ({})),
    }));

  async function find() {
    setFinding(true);
    setError(null);
    try {
      const { ok, body } = await post("/api/regulations/find", { university });
      if (!ok) return setError(body.error ?? "หาลิงก์ไม่สำเร็จ วางลิงก์เองด้านล่างได้");
      setLinks(body.links ?? []);
      setLinkUrl(body.links?.[0]?.url ?? "");
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setFinding(false);
    }
  }

  async function read(source: Record<string, unknown>) {
    setReading(true);
    setError(null);
    setPending(null);
    try {
      const { ok, body } = await post("/api/regulations/read", { university, source });
      if (!ok) return setError(body.error ?? "อ่านเอกสารไม่สำเร็จ ลองใหม่อีกครั้ง");
      if (body.existing) return onShared(); // already shared: the list refreshes with it
      if (body.pendingId) return setPending({ id: body.pendingId, preview: body.preview });
      if (body.doc) onPrivate(body.doc as PrivateDoc);
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setReading(false);
    }
  }

  async function confirm() {
    if (!pending) return;
    setReading(true);
    try {
      const { ok, body } = await post("/api/regulations/confirm", { id: pending.id });
      if (!ok) return setError(body.error ?? "ยืนยันไม่สำเร็จ ลองใหม่อีกครั้ง");
      setPending(null);
      onShared();
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setReading(false);
    }
  }

  return (
    <section className="card" aria-labelledby={`${id}h`}>
      <div className="bar">
        <h2 id={`${id}h`}>เพิ่มเอกสารระเบียบ</h2>
        {onClose && (
          <button type="button" className="btn-ghost size-9 p-0" aria-label="ปิด" onClick={onClose}>
            <XIcon />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-3 p-4 text-sm">
        <p className="text-xs text-muted">
          เอกสารจากลิงก์เว็บมหาวิทยาลัยจะเก็บไว้กลางพร้อมลิงก์ต้นทาง ให้เพื่อนมหาวิทยาลัยเดียวกันถามต่อได้{" "}
          ส่วนไฟล์ที่อัปโหลดหรือข้อความที่วางใช้เฉพาะคุณ และหายไปเมื่อปิดหน้านี้
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn" disabled={finding || reading} aria-busy={finding} onClick={find}>
            {finding ? "กำลังค้นหา…" : "ค้นหาลิงก์อัตโนมัติ"}
          </button>
          <span className="text-xs text-muted">หาจากเว็บสำนักทะเบียนของ{university}</span>
        </div>
        {links && links.length === 0 && <p className="text-muted">ไม่พบลิงก์ วางลิงก์ อัปโหลด PDF หรือวางข้อความด้านล่างแทน</p>}
        {links && links.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">ลิงก์ที่พบ</legend>
            {links.map((l) => (
              <Radio key={l.url} name={`${id}link`} checked={linkUrl === l.url} onChange={() => setLinkUrl(l.url)}>
                <span className="font-medium">{l.label || l.url}</span>
                <span className="block truncate text-xs text-muted">{l.url}</span>
              </Radio>
            ))}
            <div>
              <button type="button" className="btn-primary" disabled={!linkUrl || reading} onClick={() => read({ url: linkUrl })}>
                อ่านจากลิงก์นี้
              </button>
            </div>
          </fieldset>
        )}
        <SourceInput
          disabled={reading}
          onRead={read}
          onError={setError}
          urlLabel="ลิงก์เอกสารระเบียบ (เว็บมหาวิทยาลัย)"
          textLabel="ข้อความจากระเบียบหรือประกาศ"
          button="อ่านเอกสาร"
        />
        {reading && <p className="text-muted">กำลังอ่านเอกสาร…</p>}
        {error && (
          <p className="error-note" role="alert">
            {error}
          </p>
        )}
        {pending && (
          <div className="rounded-xs border border-line p-3" aria-live="polite">
            <p className="font-semibold">{pending.preview.title}</p>
            <p className="text-xs text-muted">
              อ่านได้ {pending.preview.pageCount} หน้า · {pending.preview.sample}…
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="btn-primary" disabled={reading} onClick={confirm}>
                ใช้เอกสารนี้ และแชร์ให้เพื่อนมหาวิทยาลัยเดียวกัน
              </button>
              <button type="button" className="btn-ghost" onClick={() => setPending(null)}>
                ไม่ใช่เอกสารนี้
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function AnswerView({ a }: { a: Answer }) {
  return (
    <div className="anim-rise mt-3 flex max-w-[65ch] flex-col gap-3 text-sm">
      {a.status === "not_found" ? (
        <div className="rounded-xs border border-line bg-canvas p-4 text-base leading-[1.65]">
          <p>
            <strong>ไม่พบ</strong> ในเอกสารที่ใช้ตอบ
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-muted">
            <li className="flex items-start gap-2">
              <ArrowRightIcon className="mt-1 size-3.5 shrink-0 text-accent" />
              <span>ลองถามด้วยคำอื่น หรือระบุภาคการศึกษาที่ต้องการ</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRightIcon className="mt-1 size-3.5 shrink-0 text-accent" />
              <span>เพิ่มเอกสารระเบียบที่เกี่ยวข้อง หรือสอบถามสำนักทะเบียน / คณะโดยตรงเพื่อคำตอบที่เป็นทางการ</span>
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
              <details className="group overflow-hidden rounded-xs border border-line bg-white open:border-accent/40">
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
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noreferrer" className="link mt-2 inline-block text-xs font-semibold">
                      เปิดหน้าเอกสารต้นฉบับ
                    </a>
                  ) : (
                    <p className="mt-2 text-xs text-muted">จากเอกสารที่คุณเพิ่มเอง</p>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      <p className="rounded-xs bg-accent-soft px-3 py-2 text-xs leading-[1.6] text-ink">
        <strong>{a.notice}</strong> ข้อความที่แปลงจากเอกสารอาจมีตัวเลขหรือคำผิด ดูหน้าเอกสารต้นฉบับจากลิงก์ด้านบน
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
