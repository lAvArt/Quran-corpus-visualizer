# Internal Schema

The app normalizes external corpus data into internal models before rendering. UI code should consume these models, not raw upstream payloads.

## Core Corpus Entities

### Sura

- `id`: integer, `1..114`
- `nameArabic`: string
- `nameTransliteration`: string
- `ayahCount`: integer

### Ayah

- `id`: string, `{sura}:{ayah}`
- `suraId`: integer
- `ayahNumber`: integer
- `textUthmani`: string
- `tokenIds`: string[]

### Token

- `id`: string, `{sura}:{ayah}:{token}`
- `suraId`: integer
- `ayahNumber`: integer
- `position`: integer
- `surface`: string
- `root`: string or `null`
- `lemma`: string or `null`
- `pos`: string
- `morphology`: `Morphology`

### Morphology

- `features`: `Record<string, string>`
- `gloss`: string or `null`
- `stem`: string or `null`

### DependencyEdge

- `id`: string
- `ayahId`: string
- `dependentTokenId`: string
- `headTokenId`: string
- `relation`: string

## Derived and Search Models

### RootIndex

- key: normalized root
- value: token IDs and ayah IDs containing that root

### LemmaIndex

- key: normalized lemma
- value: token IDs and ayah IDs containing that lemma

### PosIndex

- key: part-of-speech tag
- value: token IDs and ayah IDs containing that tag

### CollocationResult

Calculated from normalized token data and mirrored by database-backed collocation queries.

- `root`: string
- `count`: integer
- `pmi`: number
- `sampleLemmas`: string[]
- `sampleWindows`: string[]

`sampleWindows` formats:

- ayah scope: `{sura}:{ayah}`
- distance scope: `{sura}:{ayah}:{position}`

## User State Models

### TrackedRoot

Client shape used by IndexedDB, knowledge context, and Supabase mapping code.

- `root`: string
- `state`: `"learning"` or `"learned"`
- `notes`: string
- `addedAt`: epoch milliseconds
- `lastReviewedAt`: epoch milliseconds

### QuizSessionRecord

Client shape used for local quiz progress and Supabase sync.

- `id`: string
- `sessionType`: `"daily"` or `"study"`
- `score`: integer
- `total`: integer
- `completedAt`: epoch milliseconds
- `reviewedRoots`: integer
- `usedTrackedRoots`: boolean

### QuizProgressSummary

- `completedSessions`: integer
- `dailySessions`: integer
- `studySessions`: integer
- `questionsAnswered`: integer
- `correctAnswers`: integer
- `averageAccuracy`: integer
- `lastCompletedAt`: epoch milliseconds or `null`
- `lastSessionType`: `"daily"` or `"study"` or `null`

## Relation Model

- `Sura 1..n Ayah`
- `Ayah 1..n Token`
- `Ayah 1..n DependencyEdge`
- `Token 0..1 Root`
- `Token 0..1 Lemma`
- `User 1..n TrackedRoot`
- `User 1..n QuizAttempt`

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

- IDs must be stable and deterministic.
- Ordered arrays remain position-sorted where relevant.
- `null` means unknown or unavailable, not an empty string substitute.
- Lossy transforms from upstream data must be documented in adapter code or migration logic.

## Database Schema (Supabase / PostgreSQL)

The current database shape is provisioned by migrations `001` through `007`.

### `corpus_tokens`

Normalized morphological tokens.

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT` PK | `{sura}:{ayah}:{position}` |
| `sura` | `SMALLINT` | Surah number |
| `ayah` | `SMALLINT` | Ayah number |
| `position` | `SMALLINT` | Token order within ayah |
| `root` | `TEXT` | Nullable |
| `lemma` | `TEXT` | Nullable |
| `pos` | `TEXT` | Part-of-speech tag |
| `text` | `TEXT` | Surface form |
| `root_normalized` | `TEXT` | Generated |
| `lemma_normalized` | `TEXT` | Generated |
| `search_vector` | `TSVECTOR` | Generated |

Security:

- RLS enabled
- public read-only policies for `anon` and `authenticated`
- write, truncate, references, and trigger privileges revoked from end-user roles

### `ayahs`

Ayah-level Uthmani text.

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT` PK | `{sura}:{ayah}` |
| `sura` | `SMALLINT` | |
| `ayah` | `SMALLINT` | |
| `text_uthmani` | `TEXT` | |

Security follows the same read-only RLS pattern as `corpus_tokens`.

### `root_embeddings`

Precomputed embeddings for semantic root search.

| Column | Type | Notes |
|---|---|---|
| `root` | `TEXT` PK | Arabic root |
| `embedding` | `VECTOR(768)` | pgvector embedding |

Security follows the same read-only RLS pattern as other corpus tables.

### `collocations`

Materialized view for collocation statistics.

| Column | Type | Notes |
|---|---|---|
| `root_a` | `TEXT` | First root |
| `root_b` | `TEXT` | Second root |
| `window_type` | `TEXT` | `ayah` or `distance` |
| `co_count` | `BIGINT` | Co-occurrence count |
| `pmi` | `NUMERIC` | Pointwise Mutual Information |
| `surah_count` | `BIGINT` | Distinct surah count |

Materialized views use explicit `GRANT SELECT` rather than RLS.

### `cross_references`

Materialized view for ayah-level root co-occurrence.

| Column | Type | Notes |
|---|---|---|
| `sura` | `SMALLINT` | |
| `ayah` | `SMALLINT` | |
| `roots` | `TEXT[]` | All roots in the ayah |

### `tracked_roots`

Per-user tracked roots.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | Auto-generated |
| `user_id` | `UUID` | References `auth.users(id)` |
| `root` | `TEXT` | |
| `state` | `TEXT` | `learning` or `learned` |
| `notes` | `TEXT` | Defaults to empty string |
| `added_at` | `TIMESTAMPTZ` | Creation time |
| `last_reviewed_at` | `TIMESTAMPTZ` | Last update time |

Security:

- RLS enabled
- all operations are gated by `auth.uid() = user_id`
- anonymous callers cannot satisfy the policy
- `TRUNCATE` is revoked from end-user roles

### `quiz_attempts`

Per-user synced quiz history.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | Auto-generated |
| `user_id` | `UUID` | References `auth.users(id)` |
| `session_key` | `TEXT` | Unique per user |
| `session_type` | `TEXT` | `daily` or `study` |
| `score` | `INT` | Must be `>= 0` |
| `total` | `INT` | Must be `> 0` |
| `reviewed_roots` | `INT` | Defaults to `0` |
| `used_tracked_roots` | `BOOLEAN` | Defaults to `false` |
| `completed_at` | `TIMESTAMPTZ` | Completion time |
| `created_at` | `TIMESTAMPTZ` | Row creation time |

Security:

- RLS enabled
- all operations are gated by `auth.uid() = user_id`
- anonymous callers cannot satisfy the policy
- indexed by `(user_id, completed_at DESC)`

### Search Functions

| Function | Signature | Description |
|---|---|---|
| `search_roots_semantic` | `(query_embedding VECTOR(768), match_count INT)` | Cosine similarity over `root_embeddings` |
| `search_corpus_fts` | `(query TEXT, limit_n INT)` | Full-text search |
| `search_corpus_trigram` | `(query TEXT, limit_n INT, threshold FLOAT)` | Trigram similarity search |
| `get_collocates` | `(target_root TEXT, window_type TEXT, min_pmi FLOAT, limit_n INT)` | Collocate lookup |
| `cross_reference_roots` | `(root_a TEXT, root_b TEXT)` | Ayah-level co-occurrence lookup |
| `refresh_corpus_views` | `()` | Refresh materialized views, service role only |

All functions set `search_path = public, pg_catalog`.
