import type { Source } from "@/lib/core/curriculum";
import type { Meta } from "@/lib/curriculum/rows";

export const MAX_PDF = 3_000_000;
export type Body = Record<string, unknown> & { error?: string };

export async function call(path: string, post?: unknown): Promise<{ ok: boolean; body: Body }> {
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

export const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

export const sharedSource = (m: Meta): Source => ({ url: m.sourceUrl, title: m.sourceTitle, readAt: m.readAt, provenance: m.provenance });

export function Skeleton({ text }: { text: string }) {
  return (
    <div className="card flex flex-col gap-3 p-4" aria-busy="true">
      <p className="text-sm">{text}</p>
      <div className="h-4 w-2/3 animate-pulse rounded-xs bg-canvas" />
      <div className="h-4 w-1/2 animate-pulse rounded-xs bg-canvas" />
    </div>
  );
}

export function Radio({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xs border p-3 text-sm has-focus-visible:outline-2 has-focus-visible:outline-accent ${checked ? "border-accent bg-accent-soft" : "border-line bg-white"}`}
    >
      <input type="radio" name={name} className="mt-1.5 accent-accent" checked={checked} onChange={onChange} />
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}
