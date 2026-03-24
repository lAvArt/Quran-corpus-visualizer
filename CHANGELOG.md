# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Experimental `Quiz` workspace with a daily puzzle and adaptive review flow.
- Local quiz history storage plus summary helpers in `lib/quiz/quizProgress.ts`.
- Supabase-backed quiz attempt sync through `lib/supabase/quizService.ts`.
- Database migration `007_quiz_attempts.sql` for per-user quiz history with RLS.
- Quiz-focused test coverage for question templates, progress summaries, and Supabase sync.

### Changed

- Journey rail navigation now includes the `Quiz` route alongside Explore, Search, and Study.
- First-run guidance has shifted toward intent-driven mission selection and updated workspace copy.
- Search, shell, study, and quiz UI text has been refreshed across English, Arabic, and pseudo-localized message sets.
- Documentation has been refreshed to reflect the current route tree, schema, release flow, and migration set.

### Fixed

- Documentation drift around migration counts, directory layout, and release verification steps.

## [0.5.0] - 2026-02-21

### Added

- Knowledge Graph visualization with force and flow layouts.
- Knowledge Tracker with local persistence, learning states, notes, and import/export.
- Knowledge context provider for app-wide tracked-root state.
- Display settings controls for knowledge stats and import/export actions.
- Arabic translations for knowledge and settings surfaces.

## [0.4.0] - 2026-02-15

### Added

- Onboarding overlay with persistent startup preference.
- Replay onboarding action in display settings.
- Lexical coloring controls across visualizations.
- Export scope options and multi-format export menu.
- Custom theme editing with persistence.

## [0.3.0] - 2025-02-14

### Added

- Radial Surah Map.
- Root Network Graph.
- Surah Distribution Graph.
- Corpus Architecture Map.
- Root Flow Sankey.
- Arc Flow Diagram.
- Ayah Dependency Graph.
- Morphology Inspector.
- Global Search and Semantic Search panel.
- English and Arabic localization.
- Theme switching and mobile-responsive layout.
- Feedback dialog and Vercel Analytics integration.
- IndexedDB caching and metadata routes.

## [0.2.0] - 2025-01-15

### Added

- Better indexing and query UX.
- Comparative root-context views.
- Performance and cache hardening.

## [0.1.0] - 2024-12-01

### Added

- Initial MVP release.
- RootFlowSankey visualization.
- AyahDependencyGraph single-ayah focus.
- MorphologyInspector hover and focus interactions.
- Phase-1 semantic search for root, lemma, part of speech, and exact ayah.
