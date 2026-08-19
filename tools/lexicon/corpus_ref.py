# -*- coding: utf-8 -*-
"""
Reference Quran text and surah metadata, rebuilt from what the repo already ships.

The concordance OCR has no ground truth of its own, but every field it prints —
surah name, surah number, ayah number, Makkan/Madinan marker, and the verse
fragment itself — is something we already hold. This module exposes that as the
checking surface.

Sources (single source of truth, not re-typed here):
  * public/data/quranic-corpus-morphology-0.4.txt  — segment forms in Buckwalter
  * lib/data/surahData.ts                          — Arabic names, verse counts,
                                                     revelation place
"""

from __future__ import annotations

import re
import unicodedata
from functools import lru_cache
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MORPHOLOGY = REPO / "public" / "data" / "quranic-corpus-morphology-0.4.txt"
SURAH_DATA = REPO / "lib" / "data" / "surahData.ts"

# Mirrors BUCKWALTER_TO_ARABIC in lib/corpus/morphologyLoader.ts.
BUCKWALTER_TO_ARABIC = {
    "'": "ء", "|": "آ", ">": "أ", "<": "إ", "&": "ؤ", "}": "ئ",
    "A": "ا", "b": "ب", "p": "ة", "t": "ت", "v": "ث", "j": "ج",
    "H": "ح", "x": "خ", "d": "د", "*": "ذ", "r": "ر", "z": "ز",
    "s": "س", "$": "ش", "S": "ص", "D": "ض", "T": "ط", "Z": "ظ",
    "E": "ع", "g": "غ", "f": "ف", "q": "ق", "k": "ك", "l": "ل",
    "m": "م", "n": "ن", "h": "ه", "w": "و", "Y": "ى", "y": "ي",
    "F": "ً", "N": "ٌ", "K": "ٍ", "a": "َ", "u": "ُ", "i": "ِ",
    "~": "ّ", "o": "ْ", "`": "ٰ", "{": "ٱ",
}
BUCKWALTER_STRIP = set("^@_.,2[]")

ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩"
_AI_TRANS = str.maketrans(ARABIC_INDIC, "0123456789")
_DIACRITICS_RE = re.compile(r"[ً-ٰٟۖ-ۭـ]")


def buckwalter_to_arabic(text: str) -> str:
    return "".join(
        BUCKWALTER_TO_ARABIC.get(ch, ch) for ch in text if ch not in BUCKWALTER_STRIP
    )


def arabic_digits(text: str) -> str:
    """Fold Arabic-Indic digits to ASCII."""
    return text.translate(_AI_TRANS)


def fold(text: str) -> str:
    """
    Aggressive fold for comparing OCR output against reference text.

    Drops diacritics and collapses the orthographic variants OCR most often
    confuses, so a match reflects the consonantal skeleton rather than the
    scan's rendering of a 1960s typeface.
    """
    text = unicodedata.normalize("NFKD", text)
    text = _DIACRITICS_RE.sub("", text)
    text = re.sub(r"[ٱأإآ]", "ا", text)
    text = text.replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي")
    text = text.replace("ة", "ه")
    text = re.sub(r"[^ء-ي\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


# --------------------------------------------------------------------------
# Surah metadata
# --------------------------------------------------------------------------

_SURAH_RE = re.compile(
    r"(\d+):\s*\{\s*name:\s*\"(?P<name>[^\"]+)\"\s*,\s*"
    r"arabic:\s*\"(?P<arabic>[^\"]+)\"\s*,\s*"
    r"meaning:\s*\"(?P<meaning>[^\"]*)\"\s*,\s*"
    r"verses:\s*(?P<verses>\d+)\s*,\s*"
    r"revelationPlace:\s*\"(?P<place>makkah|madinah)\""
)


@lru_cache(maxsize=1)
def surahs() -> dict[int, dict]:
    """{surah number -> {arabic, name, verses, place}} parsed from surahData.ts."""
    text = SURAH_DATA.read_text(encoding="utf-8")
    out: dict[int, dict] = {}
    for match in _SURAH_RE.finditer(text):
        number = int(match.group(1))
        out[number] = {
            "arabic": match.group("arabic"),
            "name": match.group("name"),
            "verses": int(match.group("verses")),
            "place": match.group("place"),
        }
    if len(out) != 114:
        raise RuntimeError(f"parsed {len(out)} surahs from surahData.ts, expected 114")
    return out


@lru_cache(maxsize=1)
def surah_name_index() -> dict[str, int]:
    """{folded Arabic surah name -> number}, with common concordance variants."""
    index: dict[str, int] = {}
    for number, meta in surahs().items():
        key = fold(meta["arabic"])
        index[key] = number
        # The concordance drops the article on several names.
        if key.startswith("ال"):
            index.setdefault(key[2:], number)
    return index


# --------------------------------------------------------------------------
# Verse text
# --------------------------------------------------------------------------


@lru_cache(maxsize=1)
def verses() -> dict[tuple[int, int], str]:
    """{(surah, ayah) -> Arabic verse text} rebuilt from the morphology file."""
    words: dict[tuple[int, int, int], list[str]] = {}
    pattern = re.compile(r"^\((\d+):(\d+):(\d+):(\d+)\)\t([^\t]*)\t")
    with MORPHOLOGY.open(encoding="utf-8") as handle:
        for line in handle:
            match = pattern.match(line)
            if not match:
                continue
            surah, ayah, word, _seg = (int(match.group(i)) for i in range(1, 5))
            words.setdefault((surah, ayah, word), []).append(match.group(5))

    out: dict[tuple[int, int], list[tuple[int, str]]] = {}
    for (surah, ayah, word), segments in words.items():
        out.setdefault((surah, ayah), []).append(
            (word, buckwalter_to_arabic("".join(segments)))
        )

    return {
        key: " ".join(form for _, form in sorted(parts))
        for key, parts in out.items()
    }


@lru_cache(maxsize=1)
def folded_verses() -> dict[tuple[int, int], str]:
    return {key: fold(text) for key, text in verses().items()}


if __name__ == "__main__":
    import sys

    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    v = verses()
    print("verses loaded:", len(v))
    print("surahs loaded:", len(surahs()))
    print("1:1 ->", v[(1, 1)])
    print("5:18 ->", v[(5, 18)][:90])
    print("folded 5:18 ->", folded_verses()[(5, 18)][:90])
    print("name index sample:", list(surah_name_index().items())[:5])
