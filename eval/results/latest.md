# RAG evaluation

170 questions (145 answerable, 25 unanswerable; 13 answerable ones have a key number the OCR misreads). Embeddings: `multilingual-e5-small-q8`. Run 2026-11-04.

## Retrieval (answerable questions, page-level)

| chunking | retriever | R@1 | R@3 | R@5 | R@10 | MRR | doc R@5 | evidence@3 | p50 ms | p95 ms |
|---|---|---|---|---|---|---|---|---|---|---|
| fixed | bm25 | 62.8% | 80.7% | 90.3% | 96.6% | 0.740 | 99.3% | 74.5% | 0 | 0 |
| fixed | dense | 55.2% | 66.9% | 77.2% | 88.3% | 0.643 | 95.2% | 56.6% | 16 | 18 |
| fixed | hybrid | 61.4% | 80.0% | 87.6% | 96.6% | 0.726 | 98.6% | 72.4% | 16 | 18 |
| clause | bm25 | 64.8% | 83.4% | 90.3% | 97.9% | 0.755 | 97.9% | 78.6% | 0 | 1 |
| clause | dense | 53.1% | 71.7% | 82.1% | 91.0% | 0.644 | 94.5% | 59.3% | 16 | 18 |
| clause | hybrid | 60.0% | 80.0% | 91.7% | 96.6% | 0.722 | 99.3% | 71.0% | 16 | 17 |
| paragraph | bm25 | 68.3% | 86.2% | 89.7% | 95.9% | 0.782 | 99.3% | 74.5% | 0 | 0 |
| paragraph | dense | 51.7% | 69.0% | 81.4% | 85.5% | 0.623 | 91.0% | 53.1% | 16 | 16 |
| paragraph | hybrid | 58.6% | 80.0% | 89.7% | 96.6% | 0.711 | 97.2% | 68.3% | 16 | 17 |

evidence@3: the gold quote appears verbatim in one of the top 3 chunks.

Ablation, clause + hybrid **without** query rewriting: R@1 60.7%, R@5 89.0%, MRR 0.724.

## "ไม่พบ" (abstention), hybrid, threshold tuned on dev split, scored on test split

| chunking | signal | threshold | accuracy | balanced acc. | correct refusals | false refusals |
|---|---|---|---|---|---|---|
| fixed | dense | 0.867 | 77.6% | 66.1% | 50.0% | 17.8% |
| fixed | coverage | 0.380 | 87.1% | 78.5% | 66.7% | 9.6% |
| fixed | combined | 0.331 | 88.2% | 79.2% | 66.7% | 8.2% |
| clause | dense | 0.860 | 81.2% | 57.7% | 25.0% | 9.6% |
| clause | coverage | 0.510 | 76.5% | 75.9% | 75.0% | 23.3% |
| clause | combined | 0.428 | 78.8% | 77.2% | 75.0% | 20.5% |
| paragraph | dense | 0.855 | 77.6% | 55.7% | 25.0% | 13.7% |
| paragraph | coverage | 0.381 | 88.2% | 75.7% | 58.3% | 6.8% |
| paragraph | combined | 0.308 | 87.1% | 71.6% | 50.0% | 6.8% |

Signals: dense = top cosine; coverage = share of the question's IDF weight found in a top-3 chunk; combined = coverage × dense.

## End to end (clause + hybrid, combined ≥ 0.428, test split)

- mode: extractive (no GEMINI_API_KEY)
- questions: 85
- statusAccuracy: 78.8%
- citesGoldPage: 71.2%
- p50ms: 8
- p95ms: 10
- costPerQuestionUsd: 0.000000
