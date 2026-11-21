import { describe, expect, it } from "vitest";
import { toPages } from "@/lib/regulations/pages";
import { answerQuestion } from "./answer";
import { scopedRetrieval, type ScopedDoc } from "./scope";

const doc = (id: string, text: string, url = ""): ScopedDoc => ({ id, title: `ระเบียบ ${id}`, kind: "regulation", url, pages: [{ page: 1, text }] });
const A = doc("uni-a", "ข้อ 10 นักศึกษาต้องมีเวลาเรียนไม่น้อยกว่าร้อยละ 80 ของเวลาเรียนทั้งหมด จึงจะมีสิทธิ์สอบปลายภาค", "https://reg.a.ac.th/rules.pdf");
const B = doc("uni-b", "ข้อ 22 การลงทะเบียนภาคฤดูร้อนให้ลงทะเบียนได้ไม่เกิน 9 หน่วยกิต");
const opts = { strategy: "clause" as const, threshold: 0.535, signal: "coverage" as const, retriever: "bm25" as const, llm: null };

describe("scopedRetrieval", () => {
  it("answers only from the chosen university's documents", async () => {
    const onlyA = scopedRetrieval(null, [A]);
    const found = await answerQuestion("ต้องมีเวลาเรียนร้อยละเท่าไรถึงมีสิทธิ์สอบ", onlyA, opts);
    expect(found.status).toBe("answered");
    expect(found.citations[0]).toMatchObject({ docId: "uni-a", page: 1, url: "https://reg.a.ac.th/rules.pdf#page=1" });
    // University B's rule exists, but never in A's corpus.
    const other = await answerQuestion("ภาคฤดูร้อนลงทะเบียนได้กี่หน่วยกิต", onlyA, opts);
    expect(other.status).toBe("not_found");
    const inB = await answerQuestion("ภาคฤดูร้อนลงทะเบียนได้กี่หน่วยกิต", scopedRetrieval(null, [B]), opts);
    expect(inB.citations.map((c) => c.docId)).toEqual(["uni-b"]);
    // A private document has no link to open.
    expect(inB.citations[0].url).toBe("");
  });
});

describe("toPages", () => {
  it("keeps a PDF's page numbers and cuts other text into numbered parts", () => {
    expect(toPages("--- page 1 ---\nหน้าแรก\n--- page 2 ---\n\n--- page 3 ---\nหน้าสาม")).toEqual([
      { page: 1, text: "หน้าแรก" },
      { page: 3, text: "หน้าสาม" },
    ]);
    const parts = toPages(Array.from({ length: 30 }, (_, i) => `ย่อหน้า ${i} ${"ก".repeat(300)}`).join("\n\n"));
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.map((p) => p.page)).toEqual(parts.map((_, i) => i + 1));
  });
});
