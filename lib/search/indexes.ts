import type { CorpusToken } from "@/lib/schema/types";

export interface PhaseOneIndexes {
  root: Map<string, string[]>;
  rootNormalized: Map<string, string[]>;
  lemma: Map<string, string[]>;
  lemmaNormalized: Map<string, string[]>;
  textNormalized: Map<string, string[]>;
  pos: Map<string, string[]>;
  ayah: Map<string, string[]>;
}

const ARABIC_DIACRITICS_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const TATWEEL_RE = /\u0640/g;

export function normalizeArabicForSearch(value: string): string {
  return value
    .trim()
    .normalize("NFKD")
    .replace(ARABIC_DIACRITICS_RE, "")
    .replace(TATWEEL_RE, "")
    .replace(/[ٱأإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

function pushIndex(map: Map<string, string[]>, key: string, tokenId: string): void {
  const existing = map.get(key);
  if (existing) {
    existing.push(tokenId);
    return;
  }

  map.set(key, [tokenId]);
}

export function buildPhaseOneIndexes(tokens: CorpusToken[]): PhaseOneIndexes {
  const index: PhaseOneIndexes = {
    root: new Map<string, string[]>(),
    rootNormalized: new Map<string, string[]>(),
    lemma: new Map<string, string[]>(),
    lemmaNormalized: new Map<string, string[]>(),
    textNormalized: new Map<string, string[]>(),
    pos: new Map<string, string[]>(),
    ayah: new Map<string, string[]>()
  };

  for (const token of tokens) {
    const ayahId = `${token.sura}:${token.ayah}`;
    pushIndex(index.root, token.root, token.id);
    pushIndex(index.rootNormalized, normalizeArabicForSearch(token.root), token.id);
    pushIndex(index.lemma, token.lemma, token.id);
    pushIndex(index.lemmaNormalized, normalizeArabicForSearch(token.lemma), token.id);
    pushIndex(index.textNormalized, normalizeArabicForSearch(token.text), token.id);
    pushIndex(index.pos, token.pos, token.id);
    pushIndex(index.ayah, ayahId, token.id);
  }

  return index;
}

function unionBuckets(...buckets: string[][]): string[] {
  const out = new Set<string>();
  for (const bucket of buckets) {
    for (const tokenId of bucket) out.add(tokenId);
  }
  return [...out];
}

export function queryPhaseOne(index: PhaseOneIndexes, query: {
  root?: string;
  lemma?: string;
  pos?: string;
  ayah?: string;
}): Set<string> {
  const buckets: string[][] = [];
  if (query.root) {
    const normalizedRoot = normalizeArabicForSearch(query.root);
    buckets.push(
      unionBuckets(
        index.root.get(query.root) ?? [],
        index.rootNormalized.get(normalizedRoot) ?? [],
        // Fallbacks for users entering an Arabic word rather than a bare root.
        index.lemmaNormalized.get(normalizedRoot) ?? [],
        index.textNormalized.get(normalizedRoot) ?? []
      )
    );
  }
  if (query.lemma) {
    const normalizedLemma = normalizeArabicForSearch(query.lemma);
    buckets.push(
      unionBuckets(
        index.lemma.get(query.lemma) ?? [],
        index.lemmaNormalized.get(normalizedLemma) ?? [],
        index.textNormalized.get(normalizedLemma) ?? []
      )
    );
  }
  if (query.pos) buckets.push(index.pos.get(query.pos) ?? []);
  if (query.ayah) buckets.push(index.ayah.get(query.ayah) ?? []);

  if (buckets.length === 0) return new Set<string>();

  const [first, ...rest] = buckets;
  const result = new Set(first);

  for (const bucket of rest) {
    const bucketSet = new Set(bucket);
    for (const tokenId of result) {
      if (!bucketSet.has(tokenId)) result.delete(tokenId);
    }
  }

  return result;
}
