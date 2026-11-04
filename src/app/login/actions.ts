"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

const credentials = z.object({
  email: z.email("กรอกอีเมลให้ถูกต้อง"),
  password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
  mode: z.enum(["signin", "signup"]),
});

export async function authAction(_prev: AuthState, fd: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password, mode } = parsed.data;
  const supabase = await createClient();

  if (mode === "signup") {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    // With email confirmation on, there is no session until the link is clicked.
    if (!data.session) return { message: "ส่งลิงก์ยืนยันไปที่อีเมลแล้ว กดยืนยันแล้วกลับมาเข้าสู่ระบบ" };
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }
  redirect("/");
}
