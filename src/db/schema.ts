import { customType, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** pgvector column without a fixed dimension, so local (384) and Gemini (768) embeddings can coexist. */
const vector = customType<{ data: number[]; driverData: string }>({
  dataType: () => "vector",
  toDriver: (v) => `[${v.join(",")}]`,
  fromDriver: (v) => JSON.parse(v),
});

/** Immutable read-only snapshots behind /s/<id>. */
export const shares = pgTable("shares", {
  id: text("id").primaryKey(),
  term: text("term").notNull(),
  name: text("name").notNull(),
  sections: jsonb("sections").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A signed-in student's whole workspace (plans + imported sections), one row per user. */
export const workspaces = pgTable("workspaces", {
  userId: uuid("user_id").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** RAG chunks for each chunking strategy, with one embedding per model. */
export const ragChunks = pgTable(
  "rag_chunks",
  {
    id: text("id").notNull(),
    strategy: text("strategy").notNull(),
    docId: text("doc_id").notNull(),
    page: integer("page").notNull(),
    text: text("text").notNull(),
    model: text("model").notNull(),
    embedding: vector("embedding").notNull(),
  },
  (t) => [primaryKey({ columns: [t.strategy, t.model, t.id] }), index("rag_chunks_doc").on(t.docId)],
);

/** Anonymous usage counters for the README (no personal data). */
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
