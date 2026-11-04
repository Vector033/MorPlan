import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { shares } from "@/db/schema";
import type { Section } from "@/lib/core/types";
import { SharedPlan } from "./shared-plan";

async function load(id: string) {
  if (!/^[\w-]{10}$/.test(id)) return null;
  const [row] = await db.select().from(shares).where(eq(shares.id, id));
  return row ?? null;
}

export async function generateMetadata({ params }: PageProps<"/s/[id]">): Promise<Metadata> {
  const row = await load((await params).id);
  return { title: row ? `ตารางเรียน ${row.name} (${row.term})` : "ไม่พบตาราง", robots: { index: false } };
}

export default async function SharedPage({ params }: PageProps<"/s/[id]">) {
  const row = await load((await params).id);
  if (!row) notFound();
  return (
    <SharedPlan
      term={row.term}
      name={row.name}
      sections={row.sections as Section[]}
      createdAt={row.createdAt.toISOString()}
    />
  );
}
