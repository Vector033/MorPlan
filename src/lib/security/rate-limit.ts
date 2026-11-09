import "server-only";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { checkMutation, clientId, hashKey } from "./guard";

export type Limit = { bucket: string; limit: number; windowSec: number };

// Per-route budgets. Generous for a student using the app, tight for a script.
export const LIMITS = {
  ask: { bucket: "ask", limit: 30, windowSec: 600 },
  share: { bucket: "share", limit: 20, windowSec: 3600 },
  event: { bucket: "event", limit: 120, windowSec: 3600 },
  workspace: { bucket: "workspace", limit: 240, windowSec: 3600 },
  signin: { bucket: "signin", limit: 10, windowSec: 600 },
  signup: { bucket: "signup", limit: 5, windowSec: 3600 },
  account: { bucket: "account", limit: 10, windowSec: 600 },
  // Each call spends model quota: a student imports a handful of times per term.
  extract: { bucket: "extract", limit: 15, windowSec: 3600 },
  university: { bucket: "university", limit: 10, windowSec: 3600 },
} satisfies Record<string, Limit>;

/**
 * Fixed-window counter in Postgres (in-memory counters reset on every
 * serverless instance, so they do not actually limit anything there).
 * Fails open if the database is unreachable: availability over strictness
 * for a planner, and every route still validates its input.
 */
export async function rateLimit(l: Limit, id: string): Promise<{ ok: boolean; retryAfter: number }> {
  const now = Date.now();
  const windowMs = l.windowSec * 1000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const retryAfter = Math.ceil((windowStart.getTime() + windowMs - now) / 1000);
  try {
    const rows = await db.execute<{ count: number }>(sql`
      insert into rate_limits (key, window_start, count)
      values (${hashKey(l.bucket, id)}, ${windowStart.toISOString()}, 1)
      on conflict (key, window_start) do update set count = rate_limits.count + 1
      returning count`);
    // Opportunistic clean-up of old windows (about 1 request in 50).
    if (Math.random() < 0.02) await db.execute(sql`delete from rate_limits where window_start < now() - interval '1 day'`);
    return { ok: Number([...rows][0]?.count ?? 0) <= l.limit, retryAfter };
  } catch {
    return { ok: true, retryAfter: 0 };
  }
}

/**
 * Shared front door for state-changing API routes: same-origin JSON only,
 * then the per-client budget. Returns a response to send back, or null to go on.
 */
export async function guardMutation(request: Request, l: Limit, id = clientId(request.headers)): Promise<NextResponse | null> {
  const check = checkMutation(request.headers);
  if (check === "bad-origin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (check === "bad-type") return NextResponse.json({ error: "expected application/json" }, { status: 415 });
  const r = await rateLimit(l, id);
  if (!r.ok) {
    return NextResponse.json(
      { error: "ใช้งานถี่เกินไป รอสักครู่แล้วลองใหม่" },
      { status: 429, headers: { "retry-after": String(r.retryAfter) } },
    );
  }
  return null;
}
