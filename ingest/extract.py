"""Download the corpus in data/docs.json and write data/pages.jsonl (one line per PDF page).

Every page is rendered and OCR'd with Tesseract (tha+eng). The central regulations are
scanned images, and the PDFs that do have a text layer lose tone marks through broken
font maps, so OCR'ing everything gives one consistent quality level. Two-column
tables (the academic calendar) need page segmentation mode 6 ("psm": 6 in
docs.json) so each label stays on the same line as its date.
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


def ocr_page(page: pymupdf.Page, dpi: int, psm: int) -> str:
    pix = page.get_pixmap(dpi=dpi)
    img = Image.open(io.BytesIO(pix.tobytes("png")))
    return pytesseract.image_to_string(img, lang="tha+eng", config=f"--psm {psm} -c preserve_interword_spaces=1")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data")
    ap.add_argument("--dpi", type=int, default=300)
    ap.add_argument("--only", help="comma-separated doc ids")
    ap.add_argument("--renormalize", action="store_true", help="re-run text clean-up on pages.jsonl without OCR")
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

    if args.renormalize:
        rows = [dict(r, text=normalize_thai(r["text"])) for d in docs for r in existing.get(d["id"], [])]
        write(out_path, rows)
        return

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
            text = normalize_thai(ocr_page(page, args.dpi, doc.get("psm", 3)))
            rows.append({"docId": doc["id"], "page": i + 1, "text": text, "method": "ocr"})
            print(f"{doc['id']} p{i + 1}/{len(d)} {len(text)} chars {time.time() - started:.1f}s", flush=True)

    write(out_path, rows)


def write(out_path: Path, rows: list[dict]) -> None:
    with out_path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    # Same pages as a JSON array (one page per line) for the app to import at build time.
    with out_path.with_suffix(".json").open("w", encoding="utf-8", newline="\n") as f:
        body = ",\n".join(json.dumps({k: r[k] for k in ("docId", "page", "text")}, ensure_ascii=False) for r in rows)
        f.write("[\n" + body + "\n]\n")
    print(f"wrote {len(rows)} pages to {out_path} and {out_path.with_suffix('.json')}")


if __name__ == "__main__":
    main()
