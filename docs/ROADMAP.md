# Roadmap

## v0.1 (MVP) Completed

Goal: ship an accurate first release focused on linguistic graph exploration.

- RootFlowSankey
- AyahDependencyGraph single-ayah focus
- MorphologyInspector hover and focus interactions
- Phase-1 semantic search for root, lemma, part of speech, and exact ayah
- No spatial overlays
- No AI-generated claims presented as truth

## v0.2 Completed

- Better indexing and query UX
- Comparative root-context views
- Performance and cache hardening

## v0.3 Completed

- Radial Surah morphology maps
- Root dispersion views across the corpus
- Stronger inspector cross-linking between syntax and morphology

## v0.4 Completed

- Onboarding and first-run guidance
- Lexical coloring controls
- Export scope options and multi-format export
- Custom theme editing
- PWA install support
- English and Arabic localization

## v0.5 Current stable release

- Knowledge Graph visualization
- Collocation Network visualization
- Knowledge Tracker with local persistence, notes, and import/export
- Dual dictionary integration
- Shared shell polish across graph modes

## v0.6 In progress

- Supabase-backed normalized corpus and search infrastructure
- Productized Search and Study workspaces
- Experimental Quiz workspace with daily and adaptive review flows
- Supabase sync for tracked roots and quiz attempts
- Stronger first-run mission, shell navigation, and recovery-oriented UX
- Expanded release, schema, and observability documentation

## v0.7+

- Better explainability for semantic matches
- Quiz analytics and learning-loop calibration
- Stronger production monitoring and tracing
- Additional server-assisted overview data

## Later: Spatial Layer

Spatial and contextual overlays remain deferred until citation and confidence workflows are ready.

Model:

- `Ayah -> Claim -> Source -> Confidence`

Rules:

- optional only
- user-toggleable
- never the default truth layer
- always source-cited
