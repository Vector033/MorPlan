"use client";

import { useActionState, useState } from "react";
import { authAction, type AuthState } from "./actions";

export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [state, action, pending] = useActionState<AuthState, FormData>(authAction, {});

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 rounded-lg bg-stone-200/60 p-1 text-sm">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`rounded-md py-1.5 ${mode === m ? "bg-white font-medium shadow-sm" : "text-muted"}`}
          >
            {m === "signin" ? "เข้าสู่ระบบ" : "สร้างบัญชี"}
          </button>
        ))}
      </div>
      <input type="hidden" name="mode" value={mode} />
      <label className="block">
        <span className="label">อีเมล</span>
        <input name="email" type="email" required autoComplete="email" className="input" />
      </label>
      <label className="block">
        <span className="label">รหัสผ่านของ MorPlan (อย่างน้อย 8 ตัว)</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          className="input"
        />
      </label>
      {state.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="text-sm text-accent" role="status">
          {state.message}
        </p>
      )}
      <button disabled={pending} className="btn-primary w-full">
        {pending ? "กรุณารอสักครู่…" : mode === "signin" ? "เข้าสู่ระบบ" : "สร้างบัญชี"}
      </button>
    </form>
  );
}
