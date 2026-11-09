import { describe, expect, it } from "vitest";
import { isCmu, verifyUniversity } from "./university";

const sources = [
  { title: "registrar.ku.ac.th", uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/a" },
  { title: "ku.ac.th", uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/b" },
];

describe("verifyUniversity", () => {
  it("keeps links on a source domain and drops invented ones", () => {
    const info = verifyUniversity(
      {
        officialName: " มหาวิทยาลัยเกษตรศาสตร์ ",
        registrarUrl: "https://registrar.ku.ac.th/",
        courseSearchUrl: "https://made-up-reg.example.com/search",
        courseCodeExample: "01204111",
      },
      sources,
    );
    expect(info.officialName).toBe("มหาวิทยาลัยเกษตรศาสตร์");
    expect(info.registrarUrl).toBe("https://registrar.ku.ac.th/");
    expect(info.courseSearchUrl).toBeUndefined();
    expect(info.courseCodeExample).toBe("01204111");
  });

  it("drops non-web schemes and malformed URLs", () => {
    const info = verifyUniversity({ officialName: "x", registrarUrl: "javascript:alert(1)", courseSearchUrl: "not a url" }, sources);
    expect(info.registrarUrl).toBeUndefined();
    expect(info.courseSearchUrl).toBeUndefined();
  });
});

describe("isCmu", () => {
  it("treats empty and CMU spellings as CMU", () => {
    for (const n of [undefined, "", "มช", "มช.", "CMU", "Chiang Mai University", "มหาวิทยาลัยเชียงใหม่"]) expect(isCmu(n)).toBe(true);
    expect(isCmu("มหาวิทยาลัยมหิดล")).toBe(false);
  });
});
