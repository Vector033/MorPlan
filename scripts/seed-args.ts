import { parseArgs } from "node:util";

export type SeedArgs = {
  kind: "curriculum" | "electives" | "minors";
  university: string;
  faculty?: string;
  major?: string;
  cohortFrom?: number;
  cohortTo?: number;
  parent?: string;
  url?: string;
  file?: string;
  title?: string;
  yes: boolean;
  replace: boolean;
  allowRemote: boolean;
};

const num = (s?: string) => {
  if (s === undefined) return undefined;
  if (!Number.isInteger(Number(s))) throw new Error(`not a number: ${s}`);
  return Number(s);
};

export function parseSeedArgs(argv: string[]): SeedArgs {
  const { values: v } = parseArgs({
    args: argv,
    options: {
      kind: { type: "string" }, university: { type: "string" }, faculty: { type: "string" }, major: { type: "string" },
      "cohort-from": { type: "string" }, "cohort-to": { type: "string" }, parent: { type: "string" },
      url: { type: "string" }, file: { type: "string" }, title: { type: "string" },
      yes: { type: "boolean" }, replace: { type: "boolean" }, "allow-remote": { type: "boolean" },
    },
  });
  if (v.kind !== "curriculum" && v.kind !== "electives" && v.kind !== "minors") throw new Error("--kind must be curriculum, electives or minors");
  if (!v.university) throw new Error("--university is required");
  if (!v.url === !v.file) throw new Error("pass exactly one of --url or --file");
  if (v.file && !v.title) throw new Error("--file needs --title");
  if (v.kind === "curriculum" && (!v.faculty || !v.major)) throw new Error("--kind curriculum needs --faculty and --major");
  if (v.kind === "electives" && !v.parent) throw new Error("--kind electives needs --parent");
  return {
    kind: v.kind, university: v.university, faculty: v.faculty, major: v.major,
    cohortFrom: num(v["cohort-from"]), cohortTo: num(v["cohort-to"]), parent: v.parent,
    url: v.url, file: v.file, title: v.title,
    yes: !!v.yes, replace: !!v.replace, allowRemote: !!v["allow-remote"],
  };
}

/** Throws unless DATABASE_URL points at this machine or the owner passed --allow-remote. */
export function assertWritable(databaseUrl: string | undefined, allowRemote: boolean): void {
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  if (allowRemote) return;
  const refuse = (why: string) => new Error(`DATABASE_URL ${why}; pass --allow-remote to seed a remote database`);
  const authority = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i.exec(databaseUrl)?.[1] ?? "";
  if (authority.includes(",")) throw refuse("lists several hosts");
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw refuse("is not a valid URL");
  }
  // postgres.js / node-postgres let these query parameters override the URL host.
  for (const k of url.searchParams.keys()) if (/^(host|hostaddr)$/i.test(k)) throw refuse(`sets "${k}" in the query`);
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") throw refuse("is not local");
}

/** Reason not to write a read result, or null when it looks sane. */
export function refuseResult(kept: number, dropped: number): string | null {
  if (kept === 0) return "the read found nothing (0 items); not writing";
  if (dropped > kept) return `dropped ${dropped} items but kept only ${kept}; not writing`;
  return null;
}
