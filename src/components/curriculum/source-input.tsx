"use client";

import { useId, useState } from "react";
import { MAX_PDF, toBase64 } from "./shared";

export type SourceTab = "url" | "pdf" | "text";
const TAB_LABEL: Record<SourceTab, string> = { url: "วางลิงก์", pdf: "อัปโหลด PDF", text: "วางข้อความ" };

type Props = {
  /** Called with `{ url }`, `{ text }` or `{ pdfBase64, name }`. */
  onRead: (source: Record<string, unknown>) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  tabs?: SourceTab[];
  urlLabel?: string;
  textLabel?: string;
  button?: string;
};

/** The three ways to hand over a document, shared by the curriculum, electives and minors flows. */
export function SourceInput({ onRead, onError, disabled, tabs = ["url", "pdf", "text"], urlLabel = "ลิงก์หลักสูตร", textLabel = "ข้อความจากเอกสารหลักสูตร", button = "อ่านหลักสูตร" }: Props) {
  const id = useId();
  const [tab, setTab] = useState<SourceTab>(tabs[0]);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File>();
  const hint = "ไฟล์ที่อัปโหลดใช้เฉพาะกับคุณ ไม่แชร์ให้คนอื่น";
  const ready = tab === "url" ? url.trim() !== "" : tab === "pdf" ? !!file : text.trim() !== "";

  async function submit() {
    if (tab === "url") return onRead({ url: url.trim() });
    if (tab === "text") return onRead({ text });
    if (!file) return;
    if (file.size > MAX_PDF) return onError("ไฟล์ใหญ่เกิน 3 MB ลองตัดเฉพาะหน้าที่ต้องใช้ หรือวางข้อความแทน");
    try {
      onRead({ pdfBase64: await toBase64(file), name: file.name });
    } catch {
      onError("เปิดไฟล์นี้ไม่ได้ ลองไฟล์อื่น");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">วิธีใส่เอกสาร</legend>
        {tabs.map((v) => (
          <label
            key={v}
            className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium has-focus-visible:outline-2 has-focus-visible:outline-accent ${tab === v ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink/25"}`}
          >
            <input type="radio" name={`${id}tab`} className="sr-only" checked={tab === v} onChange={() => setTab(v)} />
            {TAB_LABEL[v]}
          </label>
        ))}
      </fieldset>
      {tab === "url" && (
        <div>
          <label className="label" htmlFor={`${id}url`}>
            {urlLabel}
          </label>
          <input id={`${id}url`} className="input" type="url" inputMode="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
          <p className="mt-1 text-xs text-muted">ต้องเป็นเว็บของมหาวิทยาลัย (.ac.th หรือ .edu)</p>
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
            {textLabel}
          </label>
          <textarea id={`${id}txt`} className="input min-h-32 text-xs" value={text} onChange={(e) => setText(e.target.value)} />
          <p className="mt-1 text-xs text-muted">{hint}</p>
        </div>
      )}
      <div>
        <button type="button" className="btn-primary" disabled={!ready || disabled} onClick={submit}>
          {button}
        </button>
      </div>
    </div>
  );
}
