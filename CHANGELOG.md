# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Guided Walkthroughs**: Introduced interactive, step-by-step guided walkthroughs (`walkthroughSteps.ts`, `walkthrough.ts`) for complex visualizations, to help users navigate features like the Collocation Network and Radial Sura Map.
- **UI Components**: Added `GlossaryChips.tsx` and `VizBreadcrumbs.tsx` to improve context tracking and vocabulary explanation within graphs.
- **Collocation Network**: Expanded documentation for PMI semantics, context scopes (`Whole Ayah Context` vs `Nearby Words Window`), tertiary context nodes, and context-window references.
- **Schema docs**: Added `CollocationResult` derived-analytics shape (`pmi`, `count`, `sampleLemmas`, `sampleWindows`) and window-reference formats.
- **Supabase database integration** — Full PostgreSQL schema provisioned via 6 migration files:
  - `001_extensions`: pgvector, pg_trgm, unaccent
  - `002_corpus`: `corpus_tokens`, `ayahs`, `root_embeddings` tables + `collocations` and `cross_references` materialized views with all indexes
  - `003_user_data`: `tracked_roots` with Row Level Security enabled
  - `004_functions`: `search_roots_semantic`, `search_corpus_fts`, `search_corpus_trigram`, `get_collocates`, `cross_reference_roots`, `refresh_corpus_views`
  - `005_security`: RLS on corpus tables, write-privilege lockdown, TRUNCATE/REFERENCES/TRIGGER revokes, materialized view grants
  - `006_search_path_fix`: `SET search_path = public, pg_catalog` on all functions (injection hardening)
- **`lib/supabase/`** — Supabase client (`client.ts`), server helper (`server.ts`), middleware client (`middleware-client.ts`), TypeScript types (`types.ts`), `knowledgeService.ts` for tracked-roots CRUD
- **MCP tooling** — `.vscode/mcp.json` for Supabase MCP server integration (gitignored)

### Changed

- **UI Improvements**: Refined `AppSidebar.tsx`, `MobileBottomBar.tsx`, and `VisualizationSwitcher.tsx` to streamline the user experience across desktop and mobile.
- **Search overlays**: Improved `SemanticSearchPanel.tsx` and `MobileSearchOverlay.tsx` layout and behavior.
- **Translations**: Updated English, Arabic, and pseudo-localization files with strings for new walkthrough and UI components.

### Changed

- **Version alignment**: Synchronized app/package version metadata to `0.5.0` to match current release documentation.
- **`.env.example`**: Replaced real Supabase project reference with generic `<your-project-ref>` placeholder; added missing `NEXT_PUBLIC_SUPABASE_ANON_KEY` entry.

### Fixed

- **Root Network Graph**: Corrected link highlighting Z-index priority (using SVG DOM sort) so active root connections render above dimmed connections.
- **Radial Sura Map**: Fixed root connections to highlight all paths associated with a selected root across the entire Quran, and heavily dim overlapping unassociated links.
- **Sankey Flow Graph**: Bound the SVG `viewBox` height parameter to a fixed responsive scale to eliminate layout breaking during dense root zooming.
- **Semantic Search & Morphology Panels**: Fixed the "Click to Focus" behavior so that selecting an Ayah correctly zeroes out active node properties and reroutes back to the `radial-sura` map state.
- **Security — TRUNCATE bypass**: Revoked `TRUNCATE` privilege from `anon` role on `tracked_roots`; `TRUNCATE` bypasses RLS and would have allowed unauthenticated table wipe.
- **Security — excess privileges**: Revoked `REFERENCES` and `TRIGGER` grants from `anon` and `authenticated` on all public tables.
- **Security — search_path injection**: All 6 Supabase functions now have `SET search_path = public, pg_catalog` preventing schema-injection via mutable `search_path`.

## [0.5.0] - 2026-02-21

### Added

- **Knowledge Graph Visualization** — Neural-style force-directed and flow-layout graph of tracked roots and their derived lemmas, with glow effects, ghost-root context nodes, and dual layout toggle
- **Knowledge Tracker** — IndexedDB-backed root learning system with `learning` → `learned` states, personal notes, and timestamped progress
- **Knowledge Context Provider** (`KnowledgeContext.tsx`) — App-wide React context for knowledge state, with hydration from IndexedDB on mount
- **Knowledge Cache** (`knowledgeCache.ts`) — Persistent IndexedDB store for tracked roots with export/import support
- **Knowledge Panel** in Current Selection — Track, annotate, and manage roots directly from any visualization's selection panel
- **Knowledge Settings** in Display Settings — View stats (total/learning/learned), export knowledge as JSON, import from file
- **Dual Dictionary Links** in Mobile Nav — Quick links to Doha Historical Dictionary and Al-Maany for the selected root
- **i18n: 14 new Arabic keys** for Knowledge Graph, Knowledge Tracker, and Display Settings sections
- **Visual polish** across Corpus Architecture Map, Radial Surah Map, Root Network Graph, and Surah Distribution Graph

## [0.4.0] - 2026-02-15

### Added

- Onboarding overlay with guided cards, startup toggle, and persistent local preference
- Replay onboarding action in Display Settings
- Versioned onboarding state key to re-show onboarding when onboarding content is updated
- Lexical coloring controls (theme/frequency/identity) applied across all visualizations
- Export scope options for `Current View` and `Full Graph` with multi-format export menu
- Custom color theme editing including background palette fields with persistence

## [0.3.0] - 2025-02-14

### Added

- **Radial Surah Map** — Visualize the entire Quran as a radial tree
- **Root Network Graph** — Force-directed graph of Arabic root connectivity
- **Surah Distribution Graph** — Root/lemma distribution across all Surahs
- **Corpus Architecture Map** — Structural overview of the entire corpus
- **Root Flow Sankey** — Track how roots flow through grammatical forms
- **Arc Flow Diagram** — Root and grammatical connection flows within an Ayah
- **Ayah Dependency Graph** — Syntactic dependency structure of individual Ayahs
- **Morphology Inspector** — Detailed morphological analysis panel
- **Global Search** — Full-text search across Arabic and English
- **Semantic Search Panel** — Root, lemma, and POS-based search
- **Internationalization** — Full English and Arabic (RTL) support via next-intl
- **Dark/Light theme** switching
- **Mobile responsive** layout with bottom bar navigation
- **Feedback dialog** with email delivery via Brevo
- **Vercel Analytics** integration
- **IndexedDB caching** for offline corpus data
- **Sitemap and robots.txt** for SEO
- **Visualization explainer dialog** for each chart type

## [0.2.0] - 2025-01-15

### Added

- Better indexing and query UX
- Comparative root-context views
- Performance and cache hardening

## [0.1.0] - 2024-12-01

### Added

- Initial MVP release
- RootFlowSankey visualization
- AyahDependencyGraph (single-ayah focus)
- MorphologyInspector with hover/focus interactions
- Phase-1 semantic search: root, lemma, POS, exact ayah
