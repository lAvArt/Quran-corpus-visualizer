# Internal Schema

This project normalizes all external corpus data into an internal graph model.
UI components must consume only this internal model, never raw upstream payloads.

## Core Entities

### Sura

- `id`: integer (1-114)
- `nameArabic`: string
- `nameTransliteration`: string
- `ayahCount`: integer

### Ayah

- `id`: string (`{sura}:{ayah}`)
- `suraId`: integer
- `ayahNumber`: integer
- `textUthmani`: string
- `tokenIds`: string[]

### Token

- `id`: string (`{sura}:{ayah}:{token}`)
- `suraId`: integer
- `ayahNumber`: integer
- `position`: integer
- `surface`: string
- `root`: string | null
- `lemma`: string | null
- `pos`: string
- `morphology`: Morphology

### Morphology

- `features`: `Record<string, string>`
- `gloss`: string | null
- `stem`: string | null

### DependencyEdge

- `id`: string
- `ayahId`: string
- `dependentTokenId`: string
- `headTokenId`: string
- `relation`: string

## Derived Indexes

### RootIndex

- key: root
- value: token IDs and ayah IDs containing that root

### LemmaIndex

- key: lemma
- value: token IDs and ayah IDs containing that lemma

### PosIndex

- key: POS tag
- value: token IDs and ayah IDs containing that tag

### CollocationResult (Derived Analytics)

Calculated at runtime from normalized `Token` data (not stored as a primary corpus entity).

- `root`: string (collocated root)
- `count`: integer (co-occurrence count within selected context scope)
- `pmi`: number (Pointwise Mutual Information score)
- `sampleLemmas`: string[] (sample lemmas observed for the collocated root)
- `sampleWindows`: string[] (sample context references used by tertiary nodes)

`sampleWindows` format depends on scope mode:

- `Whole Ayah Context` (`windowType: "ayah"`): `{sura}:{ayah}`
- `Nearby Words Window` (`windowType: "distance"`): `{sura}:{ayah}:{position}`

### TrackedRoot (Knowledge Tracker)

Persisted in IndexedDB (`qcv-knowledge` store). Not part of the upstream corpus — this is user-generated learning state.

- `root`: string (primary key, Arabic root)
- `state`: KnowledgeState (`"learning"` | `"learned"`)
- `notes`: string (optional, user-entered)
- `trackedAt`: number (timestamp, epoch ms)
- `updatedAt`: number (timestamp, epoch ms)

## Relation Model

- `Sura 1..n Ayah`
- `Ayah 1..n Token`
- `Ayah 1..n DependencyEdge`
- `Token 0..1 Root`
- `Token 0..1 Lemma`

## JSON Shape Example

```json
{
  "ayah": {
    "id": "2:255",
    "suraId": 2,
    "ayahNumber": 255,
    "textUthmani": "...",
    "tokenIds": ["2:255:1", "2:255:2"]
  },
  "tokens": [
    {
      "id": "2:255:1",
      "suraId": 2,
      "ayahNumber": 255,
      "position": 1,
      "surface": "...",
      "root": "...",
      "lemma": "...",
      "pos": "N",
      "morphology": {
        "features": {
          "case": "nom",
          "state": "def"
        },
        "gloss": null,
        "stem": null
      }
    }
  ],
  "dependencies": [
    {
      "id": "2:255:dep:1",
      "ayahId": "2:255",
      "dependentTokenId": "2:255:2",
      "headTokenId": "2:255:1",
      "relation": "nsubj"
    }
  ]
}
```

## Schema Rules

- IDs are stable and deterministic.
- Arrays are position-sorted where relevant.
- Null means unknown or unavailable; do not overload empty strings.
- Any lossy transform from upstream data must be documented in adapter code.

---

## Database Schema (Supabase / PostgreSQL)

The following tables and views are provisioned by `supabase/migrations/` (001–006).

### `corpus_tokens`

Normalized morphological tokens from the Quranic Arabic Corpus.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT` PK | `{sura}:{ayah}:{position}` |
| `sura` | `SMALLINT` | Surah number (1–114) |
| `ayah` | `SMALLINT` | Ayah number |
| `position` | `SMALLINT` | Token position within ayah |
| `root` | `TEXT` | Arabic root (nullable) |
| `lemma` | `TEXT` | Lemma form (nullable) |
| `pos` | `TEXT` | Part-of-speech tag |
| `text` | `TEXT` | Surface form |
| `root_normalized` | `TEXT` GENERATED | Unaccented/normalized root |
| `lemma_normalized` | `TEXT` GENERATED | Unaccented/normalized lemma |
| `search_vector` | `TSVECTOR` GENERATED | Weighted FTS vector (root + lemma) |

RLS: enabled. `anon` + `authenticated` → SELECT only.

### `ayahs`

Ayah-level Uthmani text for display and cross-reference.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT` PK | `{sura}:{ayah}` |
| `sura` | `SMALLINT` | |
| `ayah` | `SMALLINT` | |
| `text_uthmani` | `TEXT` | Full Uthmani script text |

RLS: enabled. `anon` + `authenticated` → SELECT only.

### `root_embeddings`

Pre-computed 768-dimensional vector embeddings per root for semantic search.

| Column | Type | Notes |
|--------|------|-------|
| `root` | `TEXT` PK | Arabic root |
| `embedding` | `VECTOR(768)` | Embedding vector (pgvector) |

Index: HNSW on `embedding` with cosine distance. RLS: enabled. `anon` + `authenticated` → SELECT only.

### `collocations` (Materialized View)

Pre-aggregated co-occurrence statistics with PMI scores.

| Column | Type | Notes |
|--------|------|-------|
| `root_a` | `TEXT` | First root |
| `root_b` | `TEXT` | Second root |
| `window_type` | `TEXT` | `'ayah'` or `'distance'` |
| `co_count` | `BIGINT` | Co-occurrence count |
| `pmi` | `NUMERIC` | Pointwise Mutual Information |
| `surah_count` | `BIGINT` | Number of distinct surahs |

Refreshed via `refresh_corpus_views()`. SELECT granted to `anon`, `authenticated`.

### `cross_references` (Materialized View)

Ayah-level root co-occurrence for cross-reference lookup.

| Column | Type | Notes |
|--------|------|-------|
| `sura` | `SMALLINT` | |
| `ayah` | `SMALLINT` | |
| `roots` | `TEXT[]` | Array of all roots in the ayah |

SELECT granted to `anon`, `authenticated`.

### `tracked_roots`

User learning progress. One row per (user, root) pair.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID` PK | Auto-generated |
| `user_id` | `UUID` | References `auth.users(id)` |
| `root` | `TEXT` | Arabic root |
| `state` | `TEXT` | `'learning'` \| `'learned'` |
| `notes` | `TEXT` | Optional user notes |
| `tracked_at` | `TIMESTAMPTZ` | Row creation time |
| `updated_at` | `TIMESTAMPTZ` | Last update time |

RLS: enabled. Policy: `auth.uid() = user_id` (users read/write own rows only). `anon` → SELECT only. `TRUNCATE` revoked from all client roles.

### Search Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `search_roots_semantic` | `(query_embedding VECTOR(768), match_count INT)` | Cosine similarity over `root_embeddings` |
| `search_corpus_fts` | `(query TEXT, limit_n INT)` | FTS via `tsvector`/`websearch_to_tsquery` |
| `search_corpus_trigram` | `(query TEXT, limit_n INT, threshold FLOAT)` | Fuzzy match via `pg_trgm` similarity |
| `get_collocates` | `(target_root TEXT, window_type TEXT, min_pmi FLOAT, limit_n INT)` | PMI-ranked collocates from `collocations` view |
| `cross_reference_roots` | `(root_a TEXT, root_b TEXT)` | Ayahs where both roots co-occur |
| `refresh_corpus_views` | `()` | Refreshes `collocations` + `cross_references` (service_role only) |

All functions use `SET search_path = public, pg_catalog`.
