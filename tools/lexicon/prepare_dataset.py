# -*- coding: utf-8 -*-
"""
Package everything Colab needs into one zip.

Deliberately small. Synthetic images are generated *in* Colab rather than
uploaded, because 200k PNGs is a slow upload and the text they are rendered
from is only a couple of megabytes. What must be uploaded is the part Colab
cannot reproduce: real line crops cut from the scan.

Contents of the zip:
    corpus_lines.jsonl   text lines to render synthetically (from our corpus)
    charset.json         the label alphabet, derived from that text
    real.jsonl           manifest of real crops (label status included)
    images/*.png         the real crops

Usage:
    python tools/lexicon/prepare_dataset.py --pages 13-796 --out dataset.zip
"""

from __future__ import annotations

import argparse
import json
import random
import sys
import zipfile
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from corpus_ref import verses  # noqa: E402
from export_training_data import extract_real  # noqa: E402
from ocr_mistral import DEFAULT_CACHE, DEFAULT_MODEL, DEFAULT_PDF, parse_ranges  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
MANIFEST = REPO / ".lexicon-cache" / "best-ocr.json"
STAGE = REPO / ".lexicon-cache" / "dataset"

# The alphabet must NOT be inferred from sampled corpus text alone: a class
# absent from the charset can never be predicted, and the omission is silent.
#
# Concretely — the corpus is in Uthmani orthography and spells alef-madda as
# `ءَا`, so `آ` never appears in it, while the printed book uses `آ` constantly
# (آية, القرآن, آباءنا). Deriving the charset from corpus text alone therefore
# produces a model structurally incapable of reading a very common letter.
# So the full Arabic letter inventory is declared explicitly.
ARABIC_LETTERS = "ءآأؤإئابةتثجحخدذرزسشصضطظعغفقكلمنهوىي"
ARABIC_EXTRA = "ٱٰپچژگڤ"          # forms that appear in Quranic/borrowed spellings
DIACRITICS = "ًٌٍَُِّْٰٓٔ"
DIGITS = "٠١٢٣٤٥٦٧٨٩0123456789"
PUNCT = "()[]{}«»،؛؟:.!-–—/\\'\"*•… "
EXTRA_CHARS = ARABIC_LETTERS + ARABIC_EXTRA + DIACRITICS + DIGITS + PUNCT


def build_corpus_lines(max_words: int, seed: int) -> list[str]:
    """
    Verse fragments of realistic length for line-level rendering.

    The book prints excerpts, not whole verses, so training on whole verses
    would teach the model a line length it will never see.
    """
    rng = random.Random(seed)
    lines: list[str] = []
    for text in verses().values():
        words = text.split()
        index = 0
        while index < len(words):
            take = rng.randint(3, max_words)
            chunk = " ".join(words[index : index + take])
            if len(chunk) >= 8:
                lines.append(chunk)
            index += take
    return lines


def build_charset(lines: list[str]) -> list[str]:
    counter: Counter = Counter()
    for line in lines:
        counter.update(line)
    counter.update(EXTRA_CHARS)
    # Sorted for a stable index mapping across runs — a reshuffled charset
    # silently invalidates every existing checkpoint.
    return sorted(c for c in counter if c.strip() or c == " ")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--pages", default="13-796")
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--manifest", type=Path, default=MANIFEST)
    parser.add_argument("--stage", type=Path, default=STAGE)
    parser.add_argument("--out", type=Path, default=REPO / "dataset.zip")
    parser.add_argument("--dpi", type=int, default=300)
    parser.add_argument("--max-words", type=int, default=9)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--skip-real", action="store_true")
    args = parser.parse_args()

    args.stage.mkdir(parents=True, exist_ok=True)

    # 1. Text for synthetic rendering, plus the alphabet it implies.
    lines = build_corpus_lines(args.max_words, args.seed)
    charset = build_charset(lines)
    (args.stage / "corpus_lines.jsonl").write_text(
        "\n".join(json.dumps({"text": t}, ensure_ascii=False) for t in lines),
        encoding="utf-8",
    )
    (args.stage / "charset.json").write_text(
        json.dumps({"charset": charset}, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    print(f"corpus lines: {len(lines)}   charset size: {len(charset)}")

    # 2. Real crops — the part Colab cannot regenerate.
    if not args.skip_real:
        variant = "img620s0.6"
        manifest = None
        if args.manifest.exists():
            manifest = json.loads(args.manifest.read_text(encoding="utf-8"))["pages"]
            print(f"using per-page best-OCR manifest ({len(manifest)} pages)")
        extract_real(
            args.pdf, parse_ranges(args.pages), args.stage, args.cache,
            args.model, variant, args.dpi, manifest=manifest,
        )

    # 3. Zip it.
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.out, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for name in ("corpus_lines.jsonl", "charset.json", "real.jsonl"):
            path = args.stage / name
            if path.exists():
                zf.write(path, name)
        images = args.stage / "images"
        if images.exists():
            for png in sorted(images.glob("*.png")):
                zf.write(png, f"images/{png.name}")

    size = args.out.stat().st_size / 1e6
    print(f"\nwrote {args.out}  ({size:.1f} MB)")
    print("upload this to Colab (or to Drive) and run the notebook.")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(main())
