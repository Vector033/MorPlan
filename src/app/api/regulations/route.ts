import { NextResponse } from "next/server";
import { z } from "zod";
import { canonicalUniversity, isCmu } from "@/lib/core/university";
import { loadDocs } from "@/lib/rag/corpus";
import { listShared, type RegDoc } from "@/lib/regulations/store";

export const runtime = "nodejs";

const query = z.object({ university: z.string().trim().min(2).max(100) });

/** The regulation documents the Q&A answers from for one university: bundled ones first, then shared ones. */
export async function GET(request: Request) {
  const parsed = query.safeParse({ university: new URL(request.url).searchParams.get("university") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: "ระบุมหาวิทยาลัย" }, { status: 400 });
  const university = canonicalUniversity(parsed.data.university);
  const bundled: RegDoc[] = isCmu(university)
    ? [...loadDocs().values()].map((d) => ({ id: d.id, title: d.title, kind: d.kind, sourceUrl: d.url, readAt: "" }))
    : [];
  return NextResponse.json({ docs: [...bundled, ...(await listShared(university))] });
}
