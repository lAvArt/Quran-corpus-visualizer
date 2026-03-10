# Observability

## Purpose

This document defines the minimum telemetry and review flow for release candidates of Quran Corpus Visualizer.

## Core Outcome Events

The client currently emits these product-level events through Vercel Analytics:

- `corpus_shell_ready`
- `corpus_deep_ready`
- `corpus_fallback_used`
- `search_recovery_shown`
- `search_opened`
- `search_query_submitted`
- `search_result_selected`
- `first_task_completed`
- `first_task_feedback`

## Performance Events

The client currently emits:

- `performance_metric` with `metric = shell_render`
- `performance_metric` with `metric = first_search_interaction`

Expected surfaces:

- `explore`
- `search`
- `header`
- `sidebar`
- `mobile`
- `workspace`

## Client Error Events

The client currently emits:

- `client_error` with `area = corpus`

Known corpus error codes:

- `load_failed`
- `empty_corpus_result`
- `fallback_used`

## Release Review

For a release candidate, review at minimum:

1. `corpus_shell_ready` is present for both Explore and Search sessions.
2. `corpus_deep_ready` occurs in environments where full corpus access is expected.
3. `corpus_fallback_used` does not spike unexpectedly after deployment.
4. `search_recovery_shown` remains low in normal production conditions.
5. `performance_metric` values for `shell_render` and `first_search_interaction` are not materially worse than the prior release.

## Gaps Still Open

- No server-side tracing or centralized error aggregation is configured yet.
- Search API latency/error monitoring is not yet formalized.
- Accessibility regressions are currently guarded by smoke tests and checklist review, not full audit automation.
