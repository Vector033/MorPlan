import { describe, expect, it } from "vitest";
import { mergeOptions, programOptions } from "./programs";

describe("programOptions", () => {
  it("lists a TCAS university's faculties and a faculty's majors, however the names are written", () => {
    expect(programOptions("มช")).toContain("วิทยาศาสตร์");
    expect(programOptions("มหาวิทยาลัยเชียงใหม่", "คณะวิทยาศาสตร์")).toContain("วิทยาการคอมพิวเตอร์");
    expect(programOptions("มหาวิทยาลัยที่ไม่มีอยู่จริง")).toEqual([]);
    expect(programOptions("มหาวิทยาลัยเชียงใหม่", "คณะที่ไม่มี")).toEqual([]);
  });
});

describe("mergeOptions", () => {
  it("keeps a name written two ways once, in Thai order", () => {
    expect(mergeOptions(["วิทยาศาสตร์", "เกษตรศาสตร์"], ["คณะวิทยาศาสตร์", "นิติศาสตร์"])).toEqual(["เกษตรศาสตร์", "นิติศาสตร์", "วิทยาศาสตร์"]);
  });
});
