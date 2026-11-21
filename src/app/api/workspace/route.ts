import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { getOptionalUser } from "@/lib/auth";
import { guardMutation, LIMITS } from "@/lib/security/rate-limit";
import { parseWorkspace } from "@/lib/workspace/storage";

export async function GET() {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [row] = await db.select().from(workspaces).where(eq(workspaces.userId, user.id));
  return NextResponse.json({ workspace: row?.data ?? null });
}

export async function PUT(request: Request) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const blocked = await guardMutation(request, LIMITS.workspace, user.id);
  if (blocked) return blocked;
  const text = await request.text();
  if (text.length > 2_000_000) return NextResponse.json({ error: "too large" }, { status: 413 });
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const ws = parseWorkspace(raw);
  if (!ws) return NextResponse.json({ error: "invalid workspace" }, { status: 400 });
  await db
    .insert(workspaces)
    .values({ userId: user.id, data: ws })
    .onConflictDoUpdate({ target: workspaces.userId, set: { data: ws, updatedAt: sql`now()` } });
  return NextResponse.json({ ok: true });
}

/** Wipes the account's saved workspace (account page, "ล้างข้อมูลพื้นที่ทำงาน"). */
export async function DELETE(request: Request) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const blocked = await guardMutation(request, LIMITS.workspace, user.id);
  if (blocked) return blocked;
  await db.delete(workspaces).where(eq(workspaces.userId, user.id));
  return NextResponse.json({ ok: true });
}
