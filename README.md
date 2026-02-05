# Quran Corpus Visualizer

Interactive semantic and linguistic visualisations of the Quran based on the Quranic Arabic Corpus.

## What This Is

Quran Corpus Visualizer treats the Quran as a structured semantic graph, not as a flat text surface.

Core model:

- `Sura -> Ayah -> Token`
- `Token -> Root / Lemma / Morphology`
- `Token -> Dependency (head / relation)`
- Later: `Ayah -> Claim -> Source -> Confidence`

## What This Is Not

- Not a tafsir replacement.
- Not a generative AI explanation engine.
- Not a source of uncited historical or spatial claims.

## Data Sources and Attribution

Primary source:

- Quranic Arabic Corpus (University of Leeds): morphological and syntactic annotation.

This project centers attribution and source traceability. See `docs/DATA_SOURCES.md` for source policy, usage notes, and redistribution constraints.

## Visualisations Overview

MVP (`v0.1`):

- `RootFlowSankey`: root-to-word flow exploration.
- `AyahDependencyGraph`: single-ayah dependency structure.
- `MorphologyInspector`: hover and focus morphology panel.

Planned:

- Radial sura morphology maps.
- Root dispersion views across the Quran.
- Comparative root-context views.

## Semantic Search Philosophy

Phase 1 uses transparent lexical and linguistic filters (root, lemma, POS, exact ayah).

Any later semantic ranking must remain explainable:

- show why a match appears,
- expose matched roots/morphology,
- avoid black-box claims.

## Roadmap

- `v0.1`: root flow + ayah dependency + morphology inspector.
- `v0.2`: stronger indexing and comparative views.
- `v0.3+`: optional semantic vectors with explainability.
- Spatial overlays only after confidence modeling and citation workflow are stable.

See `docs/ROADMAP.md` for milestone detail.

## Current Implementation Status

Initial `v0.1` slice is live in code:

- App shell + TypeScript data contracts.
- Sample corpus tokens for development.
- `RootFlowSankey` prototype with root filter and count labels.
- `AyahDependencyGraph` prototype for single-ayah dependency arcs.
- `MorphologyInspector` with hover/focus token inspection.
- `SemanticSearchPanel` with phase-1 filters (root, lemma, POS, ayah).

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Academic and Educational Intent

This project is built as a research and learning instrument. The goal is clarity, source discipline, and reproducible interpretation support.

## Repository Layout

```text
Quran-corpus-visualizer/
├─ app/
├─ components/
│  ├─ visualisations/
│  ├─ inspectors/
│  └─ ui/
├─ lib/
│  ├─ corpus/
│  ├─ schema/
│  ├─ search/
│  └─ cache/
├─ public/
├─ styles/
├─ docs/
│  ├─ SCHEMA.md
│  ├─ DATA_SOURCES.md
│  ├─ ROADMAP.md
│  ├─ CONTRIBUTING.md
│  └─ CONFIDENCE_MODEL.md
├─ README.md
└─ LICENSE
```
