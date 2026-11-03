"""Download the corpus in data/docs.json and write data/pages.jsonl (one line per PDF page).

Every page is rendered and OCR'd with Tesseract (tha+eng). The central regulations are
scanned images, and the PDFs that do have a text layer lose tone marks through broken
font maps, so OCR'ing everything gives one consistent quality level.
"""
import argparse
import io
import json
import time
import urllib.request
from pathlib import Path

import pymupdf
import pytesseract
from PIL import Image

from normalize import normalize_thai

UA = "MorPlan-ingest/0.1 (student project; contact via github.com/Vector033/MorPlan)"


def fetch(url: str, dest: Path) -> None:
    if dest.exists():
        return
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        dest.write_bytes(r.read())
    time.sleep(2)  # be polite to reg.cmu.ac.th


def ocr_page(page: pymupdf.Page, dpi: int) -> str:
    pix = page.get_pixmap(dpi=dpi)
    img = Image.open(io.BytesIO(pix.tobytes("png")))
    return pytesseract.image_to_string(img, lang="tha+eng", config="--psm 3 -c preserve_interword_spaces=1")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data")
    ap.add_argument("--dpi", type=int, default=300)
    ap.add_argument("--only", help="comma-separated doc ids")
    args = ap.parse_args()

    data = Path(args.data)
    raw = data / "raw"
    raw.mkdir(exist_ok=True)
    docs = json.loads((data / "docs.json").read_text(encoding="utf-8"))
    only = set(args.only.split(",")) if args.only else None

    out_path = data / "pages.jsonl"
    existing = {}
    if out_path.exists():
        for line in out_path.read_text(encoding="utf-8").splitlines():
            row = json.loads(line)
            existing.setdefault(row["docId"], []).append(row)

    rows = []
    for doc in docs:
        if only and doc["id"] not in only:
            rows.extend(existing.get(doc["id"], []))
            continue
        pdf = raw / f"{doc['id']}.pdf"
        fetch(doc["url"], pdf)
        d = pymupdf.open(pdf)
        for i, page in enumerate(d):
            started = time.time()
            text = normalize_thai(ocr_page(page, args.dpi))
            rows.append({"docId": doc["id"], "page": i + 1, "text": text, "method": "ocr"})
            print(f"{doc['id']} p{i + 1}/{len(d)} {len(text)} chars {time.time() - started:.1f}s", flush=True)

    with out_path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"wrote {len(rows)} pages to {out_path}")


if __name__ == "__main__":
    main()
