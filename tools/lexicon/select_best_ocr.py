# -*- coding: utf-8 -*-
"""
Choose, per page, which OCR pass to trust.

Two rendering strategies were run over the whole book — the original PDF slices
and 620 dpi greyscale page images — and neither wins outright:

  * PDF-only     80.3% of rows resolved
  * image-only   92.2%
  * best-of-both 98.5%

Image mode rescues pages the PDF pass dropped entirely (406, 500, 545, 743,
773 all went 0 rows -> ~70 rows). But PDF mode wins decisively where it wins:
page 88 is 196/196 rows resolved from the PDF pass against 6/73 from the image
pass. Picking a single global winner therefore throws away real data either
way.

So each page is scored on the only metric that matters — how many of its rows
resolve to a verse — and the better pass is recorded in a manifest that the
downstream tools read.

Usage:
    python tools/lexicon/select_best_ocr.py --pages 13-796
    python tools/lexicon/select_best_ocr.py --pages 13-796 --out .lexicon-cache/best.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from ocr_mistral import (  # noqa: E402
    DEFAULT_CACHE,
    DEFAULT_MODEL,
    DEFAULT_PDF,
    cache_path,
    parse_ranges,
)
from validate_concordance import resolve_row, split_rows  # noqa: E402

# Variant tag -> label. "" is the original PDF-slice pass.
VARIANTS = {"": "pdf", "img620s0.6": "image620"}
DEFAULT_MANIFEST = DEFAULT_CACHE.parent / "best-ocr.json"


def score_page(pdf_path: Path, cache_dir: Path, model: str, variant: str, page: int):
    path = cache_path(cache_dir, pdf_path, page, model, variant)
    if not path.exists():
        return {"rows": 0, "resolved": 0, "confirmed": 0}
    markdown = json.loads(path.read_text(encoding="utf-8"))["markdown"]
    rows = split_rows(markdown)
    carry = None
    resolved = confirmed = 0
    for row in rows:
        outcome = resolve_row(row, carry)
        if outcome["surah"]:
            resolved += 1
            if outcome["status"] == "confirmed":
                confirmed += 1
                carry = outcome["surah"]
    return {"rows": len(rows), "resolved": resolved, "confirmed": confirmed}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--pages", required=True)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--out", type=Path, default=DEFAULT_MANIFEST)
    args = parser.parse_args()

    pages = parse_ranges(args.pages)
    manifest: dict[str, dict] = {}
    totals = {label: {"rows": 0, "resolved": 0} for label in VARIANTS.values()}
    best_rows = best_resolved = 0
    wins = {label: 0 for label in VARIANTS.values()}
    wins["tie"] = 0

    for index, page in enumerate(pages, 1):
        scores = {}
        for variant, label in VARIANTS.items():
            result = score_page(args.pdf, args.cache, args.model, variant, page)
            scores[label] = result
            totals[label]["rows"] += result["rows"]
            totals[label]["resolved"] += result["resolved"]

        # Rank by resolved rows; break ties toward the pass with more confirmed
        # rows, then toward image (it degrades more gracefully on hard pages).
        ranked = sorted(
            scores.items(),
            key=lambda kv: (kv[1]["resolved"], kv[1]["confirmed"]),
            reverse=True,
        )
        winner, winning = ranked[0]
        runner = ranked[1][1]
        if winning["resolved"] == runner["resolved"]:
            wins["tie"] += 1
        else:
            wins[winner] += 1

        variant_tag = next(v for v, lab in VARIANTS.items() if lab == winner)
        manifest[str(page)] = {
            "variant": variant_tag,
            "label": winner,
            "rows": winning["rows"],
            "resolved": winning["resolved"],
            "scores": scores,
        }
        best_rows += winning["rows"]
        best_resolved += winning["resolved"]

        if index % 25 == 0 or index == len(pages):
            print(f"  scored {index}/{len(pages)} pages", flush=True)

    print()
    for label, agg in totals.items():
        rate = 100 * agg["resolved"] / max(agg["rows"], 1)
        print(f"{label:10} {agg['resolved']:6} resolved / {agg['rows']:6} rows  ({rate:.1f}%)")
    rate = 100 * best_resolved / max(best_rows, 1)
    print(f"{'best':10} {best_resolved:6} resolved / {best_rows:6} rows  ({rate:.1f}%)")
    print("page wins:", wins)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(
            {"model": args.model, "variants": VARIANTS, "pages": manifest},
            ensure_ascii=False,
            indent=1,
        ),
        encoding="utf-8",
    )
    print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(main())
