# -*- coding: utf-8 -*-
"""
Lift per-root core meanings out of Jabal's `المعجم الاشتقاقي المؤصل`.

The book states, for each root entry, a single `المعنى المحوري` — the axial
sense it claims unifies every word built on that root. That is precisely the
datum our app lacks: lib/data/rootGlossesAr.ts holds 48 hand-written Arabic
glosses against ~1,642 corpus roots.

Segmentation is typographic, not textual. Entry headers are set in `SKR-HEAD1`
at ~16pt; body is `Lotus-Light` at 15pt; the meaning labels are set in
`AL-Mohanadjass`. Parenthesised tokens inside body text are verb patterns
(`(فرح)`, `(نصر)`, `(كتَعِب)`) and are NOT roots — matching headers by regex
over the text yields thousands of false positives, so this keys off the font.

Scope limit, stated because it is easy to miss: the PDF in docs/ is volume 1
only (باب الباء → باب الشين). Roots outside that range simply are not in the
file, which caps coverage near half the corpus regardless of parser quality.

Usage:
    python tools/lexicon/parse_jabal.py --out public/data/root-meanings.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import fitz  # noqa: E402

from pdf_text import (  # noqa: E402
    CMapCache,
    ExtractStats,
    QURAN_GLYPH_SENTINEL,
    extract_page_lines,
    normalise_root_key,
)

REPO = Path(__file__).resolve().parents[2]
JABAL = REPO / "docs" / "المعجم الاشتقاقي المؤصل - محمد حسن جبل.pdf"
ROOT_STATS = REPO / "public" / "data" / "root-stats.json"

HEADER_FONT = "SKR-HEAD1"
HEADER_SIZE = (13.0, 20.0)
BAB_SIZE_MIN = 24.0  # the big per-bāb letter tab, not an entry header

CORE_MARKER = "المعنى المحوري"
FASL_MARKER = "معنى الفصل المعجمي"

# First body page — everything before is front matter (باب الباء starts p54).
FIRST_BODY_PAGE = 54

_ARABIC_ONLY = re.compile(r"^[ء-ي]+$")

# Body text is 15pt; footnotes are 12pt and sit at the foot of the column, so
# without this they get swept into whichever entry happens to end the page.
BODY_SIZE_MIN = 13.0

_DIACRITICS_ONLY_RE = re.compile(r"[ً-ٰٟـ]")
# Footnote call-outs are printed inline as `(1 )`, `(2 )` and are not meaning.
_FOOTNOTE_REF_RE = re.compile(r"\(\s*\d+\s*\)")
_DIACRITIC_TOKEN_RE = re.compile(r"(?<=\s)[ً-ٰٟ]+ا?(?=\s|$)")
_TANWEEN_ALIF_DUP_RE = re.compile(r"ًا\s+ا(?![ء-ي])")
_ALIF_TANWEEN_SPLIT_RE = re.compile(r"([ء-ي])ا\s+ًا(?![ء-ي])")


def tidy_arabic(text: str) -> str:
    """
    Repair the artefacts left by superscript tanween being drawn as its own span.

    The typesetter raises `ـًا` onto a separate, higher baseline, so line
    grouping cannot always place it back against its host word. That leaves
    three signatures: `محجوبًا ا`, `دائما ًا`, and a fully orphaned `ًا` token.
    Dropping a tanween mark is a far smaller error than leaving injected
    letters in the middle of a gloss, so orphans are removed rather than
    guessed back into position.
    """
    text = _ALIF_TANWEEN_SPLIT_RE.sub(r"\1ًا", text)
    text = _TANWEEN_ALIF_DUP_RE.sub("ًا", text)
    text = _DIACRITIC_TOKEN_RE.sub("", text)
    text = _FOOTNOTE_REF_RE.sub("", text)
    return re.sub(r"\s{2,}", " ", text).strip()


@dataclass
class Entry:
    page: int
    header: str
    roots: list[str] = field(default_factory=list)
    lines: list[str] = field(default_factory=list)

    @property
    def text(self) -> str:
        joined = " ".join(self.lines)
        joined = joined.replace(QURAN_GLYPH_SENTINEL, " ")
        return tidy_arabic(re.sub(r"\s+", " ", joined).strip())


def roots_from_header(header: str) -> list[str]:
    """
    `(تنن - تنتن ):` -> ['تنن', 'تنتن'].

    Headers occasionally carry more than one root when Jabal treats variants
    together; each is emitted separately so both can be looked up.
    """
    inner = re.findall(r"\(([^)]*)\)", header)
    chunks = inner if inner else [header]
    out: list[str] = []
    for chunk in chunks:
        for part in re.split(r"[-–—/،,]", chunk):
            part = re.sub(r"[^ء-ي]", "", part)
            if 2 <= len(part) <= 6 and _ARABIC_ONLY.match(part):
                out.append(part)
    return list(dict.fromkeys(out))


# Jabal writes the marker several ways: bare, or with a connector clause such as
# `المعنى المحوري لاستعمالات هذا التركيب هو:` / `للتركيبين (أوب/ أيب):`. The
# clause is scaffolding, not meaning, so it is dropped up to its colon.
#
# The clause must be *recognised*, not merely be "whatever precedes a colon" —
# Jabal also writes `<definition>: ك<illustration>`, so a permissive rule
# deletes the definition and leaves only the example. That mistake silently
# gutted 607 of 1,084 entries before this was tightened.
_SCAFFOLD_WORDS = ("استعمالات", "التركيب", "تركيب", "المادة", "هذا", "هذه", "لهذا")
_LEAD_IN_RE = re.compile(r"^\s*([^:：]{0,70}?)[:：]\s*")


def _clean_meaning(text: str) -> str:
    """Trim a captured meaning to its statement, dropping the discussion after."""
    text = re.sub(r"\s+", " ", text).strip()
    # Only strip a lead-in when the pre-colon segment is recognisably
    # scaffolding — bare `هو` / `هي`, or a clause naming the entry itself.
    match = _LEAD_IN_RE.match(text)
    if match:
        clause = match.group(1).strip()
        is_scaffold = clause in ("هو", "هي", "") or any(
            word in clause for word in _SCAFFOLD_WORDS
        )
        if is_scaffold and len(text) - match.end() >= 20:
            text = text[match.end():]
    text = text.strip(" :.،؛-–—")
    # The statement normally ends at the first full stop; keep going if that
    # lands absurdly early (abbreviations, a stray point inside a citation).
    for match in re.finditer(r"[.؟!]", text):
        if match.start() >= 40:
            return text[: match.start()].strip()
    return text[:400].strip()


def extract_entries(doc: fitz.Document, cmaps: CMapCache, stats: ExtractStats) -> list[Entry]:
    entries: list[Entry] = []
    current: Entry | None = None

    for page_number in range(doc.page_count):
        page_label = page_number + 1
        lines = extract_page_lines(
            doc, page_number, cmaps, columns=2, stats=stats
        )
        for line in lines:
            is_header = (
                HEADER_FONT in line.fonts
                and HEADER_SIZE[0] <= line.size <= HEADER_SIZE[1]
                and line.size < BAB_SIZE_MIN
                and "(" in line.text
            )
            if is_header and page_label >= FIRST_BODY_PAGE:
                roots = roots_from_header(line.text)
                if roots:
                    current = Entry(page=page_label, header=line.text, roots=roots)
                    entries.append(current)
                    continue
            if current is not None and line.size >= BODY_SIZE_MIN:
                current.lines.append(line.text)

    return entries


def suspect_reasons(core: str | None) -> list[str]:
    """
    Flag glosses that survived parsing but should not be shipped unreviewed.

    Column and page breaks interleave text in a minority of entries, and a
    silently-wrong gloss is worse than a missing one — so every record carries
    its own verdict rather than leaving consumers to assume the set is clean.
    """
    if not core:
        return ["empty"]
    reasons: list[str] = []
    if len(core) < 6:
        reasons.append("too-short")
    if core.count("(") != core.count(")"):
        reasons.append("unbalanced-parens")
    if re.search(r"(?:^|\s)(?:لاستعمالات|للتركيب|لهذا)\b", core):
        reasons.append("lead-in-not-stripped")
    # An orphan is a whole token that reduces to one letter once diacritics are
    # removed — the signature of a span that drifted out of its word. Testing
    # character adjacency instead would fire on every vowelled letter, since a
    # diacritic sits between the letter and its neighbour.
    for token in core.split():
        bare = _DIACRITICS_ONLY_RE.sub("", token).strip("،؛.:()-–—")
        if len(bare) == 1 and bare in "اأآإبتثجحخدذرزسشصضطظعغفقكمنهوي":
            reasons.append("orphan-letter")
            break
    # Illustrations start with the "such as" kaf; a gloss that begins there has
    # lost its own definition to a mis-placed colon.
    if re.match(r"^ك[ء-ي]", core) or not core[:1].isalpha():
        reasons.append("bad-start")
    return reasons


def _headline(statement: str) -> str:
    """
    The definition proper, before Jabal's illustrations.

    Entries are written `<meaning>: ك<example>…` — the colon introduces
    "such as" material. Everything before it is the gloss a UI wants, and
    cutting there also truncates most of the run-on damage that column and
    page breaks introduce further into the paragraph.
    """
    for separator in (":", "："):
        index = statement.find(separator)
        if 8 <= index <= 160:
            return statement[:index].strip(" :.،؛-–—")
    return statement[:160].strip(" :.،؛-–—")


def meanings_from_entry(entry: Entry) -> dict:
    text = entry.text
    out: dict = {"core": None, "coreFull": None, "fasl": None}

    core = re.search(
        rf"{CORE_MARKER}\s*(?:هو|هي)?\s*[:：]?\s*(.{{20,600}})", text
    )
    if core:
        full = _clean_meaning(core.group(1))
        out["coreFull"] = full
        out["core"] = _headline(full)

    fasl = re.search(
        rf"{FASL_MARKER}\s*(?:\([^)]*\))?\s*[:：]?\s*(.{{20,600}})", text
    )
    if fasl:
        out["fasl"] = _headline(_clean_meaning(fasl.group(1)))

    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", type=Path, default=JABAL)
    parser.add_argument("--out", type=Path, default=None)
    parser.add_argument("--show", type=int, default=10)
    args = parser.parse_args()

    if not args.pdf.exists():
        print(f"missing PDF: {args.pdf}")
        return 2

    doc = fitz.open(args.pdf)
    cmaps = CMapCache(doc)
    stats = ExtractStats()
    entries = extract_entries(doc, cmaps, stats)
    doc.close()

    print(f"extraction: {stats.report()}")
    print(f"entries with a typographic header: {len(entries)}")

    records: dict[str, dict] = {}
    with_core = 0
    for entry in entries:
        meanings = meanings_from_entry(entry)
        if meanings["core"]:
            with_core += 1
        for root in entry.roots:
            key = normalise_root_key(root)
            if not key:
                continue
            # First occurrence wins; later pages repeat roots in cross-refs.
            if key in records and records[key].get("core"):
                continue
            records[key] = {
                "root": root,
                "key": key,
                "page": entry.page,
                "header": entry.header,
                "core": meanings["core"],
                "coreFull": meanings["coreFull"],
                "fasl": meanings["fasl"],
                "suspect": suspect_reasons(meanings["core"]),
            }

    printed = sum(1 for r in records.values() if r["core"])
    clean = sum(1 for r in records.values() if r["core"] and not r["suspect"])
    print(f"entries carrying {CORE_MARKER}: {with_core}")
    print(f"distinct root keys: {len(records)}  (with a core meaning: {printed})")
    print(f"  clean (no suspect flags): {clean}  ({100*clean/max(printed,1):.1f}% of parsed)")
    flag_tally: dict[str, int] = {}
    for record in records.values():
        for reason in record["suspect"]:
            flag_tally[reason] = flag_tally.get(reason, 0) + 1
    if flag_tally:
        print("  flags:", dict(sorted(flag_tally.items(), key=lambda kv: -kv[1])))

    # Coverage against the corpus.
    if ROOT_STATS.exists():
        stats_json = json.loads(ROOT_STATS.read_text(encoding="utf-8"))
        corpus = {
            normalise_root_key(bare): entry.get("count", 0)
            for bare, entry in stats_json["roots"].items()
        }
        hits = [k for k in corpus if k in records and records[k]["core"]]
        covered = sum(corpus[k] for k in hits)
        total = sum(corpus.values())
        print(
            f"corpus roots with a Jabal core meaning: {len(hits)}/{len(corpus)} "
            f"({100*len(hits)/len(corpus):.1f}%), "
            f"occurrences {covered}/{total} ({100*covered/total:.1f}%)"
        )

    print(f"\n--- sample (first {args.show} with a core meaning) ---")
    shown = 0
    for record in records.values():
        if not record["core"] or shown >= args.show:
            continue
        shown += 1
        print(f"\np{record['page']}  {record['root']}  (key={record['key']})")
        print(f"   core: {record['core']}")
        if record["fasl"]:
            print(f"   fasl: {record['fasl']}")

    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": 1,
            "source": {
                "title": "المعجم الاشتقاقي المؤصل لألفاظ القرآن الكريم",
                "author": "محمد حسن جبل",
                "edition": "الطبعة الرابعة 1440/2019",
                "scope": "volume 1 only — باب الباء through باب الشين",
                "note": "Core meanings (المعنى المحوري) extracted from the "
                        "publisher PDF text layer; not OCR.",
            },
            "rootCount": len(records),
            "withCoreMeaning": printed,
            "roots": records,
        }
        args.out.write_text(
            json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8"
        )
        print(f"\nwrote {args.out}")

    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(main())
