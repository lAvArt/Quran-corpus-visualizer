# -*- coding: utf-8 -*-
"""
Export line-image training data for a custom Arabic OCR model.

Why this is cheap here
----------------------
The page layout is rigid — two columns split by a vertical rule, rows of near
constant height — so lines can be cut with projection profiles alone. No line
detector, no annotation tool, no labelling budget. Measured on this scan:
~90-100 clean line bands per page, median height 39px at 300 dpi.

Two kinds of output, because they solve different halves of the problem:

* `--mode real` cuts real line crops from the scan. These carry the true
  degradation (1-bit thresholding, broken strokes, show-through) that a model
  must survive, but their labels are only as good as the alignment.
* `--mode synth` renders corpus text in an Arabic face and degrades it to
  imitate the scan. Labels are exact by construction and the supply is
  unlimited, which is what makes pretraining possible at all.

The intended recipe is synth-pretrain then real-finetune; neither alone is
enough. Synthetic data misses the scan's real artefacts, and real data cannot
be labelled at scale without the corpus alignment being perfect.

A caution that belongs in the data, not just the docs: for a real line, we know
which *verse* the row cites but not exactly which *fragment* the typesetter
printed, nor how the numerals and surah name were spaced. So `--mode real`
emits the crop together with the corpus verse and the OCR reading and marks the
label `needs_review` unless the two agree closely. Do not train on unreviewed
real labels.

Usage:
    python tools/lexicon/export_training_data.py --mode real  --pages 100-200
    python tools/lexicon/export_training_data.py --mode synth --count 20000
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import fitz  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw, ImageFilter, ImageFont  # noqa: E402

from corpus_ref import fold, verses  # noqa: E402
from ocr_mistral import DEFAULT_CACHE, DEFAULT_MODEL, DEFAULT_PDF, cache_path, parse_ranges  # noqa: E402
from validate_concordance import resolve_row, split_rows, token_score  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
DEFAULT_OUT = REPO / ".lexicon-cache" / "dataset"
FONT_DIR = Path("C:/Windows/Fonts")
SYNTH_FONTS = ["arabtype.ttf", "tahoma.ttf", "segoeui.ttf", "Candarab.ttf"]


# --------------------------------------------------------------------------
# Real line extraction
# --------------------------------------------------------------------------


def page_ink(doc: fitz.Document, page_no: int, dpi: int = 300) -> np.ndarray:
    pix = doc[page_no - 1].get_pixmap(dpi=dpi, colorspace=fitz.csGRAY)
    arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width)
    return 255 - arr  # ink high


def find_rule(ink: np.ndarray) -> int:
    """The vertical rule between the two printed columns."""
    _, width = ink.shape
    lo, hi = int(width * 0.35), int(width * 0.65)
    return int(np.argmax(ink[:, lo:hi].sum(axis=0))) + lo


def find_line_bands(
    column: np.ndarray, min_height: int = 12, ink_frac: float = 0.02
) -> list[tuple[int, int]]:
    profile = column.sum(axis=1)
    if profile.max() == 0:
        return []
    on = profile > profile.max() * ink_frac
    bands, start = [], None
    for index, value in enumerate(on):
        if value and start is None:
            start = index
        elif not value and start is not None:
            if index - start >= min_height:
                bands.append((start, index))
            start = None
    if start is not None and len(on) - start >= min_height:
        bands.append((start, len(on)))
    return bands


def extract_real(
    pdf_path: Path,
    pages: list[int],
    out_dir: Path,
    cache_dir: Path,
    model: str,
    variant: str,
    dpi: int,
    manifest: dict | None = None,
) -> int:
    images = out_dir / "images"
    images.mkdir(parents=True, exist_ok=True)
    records: list[dict] = []
    doc = fitz.open(pdf_path)
    reviewed = 0

    for page_no in pages:
        # Per-page best pass, when select_best_ocr.py has been run.
        page_variant = variant
        if manifest:
            entry = manifest.get(str(page_no))
            if entry:
                page_variant = entry["variant"]
        record_path = cache_path(cache_dir, pdf_path, page_no, model, page_variant)
        if not record_path.exists():
            continue
        markdown = json.loads(record_path.read_text(encoding="utf-8"))["markdown"]
        rows = split_rows(markdown)
        if not rows:
            continue

        ink = page_ink(doc, page_no, dpi)
        height, width = ink.shape
        rule = find_rule(ink)
        top, bottom = int(height * 0.06), int(height * 0.95)
        columns = [
            ("right", ink[top:bottom, rule + 6 : int(width * 0.97)]),
            ("left", ink[top:bottom, int(width * 0.03) : rule - 6]),
        ]

        bands = [(side, a, b, col) for side, col in columns for a, b in find_line_bands(col)]
        # Reading order: right column top-to-bottom, then left.
        carry = None
        row_index = 0
        for side, a, b, col in bands:
            if row_index >= len(rows):
                break
            row = rows[row_index]
            outcome = resolve_row(row, carry)
            if outcome["surah"] and outcome["status"] == "confirmed":
                carry = outcome["surah"]
            row_index += 1

            crop = (255 - col[a:b]).astype(np.uint8)
            if crop.shape[0] < 12 or crop.shape[1] < 40:
                continue
            name = f"p{page_no:04d}_{side}_{a:05d}.png"
            Image.fromarray(crop).save(images / name)

            verse = outcome.get("verse")
            score = outcome.get("score", 0.0)
            # Only rows whose OCR strongly matches the corpus verse are worth
            # trusting as labels; everything else is flagged for a human.
            trustworthy = bool(verse) and score >= 0.85
            reviewed += int(trustworthy)
            records.append(
                {
                    "image": f"images/{name}",
                    "page": page_no,
                    "column": side,
                    "ocr_text": row,
                    "verse_ref": f"{outcome['surah']}:{outcome['ayah']}" if verse else None,
                    "verse_text": verse,
                    "align_score": score,
                    "label_status": "candidate" if trustworthy else "needs_review",
                }
            )

    doc.close()
    manifest = out_dir / "real.jsonl"
    with manifest.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")

    print(f"wrote {len(records)} line crops to {images}")
    print(f"  {reviewed} marked 'candidate' (align score >= 0.85)")
    print(f"  {len(records) - reviewed} marked 'needs_review' — do not train on these blind")
    print(f"manifest: {manifest}")
    return 0


# --------------------------------------------------------------------------
# Synthetic line generation
# --------------------------------------------------------------------------


_SYNTH_CSS = """
@font-face {{ font-family: ar; src: url({file}); }}
* {{ font-family: ar; }}
body {{ direction: rtl; text-align: right; font-size: {size}px;
        color: #000; line-height: 1.25; }}
"""


def render_line(text: str, font_path: Path, size: int) -> Image.Image | None:
    """Render one shaped Arabic line to a tight greyscale crop."""
    doc = fitz.open()
    page = doc.new_page(width=1800, height=140)
    css = _SYNTH_CSS.format(file=font_path.name, size=size)
    try:
        page.insert_htmlbox(
            fitz.Rect(10, 10, 1790, 130),
            f"<p>{text}</p>",
            css=css,
            archive=fitz.Archive(str(font_path.parent)),
            scale_low=0,
        )
    except Exception:
        doc.close()
        return None

    pix = page.get_pixmap(dpi=300, colorspace=fitz.csGRAY)
    arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width)
    doc.close()

    ink = 255 - arr
    rows = np.where(ink.sum(axis=1) > 0)[0]
    cols = np.where(ink.sum(axis=0) > 0)[0]
    if rows.size == 0 or cols.size == 0:
        return None
    pad = 6
    y0, y1 = max(0, rows[0] - pad), min(arr.shape[0], rows[-1] + pad)
    x0, x1 = max(0, cols[0] - pad), min(arr.shape[1], cols[-1] + pad)
    return Image.fromarray(arr[y0:y1, x0:x1])


def degrade(img: Image.Image, rng: random.Random) -> Image.Image:
    """
    Imitate what this scan did to the type.

    The source is 1-bit at ~310 dpi: it was thresholded, so strokes break up and
    thin joins vanish. Reproducing that — blur, noise, then a hard threshold —
    matters more than any single augmentation, because it is the exact
    degradation the model has to survive at inference.
    """
    if rng.random() < 0.8:
        img = img.filter(ImageFilter.GaussianBlur(rng.uniform(0.3, 1.1)))
    arr = np.asarray(img).astype(np.float32)
    arr += np.random.normal(0, rng.uniform(4, 18), arr.shape)
    if rng.random() < 0.75:  # the bitonal threshold that destroys stroke detail
        arr = np.where(arr > rng.uniform(120, 165), 255, 0)
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    out = Image.fromarray(arr)
    if rng.random() < 0.4:  # slight skew, as on a bound page
        out = out.rotate(rng.uniform(-0.7, 0.7), resample=Image.BILINEAR, fillcolor=255)
    return out


def extract_synth(out_dir: Path, count: int, height: int, seed: int) -> int:
    images = out_dir / "images_synth"
    images.mkdir(parents=True, exist_ok=True)
    rng = random.Random(seed)
    np.random.seed(seed)

    fonts = [FONT_DIR / name for name in SYNTH_FONTS if (FONT_DIR / name).exists()]
    if not fonts:
        raise SystemExit(f"no Arabic fonts found in {FONT_DIR}")

    corpus = list(verses().values())
    records = []
    for index in range(count):
        verse = rng.choice(corpus)
        words = verse.split()
        if len(words) > 6:
            start = rng.randrange(0, max(1, len(words) - 5))
            words = words[start : start + rng.randint(3, 9)]
        text = " ".join(words)
        if not text.strip():
            continue

        # Rendered through PyMuPDF, not PIL: Pillow needs libraqm for Arabic
        # shaping and bidi, and without it every glyph comes out isolated and
        # left-to-right — silently producing training images of text that is
        # not the label. PyMuPDF's HTML renderer shapes correctly.
        crop = render_line(text, rng.choice(fonts), rng.randint(26, 38))
        if crop is None:
            continue
        crop = degrade(crop, rng)
        ratio = height / crop.height
        crop = crop.resize((max(8, int(crop.width * ratio)), height), Image.LANCZOS)

        name = f"s{index:06d}.png"
        crop.save(images / name)
        records.append({"image": f"images_synth/{name}", "text": text})

        if (index + 1) % 2000 == 0:
            print(f"  generated {index + 1}/{count}", flush=True)

    manifest = out_dir / "synth.jsonl"
    with manifest.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    print(f"wrote {len(records)} synthetic lines to {images}")
    print(f"manifest: {manifest}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("real", "synth"), required=True)
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--pages", default="13-796")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--variant", default="img620s0.6")
    parser.add_argument("--dpi", type=int, default=300)
    parser.add_argument("--count", type=int, default=20000)
    parser.add_argument("--height", type=int, default=48)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    if args.mode == "synth":
        return extract_synth(args.out, args.count, args.height, args.seed)
    return extract_real(
        args.pdf, parse_ranges(args.pages), args.out, args.cache,
        args.model, args.variant, args.dpi,
    )


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(main())
