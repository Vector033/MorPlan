import { NextResponse } from "next/server";
import { z } from "zod";
import { candidates } from "@/lib/curriculum/store";

export const runtime = "nodejs";

const name = z.string().trim().min(1).max(100);
const query = z.object({ university: name, faculty: name, major: name });

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const parsed = query.safeParse({ university: q.get("university") ?? undefined, faculty: q.get("faculty") ?? undefined, major: q.get("major") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: "ระบุมหาวิทยาลัย คณะ และสาขา" }, { status: 400 });
  return NextResponse.json({ candidates: await candidates(parsed.data.university, parsed.data.faculty, parsed.data.major) });
}
