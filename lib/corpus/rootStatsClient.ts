/**
 * Client loader + lookup for the precomputed root-stats index
 * (`public/data/root-stats.json`, built by scripts/build-root-stats.ts).
 *
 * Powers the minimal home screen: real "how often / where" data for any root
 * without loading the full 6 MB corpus. Matches a query against the Arabic root,
 * its Buckwalter form, a romanized skeleton, or the curated English gloss.
 */

import { normalizeArabicForSearch } from "@/lib/search/arabicNormalize";

/** A reconstructed example verse: word tokens with the root word(s) marked (r=1). */
export interface ExampleVerse {
  /** sūrah */
  s: number;
  /** ayah */
  a: number;
  /** word position of the root occurrence (for deep-linking) */
  w: number;
  /** every word: surface text, its bare Arabic root ("" if none), and POS. */
  words: { t: string; root: string; pos: string }[];
}

export interface RootStat {
  /** Dashed display form, e.g. "ر-ح-م". */
  root: string;
  /** Bare Arabic root, e.g. "رحم". */
  bare: string;
  /** Buckwalter, e.g. "rHm". */
  bw: string;
  /** Romanized skeleton, e.g. "r · ḥ · m". */
  translit: string;
  gloss: string | null;
  count: number;
  surahs: number;
  verses: number;
  /** Distinct lemmas ("word forms"). */
  forms: number;
  first: { sura: number; ayah: number } | null;
  /** Top sūrahs as [suraId, count]. */
  top: [number, number][];
  /** Per-sūrah occurrence counts, index 0 = sūrah 1 … 113 = sūrah 114. */
  hist: number[];
  /** POS breakdown as [POS, count], dominant first. */
  pos: [string, number][];
  /** Example verses with the root word marked (featured roots only). */
  examples?: ExampleVerse[];
}

export interface RootStatsIndex {
  version: number;
  rootCount: number;
  /** Bare roots, glossed + frequency-ranked (for chips + "today's root"). */
  featured: string[];
  roots: Record<string, RootStat>;
}

let cache: RootStatsIndex | null = null;
let promise: Promise<RootStatsIndex> | null = null;
let termIndex: Map<string, string> | null = null;

export async function loadRootStats(): Promise<RootStatsIndex> {
  if (cache) return cache;
  if (!promise) {
    promise = fetch("/data/root-stats.json")
      .then((r) => {
        if (!r.ok) throw new Error(`root-stats ${r.status}`);
        return r.json();
      })
      .then((d: RootStatsIndex) => {
        cache = d;
        return d;
      });
  }
  return promise;
}

const DIACRITICS = /[ً-ْٰـ]/g; // harakat, dagger alif, tatweel

/** Strip diacritics/tatweel/separators and fold hamza-bearing alifs to bare alif. */
export function normalizeArabic(s: string): string {
  return s
    .replace(DIACRITICS, "")
    .replace(/[\s\-·.]/g, "")
    .replace(/[آأإٱ]/g, "ا") // آأإٱ → ا
    .trim();
}

/** Lowercase, fold accents (ḥ→h, ṣ→s, ʿ→ ), keep only a–z/0–9. */
export function normalizeLatin(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯʿʾˀ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function buildTermIndex(idx: RootStatsIndex): Map<string, string> {
  const map = new Map<string, string>();
  // Higher-count roots win ambiguous terms (e.g. a gloss word shared by two
  // roots) — and, because Maps preserve insertion order, prefix scans below
  // also land on the most frequent match first.
  const entries = Object.values(idx.roots).sort((a, b) => b.count - a.count);
  const add = (term: string, bare: string) => {
    if (term && !map.has(term)) map.set(term, bare);
  };
  for (const r of entries) {
    add(normalizeLatin(r.bw), r.bare);
    add(normalizeLatin(r.translit), r.bare);
    if (r.gloss) {
      for (const word of r.gloss.split(/[^a-zA-Z]+/)) {
        const w = normalizeLatin(word);
        if (w.length >= 2) add(w, r.bare);
      }
    }
  }
  return map;
}

/** Bare roots sorted by frequency, for Arabic prefix matching. */
let rootsByCount: string[] | null = null;
/** Hamza-normalized bare root → raw bare root (highest count wins). */
let normMap: Map<string, string> | null = null;

/**
 * Root-consonant normalization: inside a root string every alif / hamza
 * carrier stands for the hamza consonant. Folding both the index keys and the
 * query joins "أم"/"ام" queries with the corpus's "امم"-style roots.
 */
const normRootKey = (s: string) => s.replace(/[اأإآٱئؤ]/g, "ء");

// Light Arabic de-affixing: queries are usually surface words ("رحمة",
// "أمهاتكم"), not bare roots. Tried only after an exact miss.
const AR_PREFIXES = ["ال", "و", "ف", "ب", "ل", "لل", "وال", "بال"];
const AR_SUFFIXES = ["ات", "ون", "ين", "ان", "كم", "هم", "هن", "نا", "ها", "ة", "ه", "ي", "ا", "ن", "ت"];

function ensureArabicIndexes(idx: RootStatsIndex) {
  if (!rootsByCount) {
    rootsByCount = Object.values(idx.roots)
      .sort((a, b) => b.count - a.count)
      .map((r) => r.bare);
  }
  if (!normMap) {
    normMap = new Map();
    for (const bare of rootsByCount) {
      const n = normRootKey(bare);
      if (!normMap.has(n)) normMap.set(n, bare);
    }
  }
}

/** Exact match against raw and hamza-normalized root keys. */
function matchRoot(idx: RootStatsIndex, s: string): RootStat | null {
  if (idx.roots[s]) return idx.roots[s];
  const viaNorm = normMap?.get(normRootKey(s));
  return viaNorm ? idx.roots[viaNorm] ?? null : null;
}

/** Resolve one Arabic word to a root: exact → de-affixed → geminate → prefix. */
function lookupArabicWord(idx: RootStatsIndex, word: string): RootStat | null {
  const ar = normalizeArabic(word);
  if (!ar) return null;
  ensureArabicIndexes(idx);

  const direct = matchRoot(idx, ar);
  if (direct) return direct;

  // Iteratively strip common affixes (depth 3), longest candidates first.
  const seen = new Set<string>([ar]);
  let frontier = [ar];
  for (let depth = 0; depth < 3 && frontier.length; depth++) {
    const next: string[] = [];
    for (const f of frontier) {
      for (const p of AR_PREFIXES) {
        if (f.startsWith(p) && f.length - p.length >= 2) {
          const c = f.slice(p.length);
          if (!seen.has(c)) {
            seen.add(c);
            next.push(c);
          }
        }
      }
      for (const s of AR_SUFFIXES) {
        if (f.endsWith(s) && f.length - s.length >= 2) {
          const c = f.slice(0, f.length - s.length);
          if (!seen.has(c)) {
            seen.add(c);
            next.push(c);
          }
        }
      }
    }
    frontier = next;
  }
  const candidates = [...seen].sort((a, b) => b.length - a.length);
  for (const c of candidates) {
    const hit = matchRoot(idx, c);
    if (hit) return hit;
  }
  // Two-letter stems are often geminate roots: أم → امم, رب → ربب.
  for (const c of candidates) {
    if (c.length === 2) {
      const hit = matchRoot(idx, c + c[1]);
      if (hit) return hit;
    }
  }
  // Last resort: frequency-ranked prefix, so partial typing stays matched.
  if (ar.length >= 2) {
    const nq = normRootKey(ar);
    const hit = rootsByCount!.find((b) => b.startsWith(ar) || normRootKey(b).startsWith(nq));
    if (hit) return idx.roots[hit];
  }
  return null;
}

/** Resolve a free-text query to a single root entry, or null. */
export function lookupRoot(idx: RootStatsIndex, query: string): RootStat | null {
  const q = (query ?? "").trim();
  if (!q) return null;

  // Arabic: try the whole query, then each word ("أم القرى" → أم → امم).
  if (/[؀-ۿ]/.test(q)) {
    const whole = lookupArabicWord(idx, q);
    if (whole) return whole;
    const words = q.split(/\s+/).filter((w) => /[؀-ۿ]/.test(w));
    if (words.length > 1) {
      for (const w of words) {
        const hit = lookupArabicWord(idx, w);
        if (hit) return hit;
      }
    }
    return null;
  }

  // Latin: Buckwalter / romanization / gloss word, then prefix fallback so
  // partial queries ("knowl…") keep showing the match instead of flashing
  // no-match between keystrokes; multi-word queries fall back to per-word.
  if (!termIndex) termIndex = buildTermIndex(idx);
  const tryLatin = (s: string): RootStat | null => {
    const lat = normalizeLatin(s);
    if (!lat) return null;
    const bare = termIndex!.get(lat);
    if (bare) return idx.roots[bare] ?? null;
    if (lat.length >= 3) {
      for (const [term, b] of termIndex!) {
        if (term.startsWith(lat)) return idx.roots[b] ?? null;
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
 * All roots whose bare form starts with the query (min 3 chars), by count — for
 * the result chooser. Excludes an exact bare match (listed separately). Uses the
 * shared search normalizer so it agrees with the name index and form index.
 */
export function rootPrefixMatches(idx: RootStatsIndex, query: string, limit = 6): RootStat[] {
  const qn = normalizeArabicForSearch(query);
  if (qn.length < 3) return [];
  return Object.values(idx.roots)
    .filter((r) => {
      const b = normalizeArabicForSearch(r.bare);
      return b !== qn && b.startsWith(qn);
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Deterministic "root of the day" from the featured list. */
export function rootOfTheDay(idx: RootStatsIndex, epochDay: number): RootStat | null {
  if (!idx.featured.length) return null;
  const bare = idx.featured[epochDay % idx.featured.length];
  return idx.roots[bare] ?? null;
}
