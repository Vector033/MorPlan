"use client";

import { useState } from "react";
import { MAX_PLANS } from "@/lib/workspace/reducer";
import { useWorkspace } from "./workspace-context";

export function PlanTabs() {
  const { ws, dispatch, plan, sync } = useWorkspace();
  const [renaming, setRenaming] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="tablist" aria-label="แผนตารางเรียน" className="flex flex-wrap gap-1 rounded-xl bg-stone-200/60 p-1">
        {ws.plans.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={p.id === plan.id}
            onClick={() => dispatch({ type: "setActive", id: p.id })}
            className={`rounded-lg px-3 py-1 text-sm transition ${
              p.id === plan.id ? "bg-white font-medium shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {p.name}
          </button>
        ))}
        {ws.plans.length < MAX_PLANS && (
          <button
            className="rounded-lg px-2.5 py-1 text-sm text-muted hover:bg-white/70 hover:text-ink"
            onClick={() => dispatch({ type: "addPlan", copyFrom: plan.id })}
            title="สร้างแผนใหม่โดยคัดลอกแผนนี้"
          >
            + แผนใหม่
          </button>
        )}
      </div>

      {renaming ? (
        <form
          className="flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            const name = new FormData(e.currentTarget).get("name");
            dispatch({ type: "renamePlan", id: plan.id, name: String(name) });
            setRenaming(false);
          }}
        >
          <input name="name" defaultValue={plan.name} className="input w-36 py-1" aria-label="ชื่อแผน" autoFocus maxLength={30} />
          <button className="btn">บันทึก</button>
        </form>
      ) : (
        <button className="btn-ghost text-xs" onClick={() => setRenaming(true)}>
          เปลี่ยนชื่อ
        </button>
      )}
      {ws.plans.length > 1 && (
        <button
          className="btn-ghost text-xs hover:text-danger"
          onClick={() => {
            if (confirm(`ลบ ${plan.name}?`)) dispatch({ type: "deletePlan", id: plan.id });
          }}
        >
          ลบแผนนี้
        </button>
      )}
      <span className="ml-auto text-xs text-muted" aria-live="polite">
        {sync === "local" && "บันทึกในเบราว์เซอร์นี้"}
        {sync === "loading" && "กำลังโหลด…"}
        {sync === "saving" && "กำลังบันทึก…"}
        {sync === "saved" && "บันทึกในบัญชีแล้ว"}
        {sync === "error" && <span className="text-danger">บันทึกในบัญชีไม่สำเร็จ (ยังเก็บในเบราว์เซอร์)</span>}
      </span>
    </div>
  );
}
