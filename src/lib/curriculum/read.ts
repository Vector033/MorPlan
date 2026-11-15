import type { z } from "zod";
import type { Curriculum, ElectiveCourse, Minor } from "@/lib/core/curriculum";
import {
  CURRICULUM_SYSTEM,
  ELECTIVES_SYSTEM,
  MINORS_SYSTEM,
  checkCurriculum,
  checkElectives,
  checkMinors,
  chunks,
  curriculumReplySchema,
  electivesReplySchema,
  minorsReplySchema,
  sourcePrompt,
  studyPlanChunks,
  type CurriculumReply,
  type ElectivesReply,
  type MinorsReply,
} from "@/lib/core/curriculum-extract";
import { redact } from "@/lib/core/extract";
import type { LlmProvider } from "@/lib/rag/llm";
import type { SourceText } from "./source";

export type DocKind = "curriculum" | "electives" | "minors";
export type ReadResult =
  | { kind: "curriculum"; data: Curriculum; dropped: string[] }
  | { kind: "electives"; data: ElectiveCourse[]; dropped: string[] }
  | { kind: "minors"; data: Minor[]; dropped: string[] };

export const CURRICULUM_CHUNK_CHARS = 16000;
export const CURRICULUM_MAX_CHUNKS = 4;
export const ELECTIVES_CHUNK_CHARS = 12000;
export const MINORS_CHUNK_CHARS = 12000;
/** Sequential calls can exceed a 60 s route limit, so a few run at once. */
export const CONCURRENCY = 3;

type Meta = { university: string; faculty: string; major: string; cohort: number };

/** Run `fn` over `items` with at most `limit` in flight; results keep input order, any failure rejects. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function mergeCurriculum(replies: CurriculumReply[]): CurriculumReply {
  const plans = new Map<string, CurriculumReply["plans"][number]>();
  for (const r of replies) {
    for (const p of r.plans) {
      const have = plans.get(p.name);
      if (!have) {
        plans.set(p.name, { ...p, terms: [...p.terms] });
        continue;
      }
      have.minCredits ??= p.minCredits;
      for (const t of p.terms) if (!have.terms.some((x) => x.year === t.year && x.semester === t.semester)) have.terms.push(t);
    }
  }
  const plansOut = [...plans.values()].map((p) => ({ ...p, terms: p.terms.sort((a, b) => a.year - b.year || a.semester - b.semester) }));
  return {
    title: replies.find((r) => r.title.trim())?.title ?? "",
    cohortFrom: replies.find((r) => r.cohortFrom != null)?.cohortFrom ?? null,
    cohortTo: replies.find((r) => r.cohortTo != null)?.cohortTo ?? null,
    plans: plansOut,
  };
}

function mergeMinors(replies: MinorsReply[]): MinorsReply {
  const minors = new Map<string, MinorsReply["minors"][number]>();
  for (const m of replies.flatMap((r) => r.minors)) {
    const k = `${m.faculty ?? ""}${m.name}`;
    const have = minors.get(k);
    if (!have) {
      minors.set(k, { ...m, groups: m.groups.map((g) => ({ ...g, courses: [...g.courses] })) });
      continue;
    }
    for (const g of m.groups) {
      const same = have.groups.find((x) => x.label === g.label);
      if (same) same.courses.push(...g.courses);
      else have.groups.push({ ...g, courses: [...g.courses] });
    }
  }
  return { minors: [...minors.values()] };
}

/** Source text -> free LLM (one call per chunk) -> evidence check against the whole redacted text. */
export async function readDocument(llm: LlmProvider, kind: DocKind, source: SourceText, meta: Meta): Promise<ReadResult> {
  const text = redact(source.text);
  const ask = <T>(system: string, schema: z.ZodType<T>, parts: string[]) =>
    mapLimit(parts, CONCURRENCY, async (part) => (await llm.json({ system, prompt: sourcePrompt(meta, part), schema })).data);

  if (kind === "curriculum") {
    const replies = await ask(CURRICULUM_SYSTEM, curriculumReplySchema, studyPlanChunks(text, CURRICULUM_CHUNK_CHARS, CURRICULUM_MAX_CHUNKS));
    const { curriculum, dropped } = checkCurriculum(text, mergeCurriculum(replies), meta);
    return { kind, data: curriculum, dropped };
  }
  if (kind === "electives") {
    const replies = await ask(ELECTIVES_SYSTEM, electivesReplySchema, chunks(text, ELECTIVES_CHUNK_CHARS));
    const merged: ElectivesReply = { courses: replies.flatMap((r) => r.courses) };
    const { courses, dropped } = checkElectives(text, merged);
    return { kind, data: courses, dropped };
  }
  const replies = await ask(MINORS_SYSTEM, minorsReplySchema, chunks(text, MINORS_CHUNK_CHARS));
  const { minors, dropped } = checkMinors(text, mergeMinors(replies));
  return { kind, data: minors, dropped };
}
