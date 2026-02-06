"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { CorpusToken } from "@/lib/schema/types";

interface GlobalSearchProps {
    tokens: CorpusToken[];
    onTokenSelect: (tokenId: string) => void;
    onTokenHover: (tokenId: string | null) => void;
    theme: "light" | "dark";
}

interface SearchResult {
    token: CorpusToken;
    matchType: "text" | "root" | "lemma" | "gloss";
    matchText: string;
}

export default function GlobalSearch({
    tokens,
    onTokenSelect,
    onTokenHover,
    theme,
}: GlobalSearchProps) {
    const [query, setQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);

    // Build search indexes
    const { byRoot, byLemma } = useMemo(() => {
        const rootMap = new Map<string, CorpusToken[]>();
        const lemmaMap = new Map<string, CorpusToken[]>();

        for (const token of tokens) {
            if (token.root) {
                if (!rootMap.has(token.root)) rootMap.set(token.root, []);
                rootMap.get(token.root)!.push(token);
            }
            if (token.lemma) {
                if (!lemmaMap.has(token.lemma)) lemmaMap.set(token.lemma, []);
                lemmaMap.get(token.lemma)!.push(token);
            }
        }

        return { byRoot: rootMap, byLemma: lemmaMap };
    }, [tokens]);

    // Search function
    const results = useMemo<SearchResult[]>(() => {
        if (!query.trim() || query.length < 2) return [];

        const q = query.toLowerCase().trim();
        const matches: SearchResult[] = [];
        const seen = new Set<string>();

        // Search by root
        for (const [root, rootTokens] of byRoot) {
            if (root.includes(q) || root.replace(/ /g, "").includes(q)) {
                const token = rootTokens[0];
                if (!seen.has(token.id)) {
                    seen.add(token.id);
                    matches.push({
                        token,
                        matchType: "root",
                        matchText: `Root: ${root} (${rootTokens.length} occurrences)`,
                    });
                }
            }
        }

        // Search by lemma
        for (const [lemma, lemmaTokens] of byLemma) {
            if (lemma.includes(q)) {
                const token = lemmaTokens[0];
                if (!seen.has(token.id)) {
                    seen.add(token.id);
                    matches.push({
                        token,
                        matchType: "lemma",
                        matchText: `Lemma: ${lemma}`,
                    });
                }
            }
        }

        // Search by Arabic text
        for (const token of tokens) {
            if (token.text.includes(q) && !seen.has(token.id)) {
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
    }, [query, tokens, byRoot, byLemma]);

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
                onTokenSelect(results[selectedIndex].token.id);
                setIsOpen(false);
            } else if (e.key === "Escape") {
                setIsOpen(false);
                inputRef.current?.blur();
            }
        },
        [results, selectedIndex, onTokenSelect]
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

    return (
        <div className="global-search">
            <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                    ref={inputRef}
                    type="text"
                    className="search-input"
                    placeholder="Search roots, words, meanings..."
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                    onKeyDown={handleKeyDown}
                />
                {query && (
                    <button
                        className="search-clear"
                        onClick={() => {
                            setQuery("");
                            inputRef.current?.focus();
                        }}
                    >
                        ✕
                    </button>
                )}
            </div>

            {isOpen && results.length > 0 && (
                <div ref={resultsRef} className="search-results-dropdown">
                    {results.map((result, index) => (
                        <button
                            key={result.token.id}
                            className={`search-result-item ${index === selectedIndex ? "selected" : ""}`}
                            onMouseEnter={() => {
                                setSelectedIndex(index);
                                onTokenHover(result.token.id);
                            }}
                            onMouseLeave={() => onTokenHover(null)}
                            onClick={() => {
                                onTokenSelect(result.token.id);
                                setIsOpen(false);
                            }}
                        >
                            <span className="result-arabic">{result.token.text}</span>
                            <span className="result-meta">
                                <span className={`result-type result-type-${result.matchType}`}>
                                    {result.matchType}
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
                    <div className="search-no-results">No results found</div>
                </div>
            )}

            <style jsx>{`
        .global-search {
          position: relative;
          width: 100%;
          max-width: 320px;
        }

        .search-input-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border: 1px solid var(--line);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.7);
          transition: all 0.2s ease;
        }

        .search-input-wrapper:focus-within {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-glow);
        }

        .search-icon {
          font-size: 0.9rem;
          opacity: 0.5;
        }

        .search-input {
          flex: 1;
          border: none;
          background: transparent;
          font-size: 0.9rem;
          color: var(--ink);
          outline: none;
        }

        .search-input::placeholder {
          color: var(--ink-muted);
        }

        .search-clear {
          border: none;
          background: transparent;
          color: var(--ink-muted);
          cursor: pointer;
          padding: 2px 6px;
          font-size: 0.8rem;
        }

        .search-clear:hover {
          color: var(--ink);
        }

        .search-results-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          z-index: 100;
          max-height: 400px;
          overflow-y: auto;
          border: 1px solid var(--line);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(16px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
        }

        .search-result-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px 14px;
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
          font-size: 1.2rem;
          font-family: var(--font-arabic, "Amiri"), serif;
          direction: rtl;
          min-width: 60px;
          color: var(--ink);
        }

        .result-meta {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .result-type {
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 2px 6px;
          border-radius: 4px;
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
          font-size: 0.8rem;
          color: var(--ink-secondary);
        }

        .result-location {
          font-size: 0.75rem;
          color: var(--ink-muted);
          font-family: monospace;
        }

        .search-no-results {
          padding: 16px;
          text-align: center;
          color: var(--ink-muted);
          font-size: 0.9rem;
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
