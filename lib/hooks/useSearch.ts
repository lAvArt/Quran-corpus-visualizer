"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { CorpusToken, PartOfSpeech } from "@/lib/schema/types";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { trackPerformanceMetric, type SearchMatchType } from "@/lib/analytics/events";
import {
  buildSearchCatalog,
  groupSearchResults,
  searchCorpus,
  detectQueryIntent,
  type QueryIntent,
} from "@/lib/search/searchService";
import type { SearchResultItem } from "@/lib/search/searchTypes";

// ---------------------------------------------------------------------------
// Semantic search helper
// ---------------------------------------------------------------------------

interface SemanticHit {
  root: string;
  similarity: number;
  isAiAssisted: boolean;
}

async function fetchSemanticResults(
  query: string,
  tokens: CorpusToken[],
): Promise<SearchResultItem[]> {
  try {
    const res = await fetch("/api/search/semantic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 5, similarity_threshold: 0.72 }),
    });
    if (!res.ok) return [];
    const json = await res.json() as {
      results: SemanticHit[];
      metadata?: { disclaimer?: string };
    };
    const disclaimer = json.metadata?.disclaimer ?? "AI-assisted result";

    return json.results.map((hit) => {
      // Find a representative token for this root
      const representative = tokens.find((t) => t.root === hit.root);
      return {
        id: `semantic-${hit.root}`,
        kind: "semantic" as const,
        title: hit.root,
        arabicText: hit.root,
        subtitle: `${Math.round(hit.similarity * 100)}% match`,
        explanation: disclaimer,
        matchedRoot: hit.root,
        location: representative
          ? { surah: representative.sura, ayah: representative.ayah, tokenId: representative.id }
          : undefined,
        actionTarget: {
          routeMode: "explore" as const,
          visualizationMode: "root-network" as const,
          selection: { root: hit.root },
        },
      };
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

type AnalyticsSurface = "header" | "sidebar" | "mobile" | "workspace" | "unknown" | "explore" | "search" | "shared";

export interface UseSearchOptions {
  tokens: CorpusToken[];
  /** Surface identifier for analytics performance tracking */
  analyticsSurface?: AnalyticsSurface;
  /** Whether advanced filters start expanded (default: false) */
  initialFiltersExpanded?: boolean;
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseSearchReturn {
  // Query
  query: string;
  setQuery: (q: string) => void;
  effectiveQuery: string;

  // Dropdown / keyboard nav
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  selectedIndex: number;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;

  // Advanced filters
  filterRoot: string;
  setFilterRoot: (v: string) => void;
  filterLemma: string;
  setFilterLemma: (v: string) => void;
  filterPos: PartOfSpeech | "";
  setFilterPos: (v: PartOfSpeech | "") => void;
  filterAyah: string;
  setFilterAyah: (v: string) => void;
  filtersExpanded: boolean;
  setFiltersExpanded: (v: boolean) => void;
  hasActiveFilters: boolean;

  // Results
  results: SearchResultItem[];
  groupedResults: ReturnType<typeof groupSearchResults>;
  queryIntent: QueryIntent;

  // Refs (for wiring keyboard‑scroll + focus on the presentation side)
  inputRef: React.RefObject<HTMLInputElement | null>;
  resultsRef: React.RefObject<HTMLDivElement | null>;

  // Actions
  selectResult: (result: SearchResultItem) => {
    tokenId: string | undefined;
    matchType: SearchMatchType;
    matchedRoot: string | undefined;
  } | null;
  handleKeyDown: (event: React.KeyboardEvent) => void;
  clearAll: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSearch({
  tokens,
  analyticsSurface = "unknown",
  initialFiltersExpanded = false,
}: UseSearchOptions): UseSearchReturn {
  // ---- state ----
  const [query, setQuery] = useState("");
  const _debouncedQuery = useDebounce(query, 200);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filtersExpanded, setFiltersExpanded] = useState(initialFiltersExpanded);
  const [filterRoot, setFilterRoot] = useState("");
  const [filterLemma, setFilterLemma] = useState("");
  const [filterPos, setFilterPos] = useState<PartOfSpeech | "">("");
  const [filterAyah, setFilterAyah] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const mountedAtRef = useRef<number>(performance.now());
  const hasTrackedInteractionRef = useRef(false);

  // ---- effective query ----
  const effectiveQuery = useMemo(() => {
    const parts: string[] = [];
    if (query.trim()) parts.push(query.trim());
    if (filterRoot.trim()) parts.push(`root:${filterRoot.trim()}`);
    if (filterLemma.trim()) parts.push(`lemma:${filterLemma.trim()}`);
    if (filterPos) parts.push(`pos:${filterPos}`);
    if (filterAyah.trim()) parts.push(`ayah:${filterAyah.trim()}`);
    return parts.join(" ");
  }, [query, filterRoot, filterLemma, filterPos, filterAyah]);

  const debouncedEffectiveQuery = useDebounce(effectiveQuery, 200);

  // ---- intent ----
  const queryIntent = useMemo(() => detectQueryIntent(query), [query]);

  // ---- search ----
  const hasActiveFilters = !!(filterRoot || filterLemma || filterPos || filterAyah);
  const catalog = useMemo(() => buildSearchCatalog(tokens), [tokens]);
  const localResults = useMemo<SearchResultItem[]>(
    () => searchCorpus(tokens, catalog, debouncedEffectiveQuery),
    [catalog, debouncedEffectiveQuery, tokens],
  );

  // ---- semantic search (fires when local results are sparse + query is English) ----
  // Reads user preference from localStorage (toggle in DisplaySettingsPanel).
  const [semanticResults, setSemanticResults] = useState<SearchResultItem[]>([]);
  const semanticAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Check user preference
    let enabled = true;
    try {
      enabled = JSON.parse(localStorage.getItem("qcv-semantic-search-enabled") ?? "true");
    } catch {
      // Ignore storage read failures and keep semantic search enabled by default.
    }

    // Only trigger for English-looking queries with sparse local results
    const trimmed = debouncedEffectiveQuery.trim();
    const isEnglish = /^[a-zA-Z\s]{3,}$/.test(trimmed);
    const isSparse = localResults.length < 3;

    if (!enabled || !isEnglish || !isSparse || trimmed.length < 3) {
      setSemanticResults([]);
      return;
    }

    semanticAbortRef.current?.abort();
    const controller = new AbortController();
    semanticAbortRef.current = controller;

    fetchSemanticResults(trimmed, tokens).then((hits) => {
      if (!controller.signal.aborted) {
        // Deduplicate: exclude semantic roots already in local results
        const localRoots = new Set(localResults.map((r) => r.matchedRoot).filter(Boolean));
        setSemanticResults(hits.filter((h) => !localRoots.has(h.matchedRoot)));
      }
    });

    return () => controller.abort();
  }, [debouncedEffectiveQuery, localResults, tokens]);

  // ---- merge local + semantic ----
  const results = useMemo<SearchResultItem[]>(
    () => [...localResults, ...semanticResults],
    [localResults, semanticResults],
  );
  const groupedResults = useMemo(() => groupSearchResults(results), [results]);

  // ---- result selection (pure — returns payload, consumer fires callbacks) ----
  const selectResult = useCallback(
    (result: SearchResultItem) => {
      const tokenId = result.location?.tokenId;
      if (!tokenId) return null;
      setIsOpen(false);
      return {
        tokenId,
        matchType: result.kind as SearchMatchType,
        matchedRoot: result.matchedRoot,
      };
    },
    [],
  );

  // ---- keyboard navigation (ArrowUp / ArrowDown / Escape only) ----
  // Enter is intentionally NOT handled here — the presentation component
  // wires Enter → selectResult → consumer callbacks (see CommandBar).
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (event.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    },
    [results.length],
  );

  // ---- clearAll ----
  const clearAll = useCallback(() => {
    setQuery("");
    setFilterRoot("");
    setFilterLemma("");
    setFilterPos("");
    setFilterAyah("");
    inputRef.current?.focus();
  }, []);

  // ---- effects: reset selected index when results change ----
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // ---- effects: scroll selected result into view ----
  useEffect(() => {
    if (!resultsRef.current || results.length === 0) return;
    const el = resultsRef.current.querySelector<HTMLElement>(`#search-result-${selectedIndex}`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, results.length]);

  // ---- effects: first‑interaction analytics ----
  useEffect(() => {
    if (!debouncedEffectiveQuery.trim() || debouncedEffectiveQuery.trim().length < 2) return;
    if (!hasTrackedInteractionRef.current) {
      trackPerformanceMetric(
        "first_search_interaction",
        analyticsSurface,
        Math.round(performance.now() - mountedAtRef.current),
        { query_length: debouncedEffectiveQuery.trim().length },
      );
      hasTrackedInteractionRef.current = true;
    }
  }, [analyticsSurface, debouncedEffectiveQuery]);

  return {
    query,
    setQuery,
    effectiveQuery,
    isOpen,
    setIsOpen,
    selectedIndex,
    setSelectedIndex,
    filterRoot,
    setFilterRoot,
    filterLemma,
    setFilterLemma,
    filterPos,
    setFilterPos,
    filterAyah,
    setFilterAyah,
    filtersExpanded,
    setFiltersExpanded,
    hasActiveFilters,
    results,
    groupedResults,
    queryIntent,
    inputRef,
    resultsRef,
    selectResult,
    handleKeyDown,
    clearAll,
  };
}
