import { describe, expect, it } from "vitest";
import { academicUrl, fetchAcademic, isCmu, linkAlive, verifyUniversity } from "./university";

describe("academicUrl", () => {
  it("accepts Thai academic hosts only", () => {
    expect(academicUrl("https://registrar.ku.ac.th/")).toBe("https://registrar.ku.ac.th/");
    expect(academicUrl("http://reg.example.ac.th/search?x=1")).toBe("http://reg.example.ac.th/search?x=1");
    expect(academicUrl("https://www.au.edu/registrar")).toBe("https://www.au.edu/registrar");
    for (const bad of [
      "https://made-up-reg.example.com/search",
      "https://ku.ac.th.evil.com/",
      "https://au.edu.evil.com/",
      "https://evil-edu/",
      "https://user@au.edu/",
      "https://evil.com/?u=ku.ac.th",
      "https://user:pw@ku.ac.th/",
      "https://ku.ac.th:8443/",
      "https://127.0.0.1/",
      "javascript:alert(1)",
      "not a url",
      "",
      null,
    ])
      expect(academicUrl(bad), String(bad)).toBeUndefined();
  });
});

describe("linkAlive", () => {
  // A tiny fake web: path → [status, location].
  const web = (pages: Record<string, [number, string?]>) => {
    const seen: string[] = [];
    const fetchFn = (async (input: RequestInfo | URL) => {
      const url = String(input);
      seen.push(url);
      const [status, location] = pages[url] ?? [404];
      return new Response(null, { status, headers: location ? { location } : {} });
    }) as typeof fetch;
    return { fetchFn, seen };
  };

  it("is true for a page that answers 200, false for 404", async () => {
    const { fetchFn } = web({ "https://reg.x.ac.th/": [200] });
    expect(await linkAlive("https://reg.x.ac.th/", fetchFn)).toBe(true);
    expect(await linkAlive("https://reg.x.ac.th/made-up.asp", fetchFn)).toBe(false);
  });

  it("follows a redirect that stays on an academic host", async () => {
    const { fetchFn } = web({ "http://reg.x.ac.th/": [301, "https://reg.x.ac.th/th/"], "https://reg.x.ac.th/th/": [200] });
    expect(await linkAlive("http://reg.x.ac.th/", fetchFn)).toBe(true);
  });

  it("never follows a redirect off .ac.th, and gives up on a loop", async () => {
    const off = web({ "https://reg.x.ac.th/": [302, "http://169.254.169.254/latest/meta-data"] });
    expect(await linkAlive("https://reg.x.ac.th/", off.fetchFn)).toBe(false);
    expect(off.seen).toEqual(["https://reg.x.ac.th/"]);
    const loop = web({ "https://reg.x.ac.th/": [302, "/"] });
    expect(await linkAlive("https://reg.x.ac.th/", loop.fetchFn)).toBe(false);
    expect(loop.seen).toHaveLength(4);
  });

  it("does not fetch a non-academic URL at all", async () => {
    const { fetchFn, seen } = web({});
    expect(await linkAlive("https://example.com/", fetchFn)).toBe(false);
    expect(seen).toEqual([]);
  });
});

describe("verifyUniversity", () => {
  const reply = {
    officialName: " มหาวิทยาลัยเกษตรศาสตร์ ",
    registrarUrl: "https://registrar.ku.ac.th/",
    courseSearchUrl: "https://made-up-reg.example.com/search",
    courseCodeExample: "01204111",
  };

  it("keeps a live academic link and never probes a non-academic one", async () => {
    const probed: string[] = [];
    const info = await verifyUniversity(reply, async (url) => {
      probed.push(url);
      return true;
    });
    expect(info.officialName).toBe("มหาวิทยาลัยเกษตรศาสตร์");
    expect(info.registrarUrl).toBe("https://registrar.ku.ac.th/");
    expect(info.courseSearchUrl).toBeUndefined();
    expect(info.courseCodeExample).toBe("01204111");
    expect(probed).toEqual(["https://registrar.ku.ac.th/"]);
  });

  it("drops an academic link that does not answer", async () => {
    const info = await verifyUniversity(reply, async () => false);
    expect(info.registrarUrl).toBeUndefined();
    expect(info.homeUrl).toBeUndefined();
  });

  it("falls back to the university home page when the registrar host was a wrong guess", async () => {
    const info = await verifyUniversity({ officialName: "x", registrarUrl: "https://www.reg.ku.ac.th/" }, async (url) => url === "https://www.ku.ac.th/");
    expect(info.registrarUrl).toBeUndefined();
    expect(info.homeUrl).toBe("https://www.ku.ac.th/");
  });

  it("gives no home page when a real link was confirmed", async () => {
    const info = await verifyUniversity(reply, async () => true);
    expect(info.homeUrl).toBeUndefined();
  });
});

describe("isCmu", () => {
  it("knows CMU spellings and never assumes CMU when no university is chosen", () => {
    for (const n of ["มช", "มช.", "CMU", "Chiang Mai University", "มหาวิทยาลัยเชียงใหม่"]) expect(isCmu(n)).toBe(true);
    for (const n of [undefined, null, "", "มหาวิทยาลัยมหิดล"]) expect(isCmu(n)).toBe(false);
  });
});

describe("fetchAcademic", () => {
  // A tiny fake web: URL → [status, headers, body].
  const web = (pages: Record<string, [number, Record<string, string>, string?]>) => {
    const seen: string[] = [];
    const fetchFn = (async (input: RequestInfo | URL) => {
      const url = String(input);
      seen.push(url);
      const [status, headers, body] = pages[url] ?? [404, {}];
      return new Response(body ?? null, { status, headers });
    }) as typeof fetch;
    return { fetchFn, seen };
  };

  it("returns the final response after an on-domain redirect and null off-domain", async () => {
    const ok = web({ "http://cs.x.ac.th/": [301, { location: "https://cs.x.ac.th/th/" }], "https://cs.x.ac.th/th/": [200, {}, "hi"] });
    expect(await (await fetchAcademic("http://cs.x.ac.th/", ok.fetchFn))!.text()).toBe("hi");
    const off = web({ "https://cs.x.ac.th/": [302, { location: "http://169.254.169.254/" }] });
    expect(await fetchAcademic("https://cs.x.ac.th/", off.fetchFn)).toBeNull();
    expect(off.seen).toEqual(["https://cs.x.ac.th/"]);
    expect(await fetchAcademic("https://example.com/", ok.fetchFn)).toBeNull();
  });
});
