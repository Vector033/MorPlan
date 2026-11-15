import { NextResponse } from "next/server";
import { z } from "zod";
import { options } from "@/lib/curriculum/store";

export const runtime = "nodejs";

const query = z.object({ university: z.string().trim().min(1).max(100), faculty: z.string().trim().min(1).max(100).optional() });

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const parsed = query.safeParse({ university: q.get("university") ?? undefined, faculty: q.get("faculty") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: "ระบุมหาวิทยาลัย" }, { status: 400 });
  return NextResponse.json({ options: await options(parsed.data.university, parsed.data.faculty) });
}
