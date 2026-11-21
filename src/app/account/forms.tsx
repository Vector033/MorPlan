"use client";

import { useActionState, useRef, useState } from "react";
import { CheckIcon } from "@/components/icons";
import { PasswordField } from "@/components/password-field";
import { useWorkspace } from "@/components/planner/workspace-context";
import { submitKeepingValues } from "@/components/submit-keeping-values";
import { PASSWORD_MIN } from "@/lib/account";
import { clearAccountStorage } from "@/lib/workspace/storage";
import { changePassword, deleteAccount, signOutEverywhere, updateProfile, type FormState } from "./actions";

function Feedback({ state }: { state: FormState }) {
  if (state.error)
    return (
      <p className="error-note" role="alert">
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p className="inline-flex items-center gap-1.5 text-sm font-medium text-ok" role="status">
        <CheckIcon />
        {state.message}
      </p>
    );
  return null;
}

export function ProfileForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfile, {});
  return (
    <form onSubmit={submitKeepingValues(action)} className="flex flex-col gap-3">
      <div>
        {/* The row already shows this heading; keep the name for screen readers only. */}
        <label htmlFor="profile-name" className="sr-only">
          ชื่อที่แสดง
        </label>
        <input
          id="profile-name"
          name="name"
          defaultValue={name}
          maxLength={60}
          autoComplete="name"
          placeholder="เช่น นวัต"
          className="input"
          aria-invalid={state.field === "name" || undefined}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-primary">
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function PasswordForm({ hasPassword, email }: { hasPassword: boolean; email: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const next = await changePassword(prev, fd);
    // Never leave a password sitting in the form after it worked.
    if (next.message) formRef.current?.reset();
    return next;
  }, {});
  return (
    <form ref={formRef} onSubmit={submitKeepingValues(action)} className="flex flex-col gap-3">
      {/* Lets password managers file the new password under the right account. */}
      <input type="text" name="username" value={email} autoComplete="username" hidden readOnly />
      {hasPassword && (
        <PasswordField label="รหัสผ่านปัจจุบัน" name="current" required autoComplete="current-password" aria-invalid={state.field === "current" || undefined} />
      )}
      <PasswordField
        label={hasPassword ? "รหัสผ่านใหม่" : "ตั้งรหัสผ่าน"}
        hint={`อย่างน้อย ${PASSWORD_MIN} ตัวอักษร ห้ามใช้รหัสผ่านบัญชีมหาวิทยาลัย`}
        name="next"
        required
        minLength={PASSWORD_MIN}
        autoComplete="new-password"
        aria-invalid={state.field === "next" || undefined}
      />
      <PasswordField
        label="ยืนยันรหัสผ่านใหม่"
        name="confirm"
        required
        minLength={PASSWORD_MIN}
        autoComplete="new-password"
        aria-invalid={state.field === "confirm" || undefined}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-primary">
          {pending ? "กำลังบันทึก…" : hasPassword ? "เปลี่ยนรหัสผ่าน" : "ตั้งรหัสผ่าน"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function DeleteForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(deleteAccount, {});
  const submit = submitKeepingValues(action);
  return (
    <form
      onSubmit={(e) => {
        clearAccountStorage();
        submit(e);
      }}
      className="flex flex-col gap-3"
    >
      <div>
        <label htmlFor="delete-confirm" className="label">
          พิมพ์ <span className="font-mono">{email}</span> เพื่อยืนยัน
        </label>
        <input
          id="delete-confirm"
          name="confirm"
          autoComplete="off"
          spellCheck={false}
          className="input"
          aria-invalid={state.field === "confirm" || undefined}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={pending}
          className="inline-flex min-h-9 items-center justify-center rounded-full bg-danger px-5 py-2 text-sm font-semibold text-white hover:bg-danger-strong disabled:bg-line disabled:text-muted"
        >
          {pending ? "กำลังลบ…" : "ลบบัญชีถาวร"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

/** Both sign-out buttons; each clears what the browser may hold of an account before leaving. */
export function SignOutButtons() {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={signOutEverywhere} onSubmit={() => clearAccountStorage()}>
        <button className="btn">ออกจากระบบทุกเครื่อง</button>
      </form>
      <form action="/auth/signout" method="post" onSubmit={() => clearAccountStorage()}>
        <button className="btn-ghost">ออกจากระบบเครื่องนี้</button>
      </form>
    </div>
  );
}

/** Deletes the plans, courses and curriculum saved in this account, after a confirm. */
export function ResetWorkspaceButton() {
  const { clearWorkspace } = useWorkspace();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className="btn"
        disabled={state === "busy"}
        onClick={async () => {
          if (!window.confirm("ลบแผนตารางเรียน วิชาที่นำเข้า และหลักสูตรทั้งหมดในบัญชีนี้? กู้คืนไม่ได้")) return;
          setState("busy");
          setState((await clearWorkspace()) ? "done" : "error");
        }}
      >
        {state === "busy" ? "กำลังล้าง…" : "ล้างข้อมูลพื้นที่ทำงาน"}
      </button>
      {state === "done" && (
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-ok" role="status">
          <CheckIcon />
          ล้างแล้ว เริ่มใหม่จากพื้นที่ว่าง
        </p>
      )}
      {state === "error" && (
        <p className="error-note" role="alert">
          ล้างไม่สำเร็จ ลองใหม่อีกครั้ง
        </p>
      )}
    </div>
  );
}
