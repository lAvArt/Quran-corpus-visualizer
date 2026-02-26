import type { CorpusToken } from "@/lib/schema/types";
import {
  buildLemmaCandidates,
  normalizeArabicForSearch,
  normalizeRootFamily,
} from "@/lib/search/arabicNormalize";

export interface PhaseOneIndexes {
  root: Map<string, string[]>;
  rootNormalized: Map<string, string[]>;
  rootFamilyNormalized: Map<string, string[]>;
  lemma: Map<string, string[]>;
  lemmaNormalized: Map<string, string[]>;
  lemmaLooseNormalized: Map<string, string[]>;
  textNormalized: Map<string, string[]>;
  pos: Map<string, string[]>;
  ayah: Map<string, string[]>;
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
    rootFamilyNormalized: new Map<string, string[]>(),
    lemma: new Map<string, string[]>(),
    lemmaNormalized: new Map<string, string[]>(),
    lemmaLooseNormalized: new Map<string, string[]>(),
    textNormalized: new Map<string, string[]>(),
    pos: new Map<string, string[]>(),
    ayah: new Map<string, string[]>(),
  };

  for (const token of tokens) {
    const ayahId = `${token.sura}:${token.ayah}`;
    const normRoot = normalizeArabicForSearch(token.root);
    const normLemma = normalizeArabicForSearch(token.lemma);

    pushIndex(index.root, token.root, token.id);
    pushIndex(index.rootNormalized, normRoot, token.id);
    pushIndex(index.rootFamilyNormalized, normalizeRootFamily(token.root), token.id);

    pushIndex(index.lemma, token.lemma, token.id);
    pushIndex(index.lemmaNormalized, normLemma, token.id);
    for (const candidate of buildLemmaCandidates(token.lemma)) {
      pushIndex(index.lemmaLooseNormalized, candidate, token.id);
    }

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

export function queryPhaseOne(
  index: PhaseOneIndexes,
  query: {
    root?: string;
    lemma?: string;
    pos?: string;
    ayah?: string;
  }
): Set<string> {
  const buckets: string[][] = [];
  if (query.root) {
    const normalizedRoot = normalizeArabicForSearch(query.root);
    const rootFamily = normalizeRootFamily(query.root);
    buckets.push(
      unionBuckets(
        index.root.get(query.root) ?? [],
        index.rootNormalized.get(normalizedRoot) ?? [],
        index.rootFamilyNormalized.get(rootFamily) ?? [],
        // Fallbacks for users entering an Arabic word rather than a bare root.
        index.lemmaNormalized.get(normalizedRoot) ?? [],
        index.lemmaLooseNormalized.get(normalizedRoot) ?? [],
        index.textNormalized.get(normalizedRoot) ?? []
      )
    );
  }
  if (query.lemma) {
    const normalizedLemma = normalizeArabicForSearch(query.lemma);
    const looseBuckets = [...buildLemmaCandidates(query.lemma)].map(
      (candidate) => index.lemmaLooseNormalized.get(candidate) ?? []
    );
    buckets.push(
      unionBuckets(
        index.lemma.get(query.lemma) ?? [],
        index.lemmaNormalized.get(normalizedLemma) ?? [],
        ...looseBuckets,
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

export { normalizeArabicForSearch };

