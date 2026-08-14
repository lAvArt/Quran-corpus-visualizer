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
import { foldRasmAlef, searchKeyVariants } from "@/lib/search/arabicNormalize";

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

/** The exact surface FORM the user typed (rasm + hamza-alef fallbacks for the
    spellings the corpus writes defectively, e.g. صالح → صلح, قرآن → قرءان). */
export function lookupForm(idx: LemmaFormStats, query: string): DrillEntry | null {
  const variants = searchKeyVariants(query);
  // Every spelling's direct key (incl. the hamza-alef bridge) before any rasm
  // fold, so a bridged hit (قرآن → قرءان) wins over an over-fold (قران → قرن).
  for (const v of variants) if (idx.forms[v]) return idx.forms[v];
  for (const v of variants) {
    const f = foldRasmAlef(v);
    if (f !== v && idx.forms[f]) return idx.forms[f];
  }
  return null;
}

/**
 * The LEMMA of the typed word: a direct lemma-key hit, else via the typed
 * form's lemma link (so العزيز → form ٱلْعَزِيزُ → lemma عَزِيز).
 */
export function lookupLemma(idx: LemmaFormStats, query: string): DrillEntry | null {
  const variants = searchKeyVariants(query);
  const tryKey = (k: string): DrillEntry | null => {
    if (idx.lemmas[k]) return idx.lemmas[k];
    const l = idx.forms[k]?.l;
    return l && idx.lemmas[l] ? idx.lemmas[l] : null;
  };
  for (const v of variants) {
    const hit = tryKey(v);
    if (hit) return hit;
  }
  for (const v of variants) {
    const f = foldRasmAlef(v);
    if (f !== v) {
      const hit = tryKey(f);
      if (hit) return hit;
    }
  }
  return null;
}
