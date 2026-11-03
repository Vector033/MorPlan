# OCR + PDF text extraction for the regulation corpus. Run via ingest/run.ps1 or:
#   docker build -t morplan-ingest ingest && docker run --rm -v "$PWD/data:/data" morplan-ingest
FROM python:3.12-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# tessdata_best is noticeably more accurate on Thai than the distro's model.
RUN curl -fsSL -o /usr/share/tesseract-ocr/5/tessdata/tha.traineddata \
      https://github.com/tesseract-ocr/tessdata_best/raw/main/tha.traineddata \
 && curl -fsSL -o /usr/share/tesseract-ocr/5/tessdata/eng.traineddata \
      https://github.com/tesseract-ocr/tessdata_best/raw/main/eng.traineddata

RUN pip install --no-cache-dir pymupdf==1.28.2 pytesseract==0.3.13 pillow

WORKDIR /app
COPY extract.py normalize.py ./
ENTRYPOINT ["python", "extract.py", "--data", "/data"]
