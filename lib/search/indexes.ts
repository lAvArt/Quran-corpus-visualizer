import type { CorpusToken } from "@/lib/schema/types";

export interface PhaseOneIndexes {
  root: Map<string, string[]>;
  lemma: Map<string, string[]>;
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
    lemma: new Map<string, string[]>(),
    pos: new Map<string, string[]>(),
    ayah: new Map<string, string[]>()
  };

  for (const token of tokens) {
    const ayahId = `${token.sura}:${token.ayah}`;
    pushIndex(index.root, token.root, token.id);
    pushIndex(index.lemma, token.lemma, token.id);
    pushIndex(index.pos, token.pos, token.id);
    pushIndex(index.ayah, ayahId, token.id);
  }

  return index;
}

export function queryPhaseOne(index: PhaseOneIndexes, query: {
  root?: string;
  lemma?: string;
  pos?: string;
  ayah?: string;
}): Set<string> {
  const buckets: string[][] = [];
  if (query.root) buckets.push(index.root.get(query.root) ?? []);
  if (query.lemma) buckets.push(index.lemma.get(query.lemma) ?? []);
  if (query.pos) buckets.push(index.pos.get(query.pos) ?? []);
  if (query.ayah) buckets.push(index.ayah.get(query.ayah) ?? []);

  if (buckets.length === 0) return new Set<string>();

  const [first, ...rest] = buckets;
  const result = new Set(first);

  for (const bucket of rest) {
    for (const tokenId of [...result]) {
      if (!bucket.includes(tokenId)) result.delete(tokenId);
    }
  }

  return result;
}
