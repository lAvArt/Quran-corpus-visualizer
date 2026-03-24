# Release Checklist

## Quality Gates

Run:

```bash
npm run verify
npm run verify:release
```

If you need the explicit breakdown, `verify:release` currently expands to lint, typecheck, unit tests, build, accessibility smoke, and Playwright end-to-end coverage.

## Product Checks

- Explore loads with shell-ready content before deep corpus loading completes.
- Search loads with usable quick search and readable recovery states.
- Study renders correctly for signed-in users.
- Quiz renders and can complete both daily and adaptive review sessions.
- Auth, migration, import/export, and resume flows still work.
- Mobile shell, search overlay, and navigation behave correctly.

## Sync and Persistence Checks

- Tracked roots still migrate from local storage to Supabase correctly.
- Notes and state changes persist across reloads for authenticated users.
- Quiz progress saves locally.
- Authenticated quiz attempts sync to `quiz_attempts` without duplicates.

## Degraded-State Checks

- Corpus fallback messaging is readable in Explore, Search, and Quiz boot flows.
- Search recovery messaging is readable in Explore and Search.
- Full-corpus loading states do not block shell-level exploration.

## Metadata and Routing

- Manifest routes respond for root and localized paths.
- Canonical, Open Graph, and Twitter metadata resolve against the production domain.
- Localized Explore, Search, Study, Quiz, Profile, and Auth routes render correctly.
- Embed routes still load expected visualization modes.

## Observability Review

- Review [docs/OBSERVABILITY.md](OBSERVABILITY.md).
- Confirm expected readiness, recovery, performance, and client-error events appear.
- Compare `shell_render` and `first_search_interaction` against the previous release baseline.

## Manual Accessibility Smoke

- Keyboard navigation reaches shell navigation, auth controls, search inputs, and quiz cards.
- Visible focus states remain present on primary controls.
- Heading hierarchy and landmark regions remain intact across Explore, Search, Study, Quiz, and Auth.
