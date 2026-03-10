import { getSampleData } from "@/lib/corpus/corpusLoader";
import { buildCorpusOverview, type CorpusOverviewSummary } from "@/lib/corpus/readiness";
import { sampleAyahDependency } from "@/lib/corpus/sampleAyahDependency";
import { sampleTokens } from "@/lib/corpus/sampleCorpus";
import type { CorpusToken } from "@/lib/schema/types";

export interface CorpusOverviewData {
  shellTokens: CorpusToken[];
  visualizationTokens: CorpusToken[];
  overview: CorpusOverviewSummary;
}

export function mergeCorpusTokens(...collections: readonly CorpusToken[][]): CorpusToken[] {
  const merged = collections.flat();
  const byId = new Map(merged.map((token) => [token.id, token]));
  return [...byId.values()].sort((a, b) => a.sura - b.sura || a.ayah - b.ayah || a.position - b.position);
}

export function buildShellCorpusTokens(): CorpusToken[] {
  return mergeCorpusTokens(sampleTokens, getSampleData());
}

export function buildVisualizationCorpusTokens(
  shellTokens: CorpusToken[],
  deepTokens: CorpusToken[]
): CorpusToken[] {
  return mergeCorpusTokens(shellTokens, deepTokens, sampleAyahDependency.tokens);
}

export function buildCorpusOverviewData(deepTokens: CorpusToken[]): CorpusOverviewData {
  const shellTokens = buildShellCorpusTokens();
  const visualizationTokens = buildVisualizationCorpusTokens(shellTokens, deepTokens);

  return {
    shellTokens,
    visualizationTokens,
    overview: buildCorpusOverview(visualizationTokens),
  };
}
