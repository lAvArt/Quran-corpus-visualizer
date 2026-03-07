-- Migration 004: Database functions for search, semantic similarity,
--                collocations, and cross-reference queries

-- ─────────────────────────────────────────────────────────────────
-- 1. search_roots_semantic
--    Returns roots ordered by cosine similarity to a query embedding.
-- ─────────────────────────────────────────────────────────────────

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


-- ─────────────────────────────────────────────────────────────────
-- 2. search_corpus_fts
--    Full-text search over root_normalized + lemma_normalized.
-- ─────────────────────────────────────────────────────────────────

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


-- ─────────────────────────────────────────────────────────────────
-- 3. search_corpus_trigram
--    Fuzzy trigram match across root, lemma, and raw text.
-- ─────────────────────────────────────────────────────────────────

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


-- ─────────────────────────────────────────────────────────────────
-- 4. get_collocates
--    Returns collocates ranked by PMI from the materialized view.
-- ─────────────────────────────────────────────────────────────────

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


-- ─────────────────────────────────────────────────────────────────
-- 5. cross_reference_roots
--    Returns ayahs where both root_a and root_b co-occur.
-- ─────────────────────────────────────────────────────────────────

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


-- ─────────────────────────────────────────────────────────────────
-- 6. refresh_corpus_views (helper for after bulk ingest)
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION refresh_corpus_views()
RETURNS VOID
LANGUAGE SQL
SET search_path = public, pg_catalog
AS $$
    REFRESH MATERIALIZED VIEW CONCURRENTLY collocations;
    REFRESH MATERIALIZED VIEW CONCURRENTLY cross_references;
$$;
