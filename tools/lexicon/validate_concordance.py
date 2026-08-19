# -*- coding: utf-8 -*-
"""
Turn raw concordance OCR into validated rows — or into an explicit reject list.

The premise: `المعجم المفهرس` prints nothing we cannot already check. Each row
carries a surah name, a surah number, an ayah number, a Makkan/Madinan marker
and a verse fragment, and our corpus holds the truth for all five. So OCR output
is never trusted — it is a *candidate* that must resolve against the corpus.

That inverts the hard part. Instead of needing OCR accurate enough to trust, we
need it accurate enough to *identify* the right verse; once identified, the
verse text is taken from the corpus and the OCR's own reading of it is
discarded. `المالحة` resolving to المائدة costs nothing, because the name is an
index into data we already have.

Rows that fail to resolve are not silently dropped — they are written to a
rejects file, because a silent drop reads as "clean" when it is not.

Usage:
    python tools/lexicon/validate_concordance.py --pages 150-152
"""

from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from corpus_ref import (  # noqa: E402
    arabic_digits,
    fold,
    folded_verses,
    surah_name_index,
    surahs,
    verses,
)
from ocr_mistral import (  # noqa: E402
    DEFAULT_CACHE,
    DEFAULT_MODEL,
    DEFAULT_PDF,
    cache_path,
    recover_structure_leak,
    suspicious_ocr,
)

# Below this, a fragment is not considered to have identified its verse.
ACCEPT_SCORE = 0.55
STRONG_SCORE = 0.75

_NUM_RE = re.compile(r"[0-9٠-٩]+")
# Must include the diacritic block (U+064B–U+0652). Some pages come back fully
# vocalised (`وَأَقْرَأُوا يَوْمًا`), and a class of bare letters alone never
# matches a 6-character run in those — silently dropping every row on the page.
_ARABIC_RUN_RE = re.compile(r"[ء-ْٰٱ\s]{6,}")


def repetition_ratio(fragment: str) -> float:
    """
    How degenerate a fragment is: 1 - (unique tokens / total tokens).

    Mistral OCR sometimes falls into a token loop on these dense scans and
    emits `فبغته فبغته فبغته …`. Such a fragment carries almost no information
    but, scored naively, looks like a near-perfect match.
    """
    tokens = [t for t in fragment.split() if len(t) > 1]
    if len(tokens) < 4:
        return 0.0
    return 1.0 - (len(set(tokens)) / len(tokens))


def token_score(fragment: str, verse: str) -> float:
    """
    Fraction of *distinct* fragment tokens that appear in the verse.

    Token containment rather than whole-string similarity, because the printed
    fragment is a truncated excerpt of the verse, not the whole of it — a
    sequence ratio would punish exactly the truncation the book intends.

    Distinct, not raw, because counting repeats lets one accidentally-matching
    token repeated ten times by an OCR loop score 0.9 against an unrelated
    verse. Each token can also only consume one verse token, so a fragment
    cannot score by matching the same word over and over.
    """
    frag_tokens = list(dict.fromkeys(t for t in fragment.split() if len(t) > 1))
    if not frag_tokens:
        return 0.0
    verse_tokens = verse.split()
    if not verse_tokens:
        return 0.0

    unused = list(verse_tokens)
    hits = 0
    for token in frag_tokens:
        match = None
        if token in unused:
            match = token
        else:
            for candidate in unused:
                if difflib.SequenceMatcher(None, token, candidate).ratio() >= 0.78:
                    match = candidate
                    break
        if match is not None:
            hits += 1
            unused.remove(match)
    return hits / len(frag_tokens)


# Column captions, printed at the top of every column and OCR'd inconsistently
# (الفقرة / القطة / الصفة / اللفظة …). None of them are data.
_CAPTION_TOKENS = ("الفقرة", "اللفظة", "القطة", "الصفة", "الخطبة", "الآية",
                   "السورة", "رقمها", "وقها", "رفها", "الورقة", "الفئة")


def _is_caption(text: str) -> bool:
    hits = sum(1 for token in _CAPTION_TOKENS if token in text)
    return hits >= 2 and len(text) < 80


def split_rows(markdown: str) -> list[str]:
    """
    Pull data rows out of an OCR'd page.

    Mistral renders roughly half these pages as markdown tables and the other
    half as plain lines — the layout is identical, only the transcription
    differs. Accepting only tables silently discards every plain-text page,
    which cost 52% of the book before this was caught. Both shapes are handled,
    and a page is never read both ways.
    """
    # A page the model hallucinated or returned in the wrong shape contributes
    # nothing trustworthy. A pure structure leak is recoverable — the real
    # transcription is inside the leaked JSON — so try that before refusing.
    flags = suspicious_ocr(markdown)
    if flags:
        if flags == ["structure-leak"]:
            recovered = recover_structure_leak(markdown)
            if not recovered:
                return []
            markdown = recovered
        else:
            return []

    rows: list[str] = []
    saw_table = False

    for line in markdown.splitlines():
        line = line.strip()
        if not line.startswith("|"):
            continue
        if set(line) <= set("|- :"):  # separator row
            continue
        saw_table = True
        joined = " ".join(c.strip() for c in line.strip("|").split("|"))
        if _is_caption(joined) or not _ARABIC_RUN_RE.search(joined):
            continue
        rows.append(joined)

    if saw_table:
        return rows

    for line in markdown.splitlines():
        line = line.strip().lstrip("#").strip()
        if len(line) < 12 or _is_caption(line):
            continue
        if not _ARABIC_RUN_RE.search(line):
            continue
        # A data row cites a verse, so it carries at least one number; running
        # heads and section titles do not.
        if not re.search(r"[0-9٠-٩]", line):
            continue
        rows.append(line)

    return rows


def candidate_surahs(
    row_folded: str, numbers: list[int], carry: int | None = None
) -> list[int]:
    """Surah numbers worth testing, name matches first."""
    index = surah_name_index()
    tokens = set(row_folded.split())
    found: list[int] = []
    for name, number in index.items():
        # Long names can match as a substring; short ones (طه, يس, ص, ق, ن)
        # must match a whole token or they fire on any word containing them.
        if len(name) >= 3:
            if name in row_folded:
                found.append(number)
        elif name in tokens:
            found.append(number)
    # Fuzzy fallback for names the scan mangles (المائدة -> المالحة).
    if not found:
        for token in row_folded.split():
            if len(token) < 4:
                continue
            best = max(
                index.items(),
                key=lambda kv: difflib.SequenceMatcher(None, token, kv[0]).ratio(),
            )
            if difflib.SequenceMatcher(None, token, best[0]).ratio() >= 0.72:
                found.append(best[1])
    # `»` in this book means "same surah as the row above", so a row with no
    # name of its own inherits the last one that resolved.
    if carry is not None:
        found.append(carry)
    for number in numbers:
        if 1 <= number <= 114:
            found.append(number)
    # Preserve order, drop duplicates.
    return list(dict.fromkeys(found))


def resolve_row(row: str, carry: int | None = None) -> dict:
    """Identify which verse a row refers to, using the corpus as the authority."""
    row_folded = fold(row)
    numbers = [int(arabic_digits(n)) for n in _NUM_RE.findall(row)]
    numbers = [n for n in numbers if 0 < n <= 300]

    fragments = _ARABIC_RUN_RE.findall(row)
    fragment = fold(max(fragments, key=len)) if fragments else ""

    result = {
        "row": row,
        "fragment_ocr": fragment,
        "numbers": numbers,
        "surah": None,
        "ayah": None,
        "score": 0.0,
        "verse": None,
        "status": "unresolved",
    }
    if not fragment:
        result["status"] = "no-fragment"
        return result

    # An OCR token loop cannot identify anything; refuse it outright rather
    # than let a degenerate fragment resolve to a confident-looking verse.
    result["repetition"] = round(repetition_ratio(fragment), 2)
    if result["repetition"] >= 0.5:
        result["status"] = "degenerate-ocr"
        return result

    fv = folded_verses()
    meta = surahs()
    best = (0.0, None, None)

    for surah in candidate_surahs(row_folded, numbers, carry)[:6]:
        limit = meta[surah]["verses"]
        # Try the ayah numbers actually printed on the row first; fall back to
        # sweeping the surah, since a misread digit must not lose the row.
        ordered = [n for n in numbers if 1 <= n <= limit]
        ordered += [a for a in range(1, limit + 1) if a not in ordered]
        for ayah in ordered:
            verse = fv.get((surah, ayah))
            if not verse:
                continue
            score = token_score(fragment, verse)
            if score > best[0]:
                best = (score, surah, ayah)
                if score >= 0.95:
                    break
        if best[0] >= 0.95:
            break

    score, surah, ayah = best
    result["score"] = round(score, 3)
    if surah and score >= ACCEPT_SCORE:
        result["surah"] = surah
        result["ayah"] = ayah
        result["verse"] = verses()[(surah, ayah)]
        result["surah_name"] = meta[surah]["arabic"]
        # The ك/م marker is an independent check on the resolution.
        marker = "م" if re.search(r"(?<![ء-ي])م(?![ء-ي])", row) else (
            "ك" if re.search(r"(?<![ء-ي])ك(?![ء-ي])", row) else None
        )
        expected = "ك" if meta[surah]["place"] == "makkah" else "م"
        result["marker_ocr"] = marker
        result["marker_expected"] = expected
        result["marker_agrees"] = marker is None or marker == expected
        result["status"] = "confirmed" if score >= STRONG_SCORE else "weak"
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pages", required=True)
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--out", type=Path, default=None)
    parser.add_argument("--rejects", type=Path, default=None)
    parser.add_argument("--show", type=int, default=8)
    args = parser.parse_args()

    from ocr_mistral import parse_ranges

    pages = parse_ranges(args.pages)
    resolved: list[dict] = []
    rejects: list[dict] = []
    missing_pages: list[int] = []

    for page in pages:
        path = cache_path(args.cache, args.pdf, page, args.model)
        if not path.exists():
            missing_pages.append(page)
            continue
        record = json.loads(path.read_text(encoding="utf-8"))
        carry: int | None = None
        for row in split_rows(record["markdown"]):
            outcome = resolve_row(row, carry)
            outcome["page"] = page
            if outcome["surah"] and outcome["status"] == "confirmed":
                carry = outcome["surah"]
            (resolved if outcome["surah"] else rejects).append(outcome)

    if missing_pages:
        print(f"not OCR'd yet (run ocr_mistral.py first): {missing_pages}")

    total = len(resolved) + len(rejects)
    if not total:
        print("no rows found")
        return 1

    status = Counter(r["status"] for r in resolved + rejects)
    strong = sum(1 for r in resolved if r["status"] == "confirmed")
    marker_ok = sum(1 for r in resolved if r.get("marker_agrees"))

    print(f"\nrows parsed        : {total}")
    print(f"resolved to a verse: {len(resolved)}  ({100*len(resolved)/total:.1f}%)")
    print(f"  confirmed (>={STRONG_SCORE}) : {strong}  ({100*strong/total:.1f}%)")
    print(f"  weak      (>={ACCEPT_SCORE}) : {len(resolved)-strong}")
    print(f"unresolved         : {len(rejects)}")
    print(f"ك/م marker agrees  : {marker_ok}/{len(resolved)}")
    print("status:", dict(status))

    print(f"\n--- sample resolved (first {args.show}) ---")
    for r in resolved[: args.show]:
        print(f"[{r['score']:.2f}] {r['surah_name']} {r['surah']}:{r['ayah']}")
        print(f"   ocr   : {r['fragment_ocr'][:70]}")
        print(f"   corpus: {r['verse'][:70]}")

    if rejects:
        print(f"\n--- sample unresolved (first {min(args.show, len(rejects))}) ---")
        for r in rejects[: args.show]:
            print(f"[{r['score']:.2f}] p{r['page']}: {r['row'][:90]}")

    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(
            json.dumps(resolved, ensure_ascii=False, indent=1), encoding="utf-8"
        )
        print(f"\nwrote {len(resolved)} rows to {args.out}")
    if args.rejects:
        args.rejects.parent.mkdir(parents=True, exist_ok=True)
        args.rejects.write_text(
            json.dumps(rejects, ensure_ascii=False, indent=1), encoding="utf-8"
        )
        print(f"wrote {len(rejects)} rejects to {args.rejects}")

    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(main())
