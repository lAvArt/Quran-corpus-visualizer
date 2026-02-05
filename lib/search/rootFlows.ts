import type { CorpusToken, RootWordFlow } from "@/lib/schema/types";

export function buildRootWordFlows(tokens: CorpusToken[]): RootWordFlow[] {
  const flowCounts = new Map<string, RootWordFlow>();

  for (const token of tokens) {
    const key = `${token.root}::${token.lemma}`;
    const existing = flowCounts.get(key);

    if (existing) {
      existing.count += 1;
      existing.tokenIds.push(token.id);
      continue;
    }

    flowCounts.set(key, {
      root: token.root,
      lemma: token.lemma,
      count: 1,
      tokenIds: [token.id]
    });
  }

  return [...flowCounts.values()].sort((a, b) => b.count - a.count || a.root.localeCompare(b.root));
}

export function uniqueRoots(tokens: CorpusToken[]): string[] {
  return [...new Set(tokens.map((t) => t.root))].sort((a, b) => a.localeCompare(b));
}
