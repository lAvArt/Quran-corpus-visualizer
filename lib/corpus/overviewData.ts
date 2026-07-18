import { SAMPLE_MORPHOLOGY_DATA } from "@/lib/corpus/morphologyData";
import { buildCorpusOverview, type CorpusOverviewSummary } from "@/lib/corpus/readiness";
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
  return mergeCorpusTokens(sampleTokens, SAMPLE_MORPHOLOGY_DATA);
}

export function buildVisualizationCorpusTokens(
  shellTokens: CorpusToken[],
  deepTokens: CorpusToken[]
): CorpusToken[] {
  // Note: the `sampleAyahDependency` demo fixture is deliberately NOT merged
  // here. Its hand-split of ayah 1:5 into five word positions disagrees with
  // the real corpus (four positions — 1:5:3 is the fused "وَإِيَّاكَ"), so merging
  // it injected a phantom token "1:5:5" and inflated a genuine full load to
  // 77,430 tokens (and root عون by +1 in surah 1). The Ayah-Dependency graph
  // does not need the fixture in this pool: it renders from whatever tokens it
  // is given (shell tokens already cover ayah 1:5 with the correct four-word
  // split) and synthesizes fallback dependency edges itself.
  return mergeCorpusTokens(shellTokens, deepTokens);
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

export function buildExploreOverviewPayload(): CorpusOverviewData {
  return buildCorpusOverviewData([]);
}
