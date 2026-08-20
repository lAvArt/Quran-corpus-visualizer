"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
    calculateRootFrequencies,
    getCollocations,
    type CollocationTerm,
} from "@/lib/search/collocation";
import { normalizeArabicForSearch } from "@/lib/search/arabicNormalize";
import { loadNameStats, type NameStatsIndex } from "@/lib/corpus/nameStatsClient";
import type { CorpusToken } from "@/lib/schema/types";

/**
 * "What is named near this?" — collocation as a search answer rather than a graph.
 *
 * The engine already supported this (getCollocations with a distance window);
 * what was missing was a way to ask from the search surface. Anchoring is on the
 * exact WRITTEN FORM when the query is one, because that is the question people
 * actually ask: لِأَبِيهِ occurs 9 times, and "who is speaking" is a property of
 * those 9 tokens — not of the lemma أَب, which covers 117.
 *
 * "Names only" cannot use the part-of-speech tag: normalizePos() folds QAC's PN
 * into plain "N", so a loaded token cannot say whether it is a proper noun. The
 * curated name index can — it marks each entry kind "name" or "word" — and is
 * the better authority anyway, since it is the same list the rest of the search
 * treats as أعلام.
 *
 * Window width is a first-class control, not a hidden default, because it
 * changes the answer: the speaker beside لِأَبِيهِ is named in the same ayah 5
 * times out of 9, and only in a PREVIOUS ayah the other 4 times. An ayah-scoped
 * window reports إبراهيم ×4; ±10 tokens reports ×8. Neither is wrong — they
 * answer different questions — so the control says which one is on screen.
 */

type WindowChoice = "ayah" | 5 | 10;

const WINDOWS: WindowChoice[] = ["ayah", 5, 10];

export interface NearbyPanelProps {
    tokens: CorpusToken[];
    /** The user's query, used verbatim as the anchor. */
    term: string;
    isCorpusLoading: boolean;
    /** Open an ayah reference ("6:74") in the surrounding workspace. */
    onOpenRef?: (sura: number, ayah: number) => void;
}

export default function NearbyPanel({ tokens, term, isCorpusLoading, onOpenRef }: NearbyPanelProps) {
    const t = useTranslations("NearbySearch");
    const [windowChoice, setWindowChoice] = useState<WindowChoice>(10);
    const [namesOnly, setNamesOnly] = useState(true);
    const [nameIdx, setNameIdx] = useState<NameStatsIndex | null>(null);

    useEffect(() => {
        let alive = true;
        loadNameStats().then((d) => alive && setNameIdx(d)).catch(() => {});
        return () => { alive = false; };
    }, []);

    /** Normalized lemma keys of everything the corpus treats as a proper name. */
    const nameKeys = useMemo(() => {
        const keys = new Set<string>();
        for (const entry of Object.values(nameIdx?.names ?? {})) {
            if (entry.kind !== "name") continue;
            keys.add(entry.key);
            if (entry.lemma) keys.add(normalizeArabicForSearch(entry.lemma));
        }
        return keys;
    }, [nameIdx]);

    // One O(n) pass over the corpus, reused across every control change.
    const freq = useMemo(() => (tokens.length ? calculateRootFrequencies(tokens) : null), [tokens]);

    /**
     * Anchor kind. A query that is written somewhere in the corpus is treated as
     * a form (exact tokens); otherwise fall back to lemma, which carries the
     * engine's affix tolerance. Root anchoring is left to the root card above —
     * this panel is about the words as written.
     */
    const anchor = useMemo<CollocationTerm | null>(() => {
        const q = term.trim();
        if (!q || !tokens.length) return null;
        const key = normalizeArabicForSearch(q);
        if (!key) return null;
        const isWrittenForm = tokens.some((tk) => normalizeArabicForSearch(tk.text) === key);
        return { kind: isWrittenForm ? "form" : "lemma", value: q };
    }, [term, tokens]);

    const rows = useMemo(() => {
        if (!anchor || !freq) return [];
        return getCollocations(anchor, tokens, freq, {
            windowType: windowChoice === "ayah" ? "ayah" : "distance",
            distance: windowChoice === "ayah" ? undefined : windowChoice,
            groupBy: "lemma",
            minFrequency: 1,
        })
            .filter((r) => !namesOnly || nameKeys.has(normalizeArabicForSearch(r.label)))
            // Counts first, deliberately. PMI rewards rarity, so it floats a
            // once-mentioned name above the one named eight times — the opposite
            // of what "who is named near this?" means.
            .sort((a, b) => b.count - a.count || b.pmi - a.pmi)
            .slice(0, 12);
    }, [anchor, freq, tokens, windowChoice, namesOnly, nameKeys]);

    if (!anchor) return null;

    return (
        <article className="workspace-root-card" data-testid="search-nearby-panel">
            <div className="nearby-head">
                <div>
                    <p className="ui-kicker">{t("title")}</p>
                    <p className="nearby-sub">{t("subtitle", { term: term.trim() })}</p>
                </div>
                <div className="nearby-controls">
                    <div className="header-button-group" role="group" aria-label={t("windowLabel")}>
                        {WINDOWS.map((w) => (
                            <button
                                key={String(w)}
                                type="button"
                                className={`control-pill-btn ${windowChoice === w ? "active" : ""}`}
                                onClick={() => setWindowChoice(w)}
                            >
                                {w === "ayah" ? t("windowAyah") : t("windowTokens", { n: w })}
                            </button>
                        ))}
                    </div>
                    <label className="nearby-toggle">
                        <input
                            type="checkbox"
                            checked={namesOnly}
                            onChange={(e) => setNamesOnly(e.target.checked)}
                        />
                        <span>{t("namesOnly")}</span>
                    </label>
                </div>
            </div>

            {isCorpusLoading && (
                <p className="nearby-loading" role="status">{t("stillLoading")}</p>
            )}

            {rows.length === 0 ? (
                <p className="nearby-empty">{t("empty")}</p>
            ) : (
                <ul className="nearby-list">
                    {rows.map((row) => (
                        <li key={row.label} className="nearby-row">
                            <span className="nearby-label" lang="ar" dir="rtl">{row.label}</span>
                            <span className="nearby-count">×{row.count.toLocaleString()}</span>
                            <span className="nearby-refs">
                                {row.sampleWindows.slice(0, 4).map((w) => {
                                    const [sura, ayah] = w.split(":").map(Number);
                                    return (
                                        <button
                                            key={w}
                                            type="button"
                                            className="nearby-ref"
                                            onClick={() => onOpenRef?.(sura, ayah)}
                                        >
                                            {sura}:{ayah}
                                        </button>
                                    );
                                })}
                            </span>
                            {/* PMI is kept, quietly: useful for "distinctively
                                associated", misleading as a primary sort. */}
                            <span className="nearby-pmi" title={t("pmiHint")}>{row.pmi.toFixed(1)}</span>
                        </li>
                    ))}
                </ul>
            )}

            <style jsx>{`
                .nearby-head { display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: flex-start; }
                .nearby-sub { margin: 2px 0 0; font-size: 0.85rem; color: var(--muted); }
                .nearby-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
                .nearby-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 0.82rem; color: var(--muted); cursor: pointer; }
                .nearby-loading, .nearby-empty { margin: 12px 0 0; font-size: 0.85rem; color: var(--muted); }
                .nearby-list { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
                .nearby-row {
                    display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 2fr) auto;
                    gap: 10px; align-items: center; padding: 7px 10px; border-radius: 10px;
                    background: var(--ui-surface); border: 1px solid var(--line);
                }
                .nearby-label { font-size: 1.05rem; }
                .nearby-count { font-variant-numeric: tabular-nums; font-weight: 600; }
                .nearby-refs { display: flex; flex-wrap: wrap; gap: 5px; }
                .nearby-ref {
                    padding: 2px 7px; border-radius: 999px; cursor: pointer; font-size: 0.75rem;
                    font-variant-numeric: tabular-nums; background: transparent;
                    border: 1px solid var(--line); color: var(--muted);
                }
                .nearby-ref:hover { color: var(--fg); border-color: var(--accent); }
                .nearby-pmi { font-size: 0.72rem; color: var(--muted); font-variant-numeric: tabular-nums; }
            `}</style>
        </article>
    );
}
