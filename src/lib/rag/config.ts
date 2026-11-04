import type { Signal } from "./retrieve";
import type { Retriever, Strategy } from "./types";

// Chosen by eval/run.mts (eval/results/latest.json → best / lexical). Re-run `npm run eval` after changing the corpus.
// Hybrid needs the in-process embedding model, which is too big for a Vercel function, so
// production sets RAG_RETRIEVER=bm25 (the eval's "lexical" setup: same status accuracy on the test split).
export const RAG_STRATEGY: Strategy = "clause";
export const RAG_RETRIEVER: Retriever = process.env.RAG_RETRIEVER === "bm25" ? "bm25" : "hybrid";
const lexical = RAG_RETRIEVER === "bm25";
export const RAG_SIGNAL: Signal = lexical ? "coverage" : "combined";
export const RAG_THRESHOLD = Number(process.env.RAG_THRESHOLD ?? (lexical ? 0.535 : 0.428));
