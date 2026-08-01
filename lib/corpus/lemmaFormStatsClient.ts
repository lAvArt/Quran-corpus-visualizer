/**
 * Client for the lemma/form drill-down stats (public/data/lemma-form-stats.json,
 * built by scripts/build-lemma-form-stats.ts). Powers the home-search "exact
 * match" toggle: narrowing a root result to a specific LEMMA (the word + its
 * inflections) or exact surface FORM, each with its own occurrence count + a
 * verse carousel (via the existing /api/corpus/occurrences?refs= path).
 *
 * Lazy + best-effort: ~2 MB (brotli ≈ 0.5 MB), fetched only once a root result
 * is shown, so the resting home page never pays for it.
 */
import { normalizeArabicForSearch, foldRasmAlef } from "@/lib/search/arabicNormalize";

export interface DrillEntry {
  /** Display Arabic (with diacritics), e.g. عَزِيز / عَزِيزٌ. */
  d: string;
  /** Occurrence count (tokens), matching root-stats semantics. */
  c: number;
  /** Bare root, if any. */
  r?: string;
  /** Normalized lemma key (forms only — links a form to its lemma). */
  l?: string;
  /** Distinct-ayah refs [sura, ayah, word] for the carousel (capped). */
  refs: [number, number, number][];
}

export interface LemmaFormStats {
  version: number;
  forms: Record<string, DrillEntry>;
  lemmas: Record<string, DrillEntry>;
}

let cache: LemmaFormStats | null = null;
let promise: Promise<LemmaFormStats> | null = null;

export async function loadLemmaFormStats(): Promise<LemmaFormStats> {
  if (cache) return cache;
  if (!promise) {
    promise = fetch("/data/lemma-form-stats.json")
      .then((r) => {
        if (!r.ok) throw new Error(`lemma-form-stats ${r.status}`);
        return r.json();
      })
      .then((d: LemmaFormStats) => {
        cache = d;
        return d;
      })
      .catch((e) => {
        promise = null; // allow a later retry
        throw e;
      });
  }
  return promise;
}

/** The exact surface FORM the user typed (رasm-folded fallback for defective spellings). */
export function lookupForm(idx: LemmaFormStats, query: string): DrillEntry | null {
  const q = normalizeArabicForSearch(query);
  if (!q) return null;
  return idx.forms[q] ?? idx.forms[foldRasmAlef(q)] ?? null;
}

/**
 * The LEMMA of the typed word: a direct lemma-key hit, else via the typed
 * form's lemma link (so العزيز → form ٱلْعَزِيزُ → lemma عَزِيز).
 */
export function lookupLemma(idx: LemmaFormStats, query: string): DrillEntry | null {
  const q = normalizeArabicForSearch(query);
  if (!q) return null;
  const direct = idx.lemmas[q] ?? idx.lemmas[foldRasmAlef(q)];
  if (direct) return direct;
  const form = idx.forms[q] ?? idx.forms[foldRasmAlef(q)];
  if (form?.l && idx.lemmas[form.l]) return idx.lemmas[form.l];
  return null;
}
