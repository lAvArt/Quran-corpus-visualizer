# -*- coding: utf-8 -*-
"""
Gemini OCR backend for the scanned concordance.

Why a second backend
--------------------
Mistral's OCR endpoint is a fixed transcriber: it reads the page and returns
what it read. Gemini is a general vision model, so it can be *told* what the
page is. That matters here because the layout is rigid and fully describable —
five columns, Arabic-Indic numerals, `»` meaning ditto-previous-surah, `ك`/`م`
marking Makkan/Madinan. A transcriber has to infer all of that; a promptable
model can be handed it, and can return structured rows instead of markdown.

Three levers that the Mistral path did not expose:
  * `media_resolution=ULTRA_HIGH` — this scan is dense 1960s letterpress, and
    resolution is the single biggest quality factor on dense text.
  * `thinking_level` — more deliberation per page, at a price.
  * a real response schema — rows come back typed, so the fragile markdown
    table parsing is skipped entirely.

This plugs into the existing pipeline rather than replacing it: same cache
directory, same `variant` keying, same `suspicious_ocr` guards. So
`select_best_ocr.py` can score a Gemini pass against the Mistral passes page by
page and keep whichever actually wins. The bar is 96.3% of rows resolving to a
verse — that is what best-of-both Mistral already achieves.

Notes on the model, verified against Google's docs on 2026-08-20:
  * `gemini-3.7-flash` shipped 2026-08-13.
  * Gemini 3.x REMOVED `temperature`, `top_p`, `top_k` and `candidate_count`.
    Sending them is an error, so none are sent here.
  * `thinking_budget` is replaced by `thinking_level` (low | medium | high).
  * Run `--list-models` to see what your key can actually reach rather than
    trusting any hardcoded name.

Setup:
    pip install "google-genai>=2.3.0"
    # a Gemini Pro/Advanced *consumer subscription* is NOT API access.
    # Get a key at https://aistudio.google.com/apikey then:
    #   echo 'GEMINI_API_KEY=...' >> .env.local

Usage:
    python tools/lexicon/ocr_gemini.py --list-models
    python tools/lexicon/ocr_gemini.py --pages 150-152
    python tools/lexicon/ocr_gemini.py --pages 13-796 --thinking low
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from ocr_mistral import (  # noqa: E402
    DEFAULT_CACHE,
    DEFAULT_PDF,
    cache_path,
    parse_ranges,
    render_page_png,
    suspicious_ocr,
)

REPO = Path(__file__).resolve().parents[2]
DEFAULT_MODEL = "gemini-3.7-flash"
KEY_NAMES = ("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENAI_API_KEY")


def load_api_key() -> str:
    """Key from the environment or .env.local. Never from argv — that leaks."""
    for name in KEY_NAMES:
        value = os.environ.get(name)
        if value:
            return value.strip()

    env_path = REPO / ".env.local"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            for name in KEY_NAMES:
                if line.startswith(f"{name}="):
                    return line.split("=", 1)[1].strip().strip("\"'")

    raise SystemExit(
        "No Gemini API key found.\n"
        f"  Looked for {', '.join(KEY_NAMES)} in the environment and .env.local.\n"
        "  Note a Gemini Pro/Advanced consumer subscription is NOT API access.\n"
        "  Create a key at https://aistudio.google.com/apikey then add to .env.local:\n"
        "    GEMINI_API_KEY=..."
    )


# --------------------------------------------------------------------------
# Prompt — describing the layout is the whole advantage over a fixed OCR model
# --------------------------------------------------------------------------

LAYOUT_BRIEF = """\
This image is one page of المعجم المفهرس لألفاظ القرآن الكريم by محمد فؤاد عبد الباقي,
a Quranic concordance. It is a 1960s letterpress scan, printed in two columns,
read right-to-left.

Each column is a table. Every data row contains, reading right to left:
  1. اللفظة  — the headword. Printed only when it changes; blank means "same as the row above".
  2. الآية   — an excerpt of the verse, usually ending in dotted leaders (...).
  3. رقمها   — the ayah number, in Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩).
  4. ك or م  — ك marks a Makkan surah, م a Madinan surah.
  5. السورة  — the surah name.
  6. رقمها   — the surah number, in Arabic-Indic digits.

Rules:
- `»` or a ditto mark in the surah column means "same surah as the row above".
- Keep Arabic-Indic digits exactly as printed. Do NOT convert them to 0-9.
- Transcribe ONLY what is printed. Never complete a verse from memory and never
  invent a row: this is a transcription task, not a recall task.
- A long verse excerpt may wrap onto a continuation line with no numbers of its
  own. Attach that text to the row it continues.
- Ignore the running header and the page number at the foot of the page.
- If the page is blank, or carries no table (a title or divider page), return an
  empty rows array rather than guessing.
"""

ROW_SCHEMA = {
    "type": "object",
    "properties": {
        "rows": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "headword": {"type": "string"},
                    "fragment": {"type": "string"},
                    "ayah": {"type": "string"},
                    "makki_madani": {"type": "string"},
                    "surah_name": {"type": "string"},
                    "surah_number": {"type": "string"},
                    "column": {"type": "string", "enum": ["right", "left"]},
                },
                "required": ["fragment", "column"],
            },
        }
    },
    "required": ["rows"],
}


def rows_to_markdown(payload: str) -> str:
    """
    Render structured rows into the markdown the rest of the pipeline reads.

    Keeping one downstream format means validate_concordance, select_best_ocr
    and build_compare_pdf need no Gemini-specific branch.
    """
    cleaned = re.sub(r"^```(?:json)?|```$", "", payload.strip(), flags=re.M).strip()
    try:
        rows = json.loads(cleaned).get("rows") or []
    except (json.JSONDecodeError, AttributeError):
        return payload  # hand the raw text on; the guards downstream will judge it

    lines: list[str] = []
    for column in ("right", "left"):
        subset = [r for r in rows if (r.get("column") or "right") == column]
        if not subset:
            continue
        lines.append("|  اللفظة | الآية | رقمها | السورة | رقمها  |")
        lines.append("| --- | --- | --- | --- | --- |")
        for row in subset:
            surah = " ".join(
                str(x) for x in (row.get("makki_madani"), row.get("surah_name")) if x
            )
            cells = [
                row.get("headword") or "",
                row.get("fragment") or "",
                row.get("ayah") or "",
                surah,
                row.get("surah_number") or "",
            ]
            lines.append("| " + " | ".join(str(c).replace("|", "/") for c in cells) + "  |")
        lines.append("")
    return "\n".join(lines)


# --------------------------------------------------------------------------
# API
# --------------------------------------------------------------------------


def make_client(api_key: str):
    try:
        from google import genai
    except ImportError:
        raise SystemExit(
            'google-genai is not installed.  pip install "google-genai>=2.3.0"'
        )
    return genai.Client(api_key=api_key)


def list_models(client) -> int:
    print("models reachable with this key that support generateContent:\n")
    count = 0
    for model in client.models.list():
        actions = set(getattr(model, "supported_actions", None) or [])
        if actions and "generateContent" not in actions:
            continue
        name = (model.name or "").replace("models/", "")
        count += 1
        print(f"  {name:42} {getattr(model, 'display_name', '') or ''}")
    print(f"\n{count} model(s). Pass one with --model. Vision capability is required.")
    return 0


def transcribe_page(client, model: str, png: bytes, thinking: str, resolution: str):
    from google.genai import types

    # Gemini 3.x rejects temperature / top_p / top_k / candidate_count.
    # thinking_level replaces the old thinking_budget.
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=ROW_SCHEMA,
        thinking_config=types.ThinkingConfig(thinking_level=thinking),
    )
    part = types.Part.from_bytes(
        data=png, mime_type="image/png", media_resolution=resolution
    )
    return client.models.generate_content(
        model=model, contents=[LAYOUT_BRIEF, part], config=config
    )


def run(args) -> int:
    client = make_client(load_api_key())
    if args.list_models:
        return list_models(client)

    resolution = f"MEDIA_RESOLUTION_{args.resolution.upper()}"
    variant = f"gem-{args.model}-{args.dpi}-{args.thinking}-{args.resolution}"
    pages = parse_ranges(args.pages)
    cached = fetched = failed = 0
    flagged: list[int] = []

    for index, page in enumerate(pages, 1):
        path = cache_path(args.cache, args.pdf, page, args.model, variant)
        if path.exists() and not args.force:
            cached += 1
            continue

        png = render_page_png(args.pdf, page, dpi=args.dpi, smooth=args.smooth)

        response = None
        delay = 5
        for attempt in range(args.retries):
            try:
                response = transcribe_page(
                    client, args.model, png, args.thinking, resolution
                )
                break
            except Exception as exc:  # noqa: BLE001 - surface, then back off
                message = str(exc)
                transient = re.search(r"\b(429|500|502|503|504|RESOURCE_EXHAUSTED|UNAVAILABLE)\b", message)
                if not transient or attempt == args.retries - 1:
                    print(f"  p{page} FAILED: {message[:180]}")
                    break
                print(f"    p{page} retry {attempt + 1}/{args.retries - 1} in {delay}s")
                time.sleep(delay)
                delay *= 2

        if response is None:
            failed += 1
            continue

        raw = (getattr(response, "text", None) or "").strip()
        markdown = rows_to_markdown(raw)
        flags = suspicious_ocr(markdown)
        if flags:
            flagged.append(page)

        usage = getattr(response, "usage_metadata", None)
        record = {
            "page": page,
            "model": args.model,
            "mode": f"gemini-{args.thinking}-{args.resolution}",
            "markdown": markdown,
            "raw": raw,
            "flags": flags,
            "usage": {
                "prompt": getattr(usage, "prompt_token_count", None),
                "output": getattr(usage, "candidates_token_count", None),
                "total": getattr(usage, "total_token_count", None),
            } if usage else None,
        }
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(record, ensure_ascii=False, indent=1), encoding="utf-8")
        fetched += 1

        if index % 10 == 1 or index == len(pages):
            note = f"  flags={flags}" if flags else ""
            print(f"  p{page} ({index}/{len(pages)}) {len(markdown)} chars{note}", flush=True)

    print(f"\n{cached} cached, {fetched} fetched, {failed} failed")
    if flagged:
        print(f"flagged by suspicious_ocr: {flagged[:20]}{' …' if len(flagged) > 20 else ''}")
    print(f"variant tag: {variant}")
    print("\nScore it against the Mistral passes (they are not replaced):")
    print("  python tools/lexicon/select_best_ocr.py --pages <range>")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--list-models", action="store_true")
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    p.add_argument("--pages", default="150-152")
    p.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    p.add_argument("--thinking", choices=("low", "medium", "high"), default="low",
                   help="transcription rarely needs deliberation; low is cheapest")
    p.add_argument("--resolution", choices=("low", "medium", "high", "ultra_high"),
                   default="ultra_high", help="dense letterpress needs resolution")
    p.add_argument("--dpi", type=int, default=620)
    p.add_argument("--smooth", type=float, default=0.6)
    p.add_argument("--retries", type=int, default=4)
    p.add_argument("--force", action="store_true")
    return run(p.parse_args())


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(main())
