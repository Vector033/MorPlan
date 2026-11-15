import { normalizeKey } from "@/lib/core/curriculum";
import data from "../../../data/programs-th.json";
import { universityKey } from "./rows";

/** Faculties and majors each university lists on TCAS (data/programs-th.json, refreshed by scripts/fetch-programs.mts). */

const byUniversity = new Map(
  Object.entries(data.programs as Record<string, Record<string, string[]>>).map(([uni, faculties]) => [
    universityKey(uni),
    new Map(Object.entries(faculties).map(([faculty, majors]) => [normalizeKey(faculty), { faculty, majors }])),
  ]),
);

/** The university's faculties, or the faculty's majors when a faculty is given; [] when TCAS does not list it. */
export function programOptions(university: string, faculty?: string): string[] {
  const faculties = byUniversity.get(universityKey(university));
  if (!faculties) return [];
  if (faculty === undefined) return [...faculties.values()].map((f) => f.faculty);
  return faculties.get(normalizeKey(faculty))?.majors ?? [];
}

/** Both lists in one, a name written two ways ("คณะวิทยาศาสตร์", "วิทยาศาสตร์") kept once, in Thai order. */
export function mergeOptions(a: string[], b: string[]): string[] {
  const seen = new Map<string, string>();
  for (const name of [...a, ...b]) if (!seen.has(normalizeKey(name))) seen.set(normalizeKey(name), name);
  return [...seen.values()].sort((x, y) => x.localeCompare(y, "th"));
}
