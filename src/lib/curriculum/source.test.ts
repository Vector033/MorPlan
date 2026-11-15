import { describe, expect, it } from "vitest";
import { MAX_SOURCE_BYTES, SourceError, curriculumLinks, readPasted, readPdf, readUrl } from "./source";

const web = (pages: Record<string, [number, Record<string, string>, string?]>) => {
  const fetchFn = (async (input: RequestInfo | URL) => {
    const [status, headers, body] = pages[String(input)] ?? [404, {}];
    return new Response(body ?? null, { status, headers });
  }) as typeof fetch;
  return { fetchFn };
};

// A minimal one-page PDF with no text, with a correct xref table.
const blankPdf = () => {
  const objs = ["<</Type/Catalog/Pages 2 0 R>>", "<</Type/Pages/Kids[3 0 R]/Count 1>>", "<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>"];
  let out = "%PDF-1.4\n";
  const offs = objs.map((o, i) => {
    const at = out.length;
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return at;
  });
  const xref = out.length;
  out += `xref\n0 4\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<</Size 4/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
};

describe("readUrl", () => {
  it("turns an HTML page into text with its title", async () => {
    const { fetchFn } = web({ "https://cs.x.ac.th/plan": [200, { "content-type": "text/html" }, `<title>แผนการศึกษา</title><table><tr><td>204315</td><td>Organization of Programming Languages</td><td>3</td></tr></table>${"<p>ชั้นปีที่ 1</p>".repeat(20)}`] });
    const s = await readUrl("https://cs.x.ac.th/plan", fetchFn);
    expect(s).toMatchObject({ kind: "html", title: "แผนการศึกษา" });
    expect(s.text).toContain("204315");
  });
  it("decodes entities in a page title", async () => {
    const { fetchFn } = web({ "https://cs.x.ac.th/t": [200, { "content-type": "text/html" }, `<title>หลักสูตร &#8211; คณะ &amp; สาขา</title><p>x</p>${"<p>ชั้นปีที่ 1</p>".repeat(20)}`] });
    expect((await readUrl("https://cs.x.ac.th/t", fetchFn)).title).toBe("หลักสูตร – คณะ & สาขา");
  });
  it("rejects non-academic, unreachable, oversized and unsupported sources with typed errors", async () => {
    const big = "x".repeat(MAX_SOURCE_BYTES + 1);
    const { fetchFn } = web({
      "https://cs.x.ac.th/big": [200, { "content-type": "text/html", "content-length": String(MAX_SOURCE_BYTES + 1) }, "x"],
      "https://cs.x.ac.th/big2": [200, { "content-type": "text/html" }, big],
      "https://cs.x.ac.th/img": [200, { "content-type": "image/png" }, "x"],
    });
    await expect(readUrl("https://example.com/", fetchFn)).rejects.toMatchObject({ code: "not-academic" });
    await expect(readUrl("https://cs.x.ac.th/missing", fetchFn)).rejects.toMatchObject({ code: "unreachable" });
    await expect(readUrl("https://cs.x.ac.th/big", fetchFn)).rejects.toMatchObject({ code: "too-large" });
    await expect(readUrl("https://cs.x.ac.th/big2", fetchFn)).rejects.toMatchObject({ code: "too-large" });
    await expect(readUrl("https://cs.x.ac.th/img", fetchFn)).rejects.toMatchObject({ code: "unsupported" });
  });
  it("sniffs a PDF served without a type and reports no-text for it", async () => {
    const { fetchFn } = web({ "https://cs.x.ac.th/a/tqf2.pdf": [200, { "content-type": "application/octet-stream" }, new TextDecoder("latin1").decode(blankPdf())] });
    await expect(readUrl("https://cs.x.ac.th/a/tqf2.pdf", fetchFn)).rejects.toMatchObject({ code: "no-text" });
  });
});

describe("readUrl charset and body release", () => {
  // "หลักสูตร 204315" in windows-874 / tis-620.
  const thai = new Uint8Array([0xcb, 0xc5, 0xd1, 0xa1, 0xca, 0xd9, 0xb5, 0xc3, 0x20, ...new TextEncoder().encode("204315")]);
  const bytes = (head: string, body: Uint8Array) => new Uint8Array([...new TextEncoder().encode(head), ...body]);
  const serve = (headers: Record<string, string>, body: Uint8Array, onCancel?: () => void, onPull?: () => void) =>
    (async () => {
      let sent = false;
      const stream = new ReadableStream<Uint8Array>({
        pull(c) {
          onPull?.();
          if (sent) return c.close();
          sent = true;
          c.enqueue(body);
        },
        cancel: () => onCancel?.(),
      });
      return new Response(stream, { status: 200, headers });
    }) as unknown as typeof fetch;

  it("decodes windows-874 from the header, from <meta>, and falls back to UTF-8 on an unknown label", async () => {
    const h = await readUrl("https://cs.x.ac.th/a", serve({ "content-type": "text/html; charset=windows-874" }, bytes("<p>", thai)));
    expect(h.text).toContain("หลักสูตร 204315");
    const m = await readUrl("https://cs.x.ac.th/a", serve({ "content-type": "text/html" }, bytes('<meta charset="tis-620"><p>', thai)));
    expect(m.text).toContain("หลักสูตร 204315");
    const u = await readUrl("https://cs.x.ac.th/a", serve({ "content-type": "text/html; charset=nonsense" }, new TextEncoder().encode("<p>หลักสูตร</p>")));
    expect(u.text).toContain("หลักสูตร");
  });
  it("cancels the body when content-length is too large", async () => {
    let cancelled = false;
    const f = serve({ "content-type": "text/html", "content-length": String(MAX_SOURCE_BYTES + 1) }, new Uint8Array([1]), () => (cancelled = true));
    await expect(readUrl("https://cs.x.ac.th/a", f)).rejects.toMatchObject({ code: "too-large" });
    expect(cancelled).toBe(true);
  });
  it("rejects an image by type without reading its body", async () => {
    let cancelled = false;
    let pulls = 0;
    const f = serve({ "content-type": "image/png" }, new Uint8Array([1]), () => (cancelled = true), () => pulls++);
    await expect(readUrl("https://cs.x.ac.th/a", f)).rejects.toMatchObject({ code: "unsupported" });
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThanOrEqual(1); // the stream's initial fill only; nothing consumed
  });
});

describe("readPdf and readPasted", () => {
  it("rejects a PDF with no text layer", async () => {
    await expect(readPdf(blankPdf(), "scan.pdf")).rejects.toMatchObject({ code: "no-text" });
  });
  it("rejects pasted text that is too short, accepts enough", () => {
    expect(() => readPasted("204315")).toThrow(SourceError);
    expect(readPasted("ก".repeat(300))).toMatchObject({ kind: "text" });
  });
});

describe("curriculumLinks", () => {
  it("keeps curriculum-looking academic links, resolves relative ones, drops the rest", () => {
    const html = `<a href="/program/">หลักสูตร</a><a href="tqf2-com-64.pdf">มคอ. 2</a><a href="https://facebook.com/x">หลักสูตร</a><a href="/news">ข่าว</a><a href="/program/">หลักสูตร</a>`;
    expect(curriculumLinks(html, "https://cs.x.ac.th/home/")).toEqual([{ url: "https://cs.x.ac.th/program/", label: "หลักสูตร" }, { url: "https://cs.x.ac.th/home/tqf2-com-64.pdf", label: "มคอ. 2" }]);
  });
});
