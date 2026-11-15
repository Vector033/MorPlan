import { describe, expect, it } from "vitest";
import { assertWritable, parseSeedArgs } from "./seed-args";

describe("assertWritable", () => {
  it("allows local hosts and refuses remote ones without the flag", () => {
    expect(() => assertWritable("postgresql://u:p@127.0.0.1:55322/postgres", false)).not.toThrow();
    expect(() => assertWritable("postgresql://u:p@localhost/db", false)).not.toThrow();
    expect(() => assertWritable("postgresql://u:p@db.example.supabase.co:5432/postgres", false)).toThrow(/allow-remote/);
    expect(() => assertWritable("postgresql://u:p@db.example.supabase.co:5432/postgres", true)).not.toThrow();
    expect(() => assertWritable(undefined, true)).toThrow();
  });
});

describe("parseSeedArgs", () => {
  it("parses a curriculum call and rejects bad combinations", () => {
    const a = parseSeedArgs(["--kind", "curriculum", "--university", "U", "--faculty", "F", "--major", "M", "--cohort-from", "64", "--url", "https://x.ac.th/"]);
    expect(a).toMatchObject({ kind: "curriculum", cohortFrom: 64, yes: false });
    expect(() => parseSeedArgs(["--kind", "minors", "--university", "U", "--file", "a.pdf"])).toThrow(/title/);
    expect(() => parseSeedArgs(["--kind", "minors", "--university", "U", "--url", "u", "--file", "a", "--title", "t"])).toThrow(/exactly one/);
    expect(() => parseSeedArgs(["--kind", "electives", "--university", "U", "--url", "u"])).toThrow(/parent/);
  });
});
