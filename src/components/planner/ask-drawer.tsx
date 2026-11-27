"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AskForm } from "@/app/ask/ask-form";
import { XIcon } from "@/components/icons";

const OPEN_ASK_EVENT = "morplan:open-ask";

export function openAskDrawer() {
  window.dispatchEvent(new CustomEvent(OPEN_ASK_EVENT));
}

/** Button inside the planner toolbar that opens the global regulations drawer. */
export function AskDrawer() {
  return (
    <button type="button" className="btn" onClick={openAskDrawer} aria-haspopup="dialog">
      ถามระเบียบ
    </button>
  );
}

/** Regulations assistant slide-over mounted once in layout so top-nav and toolbar triggers share state. */
export function GlobalAskDrawer() {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      if (ref.current && !ref.current.open) ref.current.showModal();
    };
    window.addEventListener(OPEN_ASK_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ASK_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (pathname === "/ask" && ref.current?.open) ref.current.close();
  }, [pathname]);

  return (
    <dialog
      ref={ref}
      className="drawer rounded-l-md border-l border-line bg-white p-0 text-ink shadow-lg"
      aria-labelledby="ask-drawer-h"
      onClose={() => setOpen(false)}
      // Click on the backdrop (the dialog box itself, outside the panel) closes it.
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
    >
      <div className="flex h-full flex-col">
        <header className="bar fluted-glass sticky top-0 z-10 border-b border-line pb-3 backdrop-blur-md">
          <h2 id="ask-drawer-h">ถามเรื่องระเบียบการศึกษา</h2>
          <button
            type="button"
            className="btn-ghost size-9 p-0"
            onClick={() => ref.current?.close()}
            aria-label="ปิด"
          >
            <XIcon />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain p-4">
          <p className="mb-3 max-w-[65ch] text-xs leading-[1.65] text-muted">
            ตอบจากเอกสารระเบียบของ<span className="whitespace-nowrap">มหาวิทยาลัยที่คุณเลือก</span>{" "}
            <span className="whitespace-nowrap">พร้อมเลขหน้า</span> · ไม่ใช่ระบบทางการ ·{" "}
            <Link
              href="/ask"
              onClick={() => ref.current?.close()}
              className="whitespace-nowrap underline underline-offset-4 hover:text-ink"
            >
              เปิดเต็มหน้า
            </Link>
          </p>
          {open && <AskForm compact />}
        </div>
      </div>
    </dialog>
  );
}
