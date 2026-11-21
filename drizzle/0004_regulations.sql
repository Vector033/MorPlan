CREATE TABLE "regulations" (
	"id" text PRIMARY KEY NOT NULL,
	"uni_key" text NOT NULL,
	"university" text NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"provenance" text NOT NULL,
	"source_url" text,
	"pages" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "regulations_uni" ON "regulations" USING btree ("uni_key","status");--> statement-breakpoint
CREATE INDEX "regulations_status_created" ON "regulations" USING btree ("status","created_at");
--> statement-breakpoint
ALTER TABLE "regulations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "regulations" FROM anon, authenticated;
