CREATE TABLE "curricula" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"uni_key" text NOT NULL,
	"faculty_key" text,
	"major_key" text,
	"university" text NOT NULL,
	"faculty" text,
	"major" text,
	"cohort_from" integer,
	"cohort_to" integer,
	"parent_id" text,
	"data" jsonb NOT NULL,
	"source_url" text,
	"source_title" text NOT NULL,
	"provenance" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "curricula_lookup" ON "curricula" USING btree ("uni_key","faculty_key","major_key");--> statement-breakpoint
CREATE INDEX "curricula_status_created" ON "curricula" USING btree ("status","created_at");
--> statement-breakpoint
ALTER TABLE "curricula" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "curricula" FROM anon, authenticated;
