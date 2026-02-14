"use client";

import { useState, useMemo } from "react";
import type { CorpusToken } from "@/lib/schema/types";
import { SURAH_NAMES } from "@/lib/data/surahData";


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
        const query = searchQuery.toLowerCase();

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
                .filter((item) => item.label.toLowerCase().includes(query))
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
                .filter((item) => item.label.includes(query))
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
                .filter((item) => item.label.includes(query))
                .sort((a, b) => b.count - a.count);
        }
    }, [activeTab, searchQuery, data, t]);

    return (
        <div className={`corpus-index ${className}`}>
            <div className="index-tabs" role="tablist" aria-label="Index categories">
                {(["surah", "root", "lemma"] as const).map((mode) => (
                    <button
                        key={mode}
                        className={`index-tab-btn ${activeTab === mode ? "active" : ""}`}
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

            <style jsx>{`
                /* ... existing styles ... */

                 /* ... existing styles ... */
                 
                 /* RE-INSERTING PREVIOUS STYLES TO ENSURE THEY ARE NOT LOST */
                .corpus-index {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    background: var(--panel);
                    font-family: var(--font-sans);
                }

                .index-tabs {
                    display: flex;
                    border-bottom: 1px solid var(--line);
                    padding: 0 4px;
                    margin-bottom: 12px;
                }

                .index-tab-btn {
                    flex: 1;
                    background: transparent;
                    border: none;
                    padding: 12px 4px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--ink-muted);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    border-bottom: 2px solid transparent;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .index-tab-btn:hover {
                    color: var(--ink);
                }

                .index-tab-btn.active {
                    color: var(--accent);
                    border-bottom-color: var(--accent);
                }

                .search-container {
                    padding: 0 16px 12px;
                    position: relative;
                }

                .index-search-input {
                    width: 100%;
                    background: var(--bg-2);
                    border: 1px solid var(--line);
                    border-radius: 8px;
                    padding: 8px 12px 8px 36px; /* Space for icon */
                    font-size: 0.9rem;
                    color: var(--ink);
                    outline: none;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }

                .index-search-input:focus {
                    border-color: var(--accent);
                    box-shadow: 0 0 0 2px var(--accent-glow);
                }

                .search-icon {
                    position: absolute;
                    left: 26px;
                    top: 10px;
                    color: var(--ink-muted);
                    width: 16px;
                    height: 16px;
                    pointer-events: none;
                }

                .index-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 0 16px 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .index-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    width: 100%;
                    background: transparent;
                    border: 1px solid transparent;
                    border-radius: 8px;
                    padding: 8px 10px;
                    text-align: left;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }

                .index-item:hover {
                    background: var(--bg-1);
                    border-color: var(--line);
                    transform: translateX(2px);
                }

                .item-content {
                    display: flex;
                    flex-direction: column;
                }

                .item-label {
                    font-size: 0.92rem;
                    font-weight: 500;
                    color: var(--ink);
                }

                .index-item:hover .item-label {
                    color: var(--accent);
                }

                .item-sublabel {
                    font-size: 0.8rem;
                    color: var(--ink-muted);
                    margin-top: 2px;
                }

                .item-count {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--ink-muted);
                    background: var(--bg-2);
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-family: monospace;
                }

                .index-empty {
                    padding: 16px;
                    text-align: center;
                    font-size: 0.85rem;
                    color: var(--ink-muted);
                }
            `}</style>
        </div >
    );
}
