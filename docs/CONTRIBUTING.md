# Contributing

Thanks for contributing to Quran Corpus Visualizer.

## License

By contributing to this repository, you agree that your contributions will be licensed under its **GNU General Public License v3.0 (GPL-3.0)**.

## Principles

- Accuracy over novelty.
- Source traceability over convenience.
- Explainability over opaque behavior.
- Restraint over speculative features.

## Scope Rules

- MVP scope is fixed in `docs/ROADMAP.md` (`v0.1` section).
- Avoid unrelated feature expansion in MVP PRs.
- Do not introduce spatial or semantic claims without citation and confidence modeling.

## Naming Conventions

Use explicit names that encode purpose:

- `RootFlowSankey`
- `AyahDependencyGraph`
- `MorphologyInspector`
- `SemanticSearchPanel`

Avoid vague names like `GraphView`, `DataPanel`, or `Analyzer`.

## Data and Schema Rules

- UI must consume internal schema models only (`docs/SCHEMA.md`).
- External API adapters live under `lib/corpus/`.
- Any schema change requires docs updates and migration notes.

## Pull Request Checklist

- Feature aligns with roadmap phase
- Naming is explicit and domain-correct
- Source attribution is preserved
- Tests or validation steps are included
- Docs updated when behavior or schema changes

## Not Accepted

- Unsourced historical/geographic assertions
- Black-box ranking claims without rationale
- Hard-coding external payload assumptions in UI components
