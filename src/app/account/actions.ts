"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { confirmsDeletion, passwordChangeSchema, profileSchema } from "@/lib/account";
import { requireAccount } from "@/lib/auth";
import { clientId } from "@/lib/security/guard";
import { LIMITS, rateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; message?: string; field?: string };

async function throttled(userId: string): Promise<string | null> {
  // Per account and per client, so one stolen session can't hammer another user's limit.
  const limit = await rateLimit(LIMITS.account, `${userId}:${clientId(await headers())}`);
  return limit.ok ? null : `ลองหลายครั้งเกินไป รออีก ${Math.ceil(limit.retryAfter / 60)} นาทีแล้วลองใหม่`;
}

export async function updateProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const account = await requireAccount();
  const parsed = profileSchema.safeParse({ name: fd.get("name") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message, field: "name" };
  const busy = await throttled(account.id);
  if (busy) return { error: busy };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: { full_name: parsed.data.name } });
  if (error) return { error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  revalidatePath("/", "layout");
  return { message: "บันทึกชื่อแล้ว" };
}

export async function changePassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const account = await requireAccount();
  const parsed = passwordChangeSchema(account.hasPassword).safeParse({
    current: fd.get("current") ?? undefined,
    next: fd.get("next") ?? "",
    confirm: fd.get("confirm") ?? "",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message, field: String(issue.path[0] ?? "") };
  }
  const busy = await throttled(account.id);
  if (busy) return { error: busy };
  const supabase = await createClient();

  // Supabase would accept a new password from any live session; asking for the
  // current one stops someone at an unlocked laptop from taking the account.
  if (account.hasPassword) {
    const { error } = await supabase.auth.signInWithPassword({ email: account.email, password: parsed.data.current ?? "" });
    if (error) return { error: "รหัสผ่านปัจจุบันไม่ถูกต้อง", field: "current" };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.next, data: { has_password: true } });
  if (error) {
    if (error.code === "weak_password") return { error: "รหัสผ่านเดาง่ายเกินไป ลองตั้งใหม่", field: "next" };
    if (error.code === "same_password") return { error: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม", field: "next" };
    return { error: "เปลี่ยนรหัสผ่านไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  // Other devices keep their old sessions until told otherwise.
  await supabase.auth.signOut({ scope: "others" });
  revalidatePath("/account");
  return { message: account.hasPassword ? "เปลี่ยนรหัสผ่านแล้ว และออกจากระบบเครื่องอื่นให้แล้ว" : "ตั้งรหัสผ่านแล้ว ใช้อีเมลนี้เข้าสู่ระบบได้ด้วย" };
}

export async function signOutEverywhere(): Promise<void> {
  await requireAccount();
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?message=signed-out");
}

export async function deleteAccount(_prev: FormState, fd: FormData): Promise<FormState> {
  const account = await requireAccount();
  if (!confirmsDeletion(fd.get("confirm"), account.email)) {
    return { error: "พิมพ์อีเมลของบัญชีให้ตรงก่อนลบ", field: "confirm" };
  }
  const busy = await throttled(account.id);
  if (busy) return { error: busy };
  // Saved plans go with the user (workspaces.user_id references auth.users ON DELETE CASCADE).
  // Shared links are anonymous snapshots and are not tied to the account.
  try {
    await db.execute(sql`delete from auth.users where id = ${account.id}`);
  } catch (e) {
    console.error("account delete failed", e instanceof Error ? e.message : e);
    return { error: "ลบบัญชีไม่สำเร็จ ลองใหม่อีกครั้ง ถ้ายังไม่ได้ แจ้งผู้ดูแลผ่านหน้าแหล่งข้อมูล" };
  }
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/?account=deleted");
}
