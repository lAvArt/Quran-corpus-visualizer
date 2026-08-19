# -*- coding: utf-8 -*-
"""
Correctness checks for the ligature-aware extractor.

Shaped Arabic in a terminal is easy to misread — `المعنى` and `املعنى` look
nearly identical once the renderer applies contextual forms. So these assert on
exact code point sequences taken from the printed page, never on appearance.

Ground truth is page 160 of the Jabal PDF, read off a 300 dpi render.

Run:  python tools/lexicon/test_pdf_text.py
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import fitz

from pdf_text import (
    CMapCache,
    ExtractStats,
    normalise_root_key,
    page_text,
    parse_tounicode,
)

JABAL = (
    Path(__file__).resolve().parents[2]
    / "docs"
    / "المعجم الاشتقاقي المؤصل - محمد حسن جبل.pdf"
)

# Phrases that must appear on page 160, spelled correctly.
MUST_CONTAIN = [
    "المعنى المحوري",     # the payload marker — 929 of these across the book
    "معنى الفصل المعجمي",  # the bilateral-core marker
    "في القرآن",           # exercises the في ligature
    "بحر",                 # exercises simple-font code keying (was rendering as =)
    "255",                 # exercises LTR-run un-reversal (was 552)
    "الشيء",
    "انفصاله",
    "[المائدة",   # delimiters must face the right way after run reversal
    "[الضحى",
]

# Spellings that prove the bug is back if they ever reappear.
MUST_NOT_CONTAIN = [
    "املعنى",
    "احملوري",
    "املمعنى",
    "جيري",
    "å",  # the Lotus kashida leaking through as å
]


def _fail(msg: str) -> None:
    print("  FAIL:", msg)


def main() -> int:
    if not JABAL.exists():
        print(f"missing PDF: {JABAL}")
        return 2

    doc = fitz.open(JABAL)
    cmaps = CMapCache(doc)
    stats = ExtractStats()
    text = page_text(doc, 159, cmaps, columns=2, stats=stats)

    failures = 0
    print("=== page 160 ===")
    print(text)
    print()

    print("=== assertions ===")
    for needle in MUST_CONTAIN:
        ok = needle in text
        print(f"  {'ok  ' if ok else 'FAIL'} contains {needle!r}")
        failures += 0 if ok else 1
    for needle in MUST_NOT_CONTAIN:
        ok = needle not in text
        print(f"  {'ok  ' if ok else 'FAIL'} absent   {needle!r}")
        failures += 0 if ok else 1

    # CMap parser sanity: the lam-meem ligature must expand in logical order.
    lotus = None
    for font in doc[159].get_fonts(full=True):
        if "Lotus-Light" in font[3] and font[2] == "Type0":
            import re as _re

            obj = doc.xref_object(font[0])
            m = _re.search(r"/ToUnicode (\d+) 0 R", obj)
            lotus = parse_tounicode(doc.xref_stream(int(m.group(1))).decode("latin-1"))
            break
    ok = lotus is not None and lotus.get(0x33) == "لم"
    print(f"  {'ok  ' if ok else 'FAIL'} CMap gid 0x33 expands to 'لم'")
    failures += 0 if ok else 1

    # Root-key normalisation must agree with lib/search/arabicNormalize.ts.
    cases = [("أمن", "امن"), ("ءمم", "امم"), ("رحم", "رحم"), ("أتى", "اتي")]
    for src, want in cases:
        got = normalise_root_key(src)
        ok = got == want
        print(f"  {'ok  ' if ok else 'FAIL'} normalise {src!r} -> {got!r} (want {want!r})")
        failures += 0 if ok else 1

    print()
    print("extraction stats:", stats.report())
    doc.close()

    print()
    print("FAILURES:", failures)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
