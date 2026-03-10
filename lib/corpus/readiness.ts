import type { CorpusToken } from "@/lib/schema/types";

export type DataReadinessStatus = "sample" | "loading" | "full" | "fallback";
export type CorpusUiReadiness = "shell-ready" | "loading" | "full" | "fallback";

export interface CorpusOverviewSummary {
  tokenCount: number;
  surahCount: number;
  rootCount: number;
}

export interface CorpusReadinessState {
  dataStatus: DataReadinessStatus;
  uiStatus: CorpusUiReadiness;
  shellReady: boolean;
  deepDataReady: boolean;
  canExploreDeeply: boolean;
}

export function buildCorpusOverview(tokens: CorpusToken[]): CorpusOverviewSummary {
  const surahIds = new Set<number>();
  const roots = new Set<string>();

  for (const token of tokens) {
    surahIds.add(token.sura);
    if (token.root?.trim()) {
      roots.add(token.root.trim());
    }
  }

  return {
    tokenCount: tokens.length,
    surahCount: surahIds.size,
    rootCount: roots.size,
  };
}

export function deriveCorpusReadiness(
  dataStatus: DataReadinessStatus,
  isLoadingCorpus: boolean
): CorpusReadinessState {
  if (dataStatus === "full") {
    return {
      dataStatus,
      uiStatus: "full",
      shellReady: true,
      deepDataReady: true,
      canExploreDeeply: true,
    };
  }

  if (dataStatus === "fallback") {
    return {
      dataStatus,
      uiStatus: "fallback",
      shellReady: true,
      deepDataReady: false,
      canExploreDeeply: false,
    };
  }

  if (dataStatus === "loading" || isLoadingCorpus) {
    return {
      dataStatus,
      uiStatus: "loading",
      shellReady: true,
      deepDataReady: false,
      canExploreDeeply: false,
    };
  }

  return {
    dataStatus,
    uiStatus: "shell-ready",
    shellReady: true,
    deepDataReady: false,
    canExploreDeeply: false,
  };
}
