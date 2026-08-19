# -*- coding: utf-8 -*-
"""
Build a side-by-side PDF: the original scan next to what OCR read from it.

Each output page is a landscape spread — the original page on the right (where
an Arabic reader starts) and the OCR transcription on the left, at matching
scale. This is a proofing artefact: it exists so the OCR can be judged page by
page against the source rather than trusted on aggregate scores.

The original is copied as vector/image content via `show_pdf_page` rather than
re-rasterised, so the scan is reproduced exactly at whatever zoom you view it.

Usage:
    python tools/lexicon/build_compare_pdf.py --pages 150-160 --out compare.pdf
    python tools/lexicon/build_compare_pdf.py --pages 14-796 --out full.pdf
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import fitz  # noqa: E402

from ocr_mistral import (  # noqa: E402
    DEFAULT_CACHE,
    DEFAULT_MODEL,
    DEFAULT_PDF,
    cache_path,
    parse_ranges,
    suspicious_ocr,
)

# Windows ships several Arabic-capable faces; the first one present is used.
FONT_DIR = Path("C:/Windows/Fonts")
FONT_CANDIDATES = ("arabtype.ttf", "tahoma.ttf", "segoeui.ttf", "Candarab.ttf")

GUTTER = 14  # points between the two halves
HEADER = 26  # points reserved for the page label
COL_PAD = 6  # inner padding for the two OCR sub-columns


def pick_font() -> tuple[str, str]:
    """Return (css font-family name, font file name) for an Arabic-capable face."""
    for name in FONT_CANDIDATES:
        if (FONT_DIR / name).exists():
            return "arabic", name
    raise SystemExit(
        f"no Arabic font found in {FONT_DIR}; tried {', '.join(FONT_CANDIDATES)}"
    )


def split_for_columns(markdown: str) -> tuple[str, str]:
    """
    Split a page's OCR into two halves to mirror the original's two columns.

    Rendering the whole page into one tall box forces `insert_htmlbox` to scale
    the text down until it fits, leaving the OCR far smaller than the scan
    beside it and defeating the point of a side-by-side. Laying it out in two
    columns halves the required height, so the text can stay legible at
    comparable size.

    Mistral usually emits one markdown table per printed column, in which case
    the split follows those blocks exactly. Otherwise the lines are halved.
    """
    lines = markdown.splitlines()
    table_starts = [
        i for i, line in enumerate(lines) if line.strip().startswith("|")
    ]
    if table_starts:
        # Find block boundaries: a run of pipe-lines is one table.
        blocks: list[tuple[int, int]] = []
        start = prev = table_starts[0]
        for index in table_starts[1:]:
            if index != prev + 1:
                blocks.append((start, prev))
                start = index
            prev = index
        blocks.append((start, prev))
        if len(blocks) >= 2:
            cut = blocks[1][0]
            return "\n".join(lines[:cut]), "\n".join(lines[cut:])

    midpoint = max(1, len(lines) // 2)
    return "\n".join(lines[:midpoint]), "\n".join(lines[midpoint:])


def markdown_to_html(markdown: str) -> str:
    """
    Render the OCR's markdown as simple HTML.

    Mistral emits these pages either as markdown tables or as bare lines, so
    both shapes are handled — otherwise half the book renders as a wall of
    pipe characters.
    """
    out: list[str] = []
    rows: list[list[str]] = []

    def flush_table() -> None:
        if not rows:
            return
        out.append("<table>")
        for cells in rows:
            tds = "".join(f"<td>{html.escape(c)}</td>" for c in cells)
            out.append(f"<tr>{tds}</tr>")
        out.append("</table>")
        rows.clear()

    for line in markdown.splitlines():
        stripped = line.strip()
        if stripped.startswith("|"):
            if set(stripped) <= set("|- :"):
                continue
            rows.append([c.strip() for c in stripped.strip("|").split("|")])
            continue
        flush_table()
        if not stripped:
            continue
        if stripped.startswith("#"):
            out.append(f"<h3>{html.escape(stripped.lstrip('#').strip())}</h3>")
        else:
            out.append(f"<p>{html.escape(stripped)}</p>")
    flush_table()

    return "\n".join(out) or "<p><i>(no text returned for this page)</i></p>"


CSS_TEMPLATE = """
@font-face {{ font-family: {family}; src: url({file}); }}
* {{ font-family: {family}; }}
body {{ direction: rtl; text-align: right; font-size: {size}px; line-height: 1.3; }}
p {{ margin: 0 0 3px 0; }}
h3 {{ margin: 4px 0; font-size: {heading}px; }}
.warn {{ color: #a3121a; font-weight: bold; margin-bottom: 6px; }}
table {{ width: 100%; border-collapse: collapse; }}
td {{ border-bottom: 0.4px solid #ccd; padding: 1.5px 3px; vertical-align: top; }}
"""


def build(
    pdf_path: Path,
    pages: list[int],
    out_path: Path,
    cache_dir: Path,
    model: str,
    font_size: float,
    variant: str = "",
    manifest: dict | None = None,
) -> int:
    family, font_file = pick_font()
    archive = fitz.Archive(str(FONT_DIR))
    css = CSS_TEMPLATE.format(
        family=family, file=font_file, size=font_size, heading=font_size + 2
    )

    src = fitz.open(pdf_path)
    out = fitz.open()
    missing = 0
    suspect = 0

    for page_number in pages:
        if not (1 <= page_number <= src.page_count):
            continue
        src_page = src[page_number - 1]
        pw, ph = src_page.rect.width, src_page.rect.height

        spread = out.new_page(width=pw * 2 + GUTTER, height=ph + HEADER)

        # Right half: the original, copied rather than re-rendered.
        right = fitz.Rect(pw + GUTTER, HEADER, pw * 2 + GUTTER, ph + HEADER)
        spread.show_pdf_page(right, src, page_number - 1)

        # Left half: the OCR reading, laid out in two columns like the original.
        left = fitz.Rect(0, HEADER, pw, ph + HEADER)
        # A manifest (from select_best_ocr.py) overrides the variant per page,
        # because neither OCR pass wins everywhere: image mode rescues pages the
        # PDF pass dropped entirely, while the PDF pass wins decisively on
        # others (p88: 196/196 rows vs 6/73).
        page_variant = variant
        page_label = ""
        if manifest:
            entry = manifest.get(str(page_number))
            if entry:
                page_variant = entry["variant"]
                page_label = f"  [{entry['label']}: {entry['resolved']}/{entry['rows']} rows resolved]"

        record_path = cache_path(
            cache_dir, pdf_path, page_number, model, page_variant
        )
        warning = ""
        markdown = None
        if record_path.exists():
            markdown = json.loads(record_path.read_text(encoding="utf-8"))["markdown"]
            flags = suspicious_ocr(markdown)
            if flags:
                # Show it, but never let it pass as a legitimate reading.
                suspect += 1
                warning = (
                    "<p class='warn'>⚠ OCR REJECTED — "
                    + html.escape(", ".join(flags))
                    + "</p>"
                )
        else:
            missing += 1

        # scale_low=0 lets the renderer shrink text to fit rather than clip it,
        # so a dense page is still fully legible instead of silently truncated.
        if markdown is None:
            spread.insert_htmlbox(
                left, "<p><i>(page not OCR'd)</i></p>", css=css,
                archive=archive, scale_low=0,
            )
        else:
            first, second = split_for_columns(markdown)
            col_w = (pw - 3 * COL_PAD) / 2
            # Right sub-column first — this is an RTL page.
            col_right = fitz.Rect(
                COL_PAD * 2 + col_w, HEADER, pw - COL_PAD, ph + HEADER
            )
            col_left = fitz.Rect(
                COL_PAD, HEADER, COL_PAD + col_w, ph + HEADER
            )
            spread.insert_htmlbox(
                col_right, warning + markdown_to_html(first),
                css=css, archive=archive, scale_low=0,
            )
            spread.insert_htmlbox(
                col_left, markdown_to_html(second),
                css=css, archive=archive, scale_low=0,
            )
            spread.draw_line(
                fitz.Point(COL_PAD * 1.5 + col_w, HEADER + 4),
                fitz.Point(COL_PAD * 1.5 + col_w, ph + HEADER - 4),
                color=(0.86, 0.88, 0.91), width=0.5,
            )

        spread.draw_rect(left, color=(0.80, 0.82, 0.86), width=0.6)
        spread.draw_rect(right, color=(0.80, 0.82, 0.86), width=0.6)
        spread.insert_text(
            (8, 17),
            f"p{page_number}   OCR (left)  |  original scan (right){page_label}",
            fontsize=9,
            color=(0.35, 0.37, 0.42),
        )

    # `insert_htmlbox` embeds a fresh copy of the Arabic face for every page it
    # renders. Left alone that dominates the file — 784 spreads came to 319 MB,
    # of which the scans were only ~25 MB. `garbage=4` merges the duplicate
    # font objects and subsetting drops the unused glyphs: 319 MB -> ~40 MB.
    try:
        out.subset_fonts()
    except Exception as exc:  # non-fatal: only affects size, not correctness
        print(f"  note: font subsetting skipped ({exc})")
    out.save(out_path, garbage=4, deflate=True, deflate_fonts=True)
    out.close()
    src.close()

    print(f"wrote {out_path}  ({len(pages)} spread(s), {out_path.stat().st_size/1e6:.1f} MB)")
    if missing:
        print(f"  {missing} page(s) had no cached OCR — run ocr_mistral.py for those")
    if suspect:
        print(f"  {suspect} page(s) marked OCR-REJECTED in the spread (hallucination / structure leak)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--pages", required=True, help="e.g. 150-160")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--font-size", type=float, default=9.0)
    parser.add_argument("--manifest", type=Path, default=None,
                        help="best-ocr.json from select_best_ocr.py; picks the winning pass per page")
    parser.add_argument("--variant", default="img620s0.6",
                        help="cache variant; '' selects the legacy pdf-mode cache")
    args = parser.parse_args()

    if not args.pdf.exists():
        print(f"missing PDF: {args.pdf}")
        return 2

    return build(
        args.pdf,
        parse_ranges(args.pages),
        args.out,
        args.cache,
        args.model,
        args.font_size,
        args.variant,
        json.loads(args.manifest.read_text(encoding='utf-8'))['pages']
        if args.manifest and args.manifest.exists() else None,
    )


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(main())
