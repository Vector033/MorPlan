import { z } from "zod";

/**
 * Looking up a university's public registration pages with a search-grounded
 * model. Only metadata (names and links), never course data: section tables are
 * behind each university's login and change every term.
 */

export const universityReplySchema = z.object({
  officialName: z.string().max(200),
  registrarUrl: z.string().max(500).nullable().optional(),
  courseSearchUrl: z.string().max(500).nullable().optional(),
  courseCodeExample: z.string().max(40).nullable().optional(),
});

export type Source = { title: string; uri: string };
export type UniversityInfo = {
  officialName: string;
  registrarUrl?: string;
  courseSearchUrl?: string;
  courseCodeExample?: string;
  sources: Source[];
};

export function universityPrompt(name: string): string {
  return `Search the web for the Thai university "${name}" and its registrar (สำนักทะเบียน) website.
Reply with one JSON object only, no other text:
{"officialName": "<official Thai name>", "registrarUrl": "<registrar home page URL or null>", "courseSearchUrl": "<URL of the page where students look up offered courses and class times, or null>", "courseCodeExample": "<one real course code from that university, or null>"}
Use only URLs you found in the search results. Use null when unsure.`;
}

/**
 * Keep a link only when its host belongs to one of the search sources, so a
 * URL the model made up is dropped. Grounding sources are titled by domain.
 */
export function verifyUniversity(reply: z.infer<typeof universityReplySchema>, sources: Source[]): UniversityInfo {
  const domains = sources.map((s) => s.title.toLowerCase().trim()).filter((t) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(t));
  const keep = (url?: string | null) => {
    if (!url) return undefined;
    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();
      const ok = (u.protocol === "https:" || u.protocol === "http:") && domains.some((d) => host === d || host.endsWith(`.${d}`) || d.endsWith(`.${host}`));
      return ok ? u.toString() : undefined;
    } catch {
      return undefined;
    }
  };
  return {
    officialName: reply.officialName.trim(),
    registrarUrl: keep(reply.registrarUrl),
    courseSearchUrl: keep(reply.courseSearchUrl),
    courseCodeExample: reply.courseCodeExample?.trim() || undefined,
    sources: sources.slice(0, 5),
  };
}

/** มช. in any common spelling: those students get the built-in parser and exam dates. */
export function isCmu(name: string | null | undefined): boolean {
  if (!name) return true;
  return /^(มช\.?|cmu|chiang ?mai university|มหาวิทยาลัยเชียงใหม่)$/i.test(name.trim());
}
