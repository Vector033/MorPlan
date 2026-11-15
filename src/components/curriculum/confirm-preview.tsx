"use client";

import { useState } from "react";
import type { Curriculum } from "@/lib/core/curriculum";
import { DISCLAIMER, KIND_LABEL, thaiDate } from "./format";

type Props = {
  result: { data: Curriculum; dropped: string[] };
  sourceTitle: string;
  sourceUrl?: string;
  cohort: number;
  onConfirm: (cohortFrom: number, cohortTo?: number) => void;
  onCancel: () => void;
};

const credits = (items: { credits: number }[]) => items.reduce((n, i) => n + i.credits, 0);

export function ConfirmPreview({ result, sourceTitle, sourceUrl, cohort, onConfirm, onCancel }: Props) {
  const { data, dropped } = result;
  const [from, setFrom] = useState(String(data.cohortFrom || cohort));
  const [to, setTo] = useState(data.cohortTo === undefined ? "" : String(data.cohortTo));
  const [readAt] = useState(() => new Date().toISOString());
  const f = Number(from);
  const t = to.trim() === "" ? undefined : Number(to);
  const validFrom = from.trim() !== "" && Number.isInteger(f) && f >= 0 && f <= 99;
  const validTo = t === undefined || (Number.isInteger(t) && t >= f && t <= 99);
  const plan = data.plans[0];

  return (
    <section className="card anim-rise" aria-labelledby="confirm-h">
      <div className="bar">
        <h2 id="confirm-h">นี่คือหลักสูตรของคุณใช่ไหม</h2>
      </div>
      <div className="flex flex-col gap-4 p-4">
        <div>
          <p className="font-semibold">{data.title}</p>
          <p className="text-sm text-muted">
            {sourceUrl ? (
              <a className="link" href={sourceUrl} target="_blank" rel="noreferrer">
                {sourceTitle}
              </a>
            ) : (
              sourceTitle
            )}{" "}
            · อ่านเมื่อ {thaiDate(readAt)}
          </p>
        </div>

        <fieldset className="flex flex-wrap items-end gap-3">
          <legend className="label">ใช้กับรหัส</legend>
          <label className="flex flex-col gap-1 text-sm">
            ตั้งแต่
            <input className="input w-24 tabular-nums" type="number" inputMode="numeric" min={0} max={99} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            ถึง (ไม่ใส่ก็ได้)
            <input className="input w-24 tabular-nums" type="number" inputMode="numeric" min={0} max={99} value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </fieldset>
        {!(validFrom && validTo) && (
          <p role="alert" className="error-note">
            รหัสปีต้องเป็นเลข 2 หลัก และรหัส “ถึง” ต้องไม่น้อยกว่ารหัส “ตั้งแต่”
          </p>
        )}

        <ul className="flex flex-wrap gap-2 text-sm">
          {data.plans.map((p) => (
            <li key={p.id} className="chip">
              {p.name} · <span className="tabular-nums">{credits(p.terms.flatMap((x) => x.items))}</span> หน่วยกิต
            </li>
          ))}
        </ul>

        <div className="max-h-72 overflow-auto rounded-xs border border-line">
          <table className="w-full text-left text-xs tabular-nums">
            <caption className="sr-only">แผนการเรียน {plan.name}</caption>
            <thead className="sticky top-0 bg-canvas text-muted">
              <tr>
                <th scope="col" className="p-2">เทอม</th>
                <th scope="col" className="p-2">วิชา</th>
                <th scope="col" className="p-2 text-right">นก.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {plan.terms.map((term) => (
                <tr key={`${term.year}-${term.semester}`} className="align-top">
                  <th scope="row" className="p-2 whitespace-nowrap font-medium">
                    ปี {term.year} เทอม {term.semester}
                  </th>
                  <td className="p-2">
                    {term.items.map((i, k) =>
                      i.type === "course" ? (
                        <span key={k} className="block">
                          <span className="font-mono font-semibold">{i.courseNo}</span> {i.title}
                        </span>
                      ) : (
                        <span key={k} className="block text-muted">
                          {KIND_LABEL[i.kind]} {i.credits} นก.
                        </span>
                      ),
                    )}
                  </td>
                  <td className="p-2 text-right">{credits(term.items)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {dropped.length > 0 && <p className="text-sm text-muted">ตัดออก {dropped.length} รายการที่ไม่พบในเอกสาร</p>}
        <p className="text-xs text-muted">{DISCLAIMER}</p>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary" disabled={!(validFrom && validTo)} onClick={() => onConfirm(f, t)}>
            ใช่ หลักสูตรนี้
          </button>
          <button type="button" className="btn-ghost" onClick={onCancel}>
            ยกเลิก
          </button>
        </div>
      </div>
    </section>
  );
}
