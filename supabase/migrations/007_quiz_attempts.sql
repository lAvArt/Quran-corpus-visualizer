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
