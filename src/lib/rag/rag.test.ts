import { describe, expect, it } from "vitest";
import { z } from "zod";
import { answerQuestion, bestSnippet } from "./answer";
import { Bm25Index } from "./bm25";
import { chunkPages, clauses, windows } from "./chunk";
import type { Embedder } from "./embed";
import { rrf } from "./fuse";
import type { LlmProvider } from "./llm";
import { MemoryDenseStore, Retrieval } from "./retrieve";
import { normalizeForSearch, tokenize } from "./tokenize";
import { NOT_FOUND, OFFICIAL_NOTICE, type Chunk, type DocMeta, type Page } from "./types";

describe("tokenize", () => {
  it("segments Thai words and drops function words", () => {
    const t = tokenize("นักศึกษาต้องมีเวลาเรียนไม่น้อยกว่าร้อยละ ๘๐");
    expect(t).toContain("นักศึกษา");
    expect(t).toContain("เวลา");
    expect(t).toContain("80");
    expect(t).not.toContain("ไม่");
  });
  it("maps Thai digits and lower-cases Latin", () => {
    expect(normalizeForSearch("ข้อ ๑๒ Grade W")).toBe("ข้อ 12 grade w");
  });
});

describe("chunking", () => {
  const text = [
    "ข้อบังคับมหาวิทยาลัยเชียงใหม่ ว่าด้วยการศึกษา",
    "ข้อ ๑ ข้อบังคับนี้เรียกว่า " + "ก".repeat(300),
    "ข้อ ๒ ให้ใช้บังคับ " + "ข".repeat(300),
    "ข้อ ๓ สั้น",
  ].join("\n");

  it("starts clause chunks at ข้อ N and merges tiny clauses", () => {
    const c = clauses(text);
    expect(c.some((x) => x.includes("ข้อ ๑") && x.startsWith("ข้อบังคับ"))).toBe(true);
    expect(c.some((x) => x.startsWith("ข้อ ๒"))).toBe(true);
    expect(c.some((x) => x.startsWith("ข้อ ๓"))).toBe(false); // merged into ข้อ ๒
  });

  it("windows long text with overlap and keeps every character covered", () => {
    const long = Array.from({ length: 300 }, (_, i) => `คำ${i}`).join(" ");
    const w = windows(long, 200, 50);
    expect(w.length).toBeGreaterThan(5);
    expect(w.every((x) => x.length <= 200)).toBe(true);
    for (const word of ["คำ0", "คำ150", "คำ299"]) expect(w.some((x) => x.includes(word))).toBe(true);
  });

  it("never crosses pages and gives stable ids", () => {
    const pages: Page[] = [
      { docId: "d", page: 1, text: "ข้อ ๑ " + "ฟ ".repeat(400) },
      { docId: "d", page: 2, text: "ข้อ ๒ " + "ห ".repeat(400) },
    ];
    for (const s of ["fixed", "clause", "paragraph"] as const) {
      const chunks = chunkPages(pages, s);
      expect(chunks.every((c) => (c.page === 1 ? !c.text.includes("ห") : !c.text.includes("ฟ")))).toBe(true);
      expect(new Set(chunks.map((c) => c.id)).size).toBe(chunks.length);
    }
  });
});

const chunk = (id: string, text: string, docId = "d", page = 1): Chunk => ({ id, strategy: "fixed", docId, page, text });

describe("Bm25Index", () => {
  it("ranks the chunk sharing rare terms first", () => {
    const idx = new Bm25Index([
      chunk("a", "การลงทะเบียนเรียน นักศึกษาลงทะเบียนได้ไม่เกิน 22 หน่วยกิต"),
      chunk("b", "การสอบ นักศึกษาต้องแต่งกายสุภาพ"),
      chunk("c", "ค่าธรรมเนียมการศึกษา"),
    ]);
    expect(idx.search("ลงทะเบียนได้กี่หน่วยกิต")[0].chunk.id).toBe("a");
    expect(idx.search("ไดโนเสาร์")).toEqual([]);
  });
});

describe("rrf", () => {
  it("sums reciprocal ranks across lists", () => {
    const [a, b, c] = [chunk("a", ""), chunk("b", ""), chunk("c", "")];
    const fused = rrf([
      [{ chunk: a, score: 9 }, { chunk: b, score: 1 }],
      [{ chunk: b, score: 0.9 }, { chunk: c, score: 0.8 }],
    ]);
    expect(fused.map((h) => h.chunk.id)).toEqual(["b", "a", "c"]);
    expect(fused[0].score).toBeCloseTo(1 / 62 + 1 / 61);
  });
});

describe("answerQuestion", () => {
  const pages: Page[] = [
    { docId: "reg", page: 3, text: "ข้อ ๑๐ นักศึกษาต้องมีเวลาเรียนไม่น้อยกว่าร้อยละ ๘๐ จึงจะมีสิทธิ์สอบ" },
    { docId: "fee", page: 2, text: "ค่าธรรมเนียมการศึกษาแบบเหมาจ่ายภาคการศึกษาละ ๑๕,๐๐๐ บาท" },
  ];
  const docs = new Map<string, DocMeta>([
    ["reg", { id: "reg", title: "ข้อบังคับ", kind: "regulation", url: "https://example.test/reg.pdf" }],
    ["fee", { id: "fee", title: "ค่าธรรมเนียม", kind: "regulation", url: "https://example.test/fee.pdf" }],
  ]);
  // Fake embedder: one dimension per topic word, so cosine is predictable.
  const topics = ["เวลาเรียน", "ค่าธรรมเนียม"];
  const fakeEmbedder: Embedder = {
    model: "fake",
    async embed(texts) {
      return texts.map((t) => {
        const v = topics.map((w) => (t.includes(w) ? 1 : 0));
        const n = Math.hypot(...v) || 1;
        return v.map((x) => x / n);
      });
    },
  };

  async function setup() {
    const r = new Retrieval(pages, docs, fakeEmbedder, new MemoryDenseStore([]));
    const chunks = r.chunksFor("fixed");
    const vecs = await fakeEmbedder.embed(chunks.map((c) => c.text), "passage");
    const store = new MemoryDenseStore(chunks.map((c, i) => ({ strategy: "fixed", model: "fake", id: c.id, embedding: vecs[i] })));
    return new Retrieval(pages, docs, fakeEmbedder, store);
  }

  const fakeLlm = (reply: { status: "answered" | "not_found"; answer: string; cited: number[] }): LlmProvider => ({
    name: "fake",
    cost: (i, o) => (i + o) / 1e6,
    async json<T>({ schema }: { schema: z.ZodType<T> }) {
      return { data: schema.parse(reply), inputTokens: 100, outputTokens: 20 };
    },
  });

  it("answers with a citation to the document page and always adds the notice", async () => {
    const r = await setup();
    const a = await answerQuestion("ต้องมีเวลาเรียนเท่าไหร่ถึงสอบได้", r, {
      strategy: "fixed",
      signal: "dense",
      threshold: 0.5,
      llm: fakeLlm({ status: "answered", answer: "ไม่น้อยกว่าร้อยละ 80", cited: [1] }),
    });
    expect(a.status).toBe("answered");
    expect(a.citations[0]).toMatchObject({ docId: "reg", page: 3, url: "https://example.test/reg.pdf#page=3" });
    expect(a.notice).toBe(OFFICIAL_NOTICE);
    expect(a.costUsd).toBeCloseTo(120 / 1e6);
  });

  it("says ไม่พบ without calling the model when nothing is similar enough", async () => {
    const r = await setup();
    let called = false;
    const llm: LlmProvider = { ...fakeLlm({ status: "answered", answer: "x", cited: [1] }), json: async () => ((called = true), Promise.reject()) };
    const a = await answerQuestion("หอพักราคาเท่าไหร่", r, { strategy: "fixed", signal: "dense", threshold: 0.5, llm });
    expect(a).toMatchObject({ status: "not_found", text: NOT_FOUND, citations: [], notice: OFFICIAL_NOTICE });
    expect(called).toBe(false);
  });

  it("passes the model's ไม่พบ through", async () => {
    const r = await setup();
    const a = await answerQuestion("ค่าธรรมเนียมหอพัก", r, {
      strategy: "fixed",
      signal: "dense",
      threshold: 0.1,
      llm: fakeLlm({ status: "not_found", answer: NOT_FOUND, cited: [] }),
    });
    expect(a.status).toBe("not_found");
  });

  it("falls back to extractive passages without a model", async () => {
    const r = await setup();
    const a = await answerQuestion("ค่าธรรมเนียมเท่าไหร่", r, { strategy: "fixed", signal: "dense", threshold: 0.5, llm: null });
    expect(a).toMatchObject({ status: "answered", mode: "extractive" });
    expect(a.citations[0].docId).toBe("fee");
  });
});

describe("Bm25Index.coverage", () => {
  it("is low when the question's key word never appears in the corpus", () => {
    const idx = new Bm25Index([chunk("a", "ค่าธรรมเนียมการศึกษาแบบเหมาจ่าย"), chunk("b", "การสอบกลางภาค")]);
    expect(idx.coverage("ค่าธรรมเนียมการศึกษา", "a")).toBeGreaterThan(0.9);
    expect(idx.coverage("ค่าหอพักเท่าไหร่", "a")).toBeLessThan(0.5);
  });
});

describe("bestSnippet", () => {
  it("picks the line that shares words with the question", () => {
    expect(bestSnippet("บรรทัดแรก\nค่าธรรมเนียม ๑๕,๐๐๐ บาท\nอื่น ๆ", "ค่าธรรมเนียมเท่าไหร่")).toMatch(/^ค่าธรรมเนียม/);
  });
});
