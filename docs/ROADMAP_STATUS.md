# Roadmap Status

This file tracks current progress against the `Quran Corpus Visualizer Web App Upgrade Plan`.

## Overall Status

- Product baseline: no longer a prototype
- Core repo quality gates: green
- Main remaining work: final product prioritization, launch hardening, and deeper data/UX refinement

## Phase Status

### Phase 1: Foundation and Repo Hygiene

Status: completed

- lint/typecheck/build workflow stabilized
- nested unrelated app excluded from lint scope
- Next/Turbopack and metadata warnings cleaned up
- workspace assumptions documented

### Phase 2: Product Information Architecture

Status: completed

- `Explore`, `Search`, and `Study` are real product modes
- dedicated Search and Study routes/workspaces exist
- shell navigation reflects the product split

### Phase 3: App Shell Refactor

Status: completed

- home route is decomposed into shell/controller modules
- visualization viewport, header, overlays, and controller responsibilities were separated
- page-level orchestration is materially thinner than the original monolith

### Phase 4: Data and Loading Strategy

Status: substantially progressed

- shell-ready vs deep-data-ready contract exists
- Explore and Search now share a single corpus-loading path
- shell/overview corpus assembly now lives in a dedicated service layer
- fallback/loading states are explicit and user-readable

Still open:

- richer server-prepared overview data
- stronger split between overview data and deeper corpus fetches

### Phase 5: Search as a First-Class Product Surface

Status: substantially completed

- shared search contracts and service layer exist
- Search workspace is a first-class route
- grouped/recovery-oriented search UX exists
- search availability/fallback messaging is explicit

Still open:

- deeper ranking sophistication
- more server-dominant search behavior over time

### Phase 6: Visualization UX and Progressive Disclosure

Status: progressed

- beginner/advanced guidance improved
- context-transform messaging exists
- restore/recovery flows exist after context-reducing view changes

Still open:

- more systematic mode-aware controls across all visualizations
- further reduction of advanced-view complexity for first-time users

### Phase 7: Mobile UX Simplification

Status: progressed

- mobile search/tools flows are covered by e2e
- overlay behavior is more explicit and more testable

Still open:

- more aggressive simplification of mobile chrome and stacked controls

### Phase 8: Design System Extraction

Status: substantially progressed

- Search, Study, auth, sidebar, selection, overlay, and inspector surfaces share more of the same UI system
- `MorphologyInspector` local shell styles were moved into shared CSS

Still open:

- remaining localized pockets of component-specific presentation cleanup
- possible longer-term token/component extraction beyond shared CSS classes

### Phase 9: Auth, Profile, and Study Experience

Status: completed for current milestone

- auth pages are normalized into the shared visual system
- profile functions as a Study hub
- migration, import/export, resume, and tracked-root editing flows are implemented and tested

### Phase 10: Testing and Quality Gates

Status: completed for current milestone

- unit/integration coverage is healthy
- Playwright smoke coverage exists across Explore, Search, Study, mobile, fallback, migration, and recovery flows
- accessibility smoke coverage exists
- repo quality gates are green

### Phase 11: Analytics, Monitoring, and Launch Hardening

Status: materially underway

- outcome analytics exist for readiness/fallback/recovery
- shell render and first search interaction performance metrics exist
- observability and release docs exist

Still open:

- broader production monitoring integration beyond current instrumentation
- final pre-launch operational review in a real environment

## Current Quality Gates

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:a11y-smoke`
- `npm run test:e2e`
- `npm run verify`
- `npm run verify:release`

## Recommended Next Milestone

### Milestone: Launch Hardening and Final Product Prioritization

Focus:

- perform a final release-readiness pass in a real Supabase-backed environment
- decide whether the next product investment goes into:
  - deeper data architecture
  - visualization UX refinement
  - mobile simplification
- close any remaining non-critical visual consistency gaps

## Remaining High-Value Work

1. Final pre-release real-environment verification for auth, study migration, import/export, and search services.
2. Stronger server-assisted overview data for first meaningful paint.
3. Further visualization UX refinement and progressive disclosure.
4. Final mobile simplification pass.
