"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/account";
import { googleEnabled } from "@/lib/auth";
import { clientId } from "@/lib/security/guard";
import { LIMITS, rateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

const credentials = z.object({
  email: z.email("กรอกอีเมลให้ถูกต้อง"),
  password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
  mode: z.enum(["signin", "signup"]),
  next: z.string().optional(),
});

export async function authAction(_prev: AuthState, fd: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password, mode, next } = parsed.data;
  // Supabase sees our server's address, not the user's, so throttle here per client.
  const limit = await rateLimit(mode === "signup" ? LIMITS.signup : LIMITS.signin, clientId(await headers()));
  if (!limit.ok) return { error: `ลองหลายครั้งเกินไป รออีก ${Math.ceil(limit.retryAfter / 60)} นาทีแล้วลองใหม่` };
  const supabase = await createClient();

  if (mode === "signup") {
    const { data, error } = await supabase.auth.signUp({ email, password });
    // Generic on purpose: provider messages can reveal whether an email is registered.
    if (error) return { error: error.code === "weak_password" ? "รหัสผ่านเดาง่ายเกินไป ลองตั้งใหม่" : "สมัครไม่สำเร็จ ลองใหม่อีกครั้ง" };
    // With email confirmation on, there is no session until the link is clicked.
    if (!data.session) return { message: "ส่งลิงก์ยืนยันไปที่อีเมลแล้ว กดยืนยันแล้วกลับมาเข้าสู่ระบบ" };
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }
  redirect(safeNext(next));
}

export async function googleSignIn(fd: FormData): Promise<void> {
  const next = safeNext(String(fd.get("next") ?? "/"));
  if (!googleEnabled()) redirect("/login?error=google");
  const h = await headers();
  const limit = await rateLimit(LIMITS.signin, clientId(h));
  if (!limit.ok) redirect("/login?error=rate");
  // Server actions are same-origin (Next checks Origin), so this is our own address.
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}
