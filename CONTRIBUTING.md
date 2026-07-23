# Contributing to Quranic Linguistics Observatory

This project treats documentation, source attribution, and behavior correctness as first-class work. If a change affects product behavior, schema, or release flow, update the docs in the same branch.

## Quick Start

```bash
git clone https://github.com/<your-username>/Quran-corpus-visualizer.git
cd Quran-corpus-visualizer
npm install
cp .env.example .env.local
supabase db push
npm run dev
```

Minimum local environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Useful optional variables live in `.env.example`, including feedback email, OpenAI-backed search helpers, and rate-limit controls.

## Development Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the local app |
| `npm run lint` | Lint app sources |
| `npm run typecheck` | Run TypeScript |
| `npm test` | Run Vitest |
| `npm run test:e2e` | Run Playwright |
| `npm run test:a11y-smoke` | Accessibility smoke checks |
| `npm run verify` | Lint, typecheck, test, build |
| `npm run verify:release` | Full release verification |
| `npm run i18n:check` | Validate message coverage |
| `npm run i18n:pseudo` | Regenerate pseudo-localized strings |
| `npm run docs:generate` | Refresh screenshot-backed docs assets |

## Contribution Rules

### Reporting bugs

1. Check [existing issues](https://github.com/lAvArt/Quran-corpus-visualizer/issues).
2. Use the bug template.
3. Include browser, platform, reproduction steps, and whether the issue affects Explore, Search, Study, Quiz, or shared shell behavior.

### Suggesting features

1. Check [docs/ROADMAP.md](docs/ROADMAP.md) and [docs/ROADMAP_STATUS.md](docs/ROADMAP_STATUS.md).
2. Describe the user problem before the implementation idea.
3. Call out data, attribution, accessibility, and release implications.

### Submitting code

1. Branch from `main`.
2. Keep the branch scoped.
3. Add or update tests when behavior changes.
4. Update docs when routes, schema, env vars, or release checks change.
5. Run `npm run verify` before opening a pull request.

## Architecture Guidelines

### Naming

Use explicit, domain-correct names.

- `CollocationNetworkGraph`
- `MorphologyInspector`
- `ReviewQuiz`
- `SearchWorkspace`
- `JourneyRail`

Avoid vague names such as `Analyzer`, `GraphView`, or `DataPanel`.

### Source boundaries

- UI components should consume normalized internal models, not raw upstream payloads.
- Search and corpus transforms belong under `lib/`.
- Shared shell and workspace orchestration belong in `components/shell/`, `components/search/`, `components/study/`, or `components/quiz/` as appropriate.
- Supabase table or RPC changes require matching migration and schema doc updates.

### Data integrity

- Accuracy over novelty.
- Source traceability over convenience.
- Explainability over opaque behavior.
- Restraint over speculative claims.

## Pull Request Checklist

- [ ] Scope is coherent and route-aware
- [ ] Naming is explicit and domain-correct
- [ ] Source attribution is preserved
- [ ] Tests or validation steps are included
- [ ] Docs are updated for behavior, schema, or release-flow changes
- [ ] `npm run verify` passes

## Not Accepted

- Unsourced historical or geographic assertions
- Opaque ranking claims without rationale
- Frontend code bound directly to external payload shapes
- Behavior changes that skip docs or release-flow updates

## More Detail

Additional contributor guidance lives in [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).
