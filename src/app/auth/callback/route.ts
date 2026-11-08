import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/account";
import { createClient } from "@/lib/supabase/server";

// Google sends the user back here with a one-time code; the PKCE verifier
// cookie set when the sign-in started proves it is the same browser.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin), { status: 303 });
  }
  return NextResponse.redirect(new URL("/login?error=google", url.origin), { status: 303 });
}
