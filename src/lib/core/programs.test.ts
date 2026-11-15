import { describe, expect, it } from "vitest";
import { buildPrograms, facultyName, majorsOf } from "./programs";

const m = (program_name_th: string, field_name_th = "สาขาจาก TCAS") => majorsOf({ program_name_th, field_name_th });

describe("majorsOf", () => {
  it("reads the major after สาขาวิชา and splits rows that join programs", () => {
    expect(m("หลักสูตรวิทยาศาสตรบัณฑิต สาขาวิชาวิทยาการคอมพิวเตอร์")).toEqual(["วิทยาการคอมพิวเตอร์"]);
    expect(m("หลักสูตรวิทยาศาสตรบัณฑิต สาขาวิชาคณิตศาสตร์/หลักสูตรวิทยาศาสตรบัณฑิต สาขาวิชาสถิติ")).toEqual(["คณิตศาสตร์", "สถิติ"]);
    expect(m("วิศวกรรมศาสตรบัณฑิต สาขาวิชาวิศวกรรมยาง พอลิเมอร์ และปิโตรเคมี และ วิศวกรรมศาสตรบัณฑิต สาขาวิชาการออกแบบเชิงวิศวกรรม")).toEqual([
      "วิศวกรรมยาง พอลิเมอร์ และปิโตรเคมี",
      "การออกแบบเชิงวิศวกรรม",
    ]);
  });

  it("reads majors after degree abbreviations and inside a degree's brackets", () => {
    expect(m("วศ.บ. วิศวกรรมเครื่องกล")).toEqual(["วิศวกรรมเครื่องกล"]);
    expect(m("วท.บ.เทคโนโลยีสารสนเทศ")).toEqual(["เทคโนโลยีสารสนเทศ"]);
    expect(m("หลักสูตรครุศาสตรบัณฑิต (การศึกษาปฐมวัย)")).toEqual(["การศึกษาปฐมวัย"]);
  });

  it("drops track notes, tags and master's halves", () => {
    expect(m("หลักสูตรศิลปศาสตรบัณฑิต สาขาวิชาภาษาเพื่ออาชีพ (หลักสูตรนานาชาติ)")).toEqual(["ภาษาเพื่ออาชีพ"]);
    expect(m("วิศวกรรมศาสตรบัณฑิต สาขาวิชาวิศวกรรมระบบควบคุมและเครื่องมือวัด ปริญญาตรี 4 ปี")).toEqual(["วิศวกรรมระบบควบคุมและเครื่องมือวัด"]);
    expect(m("วิศวกรรมศาสตรบัณฑิต สาขาวิชาวิศวกรรมไฟฟ้า (SIIT)")).toEqual(["วิศวกรรมไฟฟ้า"]);
    expect(m("หลักสูตรบริหารธุรกิจบัณฑิต สาขาวิชาการบริหารธุรกิจ แขนงวิชาคอมพิวเตอร์ธุรกิจดิจิทัล")).toEqual(["การบริหารธุรกิจ"]);
    expect(m("ศศ.บ. สาขาวิชารัฐศาสตร์ และ ร.ม. รัฐศาสตร์")).toEqual(["รัฐศาสตร์"]);
  });

  it("falls back to the TCAS field when the name only gives the degree", () => {
    expect(m("แพทยศาสตรบัณฑิต", "แพทยศาสตร์")).toEqual(["แพทยศาสตร์"]);
    expect(m("น.บ. นิติศาสตรบัณฑิต (ภาคปกติ)", "นิติศาสตร์")).toEqual(["นิติศาสตร์"]);
    expect(m("หลักสูตรวิทยาศาสตรบัณฑิต สาขาวิชาวิทยาศาสตรบัณฑิต", "วิทยาศาสตร์ทั่วไป")).toEqual(["วิทยาศาสตร์ทั่วไป"]);
  });
});

describe("buildPrograms", () => {
  it("groups by university and faculty without คณะ, sorted and without duplicates", () => {
    const row = (faculty_name_th: string, program_name_th: string) => ({ university_name_th: "มหาวิทยาลัยเชียงใหม่", faculty_name_th, program_name_th, field_name_th: "x" });
    expect(
      buildPrograms([
        row("คณะวิทยาศาสตร์", "วท.บ. สถิติ"),
        row("คณะวิทยาศาสตร์", "หลักสูตรวิทยาศาสตรบัณฑิต สาขาวิชาคณิตศาสตร์/หลักสูตรวิทยาศาสตรบัณฑิต สาขาวิชาสถิติ"),
        row("คณะเกษตรศาสตร์", "วท.บ. พืชศาสตร์"),
      ]),
    ).toEqual({ มหาวิทยาลัยเชียงใหม่: { เกษตรศาสตร์: ["พืชศาสตร์"], วิทยาศาสตร์: ["คณิตศาสตร์", "สถิติ"] } });
    expect(facultyName(" คณะ วิศวกรรมศาสตร์ ")).toBe("วิศวกรรมศาสตร์");
  });
});
