# Release Checklist

## Quality Gates

Run all of the following before release:

```bash
npm run lint
npm run typecheck
npm test
npx playwright test tests/e2e/app-smoke.spec.ts
npm run test:a11y-smoke
npm run build
```

## Product Checks

- Explore loads with shell-ready messaging before deep corpus completes.
- Search loads with shell-ready messaging and usable quick search.
- Study renders correctly for authenticated users.
- Auth, migration, import/export, and resume flows still work.
- Mobile search overlay still opens, selects, and returns context cleanly.

## Degraded-State Checks

- Corpus fallback messaging is readable in Explore and Search.
- Search recovery messaging is readable in Explore and Search.
- Full-corpus loading messaging does not block shell-ready exploration.

## Metadata and Routing

- Manifest routes respond correctly for root and localized paths.
- Canonical, Open Graph, and Twitter metadata resolve against the production domain.
- Localized Explore, Search, Study, Profile, and Auth routes render correctly.

## Observability Review

- Review `docs/OBSERVABILITY.md`.
- Confirm expected events appear for shell-ready render, deep-data-ready transition, and search interaction timing.

## Manual Accessibility Smoke

- Keyboard navigation reaches app mode navigation, auth controls, and search inputs.
- Visible focus states remain present on primary interactive controls.
- Main headings and landmark regions are present on Explore, Search, Study, and Auth.
