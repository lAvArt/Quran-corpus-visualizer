"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { CorpusToken, PartOfSpeech } from "@/lib/schema/types";
import type { SearchMatchType } from "@/lib/analytics/events";
import type { SearchResultItem } from "@/lib/search/searchTypes";
import { useSearch, type UseSearchReturn } from "@/lib/hooks/useSearch";

// ---------------------------------------------------------------------------
// Public props
// ---------------------------------------------------------------------------

export interface CommandBarProps {
  /** Corpus tokens to search over */
  tokens: CorpusToken[];
  /** Visual variant — controls layout density & filter defaults */
  variant?: "bar" | "panel" | "overlay";
  /** Analytics surface tag */
  analyticsSurface?: "header" | "sidebar" | "mobile" | "workspace" | "unknown";
  /** Result‑selection callback */
  onTokenSelect: (tokenId: string) => void;
  /** Hover callback for live-highlighting tokens in the visualization */
  onTokenHover: (tokenId: string | null) => void;
  /** Root selection callback */
  onRootSelect?: (root: string | null) => void;
  /** Called when the search input receives focus */
  onSearchOpened?: () => void;
  /** Called when a debounced query is submitted */
  onSearchQuerySubmitted?: (query: string) => void;
  /** Called when a result is selected (with match type for analytics) */
  onSearchResultSelected?: (matchType: SearchMatchType) => void;
  /** Optional — pass an externally-created search controller (for shared state) */
  search?: UseSearchReturn;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CommandBar({
  tokens,
  variant = "bar",
  analyticsSurface = "unknown",
  onTokenSelect,
  onTokenHover,
  onRootSelect,
  onSearchOpened,
  onSearchQuerySubmitted,
  onSearchResultSelected,
  search: externalSearch,
}: CommandBarProps) {
  const t = useTranslations("GlobalSearch");

  // Use externally-provided search state, or create our own
  const internalSearch = useSearch({
    tokens,
    analyticsSurface,
    initialFiltersExpanded: variant === "panel",
  });
  const search = externalSearch ?? internalSearch;

  const {
    query,
    setQuery,
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
  } = search;

  // ---- debounced query submission callback ----
  const lastSubmittedRef = useRef("");
  const debouncedEffective = search.effectiveQuery;
  useEffect(() => {
    if (!debouncedEffective.trim() || debouncedEffective.trim().length < 2) return;
    if (debouncedEffective === lastSubmittedRef.current) return;
    lastSubmittedRef.current = debouncedEffective;
    onSearchQuerySubmitted?.(debouncedEffective.trim());
  }, [debouncedEffective, onSearchQuerySubmitted]);

  // ---- type label map ----
  const typeLabelMap: Record<SearchMatchType, string> = {
    ayah: "Ayah",
    surah: t("types.surah"),
    token: "Token",
    root: t("types.root"),
    lemma: t("types.lemma"),
    text: t("types.text"),
    gloss: t("types.gloss"),
    translation: t("types.translation"),
    semantic: t("types.semantic"),
  };

  // ---- intent hint ----
  const intentHint = (() => {
    switch (queryIntent) {
      case "arabic-root": return t("intentHints.root");
      case "arabic-text": return t("intentHints.text");
      case "english-gloss": return t("intentHints.gloss");
      case "ayah-ref": return t("intentHints.ayah");
      case "structured": return t("intentHints.structured");
      default: return null;
    }
  })();

  // ---- result selection → fire consumer callbacks ----
  const handleSelect = useCallback(
    (result: SearchResultItem) => {
      const payload = selectResult(result);
      if (!payload) return;
      onTokenSelect(payload.tokenId!);
      onSearchResultSelected?.(payload.matchType);
      if (payload.matchedRoot && onRootSelect) {
        onRootSelect(payload.matchedRoot);
      }
    },
    [selectResult, onTokenSelect, onSearchResultSelected, onRootSelect],
  );

  // ---- keyboard: delegate nav to hook, intercept Enter ourselves ----
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" && results[selectedIndex]) {
        event.preventDefault();
        handleSelect(results[selectedIndex]);
        return;
      }
      handleKeyDown(event);
    },
    [handleKeyDown, handleSelect, results, selectedIndex],
  );

  // ---- render ----
  return (
    <div className="global-search" data-tour-id="global-search-root" data-variant={variant}>
      {/* ------- Input ------- */}
      <div className="search-input-wrapper" onClick={() => inputRef.current?.focus()}>
        <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder={t("placeholder")}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onFocusCapture={() => onSearchOpened?.()}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={isOpen && results.length > 0}
          aria-controls="global-search-results"
          aria-activedescendant={isOpen && results.length > 0 ? `search-result-${selectedIndex}` : undefined}
          aria-autocomplete="list"
          aria-label={t("placeholder")}
        />
        {query ? (
          <button
            className="search-clear"
            aria-label={t("clearSearch")}
            onClick={(e) => { e.stopPropagation(); clearAll(); }}
          >
            x
          </button>
        ) : null}
        <button
          type="button"
          className={`search-filters-inline-toggle ${filtersExpanded || hasActiveFilters ? "active" : ""}`}
          onClick={(e) => { e.stopPropagation(); setFiltersExpanded(!filtersExpanded); }}
          aria-label={t("advancedFilters")}
          title={t("advancedFilters")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="8" y1="12" x2="16" y2="12" />
            <line x1="11" y1="18" x2="13" y2="18" />
          </svg>
        </button>
      </div>

      {/* ------- Fixed intent hint — floats at bottom-left above graph toolbar ------- */}
      {query.trim().length >= 2 && intentHint ? (
        <div className="search-intent-hint">
          <span className="intent-badge" data-intent={queryIntent}>{intentHint}</span>
        </div>
      ) : null}

      {/* ------- Floating overlay (filters + results) — sits below input, never stretches parent ------- */}
      <div className="search-overlay-container">
        {/* Advanced filters */}
        {filtersExpanded && (
          <div className="search-advanced-filters">
            <div className="search-filters-row">
              <input
                className="search-filter-input"
                type="text"
                value={filterRoot}
                onChange={(e) => { setFilterRoot(e.target.value); setIsOpen(true); }}
                placeholder={t("filters.root")}
                dir="rtl"
                lang="ar"
              />
              <input
                className="search-filter-input"
                type="text"
                value={filterLemma}
                onChange={(e) => { setFilterLemma(e.target.value); setIsOpen(true); }}
                placeholder={t("filters.lemma")}
                dir="rtl"
                lang="ar"
              />
            </div>
            <div className="search-filters-row">
              <select
                className="search-filter-select"
                value={filterPos}
                onChange={(e) => { setFilterPos(e.target.value as PartOfSpeech | ""); setIsOpen(true); }}
              >
                <option value="">{t("filters.allPos")}</option>
                <option value="N">{t("filters.noun")}</option>
                <option value="V">{t("filters.verb")}</option>
                <option value="P">{t("filters.particle")}</option>
                <option value="ADJ">{t("filters.adjective")}</option>
                <option value="PRON">{t("filters.pronoun")}</option>
              </select>
              <input
                className="search-filter-input"
                type="text"
                value={filterAyah}
                onChange={(e) => { setFilterAyah(e.target.value); setIsOpen(true); }}
                placeholder={t("filters.ayah")}
              />
            </div>
            {hasActiveFilters && (
              <div className="search-filters-actions">
                <button type="button" className="search-filter-clear" onClick={() => { setFilterRoot(""); setFilterLemma(""); setFilterPos(""); setFilterAyah(""); }}>
                  {t("filters.clear")}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Results dropdown */}
        {isOpen && results.length > 0 ? (
          <div ref={resultsRef} className="search-results-dropdown" id="global-search-results" role="listbox" aria-label={t("resultsAriaLabel")}>
            {groupedResults.map((group) => (
              <div key={group.kind} className="result-group">
                <div className="result-group-label">
                  {typeLabelMap[group.kind as SearchMatchType]}
                  {group.kind === "semantic" && <span className="result-ai-badge">AI</span>}
                </div>
                {group.items.map((result) => {
                  const resultIndex = results.findIndex((entry) => entry.id === result.id);
                  return (
                    <button
                      key={result.id}
                      id={`search-result-${resultIndex}`}
                      role="option"
                      aria-selected={resultIndex === selectedIndex}
                      className={`search-result-item ${resultIndex === selectedIndex ? "selected" : ""}`}
                      onMouseEnter={() => {
                        setSelectedIndex(resultIndex);
                        onTokenHover(result.location?.tokenId ?? null);
                      }}
                      onMouseLeave={() => onTokenHover(null)}
                      onClick={() => handleSelect(result)}
                    >
                      <span className="result-arabic">{result.arabicText ?? result.title}</span>
                      <span className="result-meta">
                        <span className={`result-type result-type-${result.kind}`}>
                          {typeLabelMap[result.kind as SearchMatchType]}
                        </span>
                        <span className="result-match">{result.subtitle ?? result.title}</span>
                        {result.explanation ? <span className="result-explanation">{result.explanation}</span> : null}
                      </span>
                      <span className="result-location">
                        {result.location?.surah}:{result.location?.ayah}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ) : null}

        {isOpen && (query.length >= 2 || hasActiveFilters) && results.length === 0 ? (
          <div className="search-results-dropdown">
            <div className="search-no-results">{t("noResults")}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
