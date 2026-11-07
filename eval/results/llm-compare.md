# Answer models

Test split (85 questions), clause + hybrid, combined >= 0.428. Judge: `claude-sonnet-4-5`, which is not one of the graded models. All calls go through FreeLLMAPI free tiers, so cost is $0; latency includes the local router.

| model | answer vs "ไม่พบ" | cites gold page | faithfulness | correctness | judged | errors | p50 ms | p95 ms | run |
|---|---|---|---|---|---|---|---|---|---|
| freellmapi:typhoon-2.5-30b-a3b-instruct | 80.0% | 63.0% | 67.9% | 75.0% | 56 | 0 | 1163 | 3052 | 2026-11-07 |
| freellmapi:claude-haiku-4-5 | 74.1% | 67.1% | 82.4% | 88.2% | 51 | 0 | 1326 | 18991 | 2026-11-07 |

faithfulness: every claim is in the cited passages. correctness: agrees with the gold answer. Both over judged answered questions.
Extractive baseline (no LLM, same setup): answer vs "ไม่พบ" 78.8%, cites gold page 71.2%.
Not reported: freellmapi:gpt-oss-120b (free-tier 429, 31/85 errors).
Not reported: freellmapi:gemini-3-flash-preview (free-tier 429, 61/85 errors).
