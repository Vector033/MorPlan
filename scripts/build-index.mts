// Chunk data/pages.jsonl with every strategy, embed the chunks and load them
// into rag_chunks (pgvector). Usage: npx tsx scripts/build-index.mts [--provider local|gemini]
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { ragChunks } from "../src/db/schema";
import { loadDocs, loadPages } from "../src/lib/rag/corpus";
import { GeminiEmbedder, LocalE5Embedder, type Embedder } from "../src/lib/rag/embed";
import { indexText, MemoryDenseStore, Retrieval } from "../src/lib/rag/retrieve";
import { STRATEGIES } from "../src/lib/rag/types";

config({ path: ".env.local" });
const provider = process.argv.includes("--provider") ? process.argv[process.argv.indexOf("--provider") + 1] : "local";
const embedder: Embedder =
  provider === "gemini" ? new GeminiEmbedder(process.env.GEMINI_API_KEY ?? "") : new LocalE5Embedder();

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(sql);
const docs = loadDocs();
const retrieval = new Retrieval(loadPages(), docs, embedder, new MemoryDenseStore([]));

for (const strategy of STRATEGIES) {
  const chunks = retrieval.chunksFor(strategy);
  const started = Date.now();
  const vectors = await embedder.embed(
    chunks.map((c) => indexText(c, docs)),
    "passage",
  );
  await db.delete(ragChunks).where(and(eq(ragChunks.strategy, strategy), eq(ragChunks.model, embedder.model)));
  for (let i = 0; i < chunks.length; i += 200) {
    await db.insert(ragChunks).values(
      chunks.slice(i, i + 200).map((c, j) => ({
        id: c.id,
        strategy,
        docId: c.docId,
        page: c.page,
        text: c.text,
        model: embedder.model,
        embedding: vectors[i + j],
      })),
    );
  }
  const avg = Math.round(chunks.reduce((n, c) => n + c.text.length, 0) / chunks.length);
  console.log(`${strategy}: ${chunks.length} chunks (avg ${avg} chars), ${embedder.model}, ${((Date.now() - started) / 1000).toFixed(1)}s`);
}
await sql.end();
