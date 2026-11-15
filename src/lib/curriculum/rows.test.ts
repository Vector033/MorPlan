import { describe, expect, it, vi } from "vitest";
import { parseData, readRow, type Row } from "./rows";

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
