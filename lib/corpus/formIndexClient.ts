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

/** Resolve an inflected surface word to its root's bare key, or null. */
export function lookupFormRoot(idx: FormIndex, query: string): string | null {
  const q = normalizeArabicForSearch(query);
  if (!q) return null;
  if (idx.forms[q]) return idx.forms[q];
  const stripped = q.replace(PROCLITIC, "");
  if (stripped.length >= 2 && idx.forms[stripped]) return idx.forms[stripped];
  return null;
}
