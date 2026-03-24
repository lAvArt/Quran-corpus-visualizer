# Observability

## Purpose

This document defines the telemetry surface that should be reviewed for release candidates.

## Event Catalog

### Onboarding and engagement

The client emits:

- `onboarding_started`
- `onboarding_completed`
- `onboarding_skipped`
- `mode_switched`
- `viz_changed`
- `help_opened`
- `breadcrumb_used`
- `first_task_completed`
- `first_task_feedback`

### Corpus readiness and recovery

The client emits:

- `corpus_shell_ready`
- `corpus_deep_ready`
- `corpus_fallback_used`
- `search_recovery_shown`

Expected `surface` values for corpus readiness events:

- `explore`
- `search`
- `shared`

### Search interaction

The client emits:

- `search_opened`
- `search_query_submitted`
- `search_result_selected`

Current search-surface values:

- `header`
- `sidebar`
- `mobile`

Query submissions also include coarse script classification:

- `arabic`
- `latin`
- `mixed`
- `other`

### Performance

The client emits `performance_metric` with:

- `metric = shell_render`
- `metric = first_search_interaction`

Observed `surface` values can include:

- `explore`
- `search`
- `shared`
- `header`
- `sidebar`
- `mobile`
- `workspace`
- `unknown`

### Client errors

The client emits `client_error` with these current areas:

- `corpus`
- `search`
- `ui`
- `auth`

Known corpus-related codes include:

- `load_failed`
- `empty_corpus_result`
- `fallback_used`

## Release Review

For each release candidate, review at minimum:

1. `corpus_shell_ready` appears for Explore and Search sessions.
2. `corpus_deep_ready` remains present in environments where full data access is expected.
3. `corpus_fallback_used` does not spike after deployment.
4. `search_recovery_shown` remains rare under normal operation.
5. `performance_metric` values for `shell_render` and `first_search_interaction` do not regress materially.
6. `client_error` volume does not increase unexpectedly across `corpus`, `search`, `ui`, or `auth`.

## Current Gaps

- No server-side tracing or centralized error aggregation is configured yet.
- Search API latency and failure dashboards are still lightweight.
- Quiz-specific telemetry is not yet a first-class event family.
- Accessibility regressions still rely on smoke coverage plus manual review rather than a broader automated audit.
