# -*- coding: utf-8 -*-
"""
Mistral OCR client for the scanned concordance.

`المعجم المفهرس لألفاظ القرآن` is a 796-page 1-bit bitonal scan with no text
layer, so it is the one book here that genuinely needs OCR. (Jabal does not —
see tools/lexicon/pdf_text.py.)

Design notes
------------
* Pages are sliced out of the original PDF and sent as-is rather than
  re-rendered. The scan is already bitonal at ~310 dpi; re-rasterising only
  loses information.
* Every page's result is cached to disk keyed by (pdf name, page number, model).
  OCR costs real money and the scan never changes, so a page is paid for once.
  Re-runs are free and offline.
* Nothing here trusts the OCR output. The concordance's content is fully
  redundant with our own corpus, which makes every row checkable — see
  validate_concordance.py. Treat this module's output as candidates.

Usage:
    python tools/lexicon/ocr_mistral.py --pages 150-152
    python tools/lexicon/ocr_mistral.py --pages 14-796 --out data/mufahras
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import fitz

REPO = Path(__file__).resolve().parents[2]
DEFAULT_PDF = REPO / "docs" / "المعجم المفهرس لألفاظ القرآن.pdf"
DEFAULT_CACHE = REPO / ".lexicon-cache" / "ocr"
API_URL = "https://api.mistral.ai/v1/ocr"
DEFAULT_MODEL = "mistral-ocr-latest"


# --------------------------------------------------------------------------
# Credentials
# --------------------------------------------------------------------------


def load_api_key() -> str:
    """Read MISTRAL_API_KEY from the environment, falling back to .env.local."""
    key = os.environ.get("MISTRAL_API_KEY")
    if key:
        return key.strip()

    env_path = REPO / ".env.local"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("MISTRAL_API_KEY="):
                return line.split("=", 1)[1].strip().strip("\"'")

    raise SystemExit(
        "MISTRAL_API_KEY not found in the environment or .env.local"
    )


# --------------------------------------------------------------------------
# Page slicing
# --------------------------------------------------------------------------


def slice_pdf(pdf_path: Path, first: int, last: int) -> bytes:
    """Extract a 1-indexed inclusive page range into a standalone PDF."""
    src = fitz.open(pdf_path)
    out = fitz.open()
    out.insert_pdf(src, from_page=first - 1, to_page=last - 1)
    data = out.tobytes(garbage=3, deflate=True)
    out.close()
    src.close()
    return data


def render_page_png(
    pdf_path: Path, page: int, *, dpi: int = 620, smooth: float = 0.6
) -> bytes:
    """
    Render one page as a greyscale PNG for OCR.

    Two things matter here, both measured rather than assumed:

    * **Image input beats PDF input.** Pages that returned nothing at all when
      submitted as a PDF slice (500, 773) transcribe fine as images.
    * **Upscale and re-soften.** The source is 1-bit bitonal at ~310 dpi, so it
      is already thresholded: strokes are broken and there is no grey left for
      the model to work with. Rendering at 2x and applying a light blur puts
      anti-aliased edges back. On the worst page this took 37 rows to 73.
    """
    doc = fitz.open(pdf_path)
    pix = doc[page - 1].get_pixmap(dpi=dpi, colorspace=fitz.csGRAY)
    doc.close()

    from PIL import Image, ImageFilter

    img = Image.frombytes("L", (pix.width, pix.height), pix.samples)
    if smooth > 0:
        img = img.filter(ImageFilter.GaussianBlur(smooth))
    buffer = io.BytesIO()
    img.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


# --------------------------------------------------------------------------
# API
# --------------------------------------------------------------------------


class OcrError(RuntimeError):
    pass


_CJK_RE = re.compile(r"[　-鿿＀-￯]")
_CYRILLIC_RE = re.compile(r"[Ѐ-ӿ]")
_DEVANAGARI_RE = re.compile(r"[ऀ-ॿ]")
_ARABIC_RE = re.compile(r"[؀-ۿ]")
_STRUCT_LEAK_RE = re.compile(r'\[\s*\{\s*"box_2d"|"label"\s*:\s*"table"')


# The wrapper the model splices in around (or instead of) its markdown.
_LEAK_OPEN_RE = re.compile(
    r'\[\s*\{\s*"box_2d"\s*:.*?"caption"\s*:\s*"', re.S
)
_LEAK_CLOSE_RE = re.compile(r'"\s*\}\s*\]')
_LEAK_BLOB_RE = re.compile(r'\[\s*\{\s*"box_2d".*?\}\s*\]', re.S)


def recover_structure_leak(markdown: str) -> str | None:
    """
    Salvage a page where the model spliced its layout JSON into the markdown.

    Two shapes occur, and they need opposite treatment:

    * The blob sits *inside* otherwise-good markdown, with real tables before
      and after it (p122). Its own caption is degenerate filler.
    * The blob *wraps* the real table, so the entire transcription lives in the
      `caption` string (p542).

    Unwrapping in place handles both: the JSON scaffolding is removed and
    whatever it enclosed stays where it was. Deleting the blob outright would
    throw away the whole page in the second case.

    This matters because these pages fail *deterministically* — retried with
    `--force` they return byte-identical output, so retry never clears them.

    Returns None when too little survives, so the caller can still reject.
    """
    cleaned = _LEAK_OPEN_RE.sub("\n", markdown)
    cleaned = _LEAK_CLOSE_RE.sub("\n", cleaned)
    cleaned = _LEAK_BLOB_RE.sub("\n", cleaned)
    cleaned = cleaned.replace("\\n", "\n").replace('\\"', '"')
    if cleaned == markdown:
        return None
    return cleaned if len(_ARABIC_RE.findall(cleaned)) >= 50 else None


def suspicious_ocr(markdown: str) -> list[str]:
    """
    Reasons a page's OCR should not be believed.

    Two real failure modes showed up across this book, both rare but both
    silent:

    * **Hallucination on blank pages.** Page 796 is blank — zero ink — and the
      model returned 561 characters of Chinese text about related-party
      transactions. A blank page must yield nothing, never invented content.
    * **Structure leak.** Pages 216 and 388 returned the model's internal
      `[{"box_2d": …, "label": "table"}]` JSON instead of markdown. Retrying
      fixed both, so it is stochastic rather than page-specific.

    Neither is caught by scoring the text against the corpus, because the text
    never reaches the resolver in a parseable shape — so it is checked here.
    """
    reasons: list[str] = []
    if not markdown.strip():
        return reasons

    arabic = len(_ARABIC_RE.findall(markdown))
    if _CJK_RE.search(markdown):
        reasons.append("cjk-text")
    if _CYRILLIC_RE.search(markdown):
        reasons.append("cyrillic-text")
    if _DEVANAGARI_RE.search(markdown):
        reasons.append("devanagari-text")
    if _STRUCT_LEAK_RE.search(markdown):
        reasons.append("structure-leak")
    if arabic < 20 and len(markdown.strip()) > 120:
        reasons.append("no-arabic")
    return reasons


def _post(payload: dict, api_key: str, timeout: int = 300) -> dict:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        API_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:600]
        # Never echo the payload back — it would not contain the key, but the
        # response body can carry request context. Status + message is enough.
        raise OcrError(f"HTTP {exc.code}: {detail}") from None
    except urllib.error.URLError as exc:
        raise OcrError(f"network error: {exc.reason}") from None


def ocr_chunk(
    data: bytes,
    api_key: str,
    *,
    model: str = DEFAULT_MODEL,
    retries: int = 3,
    as_image: bool = False,
) -> dict:
    """OCR a PDF chunk or a single page image. Returns the raw API response."""
    encoded = base64.b64encode(data).decode("ascii")
    if as_image:
        document = {
            "type": "image_url",
            "image_url": f"data:image/png;base64,{encoded}",
        }
    else:
        document = {
            "type": "document_url",
            "document_url": f"data:application/pdf;base64,{encoded}",
        }
    payload = {
        "model": model,
        "document": document,
        "include_image_base64": False,
    }

    delay = 4
    last: Exception | None = None
    for attempt in range(retries):
        try:
            return _post(payload, api_key)
        except OcrError as exc:
            last = exc
            message = str(exc)
            # Retry only on rate limiting and transient server faults.
            if not re.search(r"HTTP (429|5\d\d)", message):
                raise
            if attempt < retries - 1:
                print(f"    retry {attempt + 1}/{retries - 1} after {delay}s ({message[:80]})")
                time.sleep(delay)
                delay *= 2
    raise last if last else OcrError("unreachable")


# --------------------------------------------------------------------------
# Cached driver
# --------------------------------------------------------------------------


def cache_path(
    cache_dir: Path, pdf_path: Path, page: int, model: str, variant: str = ""
) -> Path:
    """
    Cache key. `variant` separates rendering strategies so switching to the
    image pipeline does not silently read back PDF-era results.
    """
    key = f"{pdf_path.name}|{model}" + (f"|{variant}" if variant else "")
    tag = hashlib.sha1(key.encode("utf-8")).hexdigest()[:10]
    return cache_dir / tag / f"p{page:04d}.json"


def ocr_pages(
    pdf_path: Path,
    pages: list[int],
    *,
    api_key: str,
    cache_dir: Path = DEFAULT_CACHE,
    model: str = DEFAULT_MODEL,
    chunk_size: int = 5,
    force: bool = False,
    mode: str = "image",
    dpi: int = 620,
    smooth: float = 0.6,
) -> dict[int, dict]:
    """
    OCR the given 1-indexed pages, caching each page's result to disk.

    `mode="image"` renders each page and submits it on its own — slower per
    page than batching a PDF slice, but measurably more accurate on this scan,
    and it recovers pages that the PDF route dropped entirely.
    """
    variant = f"img{dpi}s{smooth}" if mode == "image" else ""
    results: dict[int, dict] = {}
    todo: list[int] = []

    for page in pages:
        path = cache_path(cache_dir, pdf_path, page, model, variant)
        if path.exists() and not force:
            results[page] = json.loads(path.read_text(encoding="utf-8"))
        else:
            todo.append(page)

    if results:
        print(f"  {len(results)} page(s) served from cache")
    if not todo:
        return results

    print(f"  {len(todo)} page(s) to OCR (mode={mode})")

    def store(page_no: int, markdown: str, response: dict) -> None:
        record = {
            "page": page_no,
            "model": response.get("model", model),
            "mode": mode,
            "markdown": markdown,
            "usage_info": response.get("usage_info"),
        }
        path = cache_path(cache_dir, pdf_path, page_no, model, variant)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(record, ensure_ascii=False, indent=1), encoding="utf-8"
        )
        results[page_no] = record

    if mode == "image":
        for index, page_no in enumerate(todo, 1):
            if index % 25 == 1 or index == len(todo):
                print(f"  OCR p{page_no}  ({index}/{len(todo)})", flush=True)
            png = render_page_png(pdf_path, page_no, dpi=dpi, smooth=smooth)
            response = ocr_chunk(png, api_key, model=model, as_image=True)
            markdown = "\n".join(
                p.get("markdown", "") for p in (response.get("pages") or [])
            )
            store(page_no, markdown, response)
        return results

    for start in range(0, len(todo), chunk_size):
        batch = todo[start : start + chunk_size]
        # Only contiguous runs can be sliced as one PDF; split where they break.
        for run in _contiguous(batch):
            first, last = run[0], run[-1]
            label = f"p{first}" if first == last else f"p{first}-{last}"
            print(f"  OCR {label} …", flush=True)
            data = slice_pdf(pdf_path, first, last)
            response = ocr_chunk(data, api_key, model=model)
            pages_out = response.get("pages") or []
            if len(pages_out) != len(run):
                print(
                    f"    warning: asked for {len(run)} page(s), got {len(pages_out)}"
                )
            for offset, page_result in enumerate(pages_out):
                if offset >= len(run):
                    break
                store(run[offset], page_result.get("markdown", ""), response)

    return results


def _contiguous(pages: list[int]) -> list[list[int]]:
    runs: list[list[int]] = []
    for page in sorted(pages):
        if runs and page == runs[-1][-1] + 1:
            runs[-1].append(page)
        else:
            runs.append([page])
    return runs


def parse_ranges(spec: str) -> list[int]:
    """`14-20,150,400-402` -> sorted unique page list."""
    out: set[int] = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            lo, hi = part.split("-", 1)
            out.update(range(int(lo), int(hi) + 1))
        else:
            out.add(int(part))
    return sorted(out)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--pages", required=True, help="e.g. 150-152 or 14,20,31")
    parser.add_argument("--out", type=Path, default=None, help="write .md files here")
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--chunk-size", type=int, default=5)
    parser.add_argument("--force", action="store_true", help="ignore cache")
    parser.add_argument("--mode", choices=("image", "pdf"), default="image",
                        help="image is more accurate on this scan (default)")
    parser.add_argument("--dpi", type=int, default=620)
    parser.add_argument("--smooth", type=float, default=0.6)
    args = parser.parse_args()

    if not args.pdf.exists():
        print(f"missing PDF: {args.pdf}")
        return 2

    pages = parse_ranges(args.pages)
    print(f"{args.pdf.name}: {len(pages)} page(s) requested, model={args.model}")

    results = ocr_pages(
        args.pdf,
        pages,
        api_key=load_api_key(),
        cache_dir=args.cache,
        model=args.model,
        chunk_size=args.chunk_size,
        force=args.force,
        mode=args.mode,
        dpi=args.dpi,
        smooth=args.smooth,
    )

    total_chars = sum(len(r["markdown"]) for r in results.values())
    print(f"\n{len(results)} page(s), {total_chars} chars of markdown")

    if args.out:
        args.out.mkdir(parents=True, exist_ok=True)
        for page, record in sorted(results.items()):
            (args.out / f"p{page:04d}.md").write_text(
                record["markdown"], encoding="utf-8"
            )
        print(f"wrote {len(results)} file(s) to {args.out}")

    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(main())
