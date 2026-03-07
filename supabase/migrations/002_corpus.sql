-- Migration 002: Corpus tables, indexes, materialized views
-- Stores the full Quran corpus with search-optimised columns

-- ─────────────────────────────────────────────────────────────────
-- 1. corpus_tokens
-- ─────────────────────────────────────────────────────────────────

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
            '[أإآٱ]', 'ا', 'g'
        )
    ) STORED,
    lemma_normalized TEXT GENERATED ALWAYS AS (
        regexp_replace(
            regexp_replace(lower(lemma), '[\u064B-\u065F\u0670\u0640]', '', 'g'),
            '[أإآٱ]', 'ا', 'g'
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
                    '[أإآٱ]', 'ا', 'g'
                )
                || ' ' ||
                regexp_replace(
                    regexp_replace(lower(coalesce(lemma, '')), '[\u064B-\u065F\u0670\u0640]', '', 'g'),
                    '[أإآٱ]', 'ا', 'g'
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


-- ─────────────────────────────────────────────────────────────────
-- 2. ayahs
-- ─────────────────────────────────────────────────────────────────

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


-- ─────────────────────────────────────────────────────────────────
-- 3. root_embeddings  (pgvector semantic search)
-- ─────────────────────────────────────────────────────────────────

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


-- ─────────────────────────────────────────────────────────────────
-- 4. collocations  (materialized view – pre-computed PMI)
-- ─────────────────────────────────────────────────────────────────

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


-- ─────────────────────────────────────────────────────────────────
-- 5. cross_references  (materialized view – co-occurring roots per ayah)
-- ─────────────────────────────────────────────────────────────────

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
