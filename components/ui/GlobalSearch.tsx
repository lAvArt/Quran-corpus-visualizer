"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import type { CorpusToken } from "@/lib/schema/types";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { trackPerformanceMetric, type SearchMatchType } from "@/lib/analytics/events";
import { buildSearchCatalog, groupSearchResults, searchCorpus } from "@/lib/search/searchService";
import type { SearchResultItem } from "@/lib/search/searchTypes";

interface GlobalSearchProps {
  tokens: CorpusToken[];
  onTokenSelect: (tokenId: string) => void;
  onTokenHover: (tokenId: string | null) => void;
  onRootSelect?: (root: string | null) => void;
  onSearchOpened?: () => void;
  onSearchQuerySubmitted?: (query: string) => void;
  onSearchResultSelected?: (matchType: SearchMatchType) => void;
  analyticsSurface?: "header" | "sidebar" | "mobile" | "workspace" | "unknown";
}

export default function GlobalSearch({
  tokens,
  onTokenSelect,
  onTokenHover,
  onRootSelect,
  onSearchOpened,
  onSearchQuerySubmitted,
  onSearchResultSelected,
  analyticsSurface = "unknown",
}: GlobalSearchProps) {
  const t = useTranslations("GlobalSearch");
  const typeLabelMap: Record<SearchMatchType, string> = {
    ayah: "Ayah",
    token: "Token",
    root: t("types.root"),
    lemma: t("types.lemma"),
    text: t("types.text"),
    gloss: t("types.gloss"),
    semantic: "Semantic",
  };
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 200);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const mountedAtRef = useRef<number>(performance.now());
  const hasTrackedInteractionRef = useRef(false);

  const catalog = useMemo(() => buildSearchCatalog(tokens), [tokens]);
  const results = useMemo<SearchResultItem[]>(
    () => searchCorpus(tokens, catalog, debouncedQuery),
    [catalog, debouncedQuery, tokens]
  );
  const groupedResults = useMemo(() => groupSearchResults(results), [results]);

  const handleSelectResult = useCallback(
    (result: SearchResultItem) => {
      const tokenId = result.location?.tokenId;
      if (!tokenId) return;
      onTokenSelect(tokenId);
      onSearchResultSelected?.(result.kind as SearchMatchType);
      if (result.kind === "root" && result.matchedRoot && onRootSelect) {
        onRootSelect(result.matchedRoot);
      }
      setIsOpen(false);
    },
    [onRootSelect, onSearchResultSelected, onTokenSelect]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((current) => Math.min(current + 1, results.length - 1));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === "Enter" && results[selectedIndex]) {
        event.preventDefault();
        handleSelectResult(results[selectedIndex]);
        return;
      }

      if (event.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    },
    [handleSelectResult, results, selectedIndex]
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  useEffect(() => {
    if (!resultsRef.current || results.length === 0) return;
    const selected = resultsRef.current.querySelector<HTMLElement>(`#search-result-${selectedIndex}`);
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, results.length]);

  useEffect(() => {
    if (!debouncedQuery.trim() || debouncedQuery.trim().length < 2) return;
    if (!hasTrackedInteractionRef.current) {
      trackPerformanceMetric(
        "first_search_interaction",
        analyticsSurface,
        Math.round(performance.now() - mountedAtRef.current),
        { query_length: debouncedQuery.trim().length }
      );
      hasTrackedInteractionRef.current = true;
    }
    onSearchQuerySubmitted?.(debouncedQuery.trim());
  }, [analyticsSurface, debouncedQuery, onSearchQuerySubmitted]);

  return (
    <div className="global-search" data-tour-id="global-search-root">
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
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onFocusCapture={() => onSearchOpened?.()}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          onKeyDown={handleKeyDown}
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
            onClick={(event) => {
              event.stopPropagation();
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            x
          </button>
        ) : null}
      </div>

      {isOpen && results.length > 0 ? (
        <div ref={resultsRef} className="search-results-dropdown" id="global-search-results" role="listbox" aria-label={t("resultsAriaLabel")}>
          {groupedResults.map((group) => (
            <div key={group.kind} className="result-group">
              <div className="result-group-label">{typeLabelMap[group.kind as SearchMatchType]}</div>
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
                    onClick={() => handleSelectResult(result)}
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

      {isOpen && query.length >= 2 && results.length === 0 ? (
        <div className="search-results-dropdown">
          <div className="search-no-results">{t("noResults")}</div>
        </div>
      ) : null}
    </div>
  );
}
