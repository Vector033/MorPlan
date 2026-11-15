import { NextResponse } from "next/server";
import { z } from "zod";
import { mergeOptions, programOptions } from "@/lib/curriculum/programs";
import { options } from "@/lib/curriculum/store";

export const runtime = "nodejs";

const query = z.object({ university: z.string().trim().min(1).max(100), faculty: z.string().trim().min(1).max(100).optional() });

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const parsed = query.safeParse({ university: q.get("university") ?? undefined, faculty: q.get("faculty") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: "ระบุมหาวิทยาลัย" }, { status: 400 });
  const { university, faculty } = parsed.data;
  return NextResponse.json({ options: mergeOptions(programOptions(university, faculty), await options(university, faculty)) });
}
