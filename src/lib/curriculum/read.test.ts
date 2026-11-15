import { describe, expect, it, vi, type Mock } from "vitest";
import type { LlmProvider } from "@/lib/rag/llm";
import { LIST_MAX_CHUNKS, readDocument } from "./read";

const meta = { university: "มหาวิทยาลัยเชียงใหม่", faculty: "วิทยาศาสตร์", major: "วิทยาการคอมพิวเตอร์", cohort: 64 };

const reply = (year: number, semester: number, courseNo: string) => ({
  title: "หลักสูตร",
  cohortFrom: null,
  cohortTo: null,
  plans: [{ name: "แผนปกติ", minCredits: null, terms: [{ year, semester, items: [{ courseNo, title: "Course", credits: 3, slot: null, note: null }] }] }],
});

const fake = (replies: unknown[]) =>
  ({ name: "fake", cost: () => 0, json: vi.fn(async () => ({ data: replies.shift()!, inputTokens: 0, outputTokens: 0 })) }) as unknown as LlmProvider;

describe("readDocument", () => {
  it("reads a chunked document, merges plans by name and checks evidence against the whole source", async () => {
    // Three paragraphs of ~9000 chars: each lands in its own 16000-char chunk and mentions a study-plan heading.
    const pad = (s: string) => `${s}\n${"x".repeat(9000)}`;
    const source = {
      text: [pad("ชั้นปีที่ 3 ภาคการศึกษาที่ 1\n204321 Database Systems 3"), pad("ชั้นปีที่ 3 ภาคการศึกษาที่ 2\n204315 Organization of Programming Languages 3"), pad("ชั้นปีที่ 4 ภาคการศึกษาที่ 1")].join("\n\n"),
      title: "แผนการศึกษา",
      kind: "text" as const,
    };
    const llm = fake([reply(3, 1, "204321"), reply(3, 2, "204315"), reply(4, 1, "999999")]);
    const r = await readDocument(llm, "curriculum", source, meta);
    if (r.kind !== "curriculum") throw new Error("kind");
    expect(llm.json).toHaveBeenCalledTimes(3);
    expect(r.data.plans).toHaveLength(1);
    expect(r.data.plans[0].terms.map((t) => [t.year, t.semester])).toEqual([[3, 1], [3, 2]]);
    expect(r.dropped).toEqual([expect.stringContaining("999999")]);
  });

  it("keeps the first copy of a term seen twice", async () => {
    const pad = (s: string) => `${s}\n${"x".repeat(9000)}`;
    const text = [pad("ชั้นปีที่ 3 ภาคการศึกษาที่ 1 204321"), pad("ชั้นปีที่ 3 ภาคการศึกษาที่ 1 204315")].join("\n\n");
    const r = await readDocument(fake([reply(3, 1, "204321"), reply(3, 1, "204315")]), "curriculum", { text, title: "t", kind: "text" }, meta);
    if (r.kind !== "curriculum") throw new Error("kind");
    expect(r.data.plans[0].terms).toHaveLength(1);
    expect(JSON.stringify(r.data.plans[0].terms[0])).toContain("204321");
  });

  it("sends redacted text to the model", async () => {
    const llm = fake([reply(3, 1, "204321")]);
    await readDocument(llm, "curriculum", { text: `ชั้นปีที่ 3 ภาคการศึกษาที่ 1 204321 ติดต่อ a@b.ac.th ${"y".repeat(200)}`, title: "t", kind: "text" }, meta);
    expect(JSON.stringify((llm.json as Mock).mock.calls[0])).not.toContain("a@b.ac.th");
  });

  it("merges minors by faculty and name and de-duplicates codes", async () => {
    const minor = (code: string) => ({ minors: [{ name: "คณิตศาสตร์", faculty: null, rules: "r", groups: [{ label: "A", minCredits: null, courses: [{ prefix: "206", numbers: ["101", code] }] }] }] });
    const pad = (s: string) => `${s}\n${"x".repeat(7000)}`;
    const text = [pad("206101 206102"), pad("206101 206103")].join("\n\n");
    const r = await readDocument(fake([minor("102"), minor("103")]), "minors", { text, title: "t", kind: "text" }, meta);
    if (r.kind !== "minors") throw new Error("kind");
    expect(r.data).toHaveLength(1);
    expect(r.data[0].groups).toHaveLength(1);
    expect(r.data[0].groups[0].courseNos).toEqual(["206101", "206102", "206103"]);
  });
});

describe("list reads are bounded", () => {
  const paras = (n: number) => Array.from({ length: n }, (_, i) => `20431${i} Elective ${i}\n${"x".repeat(11000)}`).join("\n\n");
  const source = (n: number) => ({ text: paras(n), title: "t", kind: "text" as const });

  it("refuses a source needing more than the chunk cap before any model call", async () => {
    for (const kind of ["electives", "minors"] as const) {
      const llm = fake([]);
      await expect(readDocument(llm, kind, source(LIST_MAX_CHUNKS + 1), meta)).rejects.toMatchObject({ code: "too-large" });
      expect(llm.json).not.toHaveBeenCalled();
    }
  });

  it("starts no further chunk calls after one fails", async () => {
    let calls = 0;
    const llm = {
      name: "fake",
      cost: () => 0,
      json: vi.fn(async () => {
        const n = ++calls;
        if (n === 1) throw new Error("model down");
        await new Promise((r) => setTimeout(r, 20));
        return { data: { courses: [] }, inputTokens: 0, outputTokens: 0 };
      }),
    } as unknown as LlmProvider;
    await expect(readDocument(llm, "electives", source(LIST_MAX_CHUNKS), meta)).rejects.toThrow("model down");
    await new Promise((r) => setTimeout(r, 60));
    expect(calls).toBeLessThan(LIST_MAX_CHUNKS); // the chunks already in flight finish, the rest never start
  });
});
