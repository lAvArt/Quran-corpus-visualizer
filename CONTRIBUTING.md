# Contributing to Quran Corpus Visualizer

Thank you for your interest in contributing! This project aims to make the linguistic structure of the Quran more accessible through interactive visualizations.

## Quick Start

```bash
# 1. Fork and clone
git clone https://github.com/<your-username>/Quran-corpus-visualizer.git
cd Quran-corpus-visualizer

# 2. Install dependencies
npm install

# 3. (Optional) Fetch morphology data for offline dev
npm run fetch:morphology

# 4. Start the dev server
npm run dev
```

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run test` | Run tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run i18n:check` | Validate i18n completeness |

## How to Contribute

### Reporting Bugs

1. Check [existing issues](https://github.com/lAvArt/Quran-corpus-visualizer/issues) first.
2. Use the **Bug Report** template when creating a new issue.
3. Include browser, OS, and steps to reproduce.

### Suggesting Features

1. Check the [Roadmap](docs/ROADMAP.md) to see if it's already planned.
2. Use the **Feature Request** template.
3. Explain the use case and how it benefits Quran exploration.

### Submitting Code

1. **Fork** the repository and create a feature branch from `main`.
2. Follow the coding conventions below.
3. Add tests for new functionality.
4. Ensure all checks pass: `npm run lint && npm run typecheck && npm run test`
5. Submit a Pull Request using the PR template.

## Coding Conventions

### Naming

Use explicit names that encode purpose:

- `RootFlowSankey` — not `GraphView`
- `AyahDependencyGraph` — not `DataPanel`
- `MorphologyInspector` — not `Analyzer`

### Architecture

- UI consumes internal schema models only (see [docs/SCHEMA.md](docs/SCHEMA.md)).
- External API adapters live under `lib/corpus/`.
- Visualization components go in `components/visualisations/`.
- Reusable UI components go in `components/ui/`.

### Data Integrity

- Accuracy over novelty.
- Source traceability over convenience.
- Explainability over opaque behavior.
- Restraint over speculative features.

## Scope Rules

- Check [docs/ROADMAP.md](docs/ROADMAP.md) for current phase priorities.
- Avoid unrelated feature expansion in PRs.
- Do not introduce spatial or semantic claims without citation and confidence modeling.

## Pull Request Checklist

- [ ] Feature aligns with roadmap phase
- [ ] Naming is explicit and domain-correct
- [ ] Source attribution is preserved
- [ ] Tests or validation steps are included
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes
- [ ] Docs updated when behavior or schema changes

## Not Accepted

- Unsourced historical/geographic assertions
- Black-box ranking claims without rationale
- Hard-coding external payload assumptions in UI components

## License

By contributing, you agree that your contributions will be licensed under the [GNU General Public License v3.0](LICENSE).
