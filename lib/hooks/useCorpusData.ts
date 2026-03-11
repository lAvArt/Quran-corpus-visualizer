"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  trackClientError,
  trackCorpusDeepReady,
  trackCorpusFallbackUsed,
  trackCorpusShellReady,
} from "@/lib/analytics/events";
import { loadFullCorpus, type LoadingProgress } from "@/lib/corpus/corpusLoader";
import { buildCorpusOverviewData } from "@/lib/corpus/overviewData";
import {
  deriveCorpusReadiness,
  type CorpusOverviewSummary,
  type CorpusReadinessState,
  type DataReadinessStatus,
} from "@/lib/corpus/readiness";
import { readDevCorpusStatus } from "@/lib/dev/testOverrides";
import type { CorpusOverviewData } from "@/lib/corpus/overviewData";
import type { CorpusToken } from "@/lib/schema/types";

export type CorpusDataSource = "server-payload" | "client-shell" | "deep-corpus";

export interface CorpusDataState {
  shellTokens: CorpusToken[];
  deepTokens: CorpusToken[];
  allTokens: CorpusToken[];
  overview: CorpusOverviewSummary;
  overviewSource: CorpusDataSource;
  visualizationSource: CorpusDataSource;
  readiness: CorpusReadinessState;
  loadingProgress: LoadingProgress | null;
  isLoadingCorpus: boolean;
  dataStatus: DataReadinessStatus;
}

export function useCorpusData(initialOverviewData?: CorpusOverviewData): CorpusDataState {
  const [deepTokens, setDeepTokens] = useState<CorpusToken[]>([]);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress | null>(null);
  const [isLoadingCorpus, setIsLoadingCorpus] = useState(false);
  const [dataStatus, setDataStatus] = useState<DataReadinessStatus>("sample");
  const loadStartedAtRef = useRef<number | null>(null);
  const hasTrackedShellReadyRef = useRef(false);
  const hasTrackedDeepReadyRef = useRef(false);
  const hasTrackedFallbackRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const devStatus = readDevCorpusStatus();
    if (devStatus) {
      loadStartedAtRef.current = performance.now();
      setDataStatus(devStatus);
      setIsLoadingCorpus(devStatus === "loading");
      return () => {
        cancelled = true;
      };
    }

    const loadCorpus = async () => {
      loadStartedAtRef.current = performance.now();
      setIsLoadingCorpus(true);
      setDataStatus("loading");

      try {
        const corpusTokens = await loadFullCorpus((progress) => {
          if (!cancelled) setLoadingProgress(progress);
        });

        if (!cancelled && corpusTokens.length > 0) {
          setDeepTokens(corpusTokens);
          setDataStatus("full");
        } else if (!cancelled) {
          trackClientError("corpus", "empty_corpus_result", {
            stage: "load_full_corpus",
          });
          setDataStatus("fallback");
        }
      } catch (error) {
        if (!cancelled) {
          trackClientError("corpus", "load_failed", {
            stage: "load_full_corpus",
            message: error instanceof Error ? error.message : "unknown",
          });
          setDataStatus("fallback");
        }
      } finally {
        if (!cancelled) setIsLoadingCorpus(false);
      }
    };

    void loadCorpus();
    return () => {
      cancelled = true;
    };
  }, []);

  const { shellTokens, visualizationTokens: allTokens, overview, overviewSource, visualizationSource } = useMemo(() => {
    if (deepTokens.length > 0) {
      return {
        ...buildCorpusOverviewData(deepTokens),
        overviewSource: "deep-corpus" as const,
        visualizationSource: "deep-corpus" as const,
      };
    }

    if (initialOverviewData) {
      return {
        ...initialOverviewData,
        overviewSource: "server-payload" as const,
        visualizationSource: "server-payload" as const,
      };
    }

    return {
      ...buildCorpusOverviewData([]),
      overviewSource: "client-shell" as const,
      visualizationSource: "client-shell" as const,
    };
  }, [deepTokens, initialOverviewData]);
  const readiness = useMemo(
    () => deriveCorpusReadiness(dataStatus, isLoadingCorpus),
    [dataStatus, isLoadingCorpus]
  );

  useEffect(() => {
    if (hasTrackedShellReadyRef.current) return;
    if (!readiness.overviewReady) return;

    trackCorpusShellReady("shared", overview.tokenCount, overview.surahCount, overview.rootCount);
    hasTrackedShellReadyRef.current = true;
  }, [overview.rootCount, overview.surahCount, overview.tokenCount, readiness.overviewReady]);

  useEffect(() => {
    if (readiness.deepDataReady && !hasTrackedDeepReadyRef.current) {
      const durationMs = loadStartedAtRef.current ? Math.round(performance.now() - loadStartedAtRef.current) : null;
      trackCorpusDeepReady("shared", overview.tokenCount, durationMs);
      hasTrackedDeepReadyRef.current = true;
    }

    if (readiness.uiStatus === "fallback" && !hasTrackedFallbackRef.current) {
      const durationMs = loadStartedAtRef.current ? Math.round(performance.now() - loadStartedAtRef.current) : null;
      trackCorpusFallbackUsed("shared", overview.tokenCount, durationMs);
      trackClientError("corpus", "fallback_used", {
        token_count: overview.tokenCount,
        duration_ms: durationMs,
      });
      hasTrackedFallbackRef.current = true;
    }
  }, [overview.tokenCount, readiness.deepDataReady, readiness.uiStatus]);

  return {
    shellTokens,
    deepTokens,
    allTokens,
    overview,
    overviewSource,
    visualizationSource,
    readiness,
    loadingProgress,
    isLoadingCorpus,
    dataStatus,
  };
}
