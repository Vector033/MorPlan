-- Defense in depth on top of RLS: the browser never queries these tables through
-- Supabase's REST API (all access goes through the server's own connection), so
-- the API roles get no table privileges at all.
REVOKE ALL ON TABLE "shares", "workspaces", "events", "rag_chunks", "rate_limits" FROM anon, authenticated;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
