# Roadmap Status

This file tracks delivery status against the current product direction of Quranic Linguistics Observatory.

## Overall Status

- The app is now a multi-surface product rather than a single exploration prototype.
- Core local quality gates are in place and generally stable.
- The main remaining work is launch hardening, quiz stabilization, and a final production-oriented prioritization pass.

## Phase Status

### Phase 1: Foundation and Repo Hygiene

Status: completed

- lint, typecheck, unit test, and build flows are stable
- workspace assumptions and release guidance are documented
- unrelated nested projects are excluded from the main app workflow

### Phase 2: Product Information Architecture

Status: completed

- `Explore`, `Search`, `Study`, and `Quiz` now exist as distinct surfaces
- shell navigation reflects the product split
- route-level workspaces are no longer buried inside the home page

### Phase 3: App Shell Refactor

Status: completed

- shell, overlays, viewport orchestration, and route workspaces are split across focused modules
- the journey rail and workspace shell patterns now carry the main product navigation
- page-level orchestration is materially thinner than the original monolith

### Phase 4: Data and Loading Strategy

Status: substantially progressed

- shell-ready versus deep-data-ready contracts exist
- Explore, Search, and Quiz share the same overview corpus boot path
- fallback and degraded states are explicit and user-readable

Still open:

- richer server-prepared overview data
- stronger separation between overview payloads and deeper corpus fetches

### Phase 5: Search as a First-Class Product Surface

Status: substantially completed

- Search has a dedicated workspace
- shared search contracts and service layers exist
- fallback and recovery messaging are explicit

Still open:

- deeper ranking sophistication
- broader server-assisted search behavior
- clearer telemetry around search-specific failure classes

### Phase 6: Visualization UX and Progressive Disclosure

Status: progressed

- first-run guidance and mission selection exist
- contextual breadcrumbs and explainer flows exist
- recovery flows after context-reducing transitions are present

Still open:

- more systematic mode-aware controls across all visualizations
- further simplification of advanced states for first-time users

### Phase 7: Mobile UX Simplification

Status: progressed

- mobile search and shell flows are covered by existing smoke and visual suites
- the app shell is more explicit and testable on narrow screens

Still open:

- more aggressive simplification of stacked mobile controls
- dedicated quiz mobile interaction review

### Phase 8: Design System Extraction

Status: substantially progressed

- Search, Study, Quiz, auth, shell, and inspector surfaces share more of the same UI language
- shared workspace shells and global CSS primitives cover more of the product than before

Still open:

- remaining pockets of component-local styling cleanup
- longer-term extraction of design tokens and reusable primitives

### Phase 9: Auth, Profile, Study, and Learning Loop

Status: substantially progressed

- auth routes are normalized into the shared shell language
- Study and Profile flows support tracked roots, notes, import/export, and migration
- experimental Quiz flows now exist with local progress and Supabase-backed attempt sync

Still open:

- dedicated quiz telemetry
- quiz difficulty calibration and analytics
- wider release-readiness validation of study and quiz sync behavior

### Phase 10: Testing and Quality Gates

Status: strong, still widening

- unit coverage includes corpus readiness, search, auth context, knowledge sync, quiz progress, and quiz Supabase sync
- Playwright smoke, accessibility, and visual suites cover the main app shell surfaces
- `npm run verify` and `npm run verify:release` define the baseline quality gates

Still open:

- dedicated end-to-end coverage for quiz route behavior
- more failure-mode coverage around remote sync and degraded states

### Phase 11: Analytics, Monitoring, and Launch Hardening

Status: underway

- readiness, fallback, recovery, and performance events exist
- observability and release docs exist

Still open:

- centralized production monitoring and tracing
- final real-environment release review
- explicit quiz/learning-loop metrics

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

### Milestone: Launch Hardening and Quiz Stabilization

Focus:

- verify auth, tracked-root sync, and quiz attempt sync in a real Supabase-backed environment
- tighten quiz UX and add route-specific release checks
- close remaining telemetry and degraded-state visibility gaps

## Remaining High-Value Work

1. Real-environment verification for auth, tracked roots, and quiz sync.
2. Stronger server-prepared overview payloads for first meaningful paint.
3. Additional quiz coverage and telemetry.
4. Final mobile simplification and visual consistency pass.
