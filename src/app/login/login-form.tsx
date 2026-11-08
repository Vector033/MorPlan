"use client";

import { useActionState, useState } from "react";
import { PasswordField } from "@/components/password-field";
import { submitKeepingValues } from "@/components/submit-keeping-values";
import { PASSWORD_MIN } from "@/lib/account";
import { authAction, type AuthState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [state, action, pending] = useActionState<AuthState, FormData>(authAction, {});

  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-4">
      <div className="grid grid-cols-2 rounded-full bg-canvas p-1 text-sm">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`py-2 ${mode === m ? "rounded-full bg-white font-semibold text-ink shadow-sm" : "text-muted hover:text-ink"}`}
          >
            {m === "signin" ? "เข้าสู่ระบบ" : "สร้างบัญชี"}
          </button>
        ))}
      </div>
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="label">อีเมล</span>
        <input name="email" type="email" required autoComplete="email" className="input" />
      </label>
      <PasswordField
        label="รหัสผ่านของ MorPlan"
        hint={mode === "signup" ? `อย่างน้อย ${PASSWORD_MIN} ตัวอักษร ตั้งใหม่สำหรับ MorPlan เท่านั้น` : undefined}
        name="password"
        required
        minLength={PASSWORD_MIN}
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
      />
      {state.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="text-sm font-semibold text-ink" role="status">
          {state.message}
        </p>
      )}
      <button disabled={pending} className="btn-primary w-full">
        {pending ? "กรุณารอสักครู่…" : mode === "signin" ? "เข้าสู่ระบบ" : "สร้างบัญชี"}
      </button>
    </form>
  );
}
