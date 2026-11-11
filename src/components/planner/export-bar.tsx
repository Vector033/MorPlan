"use client";

import { useState, type RefObject } from "react";
import { buildIcs } from "@/lib/core/ics";
import { termInfo } from "@/lib/terms";
import { useWorkspace } from "./workspace-context";

export function ExportBar({ calendarRef }: { calendarRef: RefObject<HTMLDivElement | null> }) {
  const { ws, plan, placed } = useWorkspace();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const disabled = placed.length === 0;
  const base = `morplan-${ws.term.replace("/", "-")}-${plan.id}`;

  function downloadIcs() {
    const ics = buildIcs(placed, termInfo(ws.term), { planName: plan.name });
    download(new Blob([ics], { type: "text/calendar;charset=utf-8" }), `${base}.ics`);
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
      <button className="btn" disabled={disabled} onClick={downloadIcs} title="นำเข้า Google Calendar / Apple Calendar">
        .ics
      </button>
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
        <p className="w-full text-xs text-danger sm:w-auto" role="alert">
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
