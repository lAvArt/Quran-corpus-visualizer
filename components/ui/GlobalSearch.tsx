"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import type { CorpusToken } from "@/lib/schema/types";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { buildPhaseOneIndexes, queryPhaseOne } from "@/lib/search/indexes";
import { normalizeArabicForSearch } from "@/lib/search/arabicNormalize";
import { parseSearchQuery } from "@/lib/search/queryParser";
import type { SearchMatchType } from "@/lib/analytics/events";

interface GlobalSearchProps {
  tokens: CorpusToken[];
  onTokenSelect: (tokenId: string) => void;
  onTokenHover: (tokenId: string | null) => void;
  onRootSelect?: (root: string | null) => void;
  onSearchOpened?: () => void;
  onSearchQuerySubmitted?: (query: string) => void;
  onSearchResultSelected?: (matchType: SearchMatchType) => void;
}

interface SearchResult {
  token: CorpusToken;
  matchType: SearchMatchType;
  matchText: string;
}

export default function GlobalSearch({
  tokens,
  onTokenSelect,
  onTokenHover,
  onRootSelect,
  onSearchOpened,
  onSearchQuerySubmitted,
  onSearchResultSelected,
}: GlobalSearchProps) {
  const t = useTranslations('GlobalSearch');
  const typeLabelMap: Record<SearchResult["matchType"], string> = {
    root: t('types.root'),
    lemma: t('types.lemma'),
    text: t('types.text'),
    gloss: t('types.gloss'),
  };
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 200);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Build search indexes
  const { byRoot, byLemma, byId, phaseOne } = useMemo(() => {
    const rootMap = new Map<string, CorpusToken[]>();
    const lemmaMap = new Map<string, CorpusToken[]>();
    const byIdMap = new Map<string, CorpusToken>();

    for (const token of tokens) {
      byIdMap.set(token.id, token);
      if (token.root) {
        if (!rootMap.has(token.root)) rootMap.set(token.root, []);
        rootMap.get(token.root)!.push(token);
      }
      if (token.lemma) {
        if (!lemmaMap.has(token.lemma)) lemmaMap.set(token.lemma, []);
        lemmaMap.get(token.lemma)!.push(token);
      }
    }

    return { byRoot: rootMap, byLemma: lemmaMap, byId: byIdMap, phaseOne: buildPhaseOneIndexes(tokens) };
  }, [tokens]);

  // Search function
  const results = useMemo<SearchResult[]>(() => {
    if (!debouncedQuery.trim() || debouncedQuery.length < 2) return [];

    const parsed = parseSearchQuery(debouncedQuery);
    const queryTrimmed = parsed.freeText || parsed.raw;
    const q = queryTrimmed.toLowerCase();
    const normalizedQuery = normalizeArabicForSearch(queryTrimmed);
    const matches: SearchResult[] = [];
    const seen = new Set<string>();

    if (parsed.root || parsed.lemma || parsed.pos || parsed.ayah) {
      const ids = queryPhaseOne(phaseOne, {
        root: parsed.root,
        lemma: parsed.lemma,
        pos: parsed.pos,
        ayah: parsed.ayah,
      });

      for (const id of ids) {
        const token = byId.get(id);
        if (!token || seen.has(id)) continue;
        seen.add(id);

        const matchType: SearchMatchType = parsed.root
          ? "root"
          : parsed.lemma
          ? "lemma"
          : parsed.gloss
          ? "gloss"
          : "text";
        const matchText =
          parsed.root
            ? t("matchRoot", { root: token.root, count: (byRoot.get(token.root)?.length ?? 1) })
            : parsed.lemma
            ? t("matchLemma", { lemma: token.lemma })
            : parsed.ayah
            ? `${token.sura}:${token.ayah}`
            : token.text;

        matches.push({
          token,
          matchType,
          matchText,
        });
      }
    }

    if (!queryTrimmed) {
      return matches.slice(0, 20);
    }

    // Search by root
    for (const [root, rootTokens] of byRoot) {
      const normalizedRoot = normalizeArabicForSearch(root);
      if (
        root.includes(queryTrimmed) ||
        root.replace(/ /g, "").includes(queryTrimmed.replace(/ /g, "")) ||
        normalizedRoot.includes(normalizedQuery)
      ) {
        const token = rootTokens[0];
        if (!seen.has(token.id)) {
          seen.add(token.id);
          matches.push({
            token,
            matchType: "root",
            matchText: t('matchRoot', { root, count: rootTokens.length }),
          });
        }
      }
    }

    // Search by lemma
    for (const [lemma, lemmaTokens] of byLemma) {
      const normalizedLemma = normalizeArabicForSearch(lemma);
      if (lemma.includes(queryTrimmed) || normalizedLemma.includes(normalizedQuery)) {
        const token = lemmaTokens[0];
        if (!seen.has(token.id)) {
          seen.add(token.id);
          matches.push({
            token,
            matchType: "lemma",
            matchText: t('matchLemma', { lemma }),
          });
        }
      }
    }

    // Search by Arabic text
    for (const token of tokens) {
      const normalizedText = normalizeArabicForSearch(token.text);
      if ((token.text.includes(queryTrimmed) || normalizedText.includes(normalizedQuery)) && !seen.has(token.id)) {
        seen.add(token.id);
        matches.push({
          token,
          matchType: "text",
          matchText: token.text,
        });
      }
    }

    // Search by gloss (English meaning)
    for (const token of tokens) {
      const gloss = token.morphology?.gloss?.toLowerCase() ?? "";
      if (gloss.includes(q) && !seen.has(token.id)) {
        seen.add(token.id);
        matches.push({
          token,
          matchType: "gloss",
          matchText: token.morphology?.gloss ?? "",
        });
      }
    }

    return matches.slice(0, 20);
  }, [debouncedQuery, tokens, byRoot, byLemma, byId, phaseOne, t]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        const r = results[selectedIndex];
        onTokenSelect(r.token.id);
        onSearchResultSelected?.(r.matchType);
        if (r.matchType === "root" && r.token.root && onRootSelect) {
          onRootSelect(r.token.root);
        }
        setIsOpen(false);
      } else if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    },
    [results, selectedIndex, onTokenSelect, onRootSelect, onSearchResultSelected]
  );

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Scroll selected result into view
  useEffect(() => {
    if (resultsRef.current && results.length > 0) {
      const selected = resultsRef.current.children[selectedIndex] as HTMLElement;
      selected?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, results.length]);

  useEffect(() => {
    if (!debouncedQuery.trim() || debouncedQuery.trim().length < 2) return;
    onSearchQuerySubmitted?.(debouncedQuery.trim());
  }, [debouncedQuery, onSearchQuerySubmitted]);

  return (
    <div className="global-search" data-tour-id="global-search-root">
      <div
        className="search-input-wrapper"
        onClick={() => inputRef.current?.focus()}
      >
        <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder={t('placeholder')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
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
          aria-label={t('placeholder')}
        />
        {query && (
          <button
            className="search-clear"
            aria-label={t('clearSearch')}
            onClick={(e) => {
              e.stopPropagation();
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            ×
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div ref={resultsRef} className="search-results-dropdown" id="global-search-results" role="listbox" aria-label={t('resultsAriaLabel')}>
          {results.map((result, index) => (
            <button
              key={result.token.id}
              id={`search-result-${index}`}
              role="option"
              aria-selected={index === selectedIndex}
              className={`search-result-item ${index === selectedIndex ? "selected" : ""}`}
              onMouseEnter={() => {
                setSelectedIndex(index);
                onTokenHover(result.token.id);
              }}
              onMouseLeave={() => onTokenHover(null)}
              onClick={() => {
                onTokenSelect(result.token.id);
                onSearchResultSelected?.(result.matchType);
                if (result.matchType === "root" && result.token.root && onRootSelect) {
                  onRootSelect(result.token.root);
                }
                setIsOpen(false);
              }}
            >
              <span className="result-arabic">{result.token.text}</span>
              <span className="result-meta">
                <span className={`result-type result-type-${result.matchType}`}>
                  {typeLabelMap[result.matchType]}
                </span>
                <span className="result-match">{result.matchText}</span>
              </span>
              <span className="result-location">
                {result.token.sura}:{result.token.ayah}
              </span>
            </button>
          ))}
        </div>
      )}

      {isOpen && query.length >= 2 && results.length === 0 && (
        <div className="search-results-dropdown">
          <div className="search-no-results">{t('noResults')}</div>
        </div>
      )}

      <style jsx>{`
        .global-search {
          position: relative;
          width: 100%;
          max-width: 280px;
        }

        .search-input-wrapper {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.7);
          transition: all 0.2s ease;
        }

        .search-input-wrapper:focus-within {
          border-color: var(--accent);
          box-shadow: 0 0 0 2px var(--accent-glow);
        }

        .search-icon {
          opacity: 0.5;
          flex-shrink: 0;
        }

        .search-input {
          flex: 1;
          border: none;
          background: transparent;
          font-size: 0.8rem;
          color: var(--ink);
          outline: none;
          min-width: 0;
        }

        @media (max-width: 640px) {
          .global-search {
            width: auto;
            position: static; /* Let it expand over header if needed, or just be an icon */
          }

          .search-input-wrapper {
            padding: 8px;
            width: 36px;
            height: 36px;
            justify-content: center;
            background: transparent;
            border-color: transparent;
          }

          .search-input-wrapper:focus-within {
            position: absolute;
            top: calc(var(--header-dock-height) + 8px);
            left: 1rem;
            right: 1rem;
            width: auto;
            height: auto;
            z-index: 60;
            background: var(--bg-1);
            padding: 8px 12px;
            border: 1px solid var(--accent);
          }
          
          .search-input {
            display: block;
            width: 0;
            opacity: 0;
            pointer-events: none;
          }

          .search-input-wrapper:focus-within .search-input {
            width: 100%;
            opacity: 1;
            pointer-events: auto;
          }
          
          .search-clear {
             display: none;
          }

          .search-input-wrapper:focus-within .search-clear {
             display: block;
          }
        }

        .search-input::placeholder {
          color: var(--ink-muted);
        }

        .search-clear {
          border: none;
          background: transparent;
          color: var(--ink-muted);
          cursor: pointer;
          padding: 2px 4px;
          font-size: 0.85rem;
        }

        .search-clear:hover {
          color: var(--ink);
        }

        .search-results-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          z-index: 100;
          max-height: 360px;
          overflow-y: auto;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(16px);
          box-shadow: 0 10px 32px rgba(0, 0, 0, 0.18);
        }

        .search-result-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          border: none;
          border-bottom: 1px solid var(--line);
          background: transparent;
          text-align: left;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .search-result-item:last-child {
          border-bottom: none;
        }

        .search-result-item:hover,
        .search-result-item.selected {
          background: rgba(15, 118, 110, 0.08);
        }

        .result-arabic {
          font-size: 1.1rem;
          font-family: var(--font-arabic, "Amiri"), serif;
          direction: rtl;
          min-width: 50px;
          color: var(--ink);
        }

        .result-meta {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .result-type {
          font-size: 0.6rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 1px 5px;
          border-radius: 3px;
          width: fit-content;
        }

        .result-type-root {
          background: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
        }

        .result-type-lemma {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
        }

        .result-type-text {
          background: rgba(249, 115, 22, 0.15);
          color: #f97316;
        }

        .result-type-gloss {
          background: rgba(139, 92, 246, 0.15);
          color: #8b5cf6;
        }

        .result-match {
          font-size: 0.75rem;
          color: var(--ink-secondary);
        }

        .result-location {
          font-size: 0.7rem;
          color: var(--ink-muted);
          font-family: monospace;
        }

        .search-no-results {
          padding: 14px;
          text-align: center;
          color: var(--ink-muted);
          font-size: 0.85rem;
        }

        :global([data-theme="dark"]) .search-input-wrapper {
          background: rgba(18, 18, 26, 0.75);
        }

        :global([data-theme="dark"]) .search-results-dropdown {
          background: rgba(18, 18, 26, 0.95);
        }

        :global([data-theme="dark"]) .search-result-item:hover,
        :global([data-theme="dark"]) .search-result-item.selected {
          background: rgba(249, 115, 22, 0.12);
        }
      `}</style>
    </div>
  );
}
