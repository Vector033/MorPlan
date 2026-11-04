// Students ask in everyday words; the regulations use formal ones. Rewriting
// the question to the document vocabulary helps BM25, the coverage signal and
// (slightly) the embedding. Longest phrases first so "เกรดเฉลี่ยสะสม" wins over "เกรด".
const RULES: [RegExp, string][] = [
  [/เกรดเฉลี่ยสะสม|gpax|จีพีเอเอ็กซ์/gi, "ค่าลำดับขั้นสะสมเฉลี่ย"],
  [/เกรดเฉลี่ย|gpa|จีพีเอ/gi, "ค่าลำดับขั้นสะสมเฉลี่ย"],
  [/เกรด/g, "อักษรลำดับขั้น"],
  [/ค่าเทอม/g, "ค่าธรรมเนียมการศึกษา"],
  [/ซัมเมอร์|summer/gi, "ภาคฤดูร้อน"],
  [/มิดเทอม|midterm/gi, "สอบกลางภาค"],
  [/ไฟนอล|final/gi, "สอบไล่"],
  [/เทอม/g, "ภาคการศึกษา"],
  [/เปอร์เซ็นต์|เปอร์เซนต์|%/g, " ร้อยละ "],
  [/โดนรีไทร์|รีไทร์|retire|โดนไล่ออก/gi, "พ้นสภาพนักศึกษา"],
  [/ดรอปเรียน|ดรอปเทอม|พักการเรียน/g, "ลาพักการศึกษา"],
  [/ดรอป|drop/gi, "ถอนกระบวนวิชา"],
  [/ติด\s*w\b/gi, "อักษรลำดับขั้น W"],
  [/ลงเรียน/g, "ลงทะเบียนกระบวนวิชา"],
  [/(?<!กระบวน)วิชา/g, "กระบวนวิชา"],
  [/เซค|เซก|sec(tion)?\b/gi, "ตอน"],
  [/เรียนจบ|จบการศึกษา/g, "สำเร็จการศึกษา"],
  [/ลอกข้อสอบ|โกงข้อสอบ|โกงสอบ|ลอกเพื่อน/g, "ทุจริตในการสอบ"],
  [/มาสาย/g, "เข้าสอบช้า"],
  [/รหัสนักศึกษา|บัตร\s*นศ\.?/g, "บัตรประจำตัวนักศึกษา"],
  [/ปีหนึ่ง|ปี\s*1\b/g, "ชั้นปีที่ 1"],
];

export function rewriteQuery(q: string): string {
  let out = q;
  for (const [re, to] of RULES) out = out.replace(re, to);
  return out.replace(/\s+/g, " ").trim();
}
