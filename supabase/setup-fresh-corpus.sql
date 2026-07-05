-- =====================================================================
-- Pluragate corpus setup — RUN IN THE SUPABASE SQL EDITOR (Dashboard)
-- WARNING: Step 1 DROPS the entire public schema (all ~120 existing
-- tables + their data) so the Quran-corpus tables can be created cleanly.
-- Daily physical backups exist (Dashboard > Database > Backups) if needed.
-- =====================================================================

-- Step 1: reset the public schema + restore default grants
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT CREATE ON SCHEMA public TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- ===== 001_extensions.sql =====
-- Migration 001: Enable required Postgres extensions
-- Run this in the Supabase SQL editor or via `supabase db push`

CREATE EXTENSION IF NOT EXISTS vector;       -- pgvector: semantic similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- trigram fuzzy matching for Arabic text
CREATE EXTENSION IF NOT EXISTS unaccent;     -- accent-insensitive search helper


-- ===== 002_corpus.sql =====
-- Migration 002: Corpus tables, indexes, materialized views
-- Stores the full Quran corpus with search-optimised columns

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. corpus_tokens
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS corpus_tokens (
    id               TEXT        PRIMARY KEY,           -- "sura:ayah:position"
    sura             SMALLINT    NOT NULL,
    ayah             SMALLINT    NOT NULL,
    position         SMALLINT    NOT NULL,
    text             TEXT        NOT NULL,              -- original Arabic with diacritics
    root             TEXT        NOT NULL DEFAULT '',
    lemma            TEXT        NOT NULL DEFAULT '',
    pos              TEXT        NOT NULL DEFAULT '',   -- N V P ADJ PRON PART CONJ
    morphology       JSONB,
    -- generated normalised columns for fast matching (strip diacritics, normalise alef variants)
    root_normalized  TEXT GENERATED ALWAYS AS (
        regexp_replace(
            regexp_replace(lower(root), '[\u064B-\u065F\u0670\u0640]', '', 'g'),
            '[Ø£Ø¥Ø¢Ù±]', 'Ø§', 'g'
        )
    ) STORED,
    lemma_normalized TEXT GENERATED ALWAYS AS (
        regexp_replace(
            regexp_replace(lower(lemma), '[\u064B-\u065F\u0670\u0640]', '', 'g'),
            '[Ø£Ø¥Ø¢Ù±]', 'Ø§', 'g'
        )
    ) STORED
);

-- Full-text search vector (GIN) over root + lemma (normalised inline).
-- NOTE: PostgreSQL does not allow a generated column to reference another
-- generated column, so we duplicate the normalisation expression here.
ALTER TABLE corpus_tokens
    ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
        GENERATED ALWAYS AS (
            to_tsvector('simple',
                regexp_replace(
                    regexp_replace(lower(coalesce(root, '')), '[\u064B-\u065F\u0670\u0640]', '', 'g'),
                    '[Ø£Ø¥Ø¢Ù±]', 'Ø§', 'g'
                )
                || ' ' ||
                regexp_replace(
                    regexp_replace(lower(coalesce(lemma, '')), '[\u064B-\u065F\u0670\u0640]', '', 'g'),
                    '[Ø£Ø¥Ø¢Ù±]', 'Ø§', 'g'
                )
            )
        ) STORED;

CREATE INDEX IF NOT EXISTS idx_corpus_tokens_search_vector
    ON corpus_tokens USING GIN (search_vector);

-- Trigram indexes for fuzzy matching
CREATE INDEX IF NOT EXISTS idx_corpus_tokens_root_trgm
    ON corpus_tokens USING GIN (root_normalized gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_corpus_tokens_lemma_trgm
    ON corpus_tokens USING GIN (lemma_normalized gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_corpus_tokens_text_trgm
    ON corpus_tokens USING GIN (text gin_trgm_ops);

-- Lookup indexes
CREATE INDEX IF NOT EXISTS idx_corpus_tokens_sura_ayah
    ON corpus_tokens (sura, ayah);

CREATE INDEX IF NOT EXISTS idx_corpus_tokens_root
    ON corpus_tokens (root_normalized);

CREATE INDEX IF NOT EXISTS idx_corpus_tokens_pos
    ON corpus_tokens (pos);


-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 2. ayahs
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS ayahs (
    id             TEXT     PRIMARY KEY,   -- "sura:ayah"
    sura_id        SMALLINT NOT NULL,
    ayah_number    SMALLINT NOT NULL,
    text_uthmani   TEXT     NOT NULL,
    text_simple    TEXT,
    search_vector  TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('simple', coalesce(text_uthmani, '') || ' ' || coalesce(text_simple, ''))
    ) STORED
);

CREATE INDEX IF NOT EXISTS idx_ayahs_search_vector
    ON ayahs USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS idx_ayahs_sura
    ON ayahs (sura_id);


-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 3. root_embeddings  (pgvector semantic search)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS root_embeddings (
    root        TEXT        PRIMARY KEY,
    embedding   VECTOR(768) NOT NULL,      -- dimensions match your embedding model
    model       TEXT        NOT NULL,      -- e.g. "text-embedding-3-small" or "multilingual-e5"
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HNSW index for approximate nearest-neighbour cosine search
CREATE INDEX IF NOT EXISTS idx_root_embeddings_hnsw
    ON root_embeddings USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);


-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 4. collocations  (materialized view â€“ pre-computed PMI)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE MATERIALIZED VIEW IF NOT EXISTS collocations AS
WITH ayah_root_pairs AS (
    -- all (root, ayah) pairs
    SELECT DISTINCT
        root_normalized AS root,
        sura,
        ayah
    FROM corpus_tokens
    WHERE root_normalized <> ''
),
root_counts AS (
    SELECT root, COUNT(*) AS ayah_count
    FROM ayah_root_pairs
    GROUP BY root
),
total AS (
    SELECT COUNT(DISTINCT sura || ':' || ayah) AS total_ayahs FROM corpus_tokens
),
co_pairs AS (
    SELECT
        a.root  AS root_a,
        b.root  AS root_b,
        COUNT(*) AS co_count,
        COUNT(DISTINCT a.sura) AS surah_count
    FROM ayah_root_pairs a
    JOIN ayah_root_pairs b
        ON a.sura = b.sura AND a.ayah = b.ayah AND a.root < b.root
    GROUP BY a.root, b.root
    HAVING COUNT(*) >= 2
)
SELECT
    cp.root_a,
    cp.root_b,
    cp.co_count,
    cp.surah_count,
    'ayah'::TEXT AS window_type,
    -- PMI = log2( P(a,b) / (P(a)*P(b)) )
    LOG(2.0,
        (cp.co_count::NUMERIC / t.total_ayahs) /
        NULLIF(
            (rc_a.ayah_count::NUMERIC / t.total_ayahs) *
            (rc_b.ayah_count::NUMERIC / t.total_ayahs),
            0
        )
    ) AS pmi
FROM co_pairs cp
CROSS JOIN total t
JOIN root_counts rc_a ON rc_a.root = cp.root_a
JOIN root_counts rc_b ON rc_b.root = cp.root_b;

CREATE UNIQUE INDEX IF NOT EXISTS idx_collocations_roots
    ON collocations (root_a, root_b, window_type);

CREATE INDEX IF NOT EXISTS idx_collocations_root_a
    ON collocations (root_a, pmi DESC);

CREATE INDEX IF NOT EXISTS idx_collocations_root_b
    ON collocations (root_b, pmi DESC);


-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 5. cross_references  (materialized view â€“ co-occurring roots per ayah)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE MATERIALIZED VIEW IF NOT EXISTS cross_references AS
SELECT
    sura,
    ayah,
    array_agg(DISTINCT root_normalized ORDER BY root_normalized) AS roots
FROM corpus_tokens
WHERE root_normalized <> ''
GROUP BY sura, ayah;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cross_references_pk
    ON cross_references (sura, ayah);

CREATE INDEX IF NOT EXISTS idx_cross_references_roots
    ON cross_references USING GIN (roots);


-- ===== 003_user_data.sql =====
-- Migration 003: User data â€“ tracked roots with Row Level Security

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- tracked_roots
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS tracked_roots (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    root              TEXT        NOT NULL,
    state             TEXT        NOT NULL DEFAULT 'learning'
                                  CHECK (state IN ('learning', 'learned')),
    notes             TEXT        NOT NULL DEFAULT '',
    added_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_reviewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, root)
);

-- Row Level Security
ALTER TABLE tracked_roots ENABLE ROW LEVEL SECURITY;

-- Users can only read/insert/update/delete their own rows
CREATE POLICY "Users can manage own tracked roots"
    ON tracked_roots
    FOR ALL
    USING      (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Index to speed up per-user lookups
CREATE INDEX IF NOT EXISTS idx_tracked_roots_user_id
    ON tracked_roots (user_id);


-- ===== 004_functions.sql =====
-- Migration 004: Database functions for search, semantic similarity,
--                collocations, and cross-reference queries

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. search_roots_semantic
--    Returns roots ordered by cosine similarity to a query embedding.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE OR REPLACE FUNCTION search_roots_semantic(
    query_embedding  VECTOR(768),
    match_count      INT DEFAULT 10
)
RETURNS TABLE (root TEXT, similarity FLOAT)
LANGUAGE SQL STABLE
SET search_path = public, pg_catalog
AS $$
    SELECT
        re.root,
        1 - (re.embedding <=> query_embedding) AS similarity
    FROM root_embeddings re
    ORDER BY re.embedding <=> query_embedding
    LIMIT match_count;
$$;


-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 2. search_corpus_fts
--    Full-text search over root_normalized + lemma_normalized.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE OR REPLACE FUNCTION search_corpus_fts(
    query   TEXT,
    limit_n INT DEFAULT 50
)
RETURNS TABLE (
    id       TEXT,
    root     TEXT,
    lemma    TEXT,
    text     TEXT,
    sura     SMALLINT,
    ayah     SMALLINT,
    pos      TEXT,
    rank     FLOAT
)
LANGUAGE SQL STABLE
SET search_path = public, pg_catalog
AS $$
    SELECT
        ct.id,
        ct.root,
        ct.lemma,
        ct.text,
        ct.sura,
        ct.ayah,
        ct.pos,
        ts_rank(ct.search_vector, websearch_to_tsquery('simple', query)) AS rank
    FROM corpus_tokens ct
    WHERE ct.search_vector @@ websearch_to_tsquery('simple', query)
    ORDER BY rank DESC
    LIMIT limit_n;
$$;


-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 3. search_corpus_trigram
--    Fuzzy trigram match across root, lemma, and raw text.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE OR REPLACE FUNCTION search_corpus_trigram(
    query      TEXT,
    limit_n    INT   DEFAULT 50,
    threshold  FLOAT DEFAULT 0.25
)
RETURNS TABLE (
    id          TEXT,
    root        TEXT,
    lemma       TEXT,
    text        TEXT,
    sura        SMALLINT,
    ayah        SMALLINT,
    pos         TEXT,
    similarity  FLOAT
)
LANGUAGE SQL STABLE
SET search_path = public, pg_catalog
AS $$
    SELECT DISTINCT ON (ct.id)
        ct.id,
        ct.root,
        ct.lemma,
        ct.text,
        ct.sura,
        ct.ayah,
        ct.pos,
        GREATEST(
            similarity(ct.root_normalized,  query),
            similarity(ct.lemma_normalized, query),
            similarity(ct.text,             query)
        ) AS similarity
    FROM corpus_tokens ct
    WHERE
        similarity(ct.root_normalized,  query) >= threshold OR
        similarity(ct.lemma_normalized, query) >= threshold OR
        similarity(ct.text,             query) >= threshold
    ORDER BY ct.id, similarity DESC
    LIMIT limit_n;
$$;


-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 4. get_collocates
--    Returns collocates ranked by PMI from the materialized view.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE OR REPLACE FUNCTION get_collocates(
    target_root  TEXT,
    window_type  TEXT    DEFAULT 'ayah',
    min_pmi      FLOAT   DEFAULT 0.0,
    limit_n      INT     DEFAULT 30
)
RETURNS TABLE (
    root        TEXT,
    co_count    BIGINT,
    pmi         FLOAT,
    surah_count BIGINT
)
LANGUAGE SQL STABLE
SET search_path = public, pg_catalog
AS $$
    SELECT
        CASE
            WHEN c.root_a = target_root THEN c.root_b
            ELSE c.root_a
        END                          AS root,
        c.co_count,
        c.pmi,
        c.surah_count
    FROM collocations c
    WHERE
        (c.root_a = target_root OR c.root_b = target_root)
        AND c.window_type = window_type
        AND c.pmi >= min_pmi
    ORDER BY c.pmi DESC
    LIMIT limit_n;
$$;


-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 5. cross_reference_roots
--    Returns ayahs where both root_a and root_b co-occur.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE OR REPLACE FUNCTION cross_reference_roots(
    root_a  TEXT,
    root_b  TEXT
)
RETURNS TABLE (sura INT, ayah INT, roots TEXT[])
LANGUAGE SQL STABLE
SET search_path = public, pg_catalog
AS $$
    SELECT
        cr.sura::INT,
        cr.ayah::INT,
        cr.roots
    FROM cross_references cr
    WHERE
        cr.roots @> ARRAY[root_a]::TEXT[]
        AND cr.roots @> ARRAY[root_b]::TEXT[]
    ORDER BY cr.sura, cr.ayah;
$$;


-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 6. refresh_corpus_views (helper for after bulk ingest)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE OR REPLACE FUNCTION refresh_corpus_views()
RETURNS VOID
LANGUAGE SQL
SET search_path = public, pg_catalog
AS $$
    REFRESH MATERIALIZED VIEW CONCURRENTLY collocations;
    REFRESH MATERIALIZED VIEW CONCURRENTLY cross_references;
$$;


-- ===== 005_security.sql =====
-- Migration 005: Security hardening â€” corpus read-only enforcement & function access control
--
-- Attack surface addressed:
--   â€¢ corpus_tokens / ayahs / root_embeddings had no RLS â†’ authenticated users could
--     INSERT / UPDATE / DELETE corpus data with only a public anon key.
--   â€¢ refresh_corpus_views() was callable by any role â†’ potential denial-of-service.
--   â€¢ Materialized views (collocations, cross_references) had no explicit read grant
--     for end-user roles â†’ functions querying them could fail for anon callers.

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. Row Level Security on corpus tables
--    Public read (anon + authenticated), no write from end-user roles.
--    The service_role bypasses RLS entirely and retains full access for ingest scripts.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 2. Explicitly revoke write access on corpus tables from end-user roles.
--    RLS alone blocks unauthorised writes when no INSERT/UPDATE/DELETE policy exists,
--    but explicit REVOKEs provide defence-in-depth.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
    ON corpus_tokens, ayahs, root_embeddings
    FROM anon, authenticated;

-- Revoke unneeded DDL-adjacent privileges from corpus tables
REVOKE REFERENCES, TRIGGER ON corpus_tokens   FROM anon, authenticated;
REVOKE REFERENCES, TRIGGER ON ayahs           FROM anon, authenticated;
REVOKE REFERENCES, TRIGGER ON root_embeddings FROM anon, authenticated;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 3a. tracked_roots privilege hardening
--     TRUNCATE bypasses RLS entirely in PostgreSQL â€” critical to revoke.
--     anon cannot own rows (auth.uid()=NULL), so strip all its write privs.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON tracked_roots FROM anon;
-- authenticated may still INSERT/UPDATE/DELETE (RLS enforces user_id), but
-- TRUNCATE bypasses RLS and must be denied to all end-user roles.
REVOKE TRUNCATE ON tracked_roots FROM authenticated;
REVOKE REFERENCES, TRIGGER ON tracked_roots FROM anon, authenticated;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 3. Materialized view read access
--    PostgreSQL does not support RLS on materialized views; use GRANT instead.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

GRANT SELECT ON collocations    TO anon, authenticated;
GRANT SELECT ON cross_references TO anon, authenticated;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 4. Lock down admin function to service_role only
--    refresh_corpus_views() triggers a REFRESH MATERIALIZED VIEW CONCURRENTLY â€”
--    exposing this to end-user roles is a potential DoS vector.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

REVOKE EXECUTE ON FUNCTION refresh_corpus_views() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION refresh_corpus_views() TO service_role;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 5. Explicitly grant search/query functions to end-user roles
--    Supabase RPC calls go through PostgREST using the anon/authenticated role.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

GRANT EXECUTE ON FUNCTION search_corpus_fts(TEXT, INT)            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_corpus_trigram(TEXT, INT, FLOAT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_roots_semantic(VECTOR(768), INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_collocates(TEXT, TEXT, FLOAT, INT)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION cross_reference_roots(TEXT, TEXT)       TO anon, authenticated;


-- ===== 006_search_path_fix.sql =====
-- Migration 006: Fix mutable search_path on all public functions.
-- Prevents search_path-based injection (Supabase lint: function_search_path_mutable).

ALTER FUNCTION public.search_roots_semantic(vector, integer)
    SET search_path = public, pg_catalog;

ALTER FUNCTION public.search_corpus_fts(text, integer)
    SET search_path = public, pg_catalog;

ALTER FUNCTION public.search_corpus_trigram(text, integer, double precision)
    SET search_path = public, pg_catalog;

ALTER FUNCTION public.get_collocates(text, text, double precision, integer)
    SET search_path = public, pg_catalog;

ALTER FUNCTION public.cross_reference_roots(text, text)
    SET search_path = public, pg_catalog;

ALTER FUNCTION public.refresh_corpus_views()
    SET search_path = public, pg_catalog;


-- ===== 007_quiz_attempts.sql =====
-- Migration 007: Quiz attempt history for synced study progress

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_key         TEXT        NOT NULL,
    session_type        TEXT        NOT NULL CHECK (session_type IN ('daily', 'study')),
    score               INT         NOT NULL CHECK (score >= 0),
    total               INT         NOT NULL CHECK (total > 0),
    reviewed_roots      INT         NOT NULL DEFAULT 0 CHECK (reviewed_roots >= 0),
    used_tracked_roots  BOOLEAN     NOT NULL DEFAULT FALSE,
    completed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, session_key)
);

ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own quiz attempts"
    ON quiz_attempts
    FOR ALL
    USING      (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_completed_at
    ON quiz_attempts (user_id, completed_at DESC);


