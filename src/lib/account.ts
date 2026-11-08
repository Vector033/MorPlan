import { z } from "zod";

/** Supabase hashes with bcrypt, which only reads the first 72 bytes. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export type SignInMethod = "email" | "google";

/**
 * Where to send the user after sign-in. Only same-site paths: "//evil.com" and
 * "/\evil.com" are protocol-relative in browsers, so they count as external.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

/** Sign-in methods from Supabase identities, in a stable order. */
export function signInMethods(identities: { provider: string }[] | null | undefined): SignInMethod[] {
  const set = new Set((identities ?? []).map((i) => i.provider));
  return (["email", "google"] as const).filter((m) => set.has(m));
}

/** One letter for the avatar: the name's first letter, else the email's. */
export function initialOf(name: string, email: string): string {
  const source = name.trim() || email;
  return ([...source][0] ?? "?").toUpperCase();
}

const newPassword = z
  .string()
  .min(PASSWORD_MIN, `รหัสผ่านต้องมีอย่างน้อย ${PASSWORD_MIN} ตัวอักษร`)
  .max(PASSWORD_MAX, `รหัสผ่านยาวได้ไม่เกิน ${PASSWORD_MAX} ตัวอักษร`);

/** `current` is required only when the account already has a password. */
export function passwordChangeSchema(hasPassword: boolean) {
  return z
    .object({
      current: hasPassword ? z.string().min(1, "กรอกรหัสผ่านปัจจุบัน") : z.string().optional(),
      next: newPassword,
      confirm: z.string(),
    })
    .refine((d) => d.next === d.confirm, { message: "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน", path: ["confirm"] })
    .refine((d) => !d.current || d.current !== d.next, { message: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม", path: ["next"] });
}

export const profileSchema = z.object({
  name: z.string().trim().max(60, "ชื่อยาวได้ไม่เกิน 60 ตัวอักษร"),
});

/** Typing the email back is the confirmation for deleting the account. */
export function confirmsDeletion(typed: unknown, email: string): boolean {
  return typeof typed === "string" && email.length > 0 && typed.trim().toLowerCase() === email.toLowerCase();
}
