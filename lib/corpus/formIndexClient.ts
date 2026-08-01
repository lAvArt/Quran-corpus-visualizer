/**
 * Client for the surface-form → root index (public/data/form-index.json, built
 * by scripts/build-form-index.ts). Lets the home search resolve an inflected
 * word (اسم, اسماء, كتاب, الرحمن) to its root's key, so the result chooser can
 * offer the root alongside any same-prefix name. Lazy + best-effort.
 */
import { normalizeArabicForSearch } from "@/lib/search/arabicNormalize";

export interface FormIndex {
  version: number;
  /** normalized surface form → bare Arabic root (matches root-stats keys). */
  forms: Record<string, string>;
}

let cache: FormIndex | null = null;
let promise: Promise<FormIndex> | null = null;

export async function loadFormIndex(): Promise<FormIndex> {
  if (cache) return cache;
  if (!promise) {
    promise = fetch("/data/form-index.json")
      .then((r) => {
        if (!r.ok) throw new Error(`form-index ${r.status}`);
        return r.json();
      })
      .then((d: FormIndex) => {
        cache = d;
        return d;
      });
  }
  return promise;
}

const PROCLITIC = /^(وال|فال|بال|كال|لل|ال|و|ف|ب|ك|ل)/;

/**
 * Fold the modern (imlāʾī) spelling toward the corpus's Uthmani rasm by
 * dropping the MEDIAL long-alef — the letter the rasm most commonly omits
 * (صالح is written صلح, الصالحين → الصلحين, رحمان → رحمن). Keep the first and
 * last letters so a leading article/hamza-alif or a genuine final alef is
 * preserved. Used only as a fallback, so an over-fold that finds nothing is
 * harmless; the win is that a naturally-typed word like صالح now resolves.
 */
function foldRasmAlef(s: string): string {
  if (s.length <= 2) return s;
  return s[0] + s.slice(1, -1).replace(/ا/g, "") + s[s.length - 1];
}

/** Resolve an inflected surface word to its root's bare key, or null. */
export function lookupFormRoot(idx: FormIndex, query: string): string | null {
  const q = normalizeArabicForSearch(query);
  if (!q) return null;
  const resolve = (k: string): string | null => {
    if (idx.forms[k]) return idx.forms[k];
    const stripped = k.replace(PROCLITIC, "");
    if (stripped.length >= 2 && idx.forms[stripped]) return idx.forms[stripped];
    return null;
  };
  // Direct (imlāʾī) match first; then the rasm-folded spelling so words the
  // corpus writes defectively (صالح → صلح) still reach their root.
  const direct = resolve(q);
  if (direct) return direct;
  const folded = foldRasmAlef(q);
  return folded !== q ? resolve(folded) : null;
}
