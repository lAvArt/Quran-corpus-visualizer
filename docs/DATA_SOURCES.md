# Data Sources

This project uses curated linguistic annotation sources for Quranic text analysis.

## Primary Source

### Quranic Arabic Corpus

- Provider: University of Leeds
- Website: https://corpus.quran.com/
- Usage: morphology, syntactic dependency, lexical metadata
- Attribution: required in repository and UI where source-derived views are rendered
- Dataset: `public/data/quranic-corpus-morphology-0.4.txt` (verbatim copy)
- Version: morphology 0.4
- Retrieval date: 2026-02-06
- License note (from file header): verbatim copies allowed, changes not allowed; source attribution and link required.

## Storage Layer

Normalized corpus data is stored in a [Supabase](https://supabase.com) PostgreSQL database (project region: `ap-south-1`). Raw upstream data is:

1. Parsed by local adapters in `lib/corpus/`
2. Normalized into internal schema (see `docs/SCHEMA.md`)
3. Ingested into Supabase tables via `scripts/seed-corpus.ts` (requires `SUPABASE_SERVICE_ROLE_KEY`)

Derivatives computed from normalized tokens (PMI collocations, FTS vectors, trigram indexes) are then available via PostgreSQL functions — see `supabase/migrations/004_functions.sql`.

## Source Handling Policy

- Treat upstream payloads as external contracts that may change.
- Normalize all data into internal schema (`docs/SCHEMA.md`).
- Do not bind frontend components directly to source payload shapes.
- Cache normalized artifacts for deterministic rendering and reproducibility.
- Derived metrics (for example PMI-based collocation windows used by the Collocation Network) are computed locally from normalized tokens.

## Licensing and Redistribution

- Source-specific licensing terms must be verified before bundling or redistributing raw data dumps.
- Until explicitly verified, distribute adapters and normalized schema code, not full raw exports.
- Any downloadable data package must include attribution and license notice.

## Citation Standard

Each source-integrated feature should retain:

- source name,
- source URL,
- retrieval date or version marker,
- transformation notes (if data is normalized or merged).
