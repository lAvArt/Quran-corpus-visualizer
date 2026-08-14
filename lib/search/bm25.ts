/**
 * BM25F — fielded BM25 ranking, in-memory and dependency-free.
 *
 * The Quran corpus is small and fully loaded client-side (~6k ayahs, ~1.7k
 * roots), so a fielded BM25 index builds in milliseconds and ranks free-text
 * queries far better than the previous substring + mushaf-position ordering.
 *
 * BM25F (Robertson/Zaragoza) treats each document as a set of weighted fields
 * (e.g. Arabic text, gloss, root) with per-field length normalization, then
 * saturates the combined term frequency once — so a term repeated across a long
 * field doesn't dominate, and rare terms (high IDF) float to the top.
 */

import { searchKeyVariants } from "@/lib/search/arabicNormalize";

const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

// Minimal English stop-word set — gloss/translation fields are short, so we
// only strip the highest-frequency function words that add no signal.
const STOP_WORDS = new Set([
  "the", "a", "an", "of", "to", "and", "or", "in", "on", "for", "is", "are",
  "was", "were", "be", "with", "by", "as", "at", "that", "this", "it", "its",
]);

/** Split text into normalized, script-aware terms (Arabic ⇒ normalized, Latin ⇒ lowercased). */
export function tokenizeForBm25(text: string): string[] {
  if (!text) return [];
  const terms: string[] = [];
  // Split on whitespace and common separators while keeping Arabic + Latin runs.
  for (const raw of text.split(/[\s/·,;:()[\]{}<>"'،؛.!?\-–—]+/)) {
    const piece = raw.trim();
    if (!piece) continue;
    if (ARABIC_RANGE.test(piece)) {
      // Emit every hamza/madda spelling variant (searchKeyVariants) at BOTH
      // index and query time, so a word the corpus writes with an explicit
      // hamza (قُرْءَان) is reachable by the modern spellings (قرآن/قران/قرأن)
      // and vice-versa — the same bridge the home path uses.
      for (const v of searchKeyVariants(piece)) terms.push(v);
    } else {
      const lower = piece.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (lower && lower.length > 1 && !STOP_WORDS.has(lower)) terms.push(lower);
    }
  }
  return terms;
}

export interface Bm25FieldConfig {
  /** Field name — must match keys in each document's `fields`. */
  name: string;
  /** Relative weight of this field (default 1). */
  boost?: number;
  /** Length-normalization strength b ∈ [0,1] (default 0.75). */
  b?: number;
}

export interface Bm25Document<TMeta> {
  id: string;
  fields: Record<string, string>;
  meta: TMeta;
}

interface IndexedDoc<TMeta> {
  id: string;
  meta: TMeta;
  /** Per-field term-frequency maps, aligned with the field config order. */
  fieldTf: Array<Map<string, number>>;
  /** Per-field term counts (length), aligned with the field config order. */
  fieldLen: number[];
}

export interface Bm25Index<TMeta> {
  docs: Array<IndexedDoc<TMeta>>;
  fields: Required<Bm25FieldConfig>[];
  avgFieldLen: number[];
  /** term → document-frequency (number of docs containing the term in any field). */
  df: Map<string, number>;
  /** term → list of doc indices that contain it (postings for candidate gathering). */
  postings: Map<string, number[]>;
  k1: number;
}

export function buildBm25Index<TMeta>(
  documents: Array<Bm25Document<TMeta>>,
  fieldConfigs: Bm25FieldConfig[],
  options: { k1?: number } = {},
): Bm25Index<TMeta> {
  const fields: Required<Bm25FieldConfig>[] = fieldConfigs.map((f) => ({
    name: f.name,
    boost: f.boost ?? 1,
    b: f.b ?? 0.75,
  }));
  const k1 = options.k1 ?? 1.2;

  const docs: Array<IndexedDoc<TMeta>> = [];
  const fieldLenTotals = new Array(fields.length).fill(0);
  const df = new Map<string, number>();
  const postings = new Map<string, number[]>();

  for (const doc of documents) {
    const fieldTf: Array<Map<string, number>> = [];
    const fieldLen: number[] = [];
    const docTerms = new Set<string>();

    for (let fi = 0; fi < fields.length; fi++) {
      const tf = new Map<string, number>();
      const terms = tokenizeForBm25(doc.fields[fields[fi].name] ?? "");
      for (const term of terms) {
        tf.set(term, (tf.get(term) ?? 0) + 1);
        docTerms.add(term);
      }
      fieldTf.push(tf);
      fieldLen.push(terms.length);
      fieldLenTotals[fi] += terms.length;
    }

    const docIndex = docs.length;
    docs.push({ id: doc.id, meta: doc.meta, fieldTf, fieldLen });

    for (const term of docTerms) {
      df.set(term, (df.get(term) ?? 0) + 1);
      const bucket = postings.get(term);
      if (bucket) bucket.push(docIndex);
      else postings.set(term, [docIndex]);
    }
  }

  const avgFieldLen = fieldLenTotals.map((total) => (docs.length ? total / docs.length : 0));

  return { docs, fields, avgFieldLen, df, postings, k1 };
}

export interface Bm25Hit<TMeta> {
  id: string;
  score: number;
  meta: TMeta;
}

/**
 * Score documents against a query. Accepts either a raw query string or a
 * pre-tokenized term list (used by the concept lane, which supplies expanded
 * corpus terms directly). Optional per-term weights bias expansion terms.
 */
export function queryBm25<TMeta>(
  index: Bm25Index<TMeta>,
  query: string | string[],
  options: { limit?: number; termWeights?: Map<string, number> } = {},
): Array<Bm25Hit<TMeta>> {
  const queryTerms = Array.isArray(query) ? query : tokenizeForBm25(query);
  if (queryTerms.length === 0 || index.docs.length === 0) return [];

  // Deduplicate query terms, keeping the max supplied weight.
  const terms = new Map<string, number>();
  for (const term of queryTerms) {
    const w = options.termWeights?.get(term) ?? 1;
    terms.set(term, Math.max(terms.get(term) ?? 0, w));
  }

  const N = index.docs.length;
  const candidates = new Set<number>();
  const idf = new Map<string, number>();
  for (const term of terms.keys()) {
    const postings = index.postings.get(term);
    if (!postings) continue;
    for (const docIndex of postings) candidates.add(docIndex);
    const dfTerm = index.df.get(term) ?? 0;
    idf.set(term, Math.log(1 + (N - dfTerm + 0.5) / (dfTerm + 0.5)));
  }
  if (candidates.size === 0) return [];

  const hits: Array<Bm25Hit<TMeta>> = [];
  for (const docIndex of candidates) {
    const doc = index.docs[docIndex];
    let score = 0;

    for (const [term, termWeight] of terms) {
      const termIdf = idf.get(term);
      if (!termIdf) continue;

      let weightedTf = 0;
      for (let fi = 0; fi < index.fields.length; fi++) {
        const tf = doc.fieldTf[fi].get(term);
        if (!tf) continue;
        const field = index.fields[fi];
        const avg = index.avgFieldLen[fi] || 1;
        const norm = 1 - field.b + (field.b * doc.fieldLen[fi]) / avg;
        weightedTf += (field.boost * tf) / norm;
      }
      if (weightedTf === 0) continue;

      score += termWeight * termIdf * (weightedTf / (index.k1 + weightedTf));
    }

    if (score > 0) hits.push({ id: doc.id, score, meta: doc.meta });
  }

  hits.sort((a, b) => b.score - a.score);
  return options.limit ? hits.slice(0, options.limit) : hits;
}
