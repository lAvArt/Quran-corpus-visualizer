import type { CorpusReadinessState, DataReadinessStatus } from "@/lib/corpus/readiness";

export type CorpusStatusLabel = "shell" | "full" | "fallback";

export interface CorpusStatusPresentation {
  statusLabel: CorpusStatusLabel;
  showShellReadyMessage: boolean;
  showLoadingMessage: boolean;
  showFallbackMessage: boolean;
}

export function deriveCorpusStatusPresentation(
  readiness: CorpusReadinessState,
  dataStatus: DataReadinessStatus,
  isLoadingCorpus: boolean
): CorpusStatusPresentation {
  return {
    statusLabel: readiness.deepDataReady ? "full" : dataStatus === "fallback" ? "fallback" : "shell",
    showShellReadyMessage: readiness.overviewReady && !readiness.deepDataReady && dataStatus !== "fallback",
    showLoadingMessage: isLoadingCorpus && dataStatus === "loading",
    showFallbackMessage: dataStatus === "fallback",
  };
}
