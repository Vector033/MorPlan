"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useWorkspace } from "@/components/planner/workspace-context";
import { covers, type Curriculum, type Source } from "@/lib/core/curriculum";
import { isCmu } from "@/lib/core/university";
import { CURRENT_TERM } from "@/lib/terms";
import type { Meta } from "@/lib/curriculum/rows";
import universities from "../../../data/universities-th.json";
import { ConfirmPreview } from "./confirm-preview";
import { DISCLAIMER, rangeLabel, thaiDate } from "./format";
import { useReveal } from "./use-reveal";

const MAX_PDF = 3_000_000;
const CMU = "มหาวิทยาลัยเชียงใหม่";
const THIS_YEAR = Number(CURRENT_TERM.split("/")[1]);
const YEARS = Array.from({ length: 10 }, (_, i) => THIS_YEAR - i);

type Link = { url: string; label: string };
type Preview = { cohort: number; readAt: string; data: Curriculum; dropped: string[]; sourceTitle: string; sourceUrl?: string; pendingId?: string };
type Picked = { cohort: number; data: Curriculum; source: Source; ref?: string };
type Tab = "url" | "pdf" | "text";
type Body = Record<string, unknown> & { error?: string };

async function call(path: string, post?: unknown): Promise<{ ok: boolean; body: Body }> {
  try {
    const res = await fetch(
      path,
      post === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(post) },
    );
    return { ok: res.ok, body: (await res.json().catch(() => ({}))) as Body };
  } catch {
    return { ok: false, body: { error: "เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง" } };
  }
}

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

const sharedSource = (m: Meta): Source => ({ url: m.sourceUrl, title: m.sourceTitle, readAt: m.readAt, provenance: m.provenance });

function Skeleton({ text }: { text: string }) {
  return (
    <div className="card flex flex-col gap-3 p-4" aria-busy="true">
      <p className="text-sm">{text}</p>
      <div className="h-4 w-2/3 animate-pulse rounded-xs bg-canvas" />
      <div className="h-4 w-1/2 animate-pulse rounded-xs bg-canvas" />
    </div>
  );
}

function Radio({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xs border p-3 text-sm has-focus-visible:outline-2 has-focus-visible:outline-accent ${checked ? "border-accent bg-accent-soft" : "border-line bg-white"}`}
    >
      <input type="radio" name={name} className="mt-1.5 accent-accent" checked={checked} onChange={onChange} />
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}

/** Suggestions are best effort: free typing always works, so a failed lookup just leaves the list empty. */
function useOptions(url: string | null): string[] {
  const [got, setGot] = useState<{ url: string; list: string[] }>({ url: "", list: [] });
  useEffect(() => {
    if (!url) return;
    const ac = new AbortController();
    fetch(url, { signal: ac.signal })
      .then((r) => r.json())
      .then((b: { options?: string[] }) => setGot({ url, list: b.options ?? [] }))
      .catch(() => {});
    return () => ac.abort();
  }, [url]);
  return url && got.url === url ? got.list : [];
}

export function SetupForm({ onDone }: { onDone: () => void }) {
  const { ws, dispatch } = useWorkspace();
  const id = useId();
  const [university, setUniversity] = useState(isCmu(ws.university) ? CMU : (ws.university ?? ""));
  const [faculty, setFaculty] = useState("");
  const [major, setMajor] = useState("");
  const [cohort, setCohort] = useState("");

  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [candidates, setCandidates] = useState<Meta[]>([]);
  const [chosenId, setChosenId] = useState("");
  const [finding, setFinding] = useState(false);
  const [links, setLinks] = useState<Link[] | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [tab, setTab] = useState<Tab>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File>();
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [planId, setPlanId] = useState("");
  const [busy, setBusy] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [findErr, setFindErr] = useState<string | null>(null);
  const [readErr, setReadErr] = useState<string | null>(null);
  const [confirmErr, setConfirmErr] = useState<string | null>(null);
  // Every request takes a ticket; a response whose ticket is no longer the latest belongs to old input and is dropped.
  const ticket = useRef(0);
  const locked = useRef(false);

  const cohortNo = Number(cohort);
  const complete = university.trim().length >= 2 && faculty.trim() !== "" && major.trim() !== "" && cohort !== "";

  const u = university.trim();
  const faculties = useOptions(u.length < 2 ? null : `/api/curriculum/options?university=${encodeURIComponent(u)}`);
  const majors = useOptions(u.length < 2 || !faculty.trim() ? null : `/api/curriculum/options?university=${encodeURIComponent(u)}&faculty=${encodeURIComponent(faculty.trim())}`);

  const scope = () => ({ university: university.trim(), faculty: faculty.trim(), major: major.trim() });

  const candRef = useReveal<HTMLHeadingElement>(searched && candidates.length > 0);
  const linksRef = useReveal<HTMLHeadingElement>(!!links && !finding);
  const planRef = useReveal<HTMLHeadingElement>(!!picked);
  const status = searching ? "กำลังค้นหาหลักสูตร…" : finding ? "กำลังหาหน้าหลักสูตรจากเว็บคณะ…" : reading ? "กำลังอ่านหลักสูตร… ใช้เวลาไม่เกินหนึ่งนาที" : "";

  /** Invalidates every request in flight and clears their loading flags. */
  function begin(): number {
    locked.current = false;
    setSearching(false);
    setFinding(false);
    setReading(false);
    setBusy(false);
    return ++ticket.current;
  }

  function reset() {
    begin();
    setSearched(false);
    setCandidates([]);
    setLinks(null);
    setPreview(null);
    setPicked(null);
    setSearchErr(null);
    setLoadErr(null);
    setFindErr(null);
    setReadErr(null);
    setConfirmErr(null);
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    reset();
    const id = ticket.current;
    const cohortAtStart = cohortNo;
    setSearching(true);
    const s = scope();
    const { ok, body } = await call(
      `/api/curriculum?university=${encodeURIComponent(s.university)}&faculty=${encodeURIComponent(s.faculty)}&major=${encodeURIComponent(s.major)}`,
    );
    if (id !== ticket.current) return;
    setSearching(false);
    if (!ok) return setSearchErr(body.error ?? "ค้นหาไม่สำเร็จ ลองใหม่อีกครั้ง");
    const found = (body.candidates as Meta[] | undefined) ?? [];
    setCandidates(found);
    const best = found.find((c) => covers({ cohortFrom: c.cohortFrom ?? 0, cohortTo: c.cohortTo }, cohortAtStart)) ?? found[0];
    setChosenId(best?.id ?? "");
    setSearched(true);
    if (!found.length) void find();
  }

  async function find() {
    const id = begin();
    setFinding(true);
    setLinks(null);
    setFindErr(null);
    const { ok, body } = await call("/api/curriculum/find", scope());
    if (id !== ticket.current) return;
    setFinding(false);
    if (!ok) return setFindErr(body.error ?? "หาลิงก์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    const found = (body.links as Link[] | undefined) ?? [];
    setLinks(found);
    setLinkUrl(found[0]?.url ?? "");
  }

  function finish(p: Picked, plan: string) {
    dispatch({ type: "setCurriculum", curriculum: { ref: p.ref, data: p.data, source: p.source, cohort: p.cohort, planId: plan, passed: [], doneSlots: [] } });
    onDone();
  }
  function pick(p: Picked) {
    if (p.data.plans.length > 1) {
      setPicked(p);
      setPlanId(p.data.plans[0].id);
    } else finish(p, p.data.plans[0].id);
  }

  async function loadShared(sharedId: string) {
    if (locked.current) return;
    const id = begin();
    locked.current = true;
    const cohortAtStart = cohortNo;
    setBusy(true);
    setLoadErr(null);
    const { ok, body } = await call(`/api/curriculum/${sharedId}`);
    if (id !== ticket.current) return;
    setBusy(false);
    if (!ok) {
      locked.current = false;
      return setLoadErr(body.error ?? "เปิดหลักสูตรนี้ไม่ได้ ลองใหม่อีกครั้ง");
    }
    const m = body.meta as Meta;
    pick({ cohort: cohortAtStart, data: body.curriculum as Curriculum, ref: m.id, source: sharedSource(m) });
  }

  async function read(source: Record<string, unknown>) {
    const id = begin();
    const cohortAtStart = cohortNo;
    setReading(true);
    setReadErr(null);
    setConfirmErr(null);
    setPreview(null);
    const { ok, body } = await call("/api/curriculum/read", { kind: "curriculum", ...scope(), cohort: cohortAtStart, source });
    if (id !== ticket.current) return;
    setReading(false);
    if (!ok) return setReadErr(body.error ?? "อ่านหลักสูตรไม่สำเร็จ ลองใหม่อีกครั้ง");
    const p = body.preview as { data: Curriculum; dropped: string[] };
    setPreview({
      cohort: cohortAtStart,
      readAt: new Date().toISOString().slice(0, 10),
      data: p.data,
      dropped: p.dropped,
      sourceTitle: String(body.sourceTitle ?? ""),
      sourceUrl: "url" in source ? String(source.url) : undefined,
      pendingId: body.pendingId as string | undefined,
    });
  }

  async function readTab() {
    if (tab === "url") return read({ url: url.trim() });
    if (tab === "text") return read({ text });
    if (!file) return;
    if (file.size > MAX_PDF) return setReadErr("ไฟล์ใหญ่เกิน 3 MB ลองตัดเฉพาะหน้าแผนการศึกษา หรือวางข้อความแทน");
    try {
      await read({ pdfBase64: await toBase64(file), name: file.name });
    } catch {
      setReadErr("เปิดไฟล์นี้ไม่ได้ ลองไฟล์อื่น");
    }
  }

  async function confirmPreview(from: number, to?: number) {
    if (!preview || locked.current) return;
    const id = begin();
    locked.current = true; // stays set after success so a second click can never dispatch twice
    setConfirmErr(null);
    if (preview.pendingId) {
      setBusy(true);
      const fail = (msg: string) => {
        locked.current = false;
        setBusy(false);
        setConfirmErr(msg);
      };
      const c = await call("/api/curriculum/confirm", { id: preview.pendingId, cohortFrom: from, cohortTo: to });
      if (id !== ticket.current) return;
      if (!c.ok) return fail(c.body.error ?? "ยืนยันไม่สำเร็จ ลองใหม่อีกครั้ง");
      const g = await call(`/api/curriculum/${preview.pendingId}`);
      if (id !== ticket.current) return;
      if (!g.ok) return fail(g.body.error ?? "เปิดหลักสูตรนี้ไม่ได้ ลองใหม่อีกครั้ง");
      setBusy(false);
      const m = g.body.meta as Meta;
      return pick({ cohort: preview.cohort, data: g.body.curriculum as Curriculum, ref: m.id, source: sharedSource(m) });
    }
    pick({
      cohort: preview.cohort,
      data: { ...preview.data, cohortFrom: from, cohortTo: to },
      source: { url: preview.sourceUrl, title: preview.sourceTitle, readAt: preview.readAt, provenance: "private" },
    });
  }

  const hint = "ไฟล์ที่อัปโหลดใช้เฉพาะกับคุณ ไม่แชร์ให้คนอื่น";
  const tabs: [Tab, string][] = [
    ["url", "วางลิงก์"],
    ["pdf", "อัปโหลด PDF"],
    ["text", "วางข้อความ"],
  ];
  const tabReady = tab === "url" ? url.trim() !== "" : tab === "pdf" ? !!file : text.trim() !== "";

  if (picked)
    return (
      <form
        className="card anim-rise"
        aria-labelledby="plan-h"
        onSubmit={(e) => {
          e.preventDefault();
          finish(picked, planId);
        }}
      >
        <div className="bar">
          <h2 id="plan-h" ref={planRef} tabIndex={-1}>แผนการเรียน</h2>
        </div>
        <fieldset className="flex flex-col gap-2 p-4">
          <legend className="sr-only">แผนการเรียน</legend>
          {picked.data.plans.map((p) => (
            <Radio key={p.id} name="plan" checked={planId === p.id} onChange={() => setPlanId(p.id)}>
              <span className="font-medium">{p.name}</span>
            </Radio>
          ))}
          <div className="pt-2">
            <button type="submit" className="btn-primary">
              ยืนยันแผนการเรียน
            </button>
          </div>
        </fieldset>
      </form>
    );

  const field = (set: (v: string) => void) => (e: { target: { value: string } }) => {
    set(e.target.value);
    reset();
  };

  return (
    <>
      <form className="card" aria-labelledby="setup-h" onSubmit={search}>
        <div className="bar">
          <h2 id="setup-h">บอกเราว่าเรียนอะไร</h2>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor={`${id}u`}>
              มหาวิทยาลัย
            </label>
            <input id={`${id}u`} className="input" list={`${id}ul`} value={university} onChange={field(setUniversity)} autoComplete="off" required />
            <datalist id={`${id}ul`}>
              {universities.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor={`${id}f`}>
              คณะ
            </label>
            <input id={`${id}f`} className="input" list={`${id}fl`} placeholder="เช่น วิทยาศาสตร์" value={faculty} onChange={field(setFaculty)} autoComplete="off" required />
            <datalist id={`${id}fl`}>
              {faculties.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor={`${id}m`}>
              สาขา
            </label>
            <input id={`${id}m`} className="input" list={`${id}ml`} placeholder="เช่น วิทยาการคอมพิวเตอร์" value={major} onChange={field(setMajor)} autoComplete="off" required />
            <datalist id={`${id}ml`}>
              {majors.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor={`${id}c`}>
              รหัสปีที่เข้า
            </label>
            <select id={`${id}c`} className="input" value={cohort} onChange={field(setCohort)} required>
              <option value="" disabled>
                เลือก
              </option>
              {YEARS.map((y) => (
                <option key={y} value={y - 2500}>
                  {y - 2500} (เข้าปี {y})
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={!complete || searching} aria-busy={searching}>
              {searching ? "กำลังค้นหา…" : "ค้นหาหลักสูตร"}
            </button>
          </div>
        </div>
      </form>

      <p aria-live="polite" className="sr-only">
        {status}
      </p>
      {searchErr && (
        <p role="alert" className="error-note">
          {searchErr}
        </p>
      )}

      {searched && candidates.length > 0 && (
        <section className="card anim-rise" aria-labelledby="cand-h">
          <div className="bar">
            <h2 id="cand-h" ref={candRef} tabIndex={-1}>เจอ {candidates.length} ฉบับ เลือกอันที่ตรง</h2>
          </div>
          <fieldset className="flex flex-col gap-2 p-4">
            <legend className="sr-only">หลักสูตรที่พบ</legend>
            {candidates.map((c) => (
              <Radio key={c.id} name="cand" checked={chosenId === c.id} onChange={() => setChosenId(c.id)}>
                <span className="font-medium">{c.title}</span> <span className="tabular-nums">{rangeLabel(c)}</span>
                <span className="block text-xs text-muted">
                  {c.sourceUrl ? (
                    <a className="link" href={c.sourceUrl} target="_blank" rel="noreferrer">
                      {c.sourceTitle}
                    </a>
                  ) : (
                    c.sourceTitle
                  )}{" "}
                  · อ่านเมื่อ {thaiDate(c.readAt)}
                </span>
              </Radio>
            ))}
            <p className="text-xs text-muted">{DISCLAIMER}</p>
            {loadErr && (
              <p role="alert" className="error-note">
                {loadErr}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button type="button" className="btn-primary" disabled={!chosenId || busy || finding || reading} onClick={() => loadShared(chosenId)}>
                ใช้หลักสูตรนี้
              </button>
              <button type="button" className="btn-ghost" disabled={busy || finding || reading} onClick={find}>
                ไม่ใช่ฉบับนี้ เพิ่มจากลิงก์อื่น
              </button>
            </div>
          </fieldset>
        </section>
      )}

      {finding && <Skeleton text="กำลังหาหน้าหลักสูตรจากเว็บคณะ…" />}
      {findErr && !finding && (
        <p role="alert" className="error-note">
          {findErr}
        </p>
      )}
      {links && !finding && (
        <section className="card anim-rise" aria-labelledby="links-h">
          <div className="bar">
            <h2 id="links-h" ref={linksRef} tabIndex={-1}>{links.length ? `เจอ ${links.length} ลิงก์ที่อาจใช่ เลือกอันที่ตรง` : "ยังไม่เจอหน้าหลักสูตร"}</h2>
          </div>
          <div className="flex flex-col gap-2 p-4">
            {links.length === 0 && <p className="text-sm text-muted">ลองวางลิงก์ อัปโหลด PDF หรือวางข้อความจากด้านล่างแทน</p>}
            {links.length > 0 && (
              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">ลิงก์ที่พบ</legend>
                {links.map((l) => (
                  <Radio key={l.url} name="link" checked={linkUrl === l.url} onChange={() => setLinkUrl(l.url)}>
                    <span className="font-medium">{l.label}</span>
                    <span className="block text-xs text-muted">{hostOf(l.url)}</span>
                  </Radio>
                ))}
                <div className="pt-2">
                  <button type="button" className="btn-primary" disabled={!linkUrl || reading || busy} onClick={() => read({ url: linkUrl })}>
                    อ่านหลักสูตรจากลิงก์นี้
                  </button>
                </div>
              </fieldset>
            )}
          </div>
        </section>
      )}

      {searched && (
        <section className="card" aria-labelledby="src-h">
          <div className="bar">
            <h2 id="src-h">มีเอกสารหลักสูตรอยู่แล้ว</h2>
          </div>
          <div className="flex flex-col gap-3 p-4">
            <fieldset className="flex flex-wrap gap-2">
              <legend className="sr-only">วิธีใส่เอกสาร</legend>
              {tabs.map(([v, label]) => (
                <label
                  key={v}
                  className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium has-focus-visible:outline-2 has-focus-visible:outline-accent ${tab === v ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink/25"}`}
                >
                  <input type="radio" name="src-tab" className="sr-only" checked={tab === v} onChange={() => setTab(v)} />
                  {label}
                </label>
              ))}
            </fieldset>
            {tab === "url" && (
              <div>
                <label className="label" htmlFor={`${id}url`}>
                  ลิงก์หลักสูตร
                </label>
                <input id={`${id}url`} className="input" type="url" inputMode="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
                <p className="mt-1 text-xs text-muted">ต้องเป็นเว็บของมหาวิทยาลัย (.ac.th)</p>
              </div>
            )}
            {tab === "pdf" && (
              <div>
                <label className="label" htmlFor={`${id}pdf`}>
                  ไฟล์ PDF (ไม่เกิน 3 MB)
                </label>
                <input id={`${id}pdf`} className="input" type="file" accept=".pdf,application/pdf" onChange={(e) => setFile(e.target.files?.[0])} />
                <p className="mt-1 text-xs text-muted">{hint}</p>
              </div>
            )}
            {tab === "text" && (
              <div>
                <label className="label" htmlFor={`${id}txt`}>
                  ข้อความจากเอกสารหลักสูตร
                </label>
                <textarea id={`${id}txt`} className="input min-h-32 text-xs" value={text} onChange={(e) => setText(e.target.value)} />
                <p className="mt-1 text-xs text-muted">{hint}</p>
              </div>
            )}
            <div>
              <button type="button" className="btn-primary" disabled={!tabReady || reading} onClick={readTab}>
                อ่านหลักสูตร
              </button>
            </div>
          </div>
        </section>
      )}

      {readErr && !reading && (
        <p role="alert" className="error-note">
          {readErr}
        </p>
      )}
      {reading && <Skeleton text="กำลังอ่านหลักสูตร… ใช้เวลาไม่เกินหนึ่งนาที" />}
      {preview && !reading && (
        <ConfirmPreview
          result={preview}
          sourceTitle={preview.sourceTitle}
          sourceUrl={preview.sourceUrl}
          cohort={preview.cohort}
          readAt={preview.readAt}
          busy={busy}
          onConfirm={confirmPreview}
          onCancel={() => setPreview(null)}
        />
      )}
      {confirmErr && preview && !reading && (
        <p role="alert" className="error-note">
          {confirmErr}
        </p>
      )}
    </>
  );
}
