import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { signInMethods, type SignInMethod } from "./account";
import { createClient } from "./supabase/server";

export type SessionUser = { id: string; email: string };

export type Account = SessionUser & {
  name: string;
  methods: SignInMethod[];
  /** False for an account made with Google that never set a MorPlan password. */
  hasPassword: boolean;
  createdAt: string;
  lastSignInAt?: string;
};

/** Verified current user, or a redirect to /login. Cached per request. */
export const requireUser = cache(async (): Promise<SessionUser> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { id: data.user.id, email: data.user.email ?? "" };
});

export const getOptionalUser = cache(async (): Promise<(SessionUser & { name?: string }) | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const meta = data.user.user_metadata ?? {};
  return { id: data.user.id, email: data.user.email ?? "", name: String(meta.full_name ?? meta.name ?? "") };
});

/** Everything the account page shows, read from the verified user. */
export const requireAccount = cache(async (next = "/account"): Promise<Account> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const u = data.user;
  const meta = u.user_metadata ?? {};
  const methods = signInMethods(u.identities);
  return {
    id: u.id,
    email: u.email ?? "",
    name: String(meta.full_name ?? meta.name ?? ""),
    methods,
    // Setting a password on a Google account adds no "email" identity, so we record it ourselves.
    hasPassword: methods.includes("email") || meta.has_password === true,
    createdAt: u.created_at,
    lastSignInAt: u.last_sign_in_at,
  };
});

/** Google is offered only once its OAuth client is set up in Supabase (see README). */
export function googleEnabled(): boolean {
  return process.env.AUTH_GOOGLE_ENABLED === "true";
}
