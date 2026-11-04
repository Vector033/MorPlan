"""Clean-up for Thai text from OCR and from PDFs with broken font maps."""
import re
import unicodedata

TONE = "่-๋"  # mai ek .. mai chattawa
UPPER = "ัิ-ฺ็-๎"  # vowels and marks written above/below the consonant
THAI = "฀-๿"


def normalize_thai(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    text = re.sub(r"[\u0000-\u0008\u000b\u000c\u000e-\u001f​‌‍﻿­]", "", text)
    # Decomposed sara am (nikhahit + sara aa) -> sara am.
    text = text.replace("ํา", "ำ")
    # Tone mark must come before sara am: น + ำ + ้  ->  น + ้ + ำ
    text = re.sub(rf"ำ([{TONE}])", r"\1" + "ำ", text)
    # Doubled marks from OCR.
    text = re.sub(rf"([{UPPER}])\1+", r"\1", text)
    # Tesseract sometimes puts a space before a mark or after a leading vowel.
    text = re.sub(rf" +([{UPPER}])", r"\1", text)
    text = re.sub(rf"([เ-ไ]) +([{THAI}])", r"\1\2", text)
    # Grade letters after "อักษรลำดับขั้น" are Latin; OCR reads them as look-alikes.
    text = re.sub(r"(อักษรลำดับขั้น)\s*[wWบ๒](?![A-Za-z])", r"\1 W", text)
    text = re.sub(r"(อักษรลำดับขั้น)\s*[|lI1](?![A-Za-z0-9])", r"\1 I", text)
    text = re.sub(r"(อักษรลำดับขั้น)\s*[vVง](?=\s|$)", r"\1 V", text)
    text = re.sub(r"(อักษรลำดับขั้น)\s*[pP](?![A-Za-z])", r"\1 P", text)
    text = text.replace("\r", "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
