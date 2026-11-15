"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useWorkspace } from "@/components/planner/workspace-context";
import { minorProgress, passedNos, rankElectives, type Minor, type Source } from "@/lib/core/curriculum";
import type { Meta } from "@/lib/curriculum/rows";
import { CandidateRows } from "./elective-list";
import { DocumentAdd } from "./document-add";
import { call, sharedSource, Skeleton } from "./shared";

type Entry = { minor: Minor; source: Source };
type Catalog = { meta: Meta; minors: Minor[] };

/** "วิชาโท": pick a minor from the university's catalog and see what is done and what is left. Never says a minor is complete. */
export function MinorPicker({ say }: { say: (s: string) => void }) {
  const { ws, dispatch, placed } = useWorkspace();
  const cur = ws.curriculum!;
  const university = cur.data.university;
  const uid = useId();
  const [shared, setShared] = useState<Entry[] | null>(null);
  const [mine, setMine] = useState<Entry[]>([]); // read from a file or pasted text: this student only
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState(cur.minor?.name ?? "");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    call(`/api/curriculum/minors?university=${encodeURIComponent(university)}`).then(({ ok, body }) => {
      if (!live) return;
      if (!ok) {
        setErr(body.error ?? "โหลดบัญชีวิชาโทไม่สำเร็จ ลองใหม่อีกครั้ง");
        return setShared([]);
      }
      setErr(null);
      setShared(((body.catalogs as Catalog[] | undefined) ?? []).flatMap((c) => c.minors.map((minor) => ({ minor, source: sharedSource(c.meta) }))));
    });
    return () => {
      live = false;
    };
  }, [university, reload]);

  const entries = useMemo(() => [...mine, ...(shared ?? [])], [mine, shared]);
  const groups = useMemo(
    () =>
      cur.minor
        ? minorProgress(cur.minor, passedNos(cur)).map((g) => ({
            ...g,
            ranked: rankElectives(g.left.map((courseNo) => ({ courseNo, title: "" })), passedNos(cur), ws.pool, placed),
          }))
        : [],
    [cur, ws.pool, placed],
  );

  function choose(value: string) {
    setText(value);
    if (value.trim() === "") return dispatch({ type: "setMinor", minor: null });
    const hit = entries.find((e) => e.minor.name === value.trim());
    if (hit) dispatch({ type: "setMinor", minor: hit.minor, source: hit.source });
  }

  return (
    <section id="minor" className="card scroll-mt-4" aria-labelledby={`${uid}h`}>
      <div className="bar">
        <h2 id={`${uid}h`}>วิชาโท</h2>
      </div>
      <div className="flex flex-col gap-4 p-4">
        {shared === null && <Skeleton text="กำลังโหลดบัญชีวิชาโท…" />}
        {err && (
          <p role="alert" className="error-note">
            {err}
          </p>
        )}
        {shared !== null && entries.length === 0 && <p className="text-sm text-muted">ยังไม่มีบัญชีวิชาโทของมหาวิทยาลัยนี้</p>}
        {entries.length > 0 && (
          <div>
            <label className="label" htmlFor={`${uid}i`}>
              เลือกวิชาโท
            </label>
            <input id={`${uid}i`} className="input" list={`${uid}l`} placeholder="พิมพ์ชื่อวิชาโท" value={text} onChange={(e) => choose(e.target.value)} autoComplete="off" />
            <datalist id={`${uid}l`}>
              {entries.map((e) => (
                <option key={e.minor.name} value={e.minor.name} />
              ))}
            </datalist>
          </div>
        )}
        {cur.minor && (
          <div className="flex flex-col gap-3">
            <p className="font-semibold">{cur.minor.name}</p>
            <p className="text-sm whitespace-pre-line">{cur.minor.rules}</p>
            {groups.map((g) => (
              <div key={g.label} className="rounded-xs bg-canvas p-3">
                <p className="text-sm font-semibold">
                  {g.label} · <span className="tabular-nums">ผ่านแล้ว {g.done.length} วิชา</span>
                  {g.minCredits !== undefined && <span className="tabular-nums"> · ต้องการ {g.minCredits} นก.</span>}
                </p>
                {g.done.length > 0 && (
                  <p className="mt-1 text-sm text-muted">
                    {g.done.map((n) => (
                      <span key={n} className="mr-3 font-mono line-through">
                        {n}
                      </span>
                    ))}
                  </p>
                )}
                {g.ranked.length > 0 && (
                  <div className="mt-2">
                    <CandidateRows
                      ranked={g.ranked}
                      onAdd={(c) => {
                        dispatch({ type: "wantCourses", courseNos: [c.courseNo] });
                        say("เพิ่ม 1 วิชาลงรายการแล้ว");
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {shared !== null &&
          (adding ? (
            <DocumentAdd
              kind="minors"
              scope={{ university, faculty: "", major: "", cohort: cur.cohort }}
              onAccept={(minors, source, isShared) => {
                if (isShared) setReload((n) => n + 1); // the confirmed link is now part of the shared catalog
                else setMine((m) => [...minors.map((minor) => ({ minor, source })), ...m]);
              }}
              onClose={() => setAdding(false)}
            />
          ) : (
            <div>
              <button type="button" className="btn" onClick={() => setAdding(true)}>
                เพิ่มเอกสาร
              </button>
            </div>
          ))}
      </div>
    </section>
  );
}
