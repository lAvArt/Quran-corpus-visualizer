# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
