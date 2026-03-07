-- Migration 001: Enable required Postgres extensions
-- Run this in the Supabase SQL editor or via `supabase db push`

CREATE EXTENSION IF NOT EXISTS vector;       -- pgvector: semantic similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- trigram fuzzy matching for Arabic text
CREATE EXTENSION IF NOT EXISTS unaccent;     -- accent-insensitive search helper
