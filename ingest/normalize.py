"""Clean-up for Thai text from OCR and from PDFs with broken font maps."""
import re
import unicodedata

TONE = "\u0e48-\u0e4b"  # mai ek .. mai chattawa
THAI = "\u0e00-\u0e7f"


def normalize_thai(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    text = re.sub("[\u200b\u200c\u200d\ufeff\u00ad]", "", text)
    # Decomposed sara am (nikhahit + sara aa) -> sara am.
    text = text.replace("\u0e4d\u0e32", "\u0e33")
    # Tone mark must come before sara am: น + ำ + ้  ->  น + ้ + ำ
    text = re.sub(f"\u0e33([{TONE}])", "\1\u0e33", text)
    # Doubled combining marks from OCR.
    text = re.sub(f"([{TONE}\u0e31\u0e34-\u0e3a\u0e47\u0e4c\u0e4d])\1+", "\1", text)
    # Tesseract sometimes puts a space before a combining mark or after a leading vowel.
    text = re.sub(f" +([\u0e31\u0e34-\u0e3a\u0e47-\u0e4e])", "\1", text)
    text = re.sub(f"([\u0e40-\u0e44]) +([{THAI}])", "\1\2", text)
    text = text.replace("\r", "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
