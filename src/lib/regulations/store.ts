import "server-only";
import { and, asc, eq, lt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { regulations } from "@/db/schema";
import { boundTitle } from "@/lib/core/curriculum-limits";
import { canonicalUniversity } from "@/lib/core/university";
import { universityKey } from "@/lib/curriculum/rows";
import { pagesSchema, type RegKind, type RegPage } from "./pages";

export type RegDoc = { id: string; title: string; kind: string; sourceUrl: string | null; readAt: string };
export type RegDocWithPages = RegDoc & { pages: RegPage[] };

const shared = (university: string) => and(eq(regulations.uniKey, universityKey(university)), eq(regulations.status, "shared"));
const meta = { id: regulations.id, title: regulations.title, kind: regulations.kind, sourceUrl: regulations.sourceUrl, readAt: regulations.readAt };
const toDoc = (r: { id: string; title: string; kind: string; sourceUrl: string | null; readAt: Date }): RegDoc => ({ ...r, readAt: r.readAt.toISOString() });

/** The university's shared documents, oldest first, without their text. */
export async function listShared(university: string): Promise<RegDoc[]> {
  const rows = await db.select(meta).from(regulations).where(shared(university)).orderBy(asc(regulations.createdAt));
  return rows.map(toDoc);
}

/** The university's shared documents with their pages; a row whose pages fail validation is skipped. */
export async function sharedWithPages(university: string): Promise<RegDocWithPages[]> {
  const rows = await db.select({ ...meta, pages: regulations.pages }).from(regulations).where(shared(university)).orderBy(asc(regulations.createdAt));
  return rows.flatMap((r) => {
    const pages = pagesSchema.safeParse(r.pages);
    return pages.success ? [{ ...toDoc(r), pages: pages.data }] : [];
  });
}

/** A shared document already read from this link, so the same page is not stored twice. */
export async function sharedByUrl(university: string, url: string): Promise<RegDoc | null> {
  const [row] = await db.select(meta).from(regulations).where(and(shared(university), eq(regulations.sourceUrl, url))).limit(1);
  return row ? toDoc(row) : null;
}

export async function savePending(row: { university: string; title: string; kind: RegKind; sourceUrl: string; pages: RegPage[] }): Promise<string> {
  // Opportunistic clean-up of reads nobody confirmed, as the curricula store does.
  await db.delete(regulations).where(and(eq(regulations.status, "pending"), lt(regulations.createdAt, sql`now() - interval '1 day'`)));
  const id = nanoid(10);
  const university = canonicalUniversity(row.university.trim());
  await db.insert(regulations).values({
    id,
    uniKey: universityKey(university),
    university,
    title: boundTitle(row.title),
    kind: row.kind,
    status: "pending",
    provenance: "link",
    sourceUrl: row.sourceUrl,
    pages: pagesSchema.parse(row.pages),
  });
  return id;
}

/** Pending -> shared; false when the row is missing or already shared. */
export async function confirmShared(id: string): Promise<boolean> {
  const rows = await db
    .update(regulations)
    .set({ status: "shared" })
    .where(and(eq(regulations.id, id), eq(regulations.status, "pending")))
    .returning({ id: regulations.id });
  return rows.length > 0;
}
