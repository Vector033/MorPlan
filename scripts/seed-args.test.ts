import { describe, expect, it } from "vitest";
import { assertWritable, parseSeedArgs, refuseResult } from "./seed-args";

describe("assertWritable", () => {
  it("allows local hosts and refuses remote ones without the flag", () => {
    expect(() => assertWritable("postgresql://u:p@127.0.0.1:55322/postgres", false)).not.toThrow();
    expect(() => assertWritable("postgresql://u:p@localhost/db", false)).not.toThrow();
    expect(() => assertWritable("postgresql://u:p@db.example.supabase.co:5432/postgres", false)).toThrow(/allow-remote/);
    expect(() => assertWritable("postgresql://u:p@db.example.supabase.co:5432/postgres", true)).not.toThrow();
    expect(() => assertWritable(undefined, true)).toThrow();
  });
});

describe("assertWritable hardening", () => {
  it.each([
    "postgresql://u:p@localhost/db?host=remote.example",
    "postgresql://u:p@localhost/db?HOST=remote.example",
    "postgresql://u:p@127.0.0.1/db?hostaddr=1.2.3.4",
    "postgresql://u:p@localhost,remote.example/db",
    "postgresql://u:p@127.0.0.1:1,remote.example:2/db",
    "postgresql://u:p@127.0.0.1.evil.com/db",
    "postgresql://localhost:x@evil.com/db",
    "postgresql://u:p@evil.com/localhost",
    "postgresql://u:p@evil.com/db?x=127.0.0.1",
    "",
    "not a url",
  ])("refuses %j", (u) => {
    expect(() => assertWritable(u, false)).toThrow();
  });
  it("still allows a local URL with harmless query", () => {
    expect(() => assertWritable("postgresql://u:p@localhost:5432/db?sslmode=disable", false)).not.toThrow();
  });
});

describe("refuseResult", () => {
  it("refuses empty and mostly-dropped reads", () => {
    expect(refuseResult(0, 0)).toMatch(/nothing/);
    expect(refuseResult(3, 4)).toMatch(/dropped 4.*kept only 3/);
    expect(refuseResult(3, 3)).toBeNull();
    expect(refuseResult(50, 0)).toBeNull();
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
