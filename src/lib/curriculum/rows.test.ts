import { describe, expect, it, vi } from "vitest";
import { mergeElectives, mergeRange, parseData, readRow, universityKey, type Row } from "./rows";

const curriculum = {
  title: "หลักสูตร",
  university: "u",
  faculty: "f",
  major: "m",
  cohortFrom: 64,
  plans: [{ id: "p1", name: "ปกติ", terms: [{ year: 1, semester: 1, items: [{ type: "course", courseNo: "204111", title: "Intro", credits: 3 }] }] }],
  electives: {},
};
const row = (over: Partial<Row>): Row => ({
  id: "abc",
  kind: "curriculum",
  status: "shared",
  uniKey: "u",
  facultyKey: "f",
  majorKey: "m",
  university: "u",
  faculty: "f",
  major: "m",
  cohortFrom: 64,
  cohortTo: null,
  parentId: null,
  data: curriculum,
  sourceUrl: null,
  sourceTitle: "t",
  provenance: "owner",
  createdAt: new Date(),
  readAt: new Date(),
  ...over,
});

describe("readRow", () => {
  it("passes a good row with its meta", () => {
    const r = readRow(row({}));
    expect(r?.meta).toMatchObject({ id: "abc", title: "หลักสูตร", cohortFrom: 64 });
  });
  it("skips a malformed row and logs only its id", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(readRow(row({ data: { title: "x", plans: "nope" } }))).toBeNull();
    expect(readRow(row({ kind: "minors", data: { not: "an array" } }))).toBeNull();
    expect(warn).toHaveBeenCalledWith("curricula: skipping unreadable row abc");
    warn.mockRestore();
  });
});

describe("parseData", () => {
  it("throws on data that does not match the kind", () => {
    expect(() => parseData("electives", [{ courseNo: "bad code!" }])).toThrow();
    expect(parseData("electives", [{ courseNo: "204111", title: "x" }])).toHaveLength(1);
  });
});

describe("mergeRange", () => {
  it("keeps current values the caller does not override", () => {
    expect(mergeRange({ from: 64, to: 66 }, {})).toEqual({ from: 64, to: 66 });
    expect(mergeRange({ from: 64 }, { to: 66 })).toEqual({ from: 64, to: 66 });
  });
  it("allows an open-ended range", () => {
    expect(mergeRange({ from: 64 }, { from: 65 })).toEqual({ from: 65, to: undefined });
  });
  it("refuses a range that ends before it starts", () => {
    expect(mergeRange({ from: 20, to: 20 }, { from: 25 })).toBeNull();
    expect(mergeRange({ from: 20, to: 25 }, { to: 19 })).toBeNull();
  });
});

describe("row bounds", () => {
  it("bounds an over-long source title and skips a row with an over-long url", () => {
    const r = readRow(row({ sourceTitle: `  ${"ก".repeat(300)}
` }));
    expect(r?.meta.sourceTitle).toHaveLength(200);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(readRow(row({ sourceUrl: `https://x.ac.th/${"a".repeat(500)}` }))).toBeNull();
  });
});

describe("universityKey", () => {
  it("gives every CMU spelling the key of the Thai name, and leaves an empty name alone", () => {
    const cmu = universityKey("มหาวิทยาลัยเชียงใหม่");
    for (const n of ["มช", "มช.", "CMU", " cmu "]) expect(universityKey(n)).toBe(cmu);
    expect(universityKey("")).not.toBe(cmu);
    expect(universityKey("มหาวิทยาลัยมหิดล")).not.toBe(cmu);
  });
});

describe("mergeElectives", () => {
  const list = (...codes: string[]) => codes.map((courseNo) => ({ courseNo, title: courseNo }));
  const child = (provenance: "link" | "owner", ...codes: string[]) => ({ meta: { provenance }, data: list(...codes) });
  it("merges only children whose provenance matches the parent's, first copy of a code wins", () => {
    const kids = [child("link", "204311", "204312"), child("owner", "204313")];
    expect(mergeElectives({ provenance: "link", own: list("204311") }, kids).map((c) => c.courseNo)).toEqual(["204311", "204312"]);
    expect(mergeElectives({ provenance: "owner", own: list("204310") }, kids).map((c) => c.courseNo)).toEqual(["204310", "204313"]);
  });
  it("caps the merged list", () => {
    const many = (from: number) => Array.from({ length: 300 }, (_, i) => String(300000 + from + i));
    expect(mergeElectives({ provenance: "link", own: list(...many(0)) }, [child("link", ...many(300))])).toHaveLength(400);
  });
});
