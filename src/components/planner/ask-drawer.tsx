"use client";

import Link from "next/link";
import { useRef } from "react";
import { AskForm } from "@/app/ask/ask-form";

/** Regulations assistant as a slide-over on the planner. Stays mounted so answers survive close/open. */
export function AskDrawer() {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="btn" onClick={() => ref.current?.showModal()} aria-haspopup="dialog">
        ถามระเบียบ
      </button>
      <dialog
        ref={ref}
        className="drawer rounded-l-2xl border-l border-line bg-white p-0 text-ink shadow-lg"
        aria-labelledby="ask-drawer-h"
        // Click on the backdrop (the dialog box itself, outside the panel) closes it.
        onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      >
        <div className="flex h-full flex-col">
          <header className="bar">
            <h2 id="ask-drawer-h">ถามเรื่องระเบียบการศึกษา</h2>
            <button
              type="button"
              className="btn-ghost px-2.5"
              onClick={() => ref.current?.close()}
              aria-label="ปิด"
            >
              ✕
            </button>
          </header>
          <div className="flex-1 overflow-y-auto overscroll-contain p-4">
            <p className="mb-3 text-xs text-muted">
              ตอบจากเอกสารสาธารณะของสำนักทะเบียนฯ พร้อมเลขหน้า ไม่ใช่ระบบทางการ ·{" "}
              <Link href="/ask" className="underline underline-offset-4 hover:text-ink">
                เปิดเต็มหน้า
              </Link>
            </p>
            <AskForm compact />
          </div>
        </div>
      </dialog>
    </>
  );
}
