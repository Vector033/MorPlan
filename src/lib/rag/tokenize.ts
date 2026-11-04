const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";
const segmenter = new Intl.Segmenter("th", { granularity: "word" });

/** Thai digits → Arabic, lower-case Latin, NFC. Applied to both queries and passages. */
export function normalizeForSearch(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)))
    .toLowerCase();
}

// Very common function words that carry no meaning for retrieval.
const STOP = new Set([
  "และ", "หรือ", "ที่", "ของ", "ใน", "ให้", "ได้", "เป็น", "การ", "ความ", "ไม่", "มี", "จะ", "ซึ่ง", "โดย", "แต่", "กับ",
  "แล้ว", "นั้น", "นี้", "ถ้า", "ว่า", "ก็", "อยู่", "ไป", "มา", "คือ", "เพื่อ", "จาก", "ต่อ", "ไหม", "มั้ย", "ครับ", "ค่ะ", "คะ",
  "อะไร", "ยังไง", "อย่างไร", "บ้าง", "เท่าไหร่", "เท่าไร", "the", "of", "and", "a", "to",
]);

/**
 * Word tokens for BM25. Thai has no spaces between words, so this uses ICU's
 * dictionary segmentation (Intl.Segmenter). Numbers are kept as tokens
 * because questions often hinge on them (credits, GPA, dates).
 */
export function tokenize(s: string): string[] {
  const out: string[] = [];
  for (const seg of segmenter.segment(normalizeForSearch(s))) {
    if (!seg.isWordLike) continue;
    const w = seg.segment.trim();
    if (!w || STOP.has(w)) continue;
    out.push(w);
  }
  return out;
}
