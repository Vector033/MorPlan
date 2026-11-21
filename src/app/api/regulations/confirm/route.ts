import { NextResponse } from "next/server";
import { z } from "zod";
import { confirmShared } from "@/lib/regulations/store";
import { guardMutation, LIMITS } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const body = z.object({ id: z.string().regex(/^[\w-]{10}$/) });

/** A document read from a university link becomes shared once the student who read it confirms it. */
export async function POST(request: Request) {
  const blocked = await guardMutation(request, LIMITS.regulationsConfirm);
  if (blocked) return blocked;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  if (!(await confirmShared(parsed.data.id))) return NextResponse.json({ error: "ไม่พบเอกสารที่รอยืนยัน อ่านจากลิงก์อีกครั้ง" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
