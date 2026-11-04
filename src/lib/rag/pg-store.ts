import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { DenseStore } from "./retrieve";
import type { Strategy } from "./types";

/** pgvector cosine search over rag_chunks (`<=>` is cosine distance). */
export class PgDenseStore implements DenseStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private db: PostgresJsDatabase<any>) {}

  async search(strategy: Strategy, model: string, query: number[], k: number) {
    const vec = `[${query.join(",")}]`;
    const rows = await this.db.execute<{ id: string; score: number }>(sql`
      select id, 1 - (embedding <=> ${vec}::extensions.vector) as score
      from rag_chunks
      where strategy = ${strategy} and model = ${model}
      order by embedding <=> ${vec}::extensions.vector
      limit ${k}`);
    return [...rows].map((r) => ({ id: r.id, score: Number(r.score) }));
  }
}
