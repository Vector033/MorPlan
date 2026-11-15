"use client";

import { useRef, useState } from "react";
import type { ElectiveCourse, Minor, Source } from "@/lib/core/curriculum";
import { DISCLAIMER } from "./format";
import { call, Skeleton, SourceLine } from "./shared";
import { SourceInput, type SourceTab } from "./source-input";

type Scope = { university: string; faculty: string; major: string; cohort: number };
type Props =
  | ({ kind: "electives"; parentId?: string; onAccept: (data: ElectiveCourse[], source: Source, shared: boolean) => void } & Common)
  | ({ kind: "minors"; onAccept: (data: Minor[], source: Source, shared: boolean) => void } & Common);
type Common = { scope: Scope; onClose: () => void };
type Pending = { data: ElectiveCourse[] | Minor[]; dropped: string[]; title: string; url?: string; pendingId?: string };

/** "เพิ่มเอกสาร": read a document of electives or minors, show what was found, and only then keep it. A link also gets shared after the student confirms. */
export function DocumentAdd(props: Props) {
  const { kind, scope, onClose } = props;
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const ticket = useRef(0);
  const tabs: SourceTab[] = kind === "electives" && !props.parentId ? ["pdf", "text"] : ["url", "pdf", "text"]; // a private curriculum has no shared parent for a link's list
  const parentId = kind === "electives" ? props.parentId : undefined;

  async function read(source: Record<string, unknown>) {
    const id = ++ticket.current;
    setReading(true);
    setErr(null);
    setPending(null);
    const { ok, body } = await call("/api/curriculum/read", { kind, ...scope, ...(parentId && "url" in source ? { parentId } : {}), source });
    if (id !== ticket.current) return;
    setReading(false);
    if (!ok) return setErr(body.error ?? "อ่านเอกสารไม่สำเร็จ ลองใหม่อีกครั้ง");
    const p = body.preview as { data: ElectiveCourse[] | Minor[]; dropped: string[] };
    setPending({ data: p.data, dropped: p.dropped, title: String(body.sourceTitle ?? ""), url: "url" in source ? String(source.url) : undefined, pendingId: body.pendingId as string | undefined });
  }

  const sourceOf = (p: Pending): Source => ({ url: p.url, title: p.title, readAt: new Date().toISOString().slice(0, 10), provenance: p.pendingId ? "link" : "private" });

  async function keep() {
    if (!pending || saving) return;
    setSaving(true);
    setErr(null);
    if (pending.pendingId) {
      const c = await call("/api/curriculum/confirm", { id: pending.pendingId });
      if (!c.ok) {
        setSaving(false);
        return setErr(c.body.error ?? "ยืนยันไม่สำเร็จ ลองใหม่อีกครั้ง");
      }
    }
    const source = sourceOf(pending);
    if (kind === "electives") props.onAccept(pending.data as ElectiveCourse[], source, !!pending.pendingId);
    else props.onAccept(pending.data as Minor[], source, !!pending.pendingId);
    onClose();
  }

  const count = pending && (kind === "electives" ? `${pending.data.length} วิชา` : `${pending.data.length} วิชาโท`);
  return (
    <div className="flex flex-col gap-3 rounded-xs border border-line bg-canvas p-3">
      <SourceInput
        tabs={tabs}
        disabled={reading || saving}
        onRead={read}
        onError={setErr}
        urlLabel="ลิงก์เอกสาร"
        textLabel="ข้อความจากเอกสาร"
        button="อ่านเอกสาร"
      />
      {reading && <Skeleton text="กำลังอ่านเอกสาร… ใช้เวลาไม่เกินหนึ่งนาที" />}
      {err && (
        <p role="alert" className="error-note">
          {err}
        </p>
      )}
      {pending && !reading && (
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-semibold">เจอ {count}</p>
          <p className="text-xs text-muted">
            <SourceLine source={sourceOf(pending)} />
          </p>
          <ul className="max-h-48 overflow-auto rounded-xs border border-line bg-white p-2 text-xs">
            {kind === "electives"
              ? (pending.data as ElectiveCourse[]).map((c) => (
                  <li key={c.courseNo}>
                    <span className="font-mono font-semibold">{c.courseNo}</span> {c.title}
                  </li>
                ))
              : (pending.data as Minor[]).map((m) => <li key={m.name}>{m.name}</li>)}
          </ul>
          {pending.dropped.length > 0 && <p className="text-muted">ตัดออก {pending.dropped.length} รายการที่ไม่พบในเอกสาร</p>}
          <p className="text-xs text-muted">{DISCLAIMER}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={saving || pending.data.length === 0} onClick={keep}>
              ใช้รายการนี้
            </button>
            <button type="button" className="btn-ghost" onClick={() => setPending(null)}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}
      <div>
        <button type="button" className="btn-ghost" onClick={() => { ticket.current++; onClose(); }}>
          ปิด
        </button>
      </div>
    </div>
  );
}
