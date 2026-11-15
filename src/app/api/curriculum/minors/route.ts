import { NextResponse } from "next/server";
import { z } from "zod";
import { minorCatalogs } from "@/lib/curriculum/store";

export const runtime = "nodejs";

const university = z.string().trim().min(1).max(100);

export async function GET(request: Request) {
  const parsed = university.safeParse(new URL(request.url).searchParams.get("university") ?? undefined);
  if (!parsed.success) return NextResponse.json({ error: "ระบุมหาวิทยาลัย" }, { status: 400 });
  return NextResponse.json({ catalogs: await minorCatalogs(parsed.data) });
}
