# Data Sources

This project uses curated linguistic annotation sources for Quranic text analysis.

## Primary Source

### Quranic Arabic Corpus

- Provider: University of Leeds
- Website: https://corpus.quran.com/
- Usage: morphology, syntactic dependency, lexical metadata
- Attribution: required in repository and UI where source-derived views are rendered

## Source Handling Policy

- Treat upstream payloads as external contracts that may change.
- Normalize all data into internal schema (`docs/SCHEMA.md`).
- Do not bind frontend components directly to source payload shapes.
- Cache normalized artifacts for deterministic rendering and reproducibility.

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
