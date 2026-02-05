# Roadmap

## v0.1 (MVP)

Goal: ship a polished, accurate first release focused on linguistic graph exploration.

- `RootFlowSankey`
- `AyahDependencyGraph` (single-ayah focus)
- `MorphologyInspector` (hover/focus interactions)
- Phase-1 semantic search: root, lemma, POS, exact ayah
- No spatial overlays
- No AI-generated claims

## v0.2

- Better indexing and query UX
- Comparative root-context views
- Performance and cache hardening for larger exploration sessions

## v0.3

- Radial sura morphology maps
- Root dispersion maps across full corpus
- Stronger inspector cross-linking between syntax and morphology

## v0.4+

- Optional vector-based semantic retrieval
- Explainability layer for semantic matches
- User-visible rationale for ranking decisions

## Later: Spatial Layer

Spatial/contextual overlays are deferred until confidence and citation workflows are production-ready.

Model:

- `Ayah -> Claim -> Source -> Confidence`

Rules:

- Optional overlays only
- Toggleable by user
- Never presented as default truth
- Always source-cited
