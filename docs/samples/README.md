# Lexicon scan samples

Small excerpts from the reference lexicons, committed as fixtures for the
OCR / lexicon-integration work (see [ARABIC_OCR_TRAINING.md](../ARABIC_OCR_TRAINING.md)).

| file | contents |
|---|---|
| `mufahras-p045.pdf` | one page — the original line-segmentation fixture |
| `mufahras-p045-047.pdf` | PDF pages 45–47, extracted from the same scan |

Source: **المعجم المفهرس لألفاظ القرآن الكريم — محمد فؤاد عبد الباقي** (scan).

Page numbering: file names follow **PDF page numbers**, not the book's printed
folios — PDF page 45 carries the printed page **٣٢** (the أرض entry). The offset
matters when cross-referencing OCR output against the printed edition.

## Why only samples

The full scans are third-party books on a public repository, so they are
deliberately untracked (`docs/*.pdf` in `.gitignore`) and the licensing note
there also covers text derived from them. These few pages exist as a bounded
exception — enough to reproduce the segmentation and OCR pipeline — by the
project owner's decision. Do not grow this folder into the book.
