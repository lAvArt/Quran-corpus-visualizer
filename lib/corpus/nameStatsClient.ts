/**
 * Client loader + lookup for the precomputed name-stats index
 * (`public/data/name-stats.json`, built by scripts/build-name-stats.ts).
 *
 * Covers the Quran's ROOT-LESS words — proper nouns (Moses, Mary, Pharaoh…) and
 * function words (من, إلى, حتى…) — which never appear in root-stats.json. Lets
 * the home search resolve a name typed as-is and show the same "how often /
 * where" card, and gives every surface one consistent occurrence count.
 *
 * Matching uses the SHARED `normalizeArabicForSearch` (folds hamza→ا, ى→ي,
 * ة→ه, strips diacritics/tatweel/dagger-alif) — the SAME function the build
 * script keys entries by and that the BM25 lanes tokenize with — so surface
 * typing agrees with the index and with /search.
 */

import { normalizeArabicForSearch, buildLemmaCandidates } from "@/lib/search/arabicNormalize";

export interface NameStat {
  /** "name" for proper nouns, "word" for root-less function words. */
  kind: "name" | "word";
  /** normalizeArabicForSearch(display) — the lookup key. */
  key: string;
  /** Plain Arabic display form, e.g. "موسى". */
  root: string;
  /** Same as `root` (kept so NameStat structurally satisfies RootStat). */
  bare: string;
  /** Dominant Buckwalter LEM. */
  bw: string;
  /** Vocalized Arabic of the dominant LEM. */
  lemma: string;
  translit: string;
  gloss: string | null;
  /** Latin spelling variants that feed the transliteration term index. */
  latinAliases?: string[];
  count: number;
  surahs: number;
  verses: number;
  forms: number;
  first: { sura: number; ayah: number } | null;
  /** First occurrence location, for deep-link focus. */
  rep: { sura: number; ayah: number; word: number } | null;
  /** Top sūrahs as [suraId, count, firstAyahInSurah]. */
  top: [number, number, number][];
  hist: number[];
  pos: [string, number][];
  /** Compound occurrence refs [sura, ayah, wordStart, len] (compounds only). */
  occ?: [number, number, number, number][];
}

export interface NameStatsIndex {
  version: number;
  entryCount: number;
  nameCount: number;
  /** Alternate Arabic spelling key → canonical entry key (e.g. سليمان → سليمن). */
  aliasIndex?: Record<string, string>;
  /** Proper-noun keys, frequency-ranked (chips / suggestions). */
  featured: string[];
  names: Record<string, NameStat>;
}

let cache: NameStatsIndex | null = null;
let promise: Promise<NameStatsIndex> | null = null;
// Per-index Latin term index (keyed by the index object so switching indexes —
// e.g. across tests — never reuses stale terms).
const termIndexCache = new WeakMap<NameStatsIndex, Map<string, string>>();

export async function loadNameStats(): Promise<NameStatsIndex> {
  if (cache) return cache;
  if (!promise) {
    promise = fetch("/data/name-stats.json")
      .then((r) => {
        if (!r.ok) throw new Error(`name-stats ${r.status}`);
        return r.json();
      })
      .then((d: NameStatsIndex) => {
        cache = d;
        return d;
      });
  }
  return promise;
}

/** Lowercase, fold accents (ḥ→h, ṣ→s, ʿ→ ), keep only a–z/0–9. */
export function normalizeLatin(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯʿʾˀ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function buildTermIndex(idx: NameStatsIndex): Map<string, string> {
  const map = new Map<string, string>();
  // Higher-count entries win ambiguous terms; Map insertion order also lets
  // the prefix scan land on the most frequent match first.
  const entries = Object.values(idx.names).sort((a, b) => b.count - a.count);
  const add = (term: string, key: string) => {
    if (term && term.length >= 2 && !map.has(term)) map.set(term, key);
  };
  for (const e of entries) {
    add(normalizeLatin(e.translit), e.key);
    for (const al of e.latinAliases ?? []) add(normalizeLatin(al), e.key);
    if (e.gloss) {
      for (const word of e.gloss.split(/[^a-zA-Z]+/)) {
        add(normalizeLatin(word), e.key);
      }
    }
  }
  return map;
}

const ARABIC_RE = /[؀-ۿ]/;

/**
 * Partial typing → closest name (اسماع → اسماعيل). Frequency-ranked prefix over
 * the name keys and alias keys, preferring proper nouns over function words.
 * Min 3 chars so a 1–2 letter prefix doesn't grab an arbitrary name.
 */
function prefixMatch(idx: NameStatsIndex, qn: string): NameStat | null {
  if (qn.length < 3) return null;
  let best: NameStat | null = null;
  const consider = (e: NameStat | undefined) => {
    if (!e) return;
    if (!best) { best = e; return; }
    const es = e.kind === "name" ? 1 : 0;
    const bs = best.kind === "name" ? 1 : 0;
    if (es !== bs) { if (es > bs) best = e; return; }
    if (e.count > best.count) best = e;
  };
  for (const e of Object.values(idx.names)) if (e.key.startsWith(qn)) consider(e);
  if (idx.aliasIndex) {
    for (const [ak, ek] of Object.entries(idx.aliasIndex)) if (ak.startsWith(qn)) consider(idx.names[ek]);
  }
  return best;
}

// Single-letter proclitics (و/ف conjunctions, ب/ك/ل prepositions) that the
// corpus splits into their own segments — a user may still type them glued to
// the name ("ومريم"). Tried only after an exact/candidate miss, so names that
// legitimately start with ال (al-Lat) are unaffected (direct match wins first).
const AR_PROCLITICS = ["وال", "فال", "بال", "كال", "لل", "ال", "و", "ف", "ب", "ك", "ل"];

/** Normalized lookup keys to try for an Arabic query, exact first. */
function arabicCandidates(query: string): string[] {
  const out: string[] = [];
  const push = (s: string) => {
    const k = normalizeArabicForSearch(s);
    if (k && !out.includes(k)) out.push(k);
  };
  push(query);
  for (const cand of buildLemmaCandidates(query)) if (!out.includes(cand)) out.push(cand);
  const base = normalizeArabicForSearch(query);
  for (const p of AR_PROCLITICS) {
    if (base.startsWith(p) && base.length - p.length >= 2) push(base.slice(p.length));
  }
  return out;
}

/**
 * Resolve a free-text query to a single root-less entry (name / word), or null.
 * Arabic: exact normalized key → ال/clitic-stripped candidates. Latin: gloss or
 * transliteration term, then a prefix fallback so partial typing stays matched.
 */
export function lookupName(idx: NameStatsIndex, query: string): NameStat | null {
  const q = (query ?? "").trim();
  if (!q) return null;

  if (ARABIC_RE.test(q)) {
    // Whole query: exact key → alias spelling → ال/clitic/proclitic candidates.
    // (Alias resolves variant spellings like سليمان→سليمن, داوود→داود before the
    //  affix fallbacks, and matches multi-word compound keys like "ذو القرنين".)
    const wholeKey = normalizeArabicForSearch(q);
    if (idx.names[wholeKey]) return idx.names[wholeKey];
    const wholeAlias = idx.aliasIndex?.[wholeKey];
    if (wholeAlias && idx.names[wholeAlias]) return idx.names[wholeAlias];
    for (const cand of arabicCandidates(q)) {
      if (idx.names[cand]) return idx.names[cand];
      const a = idx.aliasIndex?.[cand];
      if (a && idx.names[a]) return idx.names[a];
    }
    // Then each whitespace-separated word (e.g. "سورة مريم" → مريم).
    const parts = q.split(/\s+/).filter((w) => ARABIC_RE.test(w));
    if (parts.length > 1) {
      for (const part of parts) {
        for (const cand of arabicCandidates(part)) {
          if (idx.names[cand]) return idx.names[cand];
          const a = idx.aliasIndex?.[cand];
          if (a && idx.names[a]) return idx.names[a];
        }
      }
    }
    // Last resort: partial typing → closest name by prefix.
    return prefixMatch(idx, wholeKey);
  }

  // Latin — English name / transliteration.
  let termIndex = termIndexCache.get(idx);
  if (!termIndex) {
    termIndex = buildTermIndex(idx);
    termIndexCache.set(idx, termIndex);
  }
  const tryLatin = (s: string): NameStat | null => {
    const lat = normalizeLatin(s);
    if (!lat) return null;
    const key = termIndex!.get(lat);
    if (key) return idx.names[key] ?? null;
    if (lat.length >= 3) {
      for (const [term, k] of termIndex!) {
        if (term.startsWith(lat)) return idx.names[k] ?? null;
      }
    }
    return null;
  };
  const whole = tryLatin(q);
  if (whole) return whole;
  const words = q.split(/[^a-zA-Z]+/).filter((w) => w.length >= 3);
  if (words.length > 1) {
    for (const w of words) {
      const hit = tryLatin(w);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * All names whose key (or alias) starts with the query — for the result
 * chooser. Proper nouns first, then by count. Suggests from the FIRST letter:
 * the home screen is a search box, and a search box that stays silent for two
 * keystrokes reads as broken. Breadth is contained by the count sort + `limit`,
 * not by a length gate. Excludes the exact match (the caller lists it
 * separately).
 */
export function namePrefixMatches(idx: NameStatsIndex, query: string, limit = 8): NameStat[] {
  const qn = normalizeArabicForSearch(query);
  if (!qn) return [];
  const seen = new Set<string>();
  const hits: NameStat[] = [];
  const add = (e: NameStat | undefined) => {
    if (!e || e.key === qn || seen.has(e.key)) return;
    seen.add(e.key);
    hits.push(e);
  };
  for (const e of Object.values(idx.names)) if (e.key.startsWith(qn)) add(e);
  if (idx.aliasIndex) {
    for (const [ak, ek] of Object.entries(idx.aliasIndex)) if (ak.startsWith(qn)) add(idx.names[ek]);
  }
  hits.sort((a, b) => {
    const as = a.kind === "name" ? 1 : 0;
    const bs = b.kind === "name" ? 1 : 0;
    return bs - as || b.count - a.count;
  });
  return hits.slice(0, limit);
}

/** Deterministic "name of the day" from the featured list (optional chips). */
export function nameOfTheDay(idx: NameStatsIndex, epochDay: number): NameStat | null {
  if (!idx.featured.length) return null;
  const key = idx.featured[epochDay % idx.featured.length];
  return idx.names[key] ?? null;
}
