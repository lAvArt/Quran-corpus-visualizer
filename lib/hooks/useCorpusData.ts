"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  trackClientError,
  trackCorpusDeepReady,
  trackCorpusFallbackUsed,
  trackCorpusShellReady,
} from "@/lib/analytics/events";
import { FULL_CORPUS_TOKEN_FLOOR } from "@/lib/corpus/corpusExpectations";
import { loadFullCorpus, loadSurahContext, type LoadingProgress } from "@/lib/corpus/corpusLoader";
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
  /** Prioritise loading a specific surah (context-first) ahead of the full corpus. */
  requestSurahContext: (suraId: number | null | undefined) => void;
}

export function useCorpusData(initialOverviewData?: CorpusOverviewData): CorpusDataState {
  const [deepTokens, setDeepTokens] = useState<CorpusToken[]>([]);
  // Context-first: the currently-open surah, built straight from the QAC
  // morphology file, so it renders fully (POS bars + roots/arcs/circles) without
  // waiting for the whole corpus to stream in. Superseded once deepTokens lands.
  const [contextTokens, setContextTokens] = useState<CorpusToken[]>([]);
  const requestedSurahRef = useRef<number | null>(null);

  const requestSurahContext = useCallback((suraId: number | null | undefined) => {
    if (!suraId || requestedSurahRef.current === suraId) return;
    requestedSurahRef.current = suraId;
    void loadSurahContext(suraId).then((tokens) => {
      if (tokens.length > 0) setContextTokens(tokens);
    });
  }, []);
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
        const corpusTokens = await loadFullCorpus(
          (progress) => {
            if (!cancelled) setLoadingProgress(progress);
          },
          (tokensSoFar, meta) => {
            // Intermediate batches only — the final state (dataStatus
            // "full"/"fallback" + the definitive token array) is still set
            // exclusively from the resolved promise below, unchanged from
            // before batching existed. This also sidesteps a subtlety on the
            // Supabase path: its post-fetch morphology enrichment can return
            // a new (enriched) array, so the batch tracker's own done:true
            // array isn't guaranteed byte-identical to the final result.
            if (cancelled || meta.done) return;
            // Monotonic guard: if Supabase streams some batches and then
            // fails mid-load, `_doLoadFullCorpus` falls back to a fresh
            // sequential Quran.com load starting at surah 1 again — never
            // let that visible restart look like data disappearing.
            setDeepTokens((prev) => (tokensSoFar.length >= prev.length ? tokensSoFar : prev));
            setLoadingProgress((prev) => {
              if (prev && prev.currentTokens > tokensSoFar.length) return prev; // same guard, for the progress bar
              return {
                currentSura: meta.completedSurahs.length,
                totalSuras: 114,
                currentTokens: tokensSoFar.length,
                totalTokens: Math.max(prev?.totalTokens ?? 0, tokensSoFar.length),
                status: "loading",
                message: prev?.message ?? "",
              };
            });
          }
        );

        if (!cancelled && corpusTokens.length >= FULL_CORPUS_TOKEN_FLOOR) {
          setDeepTokens(corpusTokens);
          setDataStatus("full");
        } else if (!cancelled && corpusTokens.length > 0) {
          // Non-empty but below the full-corpus floor (e.g. a partial cache or
          // truncated load): surface the tokens, but report the degraded
          // "fallback" status instead of claiming the corpus is complete.
          setDeepTokens(corpusTokens);
          trackClientError("corpus", "partial_corpus_result", {
            stage: "load_full_corpus",
            token_count: corpusTokens.length,
          });
          setDataStatus("fallback");
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
      // While the corpus streams in batches, the surah the user actually
      // has open may already be fully loaded via loadSurahContext
      // (contextTokens, real per-surah QAC data) even though ITS OWN batch
      // hasn't landed in deepTokens yet — without this overlay, a
      // deep-linked surah would visibly empty out for however many batches
      // remain until its turn arrives. deepTokens still wins for any token
      // id both sets share, since it's the higher-fidelity source (real
      // corpus/API text, not the morphology-file fallback text). Once the
      // corpus finishes loading, deepTokens already IS the authoritative
      // full set, so this merge is skipped — same cost/behavior as before
      // batching existed.
      if (dataStatus !== "full" && contextTokens.length > 0) {
        const byId = new Map<string, CorpusToken>();
        for (const tk of contextTokens) byId.set(tk.id, tk);
        for (const tk of deepTokens) byId.set(tk.id, tk);
        return {
          ...buildCorpusOverviewData(Array.from(byId.values())),
          overviewSource: "deep-corpus" as const,
          visualizationSource: "deep-corpus" as const,
        };
      }
      return {
        ...buildCorpusOverviewData(deepTokens),
        overviewSource: "deep-corpus" as const,
        visualizationSource: "deep-corpus" as const,
      };
    }

    // Context-first overlay: the open surah's QAC tokens over the shell baseline,
    // so it renders fully before the whole corpus has finished loading.
    if (contextTokens.length > 0) {
      const baseTokens = initialOverviewData?.shellTokens ?? [];
      const byId = new Map<string, CorpusToken>();
      for (const tk of baseTokens) byId.set(tk.id, tk);
      for (const tk of contextTokens) byId.set(tk.id, tk);
      return {
        ...buildCorpusOverviewData(Array.from(byId.values())),
        overviewSource: "client-shell" as const,
        visualizationSource: "client-shell" as const,
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
  }, [deepTokens, contextTokens, initialOverviewData, dataStatus]);
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
    requestSurahContext,
  };
}
