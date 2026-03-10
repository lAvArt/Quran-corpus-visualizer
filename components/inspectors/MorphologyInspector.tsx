"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { CorpusToken } from "@/lib/schema/types";
import { SURAH_NAMES } from "@/lib/data/surahData";

interface MorphologyInspectorProps {
    token: CorpusToken | null;
    mode: "hover" | "focus" | "idle";
    onClearFocus: () => void;
    allTokens: CorpusToken[];
    onRootSelect?: (root: string | null) => void;
    onSelectSurah?: (surahId: number, preferredView?: "root-network" | "radial-sura") => void;
}

export default function MorphologyInspector({
    token,
    mode,
    onClearFocus,
    allTokens,
    onRootSelect,
    onSelectSurah,
}: MorphologyInspectorProps) {
    const t = useTranslations("MorphologyInspector");
    const [sortBy, setSortBy] = useState<"occurrence" | "order">("occurrence");

    const translateFeature = (type: "keys" | "values" | "pos", term: string) => {
        try {
            const path = `featuresMap.${type}.${term}` as Parameters<typeof t>[0];
            if (t.has(path)) {
                return t(path);
            }
            return term;
        } catch {
            return term;
        }
    };

    const rootDistribution = useMemo(() => {
        if (!token?.root) return null;
        const rootStr = token.root;

        const matchingTokens = allTokens.filter((tk) => tk.root === rootStr);
        if (matchingTokens.length === 0) return null;

        const surahMap = new Map<number, {
            count: number;
            forms: Set<string>;
            ayahs: Map<number, { count: number; tokens: CorpusToken[] }>;
        }>();
        const allForms = new Set<string>();
        const allLemmas = new Set<string>();
        const posBreakdown = new Map<string, number>();
        let gloss = "";

        for (const tk of matchingTokens) {
            allForms.add(tk.text);
            if (tk.lemma) allLemmas.add(tk.lemma);
            if (tk.morphology?.gloss && !gloss) gloss = tk.morphology.gloss;

            posBreakdown.set(tk.pos, (posBreakdown.get(tk.pos) || 0) + 1);

            if (!surahMap.has(tk.sura)) {
                surahMap.set(tk.sura, { count: 0, forms: new Set(), ayahs: new Map() });
            }

            const entry = surahMap.get(tk.sura)!;
            entry.count++;
            entry.forms.add(tk.text);

            if (!entry.ayahs.has(tk.ayah)) {
                entry.ayahs.set(tk.ayah, { count: 0, tokens: [] });
            }

            const ayahEntry = entry.ayahs.get(tk.ayah)!;
            ayahEntry.count++;
            ayahEntry.tokens.push(tk);
        }

        const surahDistribution = Array.from(surahMap.entries())
            .map(([suraId, data]) => ({
                suraId,
                name: SURAH_NAMES[suraId]?.name || `Surah ${suraId}`,
                arabic: SURAH_NAMES[suraId]?.arabic || "",
                count: data.count,
                ayahCount: data.ayahs.size,
                forms: Array.from(data.forms).slice(0, 5),
                ayahs: Array.from(data.ayahs.entries())
                    .map(([ayahNum, ad]) => ({
                        ayah: ayahNum,
                        count: ad.count,
                        forms: ad.tokens
                            .map((entry) => entry.text)
                            .filter((value, index, array) => array.indexOf(value) === index)
                            .slice(0, 3),
                    }))
                    .sort((a, b) => a.ayah - b.ayah),
            }))
            .sort((a, b) => {
                if (sortBy === "order") return a.suraId - b.suraId;
                return b.count - a.count;
            });

        return {
            root: rootStr,
            totalOccurrences: matchingTokens.length,
            surahCount: surahMap.size,
            totalAyahs: surahDistribution.reduce((acc, surah) => acc + surah.ayahCount, 0),
            gloss,
            forms: Array.from(allForms).slice(0, 10),
            lemmas: Array.from(allLemmas),
            posBreakdown: Array.from(posBreakdown.entries()).sort((a, b) => b[1] - a[1]),
            surahDistribution,
        };
    }, [token?.root, allTokens, sortBy]);

    if (!token) {
        return (
            <div className="inspector-empty-state">
                <div className="empty-icon">{"\u2191"}</div>
                <p>{t("emptyState.hover")}</p>
                <p>{t("emptyState.click")}</p>
            </div>
        );
    }

    return (
        <div className="inspector-content">
            <div className="inspector-header">
                <div className="header-top">
                    <span className={`status-badge ${mode}`}>
                        {mode === "focus" ? t("status.locked") : t("status.preview")}
                    </span>
                    {mode === "focus" ? (
                        <button
                            type="button"
                            onClick={onClearFocus}
                            className="close-btn"
                            aria-label={t("clearSelection")}
                            data-testid="inspector-clear-focus"
                        >
                            {"\u00D7"}
                        </button>
                    ) : null}
                </div>

                <h2 className="token-arabic" lang="ar" dir="rtl">{token.text}</h2>
                <div className="token-id">{token.id}</div>
            </div>

            <div className="inspector-section">
                <h3>{t("sections.morphology")}</h3>
                <div className="data-grid">
                    <div className="data-item">
                        <span className="label">{t("labels.root")}</span>
                        <span className="value arabic-font" lang="ar">{token.root || "\u2014"}</span>
                    </div>
                    <div className="data-item">
                        <span className="label">{t("labels.lemma")}</span>
                        <span className="value arabic-font" lang="ar">{token.lemma || "\u2014"}</span>
                    </div>
                    <div className="data-item">
                        <span className="label">{t("labels.stem")}</span>
                        <span className="value arabic-font" lang="ar">{token.morphology.stem || "\u2014"}</span>
                    </div>
                    <div className="data-item">
                        <span className="label">{t("labels.pos")}</span>
                        <span className="value">{translateFeature("pos", token.pos)}</span>
                    </div>
                </div>
            </div>

            <div className="inspector-section">
                <h3>{t("sections.translation")}</h3>
                <p className="gloss-text">{token.morphology.gloss || t("noGloss")}</p>
            </div>

            {Object.keys(token.morphology.features).length > 0 ? (
                <div className="inspector-section">
                    <h3>{t("sections.features")}</h3>
                    <div className="features-list">
                        {Object.entries(token.morphology.features).map(([key, value]) => (
                            <div key={key} className="feature-tag">
                                <span className="f-key">{translateFeature("keys", key)}</span>
                                <span className="f-val">{translateFeature("values", String(value))}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {rootDistribution ? (
                <div className="inspector-section root-dist-section">
                    <h3>
                        {t("rootDistribution.title")}{" "}
                        <span className="arabic-font" lang="ar" dir="rtl">{rootDistribution.root}</span>
                    </h3>

                    {rootDistribution.gloss ? (
                        <p className="root-dist-gloss">
                            {t("rootDistribution.meaning")}: <em>{rootDistribution.gloss}</em>
                        </p>
                    ) : null}

                    <div className="root-dist-stats">
                        <div className="root-dist-stat">
                            <span className="rds-value">{rootDistribution.totalOccurrences.toLocaleString()}</span>
                            <span className="rds-label">{t("rootDistribution.stats.occurrences")}</span>
                        </div>
                        <div className="root-dist-stat">
                            <span className="rds-value">{rootDistribution.surahCount}</span>
                            <span className="rds-label">{t("rootDistribution.stats.surahs")}</span>
                        </div>
                        <div className="root-dist-stat">
                            <span className="rds-value">{rootDistribution.totalAyahs}</span>
                            <span className="rds-label">{t("rootDistribution.stats.ayahs")}</span>
                        </div>
                        <div className="root-dist-stat">
                            <span className="rds-value">{rootDistribution.lemmas.length}</span>
                            <span className="rds-label">{t("rootDistribution.stats.lemmas")}</span>
                        </div>
                    </div>

                    {rootDistribution.posBreakdown.length > 0 ? (
                        <div className="root-dist-pos">
                            {rootDistribution.posBreakdown.map(([posKey, count]) => (
                                <span key={posKey} className="feature-tag">
                                    <span className="f-key">{translateFeature("pos", posKey)}</span>
                                    <span className="f-val">{count}</span>
                                </span>
                            ))}
                        </div>
                    ) : null}

                    {rootDistribution.forms.length > 0 ? (
                        <div className="root-dist-forms">
                            <span className="rds-label">{t("rootDistribution.formsLabel")}: </span>
                            <span className="arabic-font" lang="ar" dir="rtl">
                                {rootDistribution.forms.join(" · ")}
                            </span>
                        </div>
                    ) : null}

                    {rootDistribution.lemmas.length > 0 ? (
                        <div className="root-dist-forms">
                            <span className="rds-label">{t("rootDistribution.lemmasLabel")}: </span>
                            <span className="arabic-font" lang="ar" dir="rtl">
                                {rootDistribution.lemmas.join(" · ")}
                            </span>
                        </div>
                    ) : null}

                    <div className="root-dist-divider" />

                    <div className="root-dist-list-header">
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontWeight: 600, fontSize: "0.78rem" }}>
                                {t("rootDistribution.surahDistribution")}
                            </span>
                            <select
                                className="inspector-sort-select"
                                data-testid="inspector-root-sort"
                                value={sortBy}
                                onChange={(event) => setSortBy(event.target.value as "occurrence" | "order")}
                                aria-label={t("rootDistribution.sortAria")}
                            >
                                <option value="occurrence">{t("rootDistribution.sortByOccurrence")}</option>
                                <option value="order">{t("rootDistribution.sortByOrder")}</option>
                            </select>
                        </div>
                        <span className="rds-label">{t("rootDistribution.clickToFocus")}</span>
                    </div>

                    <div className="root-dist-list">
                        {rootDistribution.surahDistribution.map((surah) => {
                            const maxCount = rootDistribution.surahDistribution[0]?.count || 1;
                            const barWidth = Math.max(8, (surah.count / maxCount) * 100);
                            return (
                                <div key={surah.suraId} className="root-dist-surah">
                                    <button
                                        type="button"
                                        className="root-dist-surah-btn"
                                        data-testid={`inspector-root-surah-${surah.suraId}`}
                                        onClick={() => {
                                            onSelectSurah?.(surah.suraId, "radial-sura");
                                            onRootSelect?.(rootDistribution.root);
                                        }}
                                    >
                                        <span className="rds-surah-name">{surah.suraId}. {surah.name}</span>
                                        <span className="rds-surah-arabic" lang="ar" dir="rtl">{surah.arabic}</span>
                                        <div className="rds-bar-track">
                                            <div className="rds-bar-fill" style={{ width: `${barWidth}%` }} />
                                        </div>
                                        <span className="rds-surah-count">{surah.count}</span>
                                    </button>
                                    <div className="rds-ayah-list">
                                        {surah.ayahs.slice(0, 8).map((ayah) => (
                                            <span
                                                key={ayah.ayah}
                                                className="rds-ayah-chip"
                                                title={`${surah.suraId}:${ayah.ayah} - ${ayah.forms.join(", ")}`}
                                            >
                                                {surah.suraId}:{ayah.ayah}
                                                {ayah.count > 1 ? <span className="rds-ayah-x">x{ayah.count}</span> : null}
                                            </span>
                                        ))}
                                        {surah.ayahs.length > 8 ? (
                                            <span className="rds-ayah-chip rds-more">+{surah.ayahs.length - 8}</span>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
