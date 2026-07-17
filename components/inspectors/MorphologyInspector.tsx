"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { useKnowledge } from "@/lib/context/KnowledgeContext";
import type { CorpusToken } from "@/lib/schema/types";
import { SURAH_NAMES } from "@/lib/data/surahData";
import { CATEGORY_COLORS } from "@/lib/schema/visualizationTypes";

interface MorphologyInspectorProps {
    token: CorpusToken | null;
    mode: "hover" | "focus" | "idle";
    onClearFocus: () => void;
    allTokens: CorpusToken[];
    onRootSelect?: (root: string | null) => void;
    onSelectSurah?: (surahId: number, preferredView?: "root-network" | "radial-sura") => void;
    /** True while the corpus is still streaming — occurrence numbers are
     *  partial, so the card shows a live "still counting" cue. */
    isCorpusLoading?: boolean;
}

// `colorKey` indexes CATEGORY_COLORS (the data-encoding palette); `posKey`
// is the corpus's short POS code, translated below via the existing
// `featuresMap.pos.*` keys (translateFeature already falls back to the
// raw code if a translation is ever missing) — reusing that map instead of
// adding a parallel "noun"/"verb"/... key set that would drift from it.
const POS_LEGEND_ENTRIES: Array<{ colorKey: keyof typeof CATEGORY_COLORS; posKey: string }> = [
    { colorKey: "noun", posKey: "N" },
    { colorKey: "verb", posKey: "V" },
    { colorKey: "adjective", posKey: "ADJ" },
    { colorKey: "pronoun", posKey: "PRON" },
    { colorKey: "preposition", posKey: "P" },
    { colorKey: "particle", posKey: "PART" },
];

export default function MorphologyInspector({
    token,
    mode,
    onClearFocus,
    allTokens,
    onRootSelect,
    onSelectSurah,
    isCorpusLoading,
}: MorphologyInspectorProps) {
    const t = useTranslations("MorphologyInspector");
    const router = useRouter();
    const { trackRoot, removeRoot, isTracked } = useKnowledge();
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

    const tracked = rootDistribution ? isTracked(rootDistribution.root) : false;

    // One-shot scale pulse when THIS root's tracked state actually flips
    // (not merely when the user hovers/selects a different root that
    // happens to have a different tracked status).
    const [trackPulse, setTrackPulse] = useState(false);
    const prevTrackedRef = useRef<{ root: string; tracked: boolean } | null>(null);
    useEffect(() => {
        const root = rootDistribution?.root ?? null;
        if (!root) {
            prevTrackedRef.current = null;
            return;
        }
        const prev = prevTrackedRef.current;
        prevTrackedRef.current = { root, tracked };
        if (prev && prev.root === root && prev.tracked !== tracked) {
            setTrackPulse(true);
            const timer = setTimeout(() => setTrackPulse(false), 260);
            return () => clearTimeout(timer);
        }
    }, [rootDistribution?.root, tracked]);

    const handleTrackToggle = () => {
        if (!rootDistribution) return;
        // Button state derives straight from context (`tracked` above), so
        // there's nothing to visually roll back on failure — just make sure
        // a rejected promise doesn't surface as an unhandled rejection.
        if (tracked) {
            void removeRoot(rootDistribution.root).catch((error) => {
                console.warn("[MorphologyInspector] removeRoot failed", error);
            });
        } else {
            void trackRoot(rootDistribution.root).catch((error) => {
                console.warn("[MorphologyInspector] trackRoot failed", error);
            });
        }
    };

    const handleQuizRoot = () => {
        if (!rootDistribution) return;
        router.push(`/quiz?root=${encodeURIComponent(rootDistribution.root)}`);
    };

    type SurahDistEntry = {
        suraId: number;
        count: number;
        name: string;
        arabic: string;
        ayahCount: number;
        forms: string[];
        ayahs: { ayah: number; count: number; forms: string[] }[];
    };

    /** Render inline SVG histogram for surah distribution */
    const renderHistogram = (surahDistribution: SurahDistEntry[]) => {
        const capped = surahDistribution.slice(0, 48);
        const maxCount = Math.max(...capped.map((s) => s.count), 1);
        const svgH = 34;
        const barW = 4;
        const gap = 2;
        const totalW = capped.length * (barW + gap) - gap;

        return (
            <svg
                viewBox={`0 0 ${totalW} ${svgH}`}
                width="100%"
                height={svgH}
                preserveAspectRatio="none"
                aria-hidden="true"
                style={{ display: "block" }}
            >
                {capped.map((s, i) => {
                    const v = s.count / maxCount;
                    const barH = Math.max(2, Math.round(v * svgH));
                    const barColor =
                        v > 0.6
                            ? "var(--accent)"
                            : v > 0.3
                              ? "color-mix(in srgb, var(--accent) 55%, transparent)"
                              : "color-mix(in srgb, var(--ink) 22%, transparent)";
                    return (
                        <rect
                            key={s.suraId}
                            x={i * (barW + gap)}
                            y={svgH - barH}
                            width={barW}
                            height={barH}
                            rx={1}
                            fill={barColor}
                        />
                    );
                })}
            </svg>
        );
    };

    /** Render root letters separated by middle dots */
    const formatRootDotted = (root: string): string => {
        return Array.from(root).join(" · ");
    };

    /**
     * Corpus roots write the hamza consonant as plain alif (امن), but external
     * dictionaries index citation orthography (أمن) — plain-alif forms land on
     * empty search pages for hamza-family roots. Inside a corpus root every
     * alif / hamza carrier stands for the hamza consonant (see
     * lib/corpus/rootStatsClient.ts normRootKey), so fold them all to
     * hamza-on-alif for external lookups. Lemmas keep their real orthography.
     */
    const toCitationRoot = (root: string): string => root.replace(/[اأإآٱئؤء]/g, "أ");

    /**
     * Calm external-dictionary lookup badges for a root/lemma value.
     * `word` must be the raw (undotted) corpus string — Almaany takes it
     * as-is in the path, Doha needs it percent-encoded (parity with the
     * legacy CurrentSelectionPanel implementation this restores).
     * Almaany's `c` param preselects the لسان العرب (Lisan al-Arab)
     * classical dictionary, the most relevant source for Quranic roots.
     */
    const renderDictBadges = (word: string) => (
        <span className="mi-dict-badges">
            <a
                href={`https://www.almaany.com/ar/dict/ar-ar/${word}/?c=${encodeURIComponent("لسان العرب")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mi-dict-badge"
                aria-label={t("almaanyAria", { word })}
                title={t("almaanyAria", { word })}
            >
                <span lang="ar" dir="rtl">{"المعاني"}</span>
                <svg className="mi-dict-badge-icon" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
            </a>
            <a
                href={`https://www.dohadictionary.org/dictionary/${encodeURIComponent(word)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mi-dict-badge"
                aria-label={t("dohaAria", { word })}
                title={t("dohaAria", { word })}
            >
                <span lang="ar" dir="rtl">{"معجم الدوحة"}</span>
                <svg className="mi-dict-badge-icon" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
            </a>
        </span>
    );

    if (!token) {
        return (
            <div className="mi-empty">
                <div className="mi-empty-icon">{"↑"}</div>
                <p className="mi-empty-primary">{t("emptyState.hover")}</p>
                <p className="mi-empty-secondary">{t("emptyState.click")}</p>
                <style jsx>{`
                    .mi-empty {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        padding: 40px 16px;
                        gap: 8px;
                        text-align: center;
                    }
                    .mi-empty-icon {
                        font-size: 28px;
                        opacity: 0.3;
                        color: var(--ink);
                        margin-bottom: 8px;
                    }
                    .mi-empty-primary {
                        font-family: 'Space Grotesk', sans-serif;
                        font-size: 13px;
                        color: var(--ink-muted);
                        margin: 0;
                    }
                    .mi-empty-secondary {
                        font-family: 'Space Grotesk', sans-serif;
                        font-size: 12px;
                        color: color-mix(in srgb, var(--ink) 45%, transparent);
                        margin: 0;
                    }
                `}</style>
            </div>
        );
    }

    const posLabel = translateFeature("pos", token.pos);
    const gloss = token.morphology.gloss;

    return (
        <div className="mi-root" aria-live="polite" aria-atomic="true">

            {/* ── Status badge + close ── */}
            <div className="mi-status-row">
                <span className={`mi-badge mi-badge-${mode}`}>
                    {mode === "focus" ? t("status.locked") : t("status.preview")}
                </span>
                {mode === "focus" ? (
                    <button
                        type="button"
                        onClick={onClearFocus}
                        className="mi-close"
                        aria-label={t("clearSelection")}
                        data-testid="inspector-clear-focus"
                    >
                        {"×"}
                    </button>
                ) : null}
            </div>

            {/* ── 1. SELECTED-WORD CARD ──
                 When the corpus has no gloss for this form, the subtitle
                 falls back to data that IS already available (root · POS)
                 instead of an apology — the apology itself moves into the
                 data grid below (small, muted, not the hero line). */}
            <div className="mi-word-card">
                <div className="mi-arabic-word" lang="ar" dir="rtl">{token.text}</div>
                <div className="mi-word-sub">
                    {gloss ? (
                        gloss
                    ) : token.root ? (
                        <>
                            <span lang="ar" dir="rtl">{token.root}</span>
                            {" · "}
                            {posLabel}
                        </>
                    ) : (
                        posLabel
                    )}
                </div>
            </div>

            {/* ── 2. MORPHOLOGY DATA GRID ── */}
            <div className="mi-data-grid">
                <span className="mi-grid-label">{t("labels.root")}</span>
                <span className="mi-grid-value">
                    {token.root ? (
                        <>
                            <span className="mi-root-text" lang="ar" dir="rtl">
                                {formatRootDotted(token.root)}
                            </span>
                            {renderDictBadges(toCitationRoot(token.root))}
                        </>
                    ) : (
                        <span className="mi-faint">{"—"}</span>
                    )}
                </span>

                <span className="mi-grid-label">{t("labels.lemma")}</span>
                <span className="mi-grid-value">
                    {token.lemma ? (
                        <>
                            <span className="mi-lemma-text" lang="ar" dir="rtl">{token.lemma}</span>
                            {renderDictBadges(token.lemma)}
                        </>
                    ) : (
                        <span className="mi-faint">{"—"}</span>
                    )}
                </span>

                <span className="mi-grid-label">{t("labels.pos")}</span>
                <span className="mi-grid-value">
                    <span className="mi-pos-pill">{posLabel}</span>
                </span>

                {gloss ? (
                    <>
                        <span className="mi-grid-label">{t("labels.gloss")}</span>
                        <span className="mi-grid-value mi-gloss-value">{gloss}</span>
                    </>
                ) : (
                    <>
                        <span className="mi-grid-label">{t("labels.gloss")}</span>
                        <span className="mi-grid-value mi-gloss-value mi-gloss-missing">{t("noGloss")}</span>
                    </>
                )}
            </div>

            {/* ── 3. OCCURRENCE CARD ── */}
            {rootDistribution ? (
                <div className="mi-occurrence-card">
                    <div className="mi-occurrence-top">
                        <span className="mi-big-count">{rootDistribution.totalOccurrences.toLocaleString()}</span>
                        <div className="mi-occurrence-labels">
                            <span className="mi-occ-line">
                                {t("rootDistribution.occurrencesOfRoot")}{" "}
                                <span className="mi-occ-root" lang="ar" dir="rtl">{rootDistribution.root}</span>
                            </span>
                            <span className="mi-occ-sub">
                                {t("rootDistribution.acrossSurahs", { count: rootDistribution.surahCount })}
                            </span>
                            {isCorpusLoading && (
                                <span className="mi-occ-counting" role="status">
                                    <span className="mi-occ-counting-dot" aria-hidden="true" />
                                    {t("rootDistribution.stillCounting")}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="mi-histogram">
                        {renderHistogram(rootDistribution.surahDistribution)}
                    </div>
                </div>
            ) : null}

            {/* ── 4. ACTION BUTTONS ──
                 Track toggles between the primary (untracked) and a calmer
                 success-tinted outline (tracked) look; a one-shot CSS pulse
                 marks the moment the state actually flips (see trackPulse
                 above). Quiz always routes to a root-focused quiz session. */}
            {rootDistribution ? (
                <div className="mi-actions">
                    <button
                        type="button"
                        className={`mi-btn-track ${tracked ? "mi-btn-track-tracked" : ""} ${trackPulse ? "mi-btn-track-pulse" : ""}`}
                        onClick={handleTrackToggle}
                        title={tracked ? t("actions.stopTracking") : undefined}
                        aria-label={tracked ? t("actions.stopTracking") : undefined}
                    >
                        <span className="mi-btn-icon" aria-hidden="true">{tracked ? "✓" : "+"}</span>
                        {tracked ? t("actions.tracking") : t("actions.trackRoot")}
                    </button>
                    <button
                        type="button"
                        className="mi-btn-quiz"
                        onClick={handleQuizRoot}
                        aria-label={t("actions.quizRootAria", { root: rootDistribution.root })}
                    >
                        {t("actions.quizRoot")}
                    </button>
                </div>
            ) : null}

            {/* ── SURAH DISTRIBUTION LIST ── */}
            {rootDistribution ? (
                <div className="mi-surah-dist">
                    <div className="mi-surah-dist-header">
                        <span className="mi-section-overline">{t("rootDistribution.surahDistribution")}</span>
                        <select
                            className="mi-sort-select"
                            data-testid="inspector-root-sort"
                            value={sortBy}
                            onChange={(event) => setSortBy(event.target.value as "occurrence" | "order")}
                            aria-label={t("rootDistribution.sortAria")}
                        >
                            <option value="occurrence">{t("rootDistribution.sortByOccurrence")}</option>
                            <option value="order">{t("rootDistribution.sortByOrder")}</option>
                        </select>
                    </div>

                    <div className="mi-surah-list">
                        {rootDistribution.surahDistribution.map((surah) => {
                            const maxCount = rootDistribution.surahDistribution[0]?.count || 1;
                            const barWidth = Math.max(6, (surah.count / maxCount) * 100);
                            return (
                                <div key={surah.suraId} className="mi-surah-item">
                                    <button
                                        type="button"
                                        className="mi-surah-btn"
                                        data-testid={`inspector-root-surah-${surah.suraId}`}
                                        onClick={() => {
                                            onSelectSurah?.(surah.suraId, "radial-sura");
                                            onRootSelect?.(rootDistribution.root);
                                        }}
                                    >
                                        <span className="mi-surah-name">{surah.suraId}. {surah.name}</span>
                                        <span className="mi-surah-arabic" lang="ar" dir="rtl">{surah.arabic}</span>
                                        <div className="mi-bar-track">
                                            <div className="mi-bar-fill" style={{ width: `${barWidth}%` }} />
                                        </div>
                                        <span className="mi-surah-count">{surah.count}</span>
                                    </button>
                                    <div className="mi-ayah-chips">
                                        {surah.ayahs.slice(0, 8).map((ayah) => (
                                            <span
                                                key={ayah.ayah}
                                                className="mi-ayah-chip"
                                                title={`${surah.suraId}:${ayah.ayah} — ${ayah.forms.join(", ")}`}
                                            >
                                                {surah.suraId}:{ayah.ayah}
                                                {ayah.count > 1 ? (
                                                    <span className="mi-ayah-x">x{ayah.count}</span>
                                                ) : null}
                                            </span>
                                        ))}
                                        {surah.ayahs.length > 8 ? (
                                            <span className="mi-ayah-chip mi-ayah-more">
                                                +{surah.ayahs.length - 8}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : null}

            {/* ── 5. POS LEGEND ── */}
            <div className="mi-pos-legend">
                <span className="mi-section-overline mi-legend-heading">{t("posLegendHeading")}</span>
                <div className="mi-legend-grid">
                    {POS_LEGEND_ENTRIES.map(({ colorKey, posKey }) => (
                        <div key={colorKey} className="mi-legend-item">
                            <span
                                className="mi-legend-swatch"
                                style={{ background: CATEGORY_COLORS[colorKey] }}
                                aria-hidden="true"
                            />
                            <span className="mi-legend-label">{translateFeature("pos", posKey)}</span>
                        </div>
                    ))}
                </div>
            </div>

            <style jsx>{`
                /* ── Root container ──
                     Component-scoped custom properties for the couple of
                     accent hues with no direct token equivalent (lavender
                     root/lemma tint, the reddish POS pill) — dark-theme
                     values match the original hardcoded palette; light
                     overrides live in the :global([data-theme="light"])
                     block below. */
                .mi-root {
                    --mi-lemma: #c4bce8;
                    --mi-pos-bg: rgba(221,106,71,0.1);
                    --mi-pos-border: rgba(221,106,71,0.3);
                    --mi-pos-fg: #ec9a80;
                    display: flex;
                    flex-direction: column;
                    gap: 0;
                    color: var(--ink);
                    font-family: 'Space Grotesk', sans-serif;
                }

                :global([data-theme="light"]) .mi-root {
                    --mi-lemma: #6d5fa8;
                    --mi-pos-bg: rgba(180, 60, 30, 0.12);
                    --mi-pos-border: rgba(180, 60, 30, 0.4);
                    --mi-pos-fg: #a8391c;
                }

                /* ── Status row ── */
                .mi-status-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 14px 6px;
                }
                .mi-badge {
                    font-family: 'Space Grotesk', sans-serif;
                    font-size: 10px;
                    font-weight: 600;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    padding: 3px 8px;
                    border-radius: 999px;
                    border: 1px solid var(--panel-border);
                    color: var(--ink-muted);
                }
                .mi-badge-focus {
                    border-color: color-mix(in srgb, var(--accent) 40%, transparent);
                    color: var(--accent);
                }
                .mi-close {
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: color-mix(in srgb, var(--ink) 45%, transparent);
                    font-size: 18px;
                    line-height: 1;
                    padding: 0 4px;
                    border-radius: 4px;
                    transition: color 0.15s;
                }
                .mi-close:hover {
                    color: var(--ink);
                }

                /* ── 1. Selected-word card ── */
                .mi-word-card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    padding: 20px 16px 16px;
                    text-align: center;
                }
                .mi-arabic-word {
                    font-family: 'Amiri', 'Traditional Arabic', serif;
                    font-size: 44px;
                    line-height: 1.15;
                    color: var(--ink);
                    direction: rtl;
                }
                .mi-word-sub {
                    font-family: 'Space Grotesk', sans-serif;
                    font-size: 13px;
                    color: var(--ink-muted);
                    letter-spacing: 0.01em;
                }

                /* ── 2. Data grid ── */
                .mi-data-grid {
                    display: grid;
                    grid-template-columns: auto 1fr;
                    gap: 10px 16px;
                    padding: 14px 16px;
                    border-top: 1px solid var(--panel-border);
                    align-items: center;
                }
                .mi-grid-label {
                    font-family: 'Space Grotesk', sans-serif;
                    font-size: 10px;
                    font-weight: 600;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    color: color-mix(in srgb, var(--ink) 45%, transparent);
                    white-space: nowrap;
                }
                .mi-grid-value {
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 6px 8px;
                }
                .mi-root-text {
                    font-family: 'Amiri', 'Traditional Arabic', serif;
                    font-size: 20px;
                    color: var(--mi-lemma);
                    letter-spacing: 0.05em;
                    direction: rtl;
                }
                .mi-lemma-text {
                    font-family: 'Amiri', 'Traditional Arabic', serif;
                    font-size: 18px;
                    color: var(--ink);
                    direction: rtl;
                }

                /* ── Dictionary lookup badges (root/lemma rows) ──
                     Quiet by default so they don't compete with the
                     Arabic value; brighten to accent only on hover/focus.
                     :global() is required here — these elements are built
                     by the renderDictBadges() helper above rather than
                     written inline in this component's JSX return, and
                     styled-jsx only auto-scopes JSX literally inside the
                     return tree; unscoped rules would otherwise silently
                     no-op and fall back to the browser's default link style. */
                :global(.mi-dict-badges) {
                    display: inline-flex;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 4px;
                }
                :global(.mi-dict-badge) {
                    display: inline-flex;
                    align-items: center;
                    gap: 3px;
                    padding: 2px 7px;
                    border-radius: 999px;
                    border: 1px solid var(--line);
                    color: var(--ink-muted);
                    font-family: 'Amiri', 'Traditional Arabic', serif;
                    font-size: 10.5px;
                    line-height: 1.4;
                    text-decoration: none;
                    white-space: nowrap;
                    transition: color 0.2s ease, border-color 0.2s ease;
                }
                :global(.mi-dict-badge:hover),
                :global(.mi-dict-badge:focus-visible) {
                    color: var(--accent);
                    border-color: color-mix(in srgb, var(--accent) 40%, transparent);
                }
                :global(.mi-dict-badge:focus-visible) {
                    outline: 2px solid var(--accent);
                    outline-offset: 1px;
                }
                :global(.mi-dict-badge-icon) {
                    opacity: 0.55;
                    flex-shrink: 0;
                    transition: opacity 0.2s ease;
                }
                :global(.mi-dict-badge:hover .mi-dict-badge-icon),
                :global(.mi-dict-badge:focus-visible .mi-dict-badge-icon) {
                    opacity: 0.9;
                }

                .mi-pos-pill {
                    display: inline-flex;
                    align-items: center;
                    border-radius: 999px;
                    padding: 4px 11px;
                    background: var(--mi-pos-bg);
                    border: 1px solid var(--mi-pos-border);
                    color: var(--mi-pos-fg);
                    font-family: 'Space Grotesk', sans-serif;
                    font-size: 12px;
                    font-weight: 500;
                    white-space: nowrap;
                }
                .mi-gloss-value {
                    font-family: 'Space Grotesk', sans-serif;
                    font-size: 14px;
                    color: var(--ink-secondary);
                }
                .mi-gloss-missing {
                    color: color-mix(in srgb, var(--ink) 40%, transparent);
                    font-size: 12px;
                    font-style: italic;
                }
                .mi-faint {
                    color: color-mix(in srgb, var(--ink) 35%, transparent);
                }

                /* ── 3. Occurrence card ── */
                .mi-occurrence-card {
                    margin: 0 12px 4px;
                    background: var(--panel);
                    border: 1px solid var(--panel-border);
                    border-radius: 14px;
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .mi-occurrence-top {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                }
                .mi-big-count {
                    font-family: 'Fraunces', 'Georgia', serif;
                    font-weight: 300;
                    font-size: 38px;
                    line-height: 1;
                    color: var(--ink);
                    flex-shrink: 0;
                }
                .mi-occurrence-labels {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    padding-top: 4px;
                }
                .mi-occ-line {
                    font-family: 'Space Grotesk', sans-serif;
                    font-size: 13px;
                    color: var(--ink-muted);
                }
                .mi-occ-root {
                    font-family: 'Amiri', 'Traditional Arabic', serif;
                    font-size: 15px;
                    color: var(--mi-lemma);
                    direction: rtl;
                    margin-right: 2px;
                }
                .mi-occ-sub {
                    font-family: 'Space Grotesk', sans-serif;
                    font-size: 12px;
                    color: var(--ink-muted);
                }
                .mi-occ-counting {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    margin-top: 2px;
                    font-family: 'Space Grotesk', sans-serif;
                    font-size: 11px;
                    color: var(--accent);
                }
                .mi-occ-counting-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: var(--accent);
                    animation: miCountPulse 1.2s ease-in-out infinite;
                }
                @keyframes miCountPulse {
                    0%, 100% { opacity: 0.35; }
                    50% { opacity: 1; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .mi-occ-counting-dot { animation: none; }
                }
                .mi-histogram {
                    width: 100%;
                }

                /* ── 4. Action buttons ── */
                .mi-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    padding: 12px 12px 4px;
                }
                .mi-btn-track {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    height: 46px;
                    border-radius: 12px;
                    background: var(--accent);
                    color: var(--accent-ink);
                    border: none;
                    cursor: pointer;
                    font-family: 'Space Grotesk', sans-serif;
                    font-size: 14px;
                    font-weight: 600;
                    transition: opacity 0.15s, transform 0.1s;
                }
                .mi-btn-track:hover {
                    opacity: 0.9;
                    transform: translateY(-1px);
                }
                .mi-btn-track:active {
                    transform: translateY(0);
                }
                .mi-btn-icon {
                    font-size: 18px;
                    line-height: 1;
                    font-weight: 400;
                }
                /* Tracked state — calmer success-tinted outline, replacing
                   the primary orange fill. Uses the app's theme tokens
                   (not the hardcoded dark palette above) so it stays
                   correct if this panel is ever made theme-aware. */
                .mi-btn-track-tracked {
                    background: var(--ui-success-bg);
                    color: var(--ui-success-fg);
                    border: 1px solid color-mix(in srgb, var(--ui-success-fg) 35%, transparent);
                }
                @keyframes mi-track-pulse {
                    0% { transform: scale(1); }
                    45% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }
                .mi-btn-track-pulse {
                    animation: mi-track-pulse 0.24s ease-out;
                }
                .mi-btn-quiz {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 46px;
                    border-radius: 12px;
                    background: transparent;
                    border: 1px solid var(--line);
                    color: var(--ink);
                    cursor: pointer;
                    font-family: 'Space Grotesk', sans-serif;
                    font-size: 14px;
                    font-weight: 500;
                    transition: border-color 0.15s, background 0.15s;
                }
                .mi-btn-quiz:hover {
                    border-color: color-mix(in srgb, var(--ink) 30%, transparent);
                    background: color-mix(in srgb, var(--ink) 4%, transparent);
                }

                /* ── Surah distribution ── */
                .mi-surah-dist {
                    padding: 12px 12px 4px;
                }
                .mi-surah-dist-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 10px;
                }
                .mi-section-overline {
                    font-family: 'Space Grotesk', sans-serif;
                    font-size: 10px;
                    font-weight: 600;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    color: color-mix(in srgb, var(--ink) 45%, transparent);
                }
                .mi-sort-select {
                    background: var(--panel);
                    border: 1px solid var(--panel-border);
                    color: var(--ink-secondary);
                    font-family: 'Space Grotesk', sans-serif;
                    font-size: 11px;
                    border-radius: 6px;
                    padding: 3px 6px;
                    cursor: pointer;
                    outline: none;
                }
                .mi-sort-select:focus {
                    border-color: var(--accent-glow);
                }
                .mi-surah-list {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .mi-surah-item {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .mi-surah-btn {
                    display: grid;
                    grid-template-columns: 1fr auto auto auto;
                    align-items: center;
                    gap: 8px;
                    width: 100%;
                    background: color-mix(in srgb, var(--ink) 3%, transparent);
                    border: 1px solid var(--line);
                    border-radius: 8px;
                    padding: 7px 10px;
                    cursor: pointer;
                    text-align: left;
                    transition: background 0.15s, border-color 0.15s;
                }
                .mi-surah-btn:hover {
                    background: color-mix(in srgb, var(--accent) 8%, transparent);
                    border-color: color-mix(in srgb, var(--accent) 20%, transparent);
                }
                .mi-surah-name {
                    font-family: 'Space Grotesk', sans-serif;
                    font-size: 12px;
                    color: var(--ink-secondary);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .mi-surah-arabic {
                    font-family: 'Amiri', 'Traditional Arabic', serif;
                    font-size: 14px;
                    color: color-mix(in srgb, var(--mi-lemma) 80%, transparent);
                    direction: rtl;
                    flex-shrink: 0;
                }
                .mi-bar-track {
                    width: 48px;
                    height: 4px;
                    background: var(--line);
                    border-radius: 2px;
                    overflow: hidden;
                    flex-shrink: 0;
                }
                .mi-bar-fill {
                    height: 100%;
                    background: var(--accent);
                    border-radius: 2px;
                    transition: width 0.3s ease;
                }
                .mi-surah-count {
                    font-family: 'Space Grotesk', sans-serif;
                    font-size: 11px;
                    font-weight: 600;
                    color: color-mix(in srgb, var(--accent) 90%, transparent);
                    min-width: 20px;
                    text-align: right;
                    flex-shrink: 0;
                }
                .mi-ayah-chips {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px;
                    padding: 0 2px;
                }
                .mi-ayah-chip {
                    font-family: 'Space Grotesk', sans-serif;
                    font-size: 10px;
                    color: var(--ink-muted);
                    background: color-mix(in srgb, var(--line) 60%, transparent);
                    border-radius: 4px;
                    padding: 2px 5px;
                    white-space: nowrap;
                }
                .mi-ayah-x {
                    color: color-mix(in srgb, var(--accent) 70%, transparent);
                    margin-left: 2px;
                }
                .mi-ayah-more {
                    color: color-mix(in srgb, var(--ink) 35%, transparent);
                    font-style: italic;
                }

                /* ── 5. POS Legend ── */
                .mi-pos-legend {
                    padding: 14px 12px 16px;
                    border-top: 1px solid var(--panel-border);
                    margin-top: 8px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .mi-legend-heading {
                    display: block;
                }
                .mi-legend-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 7px 12px;
                }
                .mi-legend-item {
                    display: flex;
                    align-items: center;
                    gap: 7px;
                }
                .mi-legend-swatch {
                    width: 10px;
                    height: 10px;
                    border-radius: 3px;
                    flex-shrink: 0;
                }
                .mi-legend-label {
                    font-family: 'Space Grotesk', sans-serif;
                    font-size: 11px;
                    color: var(--ink-muted);
                }
            `}</style>
        </div>
    );
}
