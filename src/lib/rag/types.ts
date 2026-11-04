export type Page = { docId: string; page: number; text: string };
export type DocMeta = { id: string; title: string; kind: string; url: string };

export type Strategy = "fixed" | "clause" | "paragraph";
export const STRATEGIES: Strategy[] = ["fixed", "clause", "paragraph"];

export type Chunk = { id: string; strategy: Strategy; docId: string; page: number; text: string };

export type Retriever = "bm25" | "dense" | "hybrid";
export type Hit = { chunk: Chunk; score: number };

export type Citation = { n: number; docId: string; title: string; page: number; url: string; snippet: string };

export type Answer = {
  status: "answered" | "not_found";
  text: string;
  citations: Citation[];
  mode: "llm" | "extractive";
  notice: string;
  latencyMs: number;
  costUsd: number;
  topScore: number;
};

export const OFFICIAL_NOTICE = "ตรวจสอบกับประกาศทางการอีกครั้ง";
export const NOT_FOUND = "ไม่พบ";
