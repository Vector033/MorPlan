"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { CheckIcon, XIcon } from "@/components/icons";
import { buildIcs } from "@/lib/core/ics";
import { playExportChime, useMicroSound } from "@/lib/sound";
import { termDefaults } from "@/lib/terms";
import { useWorkspace } from "./workspace-context";

type ExportKind = "share" | "ics" | "png";
type Celebration = { id: number; kind: ExportKind; message: string };

const SPARK_VECTORS: ReadonlyArray<{ sx: string; sy: string; fill: string; shape: "dot" | "diamond" | "star"; delay: string }> = [
  { sx: "-22px", sy: "-16px", fill: "var(--color-accent)", shape: "star", delay: "0ms" },
  { sx: "0px", sy: "-24px", fill: "var(--color-ok)", shape: "dot", delay: "30ms" },
  { sx: "22px", sy: "-15px", fill: "var(--color-accent)", shape: "diamond", delay: "15ms" },
  { sx: "-14px", sy: "-22px", fill: "var(--color-ink)", shape: "dot", delay: "45ms" },
  { sx: "14px", sy: "-21px", fill: "#3d6bf0", shape: "star", delay: "25ms" },
  { sx: "-26px", sy: "-4px", fill: "var(--color-ok)", shape: "diamond", delay: "40ms" },
  { sx: "26px", sy: "-5px", fill: "var(--color-ink)", shape: "dot", delay: "35ms" },
];

export function ExportBar({ calendarRef }: { calendarRef: RefObject<HTMLDivElement | null> }) {
  const { ws, plan, placed } = useWorkspace();
  const [soundOn] = useMicroSound();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const celebrationSeq = useRef(0);
  const disabled = placed.length === 0;
  const base = `morplan-${ws.term.replace("/", "-")}-${plan.id}`;
  const id = useId();
  const icsDialog = useRef<HTMLDialogElement>(null);
  const [range, setRange] = useState({ start: "", end: "" });
  const rangeOk = /^\d{4}-\d{2}-\d{2}$/.test(range.start) && /^\d{4}-\d{2}-\d{2}$/.test(range.end) && range.start <= range.end;

  useEffect(() => {
    if (!celebration) return;
    const t = setTimeout(() => setCelebration(null), 2800);
    return () => clearTimeout(t);
  }, [celebration]);

  function triggerCelebration(kind: ExportKind, message: string) {
    celebrationSeq.current += 1;
    setCelebration({ id: celebrationSeq.current, kind, message });
    if (soundOn) playExportChime();
  }

  /** Every university has its own first and last day of classes: confirm them before the download. */
  function openIcs() {
    const d = termDefaults(ws.term, ws.university);
    setRange({ start: d.start, end: d.end });
    icsDialog.current?.showModal();
  }

  function downloadIcs() {
    if (!rangeOk) return;
    const d = termDefaults(ws.term, ws.university);
    const term = { ...d, ...range, noClass: d.noClass.filter(([from, to]) => from >= range.start && to <= range.end) };
    const ics = buildIcs(placed, term, { planName: plan.name });
    download(new Blob([ics], { type: "text/calendar;charset=utf-8" }), `${base}.ics`);
    icsDialog.current?.close();
    triggerCelebration("ics", "ดาวน์โหลดปฏิทิน .ics แล้ว");
  }

  async function downloadPng() {
    if (!calendarRef.current) return;
    setBusy("png");
    setError(null);
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(calendarRef.current, { pixelRatio: 2, backgroundColor: "#ffffff" });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${base}.png`;
      a.click();
      triggerCelebration("png", "บันทึกรูปตารางเรียนแล้ว");
    } catch {
      setError("สร้างรูปไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    setBusy("share");
    setError(null);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ term: ws.term, name: plan.name, sections: placed }),
      });
      if (!res.ok) throw new Error();
      const { id } = (await res.json()) as { id: string };
      const url = `${location.origin}/s/${id}`;
      setShareUrl(url);
      await navigator.clipboard?.writeText(url).catch(() => {});
      triggerCelebration("share", "คัดลอกลิงก์แชร์แล้ว");
    } catch {
      setError("สร้างลิงก์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="relative inline-flex">
        <button className="btn-primary min-h-9 px-4 py-1.5" disabled={disabled || busy === "share"} onClick={share}>
          {busy === "share" ? "กำลังสร้าง…" : "แชร์ลิงก์"}
        </button>
        {celebration?.kind === "share" && <SparkleBurst key={celebration.id} />}
      </span>
      <span className="relative inline-flex">
        <button className="btn" disabled={disabled} onClick={openIcs} title="นำเข้า Google Calendar / Apple Calendar">
          .ics
        </button>
        {celebration?.kind === "ics" && <SparkleBurst key={celebration.id} />}
      </span>
      <dialog
        ref={icsDialog}
        aria-labelledby={`${id}h`}
        onClick={(e) => e.target === icsDialog.current && icsDialog.current?.close()}
        className="anim-modal m-auto w-[min(26rem,calc(100vw-1.5rem))] rounded-md border border-line bg-white p-0 text-ink shadow-lg backdrop:bg-ink/40"
      >
        <form
          className="flex flex-col gap-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            downloadIcs();
          }}
        >
          <h2 id={`${id}h`} className="text-heading font-semibold">
            ส่งออกปฏิทิน (.ics)
          </h2>
          <p className="text-sm text-muted">ตั้งวันเปิดเรียนวันแรกและวันเรียนวันสุดท้ายของภาค {ws.term} ให้ตรงกับปฏิทินของมหาวิทยาลัยคุณ</p>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="label">วันเรียนวันแรก</span>
              <input type="date" className="input" required value={range.start} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} />
            </label>
            <label>
              <span className="label">วันเรียนวันสุดท้าย</span>
              <input type="date" className="input" required value={range.end} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} />
            </label>
          </div>
          {!rangeOk && range.start && range.end && (
            <p className="error-note" role="alert">
              วันสุดท้ายต้องไม่ก่อนวันแรก
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={() => icsDialog.current?.close()}>
              ยกเลิก
            </button>
            <button className="btn-primary" disabled={!rangeOk}>
              ดาวน์โหลด .ics
            </button>
          </div>
        </form>
      </dialog>
      <span className="relative inline-flex">
        <button className="btn hidden md:inline-flex" disabled={disabled || busy === "png"} onClick={downloadPng}>
          รูปภาพ
        </button>
        {celebration?.kind === "png" && <SparkleBurst key={celebration.id} />}
      </span>
      {shareUrl && (
        <p className="anim-rise w-full text-xs text-muted sm:w-auto" role="status">
          คัดลอกลิงก์แล้ว:{" "}
          <a className="link" href={shareUrl} target="_blank" rel="noreferrer">
            {shareUrl}
          </a>
        </p>
      )}
      {error && (
        <p className="w-full text-xs font-semibold text-ink sm:w-auto" role="alert">
          {error}
        </p>
      )}
      {celebration && (
        <div
          aria-live="polite"
          className="anim-rise pointer-events-auto fixed bottom-36 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-ok/30 bg-white py-1.5 pr-2.5 pl-2 text-sm font-medium whitespace-nowrap text-ink shadow-lg md:bottom-6"
        >
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ok-soft text-ok">
            <CheckIcon className="size-3.5" />
          </span>
          <span>{celebration.message}</span>
          <button
            type="button"
            onClick={() => setCelebration(null)}
            className="btn-ghost size-6 p-0 text-muted"
            aria-label="ปิดการแจ้งเตือน"
          >
            <XIcon className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Restrained Swiss-geometric SVG burst anchored above the triggering export button. */
function SparkleBurst() {
  return (
    <svg
      viewBox="-36 -32 72 40"
      className="pointer-events-none absolute -top-5 left-1/2 z-20 h-10 w-18 -translate-x-1/2 overflow-visible"
      aria-hidden="true"
    >
      {SPARK_VECTORS.map((s, i) => (
        <g
          key={i}
          className="export-spark"
          style={{ ["--sx" as string]: s.sx, ["--sy" as string]: s.sy, animationDelay: s.delay }}
        >
          {s.shape === "dot" && <circle cx="0" cy="0" r="2.2" fill={s.fill} />}
          {s.shape === "diamond" && <rect x="-2" y="-2" width="4" height="4" transform="rotate(45)" fill={s.fill} />}
          {s.shape === "star" && <path d="M0 -3.5 L1 -1 L3.5 0 L1 1 L0 3.5 L-1 1 L-3.5 0 L-1 -1 Z" fill={s.fill} />}
        </g>
      ))}
    </svg>
  );
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
