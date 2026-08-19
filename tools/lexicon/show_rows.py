# -*- coding: utf-8 -*-
"""
Human-readable side-by-side of what the concordance pipeline produced.

Prints the OCR's reading next to the corpus verse it resolved to, untruncated,
so a match can actually be judged rather than taken on a score. Verdicts are
deliberately blunt — a row is only ✓ when the marker check agrees too.

Usage:
    python tools/lexicon/show_rows.py --pages 150-151 --limit 20
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
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


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pages", required=True)
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--only", choices=["all", "good", "bad"], default="all")
    args = parser.parse_args()

    shown = 0
    tally: Counter = Counter()

    for page in parse_ranges(args.pages):
        path = cache_path(args.cache, args.pdf, page, args.model)
        if not path.exists():
            print(f"page {page}: not OCR'd yet")
            continue
        record = json.loads(path.read_text(encoding="utf-8"))
        carry = None
        for row in split_rows(record["markdown"]):
            outcome = resolve_row(row, carry)
            if outcome["surah"] and outcome["status"] == "confirmed":
                carry = outcome["surah"]

            good = bool(outcome["surah"]) and outcome.get("marker_agrees", False) and \
                outcome["status"] == "confirmed"
            tally[outcome["status"]] += 1
            if args.only == "good" and not good:
                continue
            if args.only == "bad" and good:
                continue
            if shown >= args.limit:
                continue
            shown += 1

            mark = "OK  " if good else "??  "
            if not outcome["surah"]:
                print(f"\n{mark}p{page}  [{outcome['status']}] score={outcome['score']}")
                print(f"   raw row : {outcome['row'][:150]}")
                continue

            print(
                f"\n{mark}p{page}  {outcome['surah_name']} "
                f"({outcome['surah']}:{outcome['ayah']})  "
                f"score={outcome['score']}  "
                f"marker ocr={outcome.get('marker_ocr')} "
                f"expected={outcome.get('marker_expected')}"
            )
            print(f"   ocr read : {outcome['fragment_ocr']}")
            print(f"   corpus   : {outcome['verse']}")

    print("\n--- tally ---")
    for status, count in tally.most_common():
        print(f"  {status:16} {count}")
    print(f"  {'TOTAL':16} {sum(tally.values())}")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(main())
