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

/**
 * Fixed-window request counters. `key` is a salted SHA-256 of bucket + client,
 * so no IP address or user id is stored in clear.
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] }), index("rate_limits_window").on(t.windowStart)],
);

/**
 * Curricula read from university pages, shared between students. `pending` rows
 * were read from a link and wait for the reader to confirm; `shared` rows are
 * visible to everyone. electives/minors rows point at a curriculum via parent_id.
 */
export const curricula = pgTable(
  "curricula",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(), // curriculum | electives | minors
    status: text("status").notNull(), // pending | shared
    uniKey: text("uni_key").notNull(),
    facultyKey: text("faculty_key"),
    majorKey: text("major_key"),
    university: text("university").notNull(),
    faculty: text("faculty"),
    major: text("major"),
    cohortFrom: integer("cohort_from"),
    cohortTo: integer("cohort_to"),
    parentId: text("parent_id"),
    data: jsonb("data").notNull(),
    sourceUrl: text("source_url"),
    sourceTitle: text("source_title").notNull(),
    provenance: text("provenance").notNull(), // link | owner
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("curricula_lookup").on(t.uniKey, t.facultyKey, t.majorKey), index("curricula_status_created").on(t.status, t.createdAt)],
);

/**
 * Regulation documents per university for the Q&A: read from a university link (shared once confirmed)
 * or by the owner. Uploads and pasted text never come here; they stay in the student's request.
 */
export const regulations = pgTable(
  "regulations",
  {
    id: text("id").primaryKey(),
    uniKey: text("uni_key").notNull(),
    university: text("university").notNull(),
    title: text("title").notNull(),
    kind: text("kind").notNull(), // regulation | calendar | announcement | guide
    status: text("status").notNull(), // pending | shared
    provenance: text("provenance").notNull(), // link | owner
    sourceUrl: text("source_url"),
    pages: jsonb("pages").notNull(), // { page: number; text: string }[]
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("regulations_uni").on(t.uniKey, t.status), index("regulations_status_created").on(t.status, t.createdAt)],
);
