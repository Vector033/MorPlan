"use client";

import { useId, useRef, useState, type RefObject } from "react";
import { buildIcs } from "@/lib/core/ics";
import { termDefaults } from "@/lib/terms";
import { useWorkspace } from "./workspace-context";

export function ExportBar({ calendarRef }: { calendarRef: RefObject<HTMLDivElement | null> }) {
  const { ws, plan, placed } = useWorkspace();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const disabled = placed.length === 0;
  const base = `morplan-${ws.term.replace("/", "-")}-${plan.id}`;
  const id = useId();
  const icsDialog = useRef<HTMLDialogElement>(null);
  const [range, setRange] = useState({ start: "", end: "" });
  const rangeOk = /^\d{4}-\d{2}-\d{2}$/.test(range.start) && /^\d{4}-\d{2}-\d{2}$/.test(range.end) && range.start <= range.end;

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
  }

  async function downloadPng() {
    if (!calendarRef.current) return;
    setBusy("png");
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(calendarRef.current, { pixelRatio: 2, backgroundColor: "#ffffff" });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${base}.png`;
      a.click();
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
    } catch {
      setError("สร้างลิงก์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button className="btn-primary min-h-9 px-4 py-1.5" disabled={disabled || busy === "share"} onClick={share}>
        {busy === "share" ? "กำลังสร้าง…" : "แชร์ลิงก์"}
      </button>
      <button className="btn" disabled={disabled} onClick={openIcs} title="นำเข้า Google Calendar / Apple Calendar">
        .ics
      </button>
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
      <button className="btn hidden md:inline-flex" disabled={disabled || busy === "png"} onClick={downloadPng}>
        รูปภาพ
      </button>
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
    </div>
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
