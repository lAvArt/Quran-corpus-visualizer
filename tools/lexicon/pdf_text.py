# -*- coding: utf-8 -*-
"""
Exact Arabic text extraction from ligature-heavy PDFs.

Why this exists
---------------
`المعجم الاشتقاقي المؤصل` (Jabal) is born-digital and carries a text layer, but
naive extraction (`page.get_text()`, pdftotext, pdfplumber, …) mangles it:

    المعنى المحوري   ->   املعنى احملوري
    لا يجري          ->   ال جيري

The PDF itself is *correct*. Its Lotus fonts use OpenType ligature glyphs whose
`/ToUnicode` entries expand one glyph id to several code points in proper
logical order (`gid<0033> -> "لم"`). The extractors then apply bidi reordering
to the whole flattened character stream, which reverses *inside* those
expansions as well — double-reversing them into `مل`.

The fix is exact, not heuristic: read glyphs in placement order, expand each
glyph through the font's own ToUnicode map, and reverse at *glyph* granularity
rather than *character* granularity.

Also handled here:
  * `å` / `_` — the Lotus kashida (tatweel) glyphs, dropped as decoration.
  * `QCF_P###` spans — per-mushaf-page Quran fonts whose glyph ids are page-local
    and carry no usable Unicode. These are replaced with a `` sentinel so a
    later pass can rehydrate the verse from our own corpus using the adjacent
    `[سورة:آية]` reference.
"""

from __future__ import annotations

import collections
import re
import unicodedata
from dataclasses import dataclass, field

import fitz

# Sentinel standing in for a run of unrecoverable mushaf-font glyphs.
QURAN_GLYPH_SENTINEL = ""

# Fonts whose glyph ids are page-local mushaf shapes, not text.
_MUSHAF_FONT_RE = re.compile(r"QCF_P\d+|KFGQPC|Al-QuranAlKareem|MohammadNaskh", re.I)

# Decorative elongation + ornament glyphs that carry no linguistic content.
_DECORATIVE = {"ـ", "å", "_", "", "�", "•", "❁", "✿"}

_ARABIC_RANGE = (
    "؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿"
)
_ARABIC_RE = re.compile(f"[{_ARABIC_RANGE}]")


# --------------------------------------------------------------------------
# ToUnicode CMap parsing
# --------------------------------------------------------------------------

_BFCHAR_RE = re.compile(r"beginbfchar(.*?)endbfchar", re.S)
_BFRANGE_RE = re.compile(r"beginbfrange(.*?)endbfrange", re.S)
_PAIR_RE = re.compile(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>")
_RANGE_RE = re.compile(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>")
_RANGE_ARRAY_RE = re.compile(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[(.*?)\]", re.S)


def _hex_to_str(hexstr: str) -> str:
    """UTF-16BE hex payload -> python str (may be several code points)."""
    try:
        return bytes.fromhex(hexstr).decode("utf-16-be", errors="ignore")
    except ValueError:
        return ""


def parse_tounicode(stream: str) -> dict[int, str]:
    """Build {glyph_id -> unicode string} from a ToUnicode CMap stream."""
    out: dict[int, str] = {}

    for blk in _BFCHAR_RE.findall(stream):
        for src, dst in _PAIR_RE.findall(blk):
            out[int(src, 16)] = _hex_to_str(dst)

    for blk in _BFRANGE_RE.findall(stream):
        for lo, hi, arr in _RANGE_ARRAY_RE.findall(blk):
            targets = re.findall(r"<([0-9A-Fa-f]+)>", arr)
            for offset, dst in enumerate(targets):
                out[int(lo, 16) + offset] = _hex_to_str(dst)
        for lo, hi, dst in _RANGE_RE.findall(blk):
            lo_i, hi_i = int(lo, 16), int(hi, 16)
            if hi_i - lo_i > 0xFFFF:  # guard against a malformed range
                continue
            base = _hex_to_str(dst)
            if not base:
                continue
            first = ord(base[0])
            for offset in range(hi_i - lo_i + 1):
                out[lo_i + offset] = chr(first + offset) + base[1:]

    return out


class FontMaps:
    """
    Every ToUnicode map published under one font *name*, split by keyspace.

    This book embeds `Lotus-Light` twice — once as a simple `TrueType` font
    (byte-code keyed, a 432-byte map holding punctuation) and once as a
    composite `Type0`/`Identity-H` font (glyph-id keyed, the 3.8 KB map holding
    every Arabic ligature). `get_texttrace()` reports only the shared name, so
    both maps have to be kept and consulted in priority order: glyph id first,
    then byte code. Collapsing them into one entry silently loses every
    ligature and is what turns `المعنى` into `املعنى`.
    """

    __slots__ = ("by_gid", "by_code")

    def __init__(self) -> None:
        self.by_gid: dict[int, str] = {}
        self.by_code: dict[int, str] = {}

    def add(self, table: dict[int, str], composite: bool) -> None:
        target = self.by_gid if composite else self.by_code
        for key, value in table.items():
            target.setdefault(key, value)

    def lookup(self, gid: int, code: int) -> str | None:
        return self.by_gid.get(gid) or self.by_code.get(code)


class CMapCache:
    """Lazily resolves and caches `FontMaps` per font name, per document."""

    def __init__(self, doc: fitz.Document) -> None:
        self.doc = doc
        self._by_fontname: dict[str, FontMaps] = {}
        self._seen_xrefs: set[int] = set()
        self._scanned_pages: set[int] = set()

    def _scan_page(self, page_number: int) -> None:
        if page_number in self._scanned_pages:
            return
        self._scanned_pages.add(page_number)
        for font in self.doc[page_number].get_fonts(full=True):
            xref, ftype, basefont = font[0], font[2], font[3]
            if xref in self._seen_xrefs:
                continue
            self._seen_xrefs.add(xref)
            name = basefont.split("+")[-1]
            maps = self._by_fontname.setdefault(name, FontMaps())
            obj = self.doc.xref_object(xref)
            match = re.search(r"/ToUnicode (\d+) 0 R", obj)
            if not match:
                continue
            try:
                raw = self.doc.xref_stream(int(match.group(1))).decode("latin-1")
            except Exception:
                continue
            maps.add(parse_tounicode(raw), composite=ftype == "Type0")

    def get(self, page_number: int, fontname: str) -> FontMaps:
        self._scan_page(page_number)
        name = fontname.split("+")[-1]
        return self._by_fontname.setdefault(name, FontMaps())


# --------------------------------------------------------------------------
# Line assembly
# --------------------------------------------------------------------------


@dataclass
class Line:
    text: str
    bbox: tuple[float, float, float, float]
    size: float
    fonts: set[str] = field(default_factory=set)

    @property
    def y(self) -> float:
        return self.bbox[1]

    @property
    def x_right(self) -> float:
        return self.bbox[2]


_LTR_RUN_RE = re.compile(r"[0-9A-Za-z][0-9A-Za-z.,/:\-–— ]*[0-9A-Za-z]")

@dataclass
class ExtractStats:
    """Per-run diagnostics — surfaces silent glyph dropouts instead of hiding them."""

    missing_glyphs: collections.Counter = field(default_factory=collections.Counter)
    mushaf_spans: int = 0
    pages: int = 0

    def report(self) -> str:
        if not self.missing_glyphs:
            return f"{self.pages} pages, no unmapped glyphs, {self.mushaf_spans} mushaf spans"
        worst = ", ".join(f"{f}={n}" for f, n in self.missing_glyphs.most_common(8))
        total = sum(self.missing_glyphs.values())
        return (
            f"{self.pages} pages, {total} unmapped glyphs "
            f"({worst}), {self.mushaf_spans} mushaf spans"
        )


def _unreverse_ltr_runs(text: str) -> str:
    """
    The glyph sequence is reversed wholesale for an RTL span, which is right for
    Arabic but wrong for the Latin/numeric islands embedded in it — page
    citations like `بحر 4 / 255` come out as `552`. Flip those runs back.
    """
    return _LTR_RUN_RE.sub(lambda m: m.group(0)[::-1], text)


def _cluster_glyphs(chars: list, maps: "FontMaps") -> list[str]:
    """
    Collapse a texttrace char list into one string per *glyph*.

    `get_texttrace()` reports a ligature glyph once per code point it expands
    to. Emitting the whole expansion for the first entry and then letting the
    trailing entries fall through to the byte-code map duplicates letters
    (`المعنى` -> `املمعنى`).

    Trailing entries are therefore absorbed only when they actually spell out
    the rest of the expansion. Matching on the characters rather than on glyph
    id or geometry keeps two genuinely adjacent `م` glyphs as two, and refuses
    to swallow a neighbour when a font reports a multi-code-point glyph just
    once.
    """
    out: list[str] = []
    i, n = 0, len(chars)
    while i < n:
        code, gid = chars[i][0], chars[i][1]
        expansion = maps.lookup(gid, code)
        if not expansion:
            out.append(chr(code) if code and code != 0xFFFD else "")
            i += 1
            continue
        out.append(expansion)
        consumed = 1
        while (
            consumed < len(expansion)
            and i + consumed < n
            and chars[i + consumed][0] == ord(expansion[consumed])
        ):
            consumed += 1
        i += consumed
    return out


def extract_page_lines(
    doc: fitz.Document,
    page_number: int,
    cmaps: CMapCache,
    *,
    y_tolerance: float = 3.0,
    columns: int = 1,
    stats: ExtractStats | None = None,
) -> list[Line]:
    """
    Extract a page as reading-ordered lines with ligature expansions intact.

    Glyphs are read in placement order and reversed as whole units, so a
    ligature glyph contributes its ToUnicode expansion unreversed.

    `columns` splits the page into that many vertical bands before assembling
    lines, emitted right-band first. Jabal's body pages are two-column, and
    without this a line from the right column is glued to the line beside it in
    the left column, which silently corrupts every entry that spans a column
    break.
    """
    stats = stats if stats is not None else ExtractStats()
    stats.pages += 1
    page = doc[page_number]
    spans = page.get_texttrace()

    rows: list[dict] = []
    for span in spans:
        chars = span.get("chars") or []
        if not chars:
            continue
        font = span.get("font", "")
        is_mushaf = bool(_MUSHAF_FONT_RE.search(font))

        if is_mushaf:
            pieces = [QURAN_GLYPH_SENTINEL]
            stats.mushaf_spans += 1
        else:
            pieces = _cluster_glyphs(chars, cmaps.get(page_number, font))
            missing = sum(1 for p in pieces if not p)
            if missing:
                stats.missing_glyphs[font] += missing

        # Placement order is left-to-right on the page; Arabic reads the other
        # way, so reverse the *glyph sequence* while keeping each glyph's own
        # expansion in its correct internal order.
        rtl = span.get("bidi_dir", 0) != 0 or _ARABIC_RE.search("".join(pieces))
        if rtl:
            pieces = pieces[::-1]

        text = "".join(pieces)
        text = "".join(ch for ch in text if ch not in _DECORATIVE)
        text = re.sub(f"{QURAN_GLYPH_SENTINEL}+", QURAN_GLYPH_SENTINEL, text)
        if rtl:
            # No bidi mirroring here on purpose. The glyph stream already
            # stores the logically correct delimiter, and reversing the run
            # moves it to the correct slot — mirroring on top of that flips it
            # a second time and yields `]المائدة:3[`.
            text = _unreverse_ltr_runs(text)
        if not text.strip():
            continue

        rows.append(
            {
                "text": text,
                "bbox": tuple(span["bbox"]),
                "size": span.get("size", 0.0),
                "font": font,
            }
        )

    if not rows:
        return []

    # Split into vertical bands, right-hand band first (Arabic column order).
    page_x0, page_x1 = page.rect.x0, page.rect.x1
    width = (page_x1 - page_x0) / max(columns, 1)
    bands: list[list[dict]] = [[] for _ in range(max(columns, 1))]
    for row in rows:
        centre = (row["bbox"][0] + row["bbox"][2]) / 2
        idx = min(int((centre - page_x0) / width), len(bands) - 1)
        bands[max(idx, 0)].append(row)

    lines: list[Line] = []
    for band in reversed(bands):
        lines.extend(_assemble(band, y_tolerance))
    return lines


def _assemble(rows: list[dict], y_tolerance: float) -> list[Line]:
    """Group spans into visual lines by baseline proximity, top-to-bottom."""
    if not rows:
        return []
    rows.sort(key=lambda r: (round(r["bbox"][1] / y_tolerance), -r["bbox"][2]))

    lines: list[Line] = []
    current: list[dict] = []
    current_y: float | None = None
    for row in rows:
        y = row["bbox"][1]
        if current_y is None or abs(y - current_y) <= y_tolerance:
            current.append(row)
            if current_y is None:
                current_y = y
        else:
            lines.append(_merge(current))
            current = [row]
            current_y = y
    if current:
        lines.append(_merge(current))

    return lines


_JOINING = set("ببتثجحخسشصضطظعغفقكلمنهيئـ")


def _merge(rows: list[dict]) -> Line:
    """
    Stitch the spans of one visual line together, right to left.

    Spans are NOT joined with an unconditional space. This book is justified
    with kashida, so a single word is routinely drawn as several spans
    (`الشيء` as `ال` + `شي` + `ء`) and superscript tanween is drawn as its own
    span. Once the decorative tatweel is stripped, a blanket space turns those
    back into `ال شي ء` and `امتناع ًا ا` — which corrupts every extracted
    gloss. So the horizontal gap decides: touching spans concatenate, separated
    ones get a space.
    """
    rows = sorted(rows, key=lambda r: -r["bbox"][2])
    kept = [r for r in rows if r["text"].strip()]
    if not kept:
        return Line(text="", bbox=(0, 0, 0, 0), size=0.0, fonts=set())

    prev_text = kept[0]["text"].strip()
    parts: list[str] = [prev_text]
    for previous, current in zip(kept, kept[1:]):
        # RTL: `current` sits to the left of `previous`, so it continues the
        # string. The break therefore falls at the *end* of the previous span's
        # logical text — its visually leftmost character.
        gap = previous["bbox"][0] - current["bbox"][2]
        threshold = 0.3 * max(previous["size"], current["size"], 1.0)
        cur_text = current["text"].strip()
        # Glue only mid-word: a connecting letter at the break means the
        # typesetter split a word, not that a space belongs there.
        mid_word = bool(prev_text) and prev_text[-1] in _JOINING
        parts.append(("" if gap <= threshold and mid_word else " ") + cur_text)
        prev_text = cur_text

    text = "".join(parts)
    text = re.sub(r" {2,}", " ", text).strip()
    x0 = min(r["bbox"][0] for r in rows)
    y0 = min(r["bbox"][1] for r in rows)
    x1 = max(r["bbox"][2] for r in rows)
    y1 = max(r["bbox"][3] for r in rows)
    return Line(
        text=text,
        bbox=(x0, y0, x1, y1),
        size=max(r["size"] for r in rows),
        fonts={r["font"] for r in rows},
    )


def page_text(
    doc: fitz.Document,
    page_number: int,
    cmaps: CMapCache,
    *,
    columns: int = 1,
    stats: ExtractStats | None = None,
) -> str:
    lines = extract_page_lines(
        doc, page_number, cmaps, columns=columns, stats=stats
    )
    return "\n".join(line.text for line in lines)


# --------------------------------------------------------------------------
# Normalisation helpers shared by downstream parsers
# --------------------------------------------------------------------------

_DIACRITICS_RE = re.compile(r"[ً-ٰٟۖ-ۭ]")


def strip_diacritics(text: str) -> str:
    return _DIACRITICS_RE.sub("", unicodedata.normalize("NFC", text))


def normalise_root_key(root: str) -> str:
    """
    Mirror of `normalizeArabicForSearch` in lib/search/arabicNormalize.ts, so
    roots lifted out of the PDF join cleanly against public/data/root-stats.json.

    Keep the two in lockstep. The corpus writes hamza roots with a bare alif
    (`امن`, `امم`) while printed lexicons use the hamza carrier (`أمن`, `ءمم`);
    folding every carrier — including a lone `ء` — to `ا` is what makes those
    two spellings meet.
    """
    root = unicodedata.normalize("NFKD", root.strip())
    root = _DIACRITICS_RE.sub("", root)
    root = root.replace("ـ", "")
    root = re.sub(r"[ٱأإآء]", "ا", root)
    root = root.replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي").replace("ة", "ه")
    return re.sub(r"\s+", "", root)
