import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/security/guard";
import { createClient } from "@/lib/supabase/server";

// A plain form post, so only the Origin check applies (it stops other sites logging users out).
export async function POST(request: Request) {
  if (!sameOrigin(request.headers)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
