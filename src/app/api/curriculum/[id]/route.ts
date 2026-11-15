import { NextResponse } from "next/server";
import { getShared } from "@/lib/curriculum/store";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = /^[\w-]{10}$/.test(id) ? await getShared(id) : null;
  if (!found) return NextResponse.json({ error: "ไม่พบหลักสูตรนี้" }, { status: 404 });
  return NextResponse.json(found);
}
