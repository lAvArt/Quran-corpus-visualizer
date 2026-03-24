# Contributing

This file supplements the root [CONTRIBUTING.md](../CONTRIBUTING.md) with repository-specific guardrails.

## Principles

- Accuracy over novelty.
- Source traceability over convenience.
- Explainability over opaque behavior.
- Restraint over speculative claims.

## Local Setup

```bash
npm install
cp .env.example .env.local
supabase db push
npm run dev
```

## Validation Standard

For normal changes, run:

```bash
npm run verify
```

For release-sensitive changes, run:

```bash
npm run verify:release
```

If you touch translations, also run:

```bash
npm run i18n:check
```

## Architecture Rules

- UI consumes normalized internal models only.
- Supabase schema changes require migration updates plus `docs/SCHEMA.md` updates.
- Route-level product behavior belongs to explicit workspaces such as Explore, Search, Study, or Quiz rather than ad hoc page-local logic.
- Shared shell changes should preserve desktop and mobile behavior.

## Documentation Rules

Update docs when any of the following changes:

- route tree or workspace names
- environment variables
- database schema or policies
- release steps or quality gates
- user-visible feature names or onboarding flows

## Not Accepted

- Unsourced claims presented as product truth
- Schema changes without migration notes
- Release-flow changes without documentation updates
