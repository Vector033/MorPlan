import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { events, shares } from "@/db/schema";
import { guardMutation, LIMITS } from "@/lib/security/rate-limit";
import { sectionSchema } from "@/lib/workspace/storage";

const body = z.object({
  term: z.string().regex(/^[123]\/\d{4}$/),
  name: z.string().trim().min(1).max(30),
  sections: z.array(sectionSchema).max(20),
});

/** Store an immutable snapshot of one plan and return its read-only link id. */
export async function POST(request: Request) {
  const blocked = await guardMutation(request, LIMITS.share);
  if (blocked) return blocked;
  const text = await request.text();
  if (text.length > 100_000) return NextResponse.json({ error: "too large" }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const id = nanoid(10);
  await db.insert(shares).values({ id, ...parsed.data });
  await db.insert(events).values({ kind: "share_created", meta: { sections: parsed.data.sections.length } });
  return NextResponse.json({ id }, { status: 201 });
}
