-- pgvector for rag_chunks.embedding
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
--> statement-breakpoint
SET search_path TO public, extensions;
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_chunks" (
	"id" text NOT NULL,
	"strategy" text NOT NULL,
	"doc_id" text NOT NULL,
	"page" integer NOT NULL,
	"text" text NOT NULL,
	"model" text NOT NULL,
	"embedding" extensions.vector NOT NULL,
	CONSTRAINT "rag_chunks_strategy_model_id_pk" PRIMARY KEY("strategy","model","id")
);
--> statement-breakpoint
CREATE TABLE "shares" (
	"id" text PRIMARY KEY NOT NULL,
	"term" text NOT NULL,
	"name" text NOT NULL,
	"sections" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rag_chunks_doc" ON "rag_chunks" USING btree ("doc_id");
--> statement-breakpoint
-- Only the server (direct Postgres connection) touches these tables; RLS with no
-- policies keeps them closed to the public Supabase REST API.
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "rag_chunks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "shares" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_user_fk" FOREIGN KEY ("user_id") REFERENCES auth.users("id") ON DELETE CASCADE;
