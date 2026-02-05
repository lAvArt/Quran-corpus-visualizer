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
