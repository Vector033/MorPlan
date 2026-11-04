# RAG evaluation

170 questions (145 answerable, 25 unanswerable; 13 answerable ones have a key number the OCR misreads). Embeddings: `multilingual-e5-small-q8`. Run 2026-11-04.

## Retrieval (answerable questions, page-level)

| chunking | retriever | R@1 | R@3 | R@5 | R@10 | MRR | doc R@5 | evidence@3 | p50 ms | p95 ms |
|---|---|---|---|---|---|---|---|---|---|---|
| fixed | bm25 | 59.3% | 76.6% | 86.9% | 95.2% | 0.705 | 96.6% | 69.7% | 0 | 0 |
| fixed | dense | 54.5% | 71.0% | 77.9% | 90.3% | 0.649 | 93.8% | 57.2% | 22 | 23 |
| fixed | hybrid | 65.5% | 80.0% | 87.6% | 94.5% | 0.748 | 97.2% | 73.1% | 21 | 23 |
| clause | bm25 | 60.0% | 76.6% | 86.9% | 95.9% | 0.711 | 96.6% | 71.0% | 0 | 0 |
| clause | dense | 51.7% | 71.0% | 77.2% | 89.0% | 0.630 | 92.4% | 60.0% | 21 | 22 |
| clause | hybrid | 62.1% | 80.0% | 88.3% | 94.5% | 0.729 | 97.2% | 70.3% | 21 | 22 |
| paragraph | bm25 | 61.4% | 82.8% | 87.6% | 94.5% | 0.730 | 97.9% | 69.7% | 0 | 0 |
| paragraph | dense | 51.7% | 69.0% | 77.2% | 84.1% | 0.620 | 92.4% | 52.4% | 22 | 27 |
| paragraph | hybrid | 57.2% | 80.0% | 87.6% | 97.2% | 0.703 | 97.2% | 67.6% | 22 | 25 |

evidence@3: the gold quote appears verbatim in one of the top 3 chunks.

## "ไม่พบ" (abstention), hybrid, threshold tuned on dev split, scored on test split

| chunking | signal | threshold | accuracy | balanced acc. | correct refusals | false refusals |
|---|---|---|---|---|---|---|
| fixed | dense | 0.872 | 54.1% | 62.8% | 75.0% | 49.3% |
| fixed | coverage | 0.378 | 69.4% | 71.7% | 75.0% | 31.5% |
| fixed | combined | 0.330 | 68.2% | 71.1% | 75.0% | 32.9% |
| clause | dense | 0.873 | 54.1% | 59.4% | 66.7% | 47.9% |
| clause | coverage | 0.432 | 65.9% | 76.7% | 91.7% | 38.4% |
| clause | combined | 0.371 | 65.9% | 76.7% | 91.7% | 38.4% |
| paragraph | dense | 0.869 | 56.5% | 64.2% | 75.0% | 46.6% |
| paragraph | coverage | 0.259 | 84.7% | 73.7% | 58.3% | 11.0% |
| paragraph | combined | 0.222 | 84.7% | 73.7% | 58.3% | 11.0% |

Signals: dense = top cosine; coverage = share of the question's IDF weight found in a top-3 chunk; combined = coverage × dense.

## End to end (clause + hybrid, combined ≥ 0.371, test split)

- mode: extractive (no GEMINI_API_KEY)
- questions: 85
- statusAccuracy: 65.9%
- citesGoldPage: 57.5%
- p50ms: 12
- p95ms: 17
- costPerQuestionUsd: 0.000000
