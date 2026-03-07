-- Migration 003: User data – tracked roots with Row Level Security

-- ─────────────────────────────────────────────────────────────────
-- tracked_roots
-- ─────────────────────────────────────────────────────────────────

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
