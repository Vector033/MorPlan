import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { events } from "@/db/schema";
import { guardMutation, LIMITS } from "@/lib/security/rate-limit";

// Anonymous counters for the usage numbers in the README. No ids, IPs or content are stored.
const body = z.object({
  kind: z.enum(["import_done", "demo_loaded", "section_placed", "ics_exported", "png_exported", "plan_added"]),
  count: z.number().int().min(0).max(5000).optional(),
});

export async function POST(request: Request) {
  const blocked = await guardMutation(request, LIMITS.event);
  if (blocked) return blocked;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad event" }, { status: 400 });
  await db.insert(events).values({ kind: parsed.data.kind, meta: parsed.data.count ? { count: parsed.data.count } : null });
  return new NextResponse(null, { status: 204 });
}
