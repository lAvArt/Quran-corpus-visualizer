"use client";

import { useState, useMemo } from "react";
import type { CorpusToken } from "@/lib/schema/types";
import { SURAH_NAMES } from "@/lib/data/surahData";
import { normalizeArabicForSearch } from "@/lib/search/indexes";


interface CorpusIndexProps {
    tokens: CorpusToken[];
    onSelectSurah: (id: number) => void;
    onSelectRoot: (root: string) => void;
    onSelectLemma: (lemma: string) => void;
    /** Un-scope the Root/Lemma tabs back to the whole corpus. */
    onClearSurah?: () => void;
    className?: string;
    selectedSurahId?: number;
}

const PAGE_SIZE = 25;

type TabMode = "surah" | "root" | "lemma";

import { useTranslations } from "next-intl";

export default function CorpusIndex({
    tokens,
    onSelectSurah,
    onSelectRoot,
    onSelectLemma,
    onClearSurah,
    className = "",
    selectedSurahId,
}: CorpusIndexProps) {
    const t = useTranslations('CorpusIndex');
    const [activeTab, setActiveTab] = useState<TabMode>("surah");
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(0);

    // Compute aggregates
    const data = useMemo(() => {
        const surahCounts = new Map<number, number>();
        const rootCounts = new Map<string, number>();
        const lemmaCounts = new Map<string, number>();

        // Filter tokens if we are looking at roots/lemmas and a surah is selected
        // We always count surahs globally though, or else the surah list would disappear
        const relevantTokens = (activeTab !== "surah" && selectedSurahId)
            ? tokens.filter(t => t.sura === selectedSurahId)
            : tokens;

        // If activeTab is surah, we need global counts for the list
        // So we might need two passes or separate data structures
        // Simpler: Always calc global surah counts, but local root/lemma counts

        tokens.forEach((t) => {
            // Always count surahs globally
            surahCounts.set(t.sura, (surahCounts.get(t.sura) || 0) + 1);
        });

        relevantTokens.forEach(t => {
            if (activeTab !== "surah") {
                if (t.root) rootCounts.set(t.root, (rootCounts.get(t.root) || 0) + 1);
                if (t.lemma) lemmaCounts.set(t.lemma, (lemmaCounts.get(t.lemma) || 0) + 1);
            }
        });

        return { surahCounts, rootCounts, lemmaCounts };
    }, [tokens, selectedSurahId, activeTab]);

    const filteredItems = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        const normalizedQuery = normalizeArabicForSearch(searchQuery);

        if (activeTab === "surah") {
            return Object.entries(SURAH_NAMES)
                .map(([id, data]) => ({
                    id: parseInt(id),
                    label: `${id}. ${data.name}`,
                    subLabel: data.arabic,
                    count: data.verses.toString() + " " + t('verses'), // Dynamic suffix
                    tokenCount: 0, // Placeholder, actual count is in computed data
                    value: parseInt(id),
                }))
                .filter((item) => {
                    if (!query) return true;
                    const normalizedSubLabel = normalizeArabicForSearch(item.subLabel);
                    return item.label.toLowerCase().includes(query) || normalizedSubLabel.includes(normalizedQuery);
                })
                .sort((a, b) => a.id - b.id);
        } else if (activeTab === "root") {
            return Array.from(data.rootCounts.entries())
                .map(([root, count]) => ({
                    id: root,
                    label: root,
                    subLabel: "",
                    count: count,
                    value: root,
                }))
                .filter((item) => {
                    if (!query) return true;
                    return item.label.includes(searchQuery) || normalizeArabicForSearch(item.label).includes(normalizedQuery);
                })
                .sort((a, b) => b.count - a.count);
        } else {
            return Array.from(data.lemmaCounts.entries())
                .map(([lemma, count]) => ({
                    id: lemma,
                    label: lemma,
                    subLabel: "",
                    count: count,
                    value: lemma,
                }))
                .filter((item) => {
                    if (!query) return true;
                    return item.label.includes(searchQuery) || normalizeArabicForSearch(item.label).includes(normalizedQuery);
                })
                .sort((a, b) => b.count - a.count);
        }
    }, [activeTab, searchQuery, data, t]);

    // Pagination is derived, never stored: reset to the first page whenever
    // the underlying list changes shape (tab, filter, or scope switch).
    const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount - 1);
    const pagedItems = filteredItems.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

    const switchTab = (mode: TabMode) => {
        setActiveTab(mode);
        setPage(0);
    };

    const scopedSurahName = selectedSurahId ? SURAH_NAMES[selectedSurahId]?.name ?? `#${selectedSurahId}` : null;

    return (
        <div className={`corpus-index ${className}`}>
            <div className="index-tabs" role="tablist" aria-label={t('tabsAriaLabel')}>
                {(["surah", "root", "lemma"] as const).map((mode) => (
                    <button
                        key={mode}
                        className={`index-tab-btn ${activeTab === mode ? "active" : ""}`}
                        data-testid={`index-tab-${mode}`}
                        onClick={() => switchTab(mode)}
                        role="tab"
                        aria-selected={activeTab === mode}
                        id={`index-tab-${mode}`}
                        aria-controls="index-tabpanel"
                    >
                        {t(`tabs.${mode}`)}
                    </button>
                ))}
            </div>

            {activeTab !== "surah" && scopedSurahName ? (
                <div className="index-scope-row">
                    <span className="index-scope-chip" data-testid="index-scope-chip">
                        {t('scopedTo', { name: scopedSurahName })}
                    </span>
                    {onClearSurah ? (
                        <button type="button" className="index-scope-clear" onClick={() => { onClearSurah(); setPage(0); }}>
                            {t('clearScope')}
                        </button>
                    ) : null}
                </div>
            ) : null}

            <div className="search-container">
                <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                    type="text"
                    className="index-search-input"
                    data-testid="index-search-input"
                    placeholder={t('searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                    aria-label={t('searchPlaceholder')}
                />
            </div>
            <div className="index-list custom-scrollbar" role="tabpanel" id="index-tabpanel" aria-labelledby={`index-tab-${activeTab}`}>
                {pagedItems.map((item) => (
                    <button
                        key={item.id}
                        data-testid={`index-item-${String(item.id)}`}
                        onClick={() => {
                            if (activeTab === "surah") onSelectSurah(item.value as number);
                            if (activeTab === "root") onSelectRoot(item.value as string);
                            if (activeTab === "lemma") onSelectLemma(item.value as string);
                        }}
                        className="index-item"
                    >
                        <div className="item-content">
                            <span className="item-label">
                                {item.label}
                            </span>
                            {item.subLabel && (
                                <span className="item-sublabel font-arabic">
                                    {item.subLabel}
                                </span>
                            )}
                        </div>
                        <span className="item-count">
                            {item.count}
                        </span>
                    </button>
                ))}
                {
                    filteredItems.length === 0 && (
                        <div className="index-empty">
                            {t('noResults')}
                        </div>
                    )
                }
            </div >

            {pageCount > 1 ? (
                <div className="index-pager" data-testid="index-pager">
                    <button
                        type="button"
                        className="index-pager-btn"
                        onClick={() => setPage(Math.max(0, safePage - 1))}
                        disabled={safePage === 0}
                        aria-label={t('prevPage')}
                    >
                        ‹
                    </button>
                    <span className="index-pager-status">
                        {t('pageStatus', {
                            from: safePage * PAGE_SIZE + 1,
                            to: Math.min(filteredItems.length, (safePage + 1) * PAGE_SIZE),
                            total: filteredItems.length,
                        })}
                    </span>
                    <button
                        type="button"
                        className="index-pager-btn"
                        onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
                        disabled={safePage >= pageCount - 1}
                        aria-label={t('nextPage')}
                    >
                        ›
                    </button>
                </div>
            ) : null}

            <style jsx>{`
                .index-scope-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 8px;
                }

                .index-scope-chip {
                    font-size: 0.72rem;
                    color: var(--ink-secondary);
                    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
                    background: color-mix(in srgb, var(--accent) 10%, transparent);
                    border-radius: 999px;
                    padding: 3px 10px;
                }

                .index-scope-clear {
                    font-size: 0.72rem;
                    color: var(--ink-muted);
                    background: none;
                    border: none;
                    cursor: pointer;
                    text-decoration: underline;
                    font-family: inherit;
                }

                .index-scope-clear:hover {
                    color: var(--ink);
                }

                /* Bounded list: pagination keeps pages short, the cap keeps the
                   worst case (long labels wrapping) from crawling under the
                   fixed footer. */
                .index-list {
                    max-height: 560px;
                    overflow-y: auto;
                }

                /* Pager pinned to the card's bottom edge with breathing room —
                   arrows always in the same place regardless of page length. */
                .index-pager {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 18px;
                    margin-top: auto;
                    padding: 14px 0 4px;
                    border-top: 1px solid var(--line);
                }

                .index-pager-btn {
                    width: 30px;
                    height: 30px;
                    border-radius: 8px;
                    border: 1px solid var(--line);
                    background: transparent;
                    color: var(--ink-secondary);
                    font-size: 1rem;
                    line-height: 1;
                    cursor: pointer;
                }

                .index-pager-btn:hover:not(:disabled) {
                    border-color: var(--accent);
                    color: var(--ink);
                }

                .index-pager-btn:disabled {
                    opacity: 0.35;
                    cursor: default;
                }

                .index-pager-status {
                    font-size: 0.72rem;
                    color: var(--ink-muted);
                    font-variant-numeric: tabular-nums;
                }
            `}</style>
        </div >
    );
}
