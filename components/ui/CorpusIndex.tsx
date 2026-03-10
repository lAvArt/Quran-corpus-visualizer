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
    className?: string;
    selectedSurahId?: number;
}

type TabMode = "surah" | "root" | "lemma";

import { useTranslations } from "next-intl";

export default function CorpusIndex({
    tokens,
    onSelectSurah,
    onSelectRoot,
    onSelectLemma,
    className = "",
    selectedSurahId,
}: CorpusIndexProps) {
    const t = useTranslations('CorpusIndex');
    const [activeTab, setActiveTab] = useState<TabMode>("surah");
    const [searchQuery, setSearchQuery] = useState("");

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

    return (
        <div className={`corpus-index ${className}`}>
            <div className="index-tabs" role="tablist" aria-label={t('tabsAriaLabel')}>
                {(["surah", "root", "lemma"] as const).map((mode) => (
                    <button
                        key={mode}
                        className={`index-tab-btn ${activeTab === mode ? "active" : ""}`}
                        data-testid={`index-tab-${mode}`}
                        onClick={() => setActiveTab(mode)}
                        role="tab"
                        aria-selected={activeTab === mode}
                        id={`index-tab-${mode}`}
                        aria-controls="index-tabpanel"
                    >
                        {t(`tabs.${mode}`)}
                    </button>
                ))}
            </div>

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
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label={t('searchPlaceholder')}
                />
            </div>
            <div className="index-list custom-scrollbar" role="tabpanel" id="index-tabpanel" aria-labelledby={`index-tab-${activeTab}`}>
                {filteredItems.map((item) => (
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

        </div >
    );
}
