import type { Signal } from "./retrieve";
import type { Strategy } from "./types";

// Chosen by eval/run.mts (eval/results/latest.json → best). Re-run `npm run eval` after changing the corpus.
export const RAG_STRATEGY: Strategy = "clause";
export const RAG_SIGNAL: Signal = "combined";
export const RAG_THRESHOLD = Number(process.env.RAG_THRESHOLD ?? 0.371);
