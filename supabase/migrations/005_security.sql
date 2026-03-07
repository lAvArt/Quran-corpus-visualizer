-- Migration 005: Security hardening — corpus read-only enforcement & function access control
--
-- Attack surface addressed:
--   • corpus_tokens / ayahs / root_embeddings had no RLS → authenticated users could
--     INSERT / UPDATE / DELETE corpus data with only a public anon key.
--   • refresh_corpus_views() was callable by any role → potential denial-of-service.
--   • Materialized views (collocations, cross_references) had no explicit read grant
--     for end-user roles → functions querying them could fail for anon callers.

-- ─────────────────────────────────────────────────────────────────
-- 1. Row Level Security on corpus tables
--    Public read (anon + authenticated), no write from end-user roles.
--    The service_role bypasses RLS entirely and retains full access for ingest scripts.
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE corpus_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "corpus_tokens_public_read"
    ON corpus_tokens
    FOR SELECT TO anon, authenticated
    USING (true);

ALTER TABLE ayahs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ayahs_public_read"
    ON ayahs
    FOR SELECT TO anon, authenticated
    USING (true);

ALTER TABLE root_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "root_embeddings_public_read"
    ON root_embeddings
    FOR SELECT TO anon, authenticated
    USING (true);

-- ─────────────────────────────────────────────────────────────────
-- 2. Explicitly revoke write access on corpus tables from end-user roles.
--    RLS alone blocks unauthorised writes when no INSERT/UPDATE/DELETE policy exists,
--    but explicit REVOKEs provide defence-in-depth.
-- ─────────────────────────────────────────────────────────────────

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
    ON corpus_tokens, ayahs, root_embeddings
    FROM anon, authenticated;

-- Revoke unneeded DDL-adjacent privileges from corpus tables
REVOKE REFERENCES, TRIGGER ON corpus_tokens   FROM anon, authenticated;
REVOKE REFERENCES, TRIGGER ON ayahs           FROM anon, authenticated;
REVOKE REFERENCES, TRIGGER ON root_embeddings FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────
-- 3a. tracked_roots privilege hardening
--     TRUNCATE bypasses RLS entirely in PostgreSQL — critical to revoke.
--     anon cannot own rows (auth.uid()=NULL), so strip all its write privs.
-- ─────────────────────────────────────────────────────────────────

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON tracked_roots FROM anon;
-- authenticated may still INSERT/UPDATE/DELETE (RLS enforces user_id), but
-- TRUNCATE bypasses RLS and must be denied to all end-user roles.
REVOKE TRUNCATE ON tracked_roots FROM authenticated;
REVOKE REFERENCES, TRIGGER ON tracked_roots FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────
-- 3. Materialized view read access
--    PostgreSQL does not support RLS on materialized views; use GRANT instead.
-- ─────────────────────────────────────────────────────────────────

GRANT SELECT ON collocations    TO anon, authenticated;
GRANT SELECT ON cross_references TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────
-- 4. Lock down admin function to service_role only
--    refresh_corpus_views() triggers a REFRESH MATERIALIZED VIEW CONCURRENTLY —
--    exposing this to end-user roles is a potential DoS vector.
-- ─────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION refresh_corpus_views() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION refresh_corpus_views() TO service_role;

-- ─────────────────────────────────────────────────────────────────
-- 5. Explicitly grant search/query functions to end-user roles
--    Supabase RPC calls go through PostgREST using the anon/authenticated role.
-- ─────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION search_corpus_fts(TEXT, INT)            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_corpus_trigram(TEXT, INT, FLOAT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_roots_semantic(VECTOR(768), INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_collocates(TEXT, TEXT, FLOAT, INT)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION cross_reference_roots(TEXT, TEXT)       TO anon, authenticated;
