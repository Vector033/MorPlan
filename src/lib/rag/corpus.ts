import docsJson from "../../../data/docs.json";
import pagesJson from "../../../data/pages.json";
import type { DocMeta, Page } from "./types";

// Imported (not read from disk) so the corpus is bundled with the server code
// and works regardless of the working directory or serverless file tracing.
export function loadPages(): Page[] {
  return pagesJson as Page[];
}

export function loadDocs(): Map<string, DocMeta> {
  return new Map((docsJson as DocMeta[]).map((d) => [d.id, d]));
}
