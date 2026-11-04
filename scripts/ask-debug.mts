// Show retrieval signals and top chunks for questions, to debug the Q&A.
// Usage: npx tsx scripts/ask-debug.mts "คำถาม 1" "คำถาม 2"
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { RAG_STRATEGY } from "../src/lib/rag/config";
import { loadDocs, loadPages } from "../src/lib/rag/corpus";
import { getEmbedder } from "../src/lib/rag/embed";
import { PgDenseStore } from "../src/lib/rag/pg-store";
import { Retrieval } from "../src/lib/rag/retrieve";
import { tokenize } from "../src/lib/rag/tokenize";

config({ path: ".env.local" });
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const r = new Retrieval(loadPages(), loadDocs(), getEmbedder(), new PgDenseStore(drizzle(sql)));
for (const q of process.argv.slice(2)) {
  const res = await r.retrieve(q, RAG_STRATEGY, "hybrid", 6);
  console.log(`\n${q}\n  tokens: ${tokenize(q).join(" | ")}\n  signals: ${JSON.stringify(res.signals)}`);
  for (const h of res.hits.slice(0, 3)) console.log(`  ${h.chunk.docId} p${h.chunk.page}: ${h.chunk.text.slice(0, 140).replace(/\n/g, " ")}`);
}
await sql.end();
