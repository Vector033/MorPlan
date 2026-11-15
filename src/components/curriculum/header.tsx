"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/components/planner/workspace-context";
import { studyPlanOf, type Curriculum } from "@/lib/core/curriculum";
import type { Meta } from "@/lib/curriculum/rows";
import { DISCLAIMER } from "./format";
import { call, sharedSource, SourceLine } from "./shared";

/** One line about the chosen curriculum: where it came from, how to change or re-read it. */
export function CurriculumHeader({ say }: { say: (s: string) => void }) {
  const { ws, dispatch } = useWorkspace();
  const c = ws.curriculum!;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const live = useRef(c.ref); // the curriculum chosen right now, for replies that arrive after a change
  useEffect(() => {
    live.current = c.ref;
  }, [c.ref]);
  const plan = studyPlanOf(c);
  const { source } = c;

  async function refresh() {
    if (!c.ref || busy) return;
    setBusy(true);
    setErr(null);
    const r = await call("/api/curriculum/refresh", { id: c.ref });
    if (live.current !== c.ref) return setBusy(false);
    if (!r.ok) {
      setBusy(false);
      return setErr(r.body.error ?? "อ่านใหม่ไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
    if (!r.body.replaced) {
      setBusy(false);
      return say("ยังใช้ฉบับเดิม (อ่านใหม่ได้ข้อมูลไม่ครบ)");
    }
    const g = await call(`/api/curriculum/${c.ref}`);
    setBusy(false);
    if (live.current !== c.ref) return;
    if (!g.ok) return setErr(g.body.error ?? "เปิดหลักสูตรนี้ไม่ได้ ลองใหม่อีกครั้ง");
    dispatch({ type: "refreshCurriculum", data: g.body.curriculum as Curriculum, source: sharedSource(g.body.meta as Meta), ref: c.ref });
    say("อัปเดตแล้ว");
  }

  return (
    <section className="card p-4" aria-label="หลักสูตรของฉัน">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 font-semibold">
          หลักสูตรของฉัน: {c.data.major} {c.data.university} · รหัส {c.cohort} · {plan?.name}
        </p>
        <button
          type="button"
          className="btn-ghost min-h-6"
          onClick={() => {
            if (confirm("เปลี่ยนหลักสูตร? วิชาที่ติ๊กว่าผ่านแล้วจะถูกล้าง")) dispatch({ type: "clearCurriculum" });
          }}
        >
          เปลี่ยน
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">
        <SourceLine source={source} />
        {source.provenance === "link" && c.ref && (
          <>
            {" "}
            ·{" "}
            <button type="button" className="link min-h-6" disabled={busy} onClick={refresh}>
              {busy ? "กำลังอ่านใหม่…" : "อ่านใหม่จากต้นทาง"}
            </button>
          </>
        )}
      </p>
      <p className="text-xs text-muted">{DISCLAIMER}</p>
      {err && (
        <p role="alert" className="error-note mt-2">
          {err}
        </p>
      )}
    </section>
  );
}
