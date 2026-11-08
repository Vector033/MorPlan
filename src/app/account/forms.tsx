"use client";

import { useActionState, useRef } from "react";
import { PasswordField } from "@/components/password-field";
import { submitKeepingValues } from "@/components/submit-keeping-values";
import { PASSWORD_MIN } from "@/lib/account";
import { changePassword, deleteAccount, updateProfile, type FormState } from "./actions";

function Feedback({ state }: { state: FormState }) {
  if (state.error)
    return (
      <p className="text-sm text-danger" role="alert">
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p className="text-sm font-medium text-[#14603a]" role="status">
        ✓ {state.message}
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
        hint={`อย่างน้อย ${PASSWORD_MIN} ตัวอักษร ห้ามใช้รหัสผ่าน CMU หรือ reg`}
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
  return (
    <form onSubmit={submitKeepingValues(action)} className="flex flex-col gap-3">
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
          className="inline-flex min-h-9 items-center justify-center rounded-full bg-danger px-5 py-2 text-sm font-semibold text-white hover:bg-[#b0170f] disabled:bg-line disabled:text-muted"
        >
          {pending ? "กำลังลบ…" : "ลบบัญชีถาวร"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}
