"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { MAX_PLANS } from "@/lib/workspace/reducer";
import { useWorkspace } from "./workspace-context";

export function PlanTabs() {
  const { ws, dispatch, plan, sync } = useWorkspace();
  const [renaming, setRenaming] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  // Slide the black bar under the active tab: transform only (translate + scaleX of a full-width bar).
  useLayoutEffect(() => {
    const list = listRef.current;
    const bar = barRef.current;
    if (!list || !bar) return;
    const place = () => {
      const tab = list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      if (!tab || !list.offsetWidth) return;
      bar.style.transform = `translateX(${tab.offsetLeft}px) scaleX(${tab.offsetWidth / list.offsetWidth})`;
    };
    place();
    // Enable the transition after the first placement so it never slides in from the left edge.
    const id = requestAnimationFrame(() => bar.setAttribute("data-ready", ""));
    const ro = new ResizeObserver(place);
    ro.observe(list);
    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
    };
  }, [plan.id, ws.plans]);

  function switchTo(id: string) {
    if (id === plan.id) return;
    const go = () => dispatch({ type: "setActive", id });
    // Cross-fade the timetable where View Transitions exist; plain swap elsewhere.
    if (typeof document.startViewTransition === "function") document.startViewTransition(() => flushSync(go));
    else go();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div ref={listRef} role="tablist" aria-label="แผนตารางเรียน" className="relative flex flex-wrap border-b border-line">
        {ws.plans.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={p.id === plan.id}
            onClick={() => switchTo(p.id)}
            className={`rounded-t-lg px-3.5 pt-1.5 pb-2 text-sm ${
              p.id === plan.id ? "font-semibold text-ink" : "text-muted hover:bg-white hover:text-ink"
            }`}
          >
            {p.name}
          </button>
        ))}
        {ws.plans.length < MAX_PLANS && (
          <button
            className="rounded-t-lg px-3.5 pt-1.5 pb-2 text-sm font-medium text-accent hover:bg-white"
            onClick={() => dispatch({ type: "addPlan", copyFrom: plan.id })}
            title="สร้างแผนใหม่โดยคัดลอกแผนนี้"
          >
            + แผนใหม่
          </button>
        )}
        <span ref={barRef} className="tab-indicator pointer-events-none absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-accent" aria-hidden />
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
