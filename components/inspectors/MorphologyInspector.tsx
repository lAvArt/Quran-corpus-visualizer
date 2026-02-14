"use client";

import { useMemo } from "react";
import type { CorpusToken } from "@/lib/schema/types";
import { SURAH_NAMES } from "@/lib/data/surahData";
import { useTranslations } from "next-intl";

interface MorphologyInspectorProps {
    token: CorpusToken | null;
    mode: "hover" | "focus" | "idle";
    onClearFocus: () => void;
    allTokens: CorpusToken[];
    onRootSelect?: (root: string | null) => void;
    onSelectSurah?: (surahId: number) => void;
}

export default function MorphologyInspector({ token, mode, onClearFocus, allTokens, onRootSelect, onSelectSurah }: MorphologyInspectorProps) {
    const t = useTranslations('MorphologyInspector');

    // Compute root distribution when a token with a root is shown
    const rootDistribution = useMemo(() => {
        if (!token?.root) return null;
        const rootStr = token.root;

        const matchingTokens = allTokens.filter(tk => tk.root === rootStr);
        if (matchingTokens.length === 0) return null;

        // Surah → Ayah → tokens aggregation
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
                        forms: ad.tokens.map(tk => tk.text).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3),
                    }))
                    .sort((a, b) => a.ayah - b.ayah),
            }))
            .sort((a, b) => b.count - a.count);

        return {
            root: rootStr,
            totalOccurrences: matchingTokens.length,
            surahCount: surahMap.size,
            totalAyahs: surahDistribution.reduce((acc, s) => acc + s.ayahCount, 0),
            gloss,
            forms: Array.from(allForms).slice(0, 10),
            lemmas: Array.from(allLemmas),
            posBreakdown: Array.from(posBreakdown.entries()).sort((a, b) => b[1] - a[1]),
            surahDistribution,
        };
    }, [token?.root, allTokens]);

    if (!token) {
        return (
            <div className="inspector-empty-state">
                <div className="empty-icon">{"\u2191"}</div>
                <p>{t('emptyState.hover')}</p>
                <p>{t('emptyState.click')}</p>

                <style jsx>{`
        .inspector-empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            text-align: center;
            color: var(--ink-muted);
            padding: 2rem 1rem;
        }
        .empty-icon {
            font-size: 2rem;
            margin-bottom: 1rem;
            opacity: 0.6;
        }
        `}</style>
            </div>
        );
    }

    return (
        <div className="inspector-content">
            <div className="inspector-header">
                <div className="header-top">
                    <span className={`status-badge ${mode}`}>
                        {mode === "focus" ? t('status.locked') : t('status.preview')}
                    </span>
                    {mode === "focus" && (
                        <button type="button" onClick={onClearFocus} className="close-btn" aria-label={t('clearSelection')}>{"\u00D7"}</button>
                    )}
                </div>

                <h2 className="token-arabic" lang="ar" dir="rtl">{token.text}</h2>
                <div className="token-id">{token.id}</div>
            </div>

            <div className="inspector-section">
                <h3>{t('sections.morphology')}</h3>
                <div className="data-grid">
                    <div className="data-item">
                        <span className="label">{t('labels.root')}</span>
                        <span className="value arabic-font" lang="ar">{token.root || "\u2014"}</span>
                    </div>
                    <div className="data-item">
                        <span className="label">{t('labels.lemma')}</span>
                        <span className="value arabic-font" lang="ar">{token.lemma || "\u2014"}</span>
                    </div>
                    <div className="data-item">
                        <span className="label">{t('labels.stem')}</span>
                        <span className="value arabic-font" lang="ar">{token.morphology.stem || "\u2014"}</span>
                    </div>
                    <div className="data-item">
                        <span className="label">{t('labels.pos')}</span>
                        <span className="value">{token.pos}</span>
                    </div>
                </div>
            </div>

            <div className="inspector-section">
                <h3>{t('sections.translation')}</h3>
                <p className="gloss-text">{token.morphology.gloss || t('noGloss')}</p>
            </div>

            {Object.keys(token.morphology.features).length > 0 && (
                <div className="inspector-section">
                    <h3>{t('sections.features')}</h3>
                    <div className="features-list">
                        {Object.entries(token.morphology.features).map(([key, value]) => (
                            <div key={key} className="feature-tag">
                                <span className="f-key">{key}</span>
                                <span className="f-val">{value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Root Distribution Panel */}
            {rootDistribution && (
                <div className="inspector-section root-dist-section">
                    <h3>Root Analysis — <span className="arabic-font" lang="ar" dir="rtl">{rootDistribution.root}</span></h3>

                    {rootDistribution.gloss && (
                        <p className="root-dist-gloss">Meaning: <em>{rootDistribution.gloss}</em></p>
                    )}

                    <div className="root-dist-stats">
                        <div className="root-dist-stat">
                            <span className="rds-value">{rootDistribution.totalOccurrences.toLocaleString()}</span>
                            <span className="rds-label">Occurrences</span>
                        </div>
                        <div className="root-dist-stat">
                            <span className="rds-value">{rootDistribution.surahCount}</span>
                            <span className="rds-label">Surahs</span>
                        </div>
                        <div className="root-dist-stat">
                            <span className="rds-value">{rootDistribution.totalAyahs}</span>
                            <span className="rds-label">Ayahs</span>
                        </div>
                        <div className="root-dist-stat">
                            <span className="rds-value">{rootDistribution.lemmas.length}</span>
                            <span className="rds-label">Lemmas</span>
                        </div>
                    </div>

                    {rootDistribution.posBreakdown.length > 0 && (
                        <div className="root-dist-pos">
                            {rootDistribution.posBreakdown.map(([posKey, count]) => (
                                <span key={posKey} className="feature-tag">
                                    <span className="f-key">{posKey}</span>
                                    <span className="f-val">{count}</span>
                                </span>
                            ))}
                        </div>
                    )}

                    {rootDistribution.forms.length > 0 && (
                        <div className="root-dist-forms">
                            <span className="rds-label">Forms: </span>
                            <span className="arabic-font" lang="ar" dir="rtl">
                                {rootDistribution.forms.join(" · ")}
                            </span>
                        </div>
                    )}

                    {rootDistribution.lemmas.length > 0 && (
                        <div className="root-dist-forms">
                            <span className="rds-label">Lemmas: </span>
                            <span className="arabic-font" lang="ar" dir="rtl">
                                {rootDistribution.lemmas.join(" · ")}
                            </span>
                        </div>
                    )}

                    <div className="root-dist-divider" />

                    <div className="root-dist-list-header">
                        <span style={{ fontWeight: 600, fontSize: '0.78rem' }}>Surah Distribution</span>
                        <span className="rds-label">Click to focus</span>
                    </div>

                    <div className="root-dist-list">
                        {rootDistribution.surahDistribution.map((s) => {
                            const maxCount = rootDistribution.surahDistribution[0]?.count || 1;
                            const barWidth = Math.max(8, (s.count / maxCount) * 100);
                            return (
                                <div key={s.suraId} className="root-dist-surah">
                                    <button
                                        type="button"
                                        className="root-dist-surah-btn"
                                        onClick={() => {
                                            if (onSelectSurah) onSelectSurah(s.suraId);
                                            if (onRootSelect) onRootSelect(rootDistribution.root);
                                        }}
                                    >
                                        <span className="rds-surah-name">{s.suraId}. {s.name}</span>
                                        <span className="rds-surah-arabic" lang="ar" dir="rtl">{s.arabic}</span>
                                        <div className="rds-bar-track">
                                            <div className="rds-bar-fill" style={{ width: `${barWidth}%` }} />
                                        </div>
                                        <span className="rds-surah-count">{s.count}</span>
                                    </button>
                                    <div className="rds-ayah-list">
                                        {s.ayahs.slice(0, 8).map((a) => (
                                            <span key={a.ayah} className="rds-ayah-chip" title={`${s.suraId}:${a.ayah} — ${a.forms.join(', ')}`}>
                                                {s.suraId}:{a.ayah}
                                                {a.count > 1 && <span className="rds-ayah-x">×{a.count}</span>}
                                            </span>
                                        ))}
                                        {s.ayahs.length > 8 && (
                                            <span className="rds-ayah-chip rds-more">+{s.ayahs.length - 8}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <style jsx>{`
        .inspector-content {
            animation: fadeIn 0.2s ease;
        }

        .inspector-header {
            border-bottom: 1px solid var(--line);
            padding-bottom: 1rem;
            margin-bottom: 1rem;
        }

        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.75rem;
        }

        .status-badge {
            font-size: 0.65rem;
            padding: 4px 10px;
            border-radius: 999px;
            font-weight: 600;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            background: rgba(15, 118, 110, 0.12);
            color: var(--accent);
        }

        .status-badge.focus {
            background: var(--accent);
            color: white;
        }

        .status-badge.hover {
            background: rgba(15, 118, 110, 0.12);
            color: var(--accent);
        }

        .close-btn {
            background: var(--bg-2);
            border: 1px solid var(--line);
            width: 28px;
            height: 28px;
            border-radius: 999px;
            font-size: 1.1rem;
            line-height: 1;
            cursor: pointer;
            color: var(--ink);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        }

        .close-btn:hover {
            color: white;
            background: var(--accent);
            border-color: var(--accent);
        }

        .token-arabic {
            font-size: 2.4rem;
            margin: 0.3rem 0 0.4rem;
            line-height: 1.2;
            color: var(--ink);
            font-family: var(--font-arabic, "Amiri"), "Amiri", "Noto Sans Arabic", serif;
        }

        .token-id {
            font-family: "SFMono-Regular", Menlo, Consolas, monospace;
            color: var(--ink-muted);
            font-size: 0.78rem;
        }

        .inspector-section {
            margin-bottom: 1rem;
            padding: 12px;
            border-radius: 12px;
            border: 1px solid var(--line);
            background: rgba(255, 255, 255, 0.6);
        }

        .inspector-section h3 {
            font-size: 0.78rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--ink-muted);
            margin: 0 0 0.8rem 0;
        }

        .data-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
        }

        .data-item {
            background: var(--bg-2);
            border-radius: 10px;
            padding: 8px 10px;
            display: flex;
            flex-direction: column;
            border: 1px solid var(--line);
        }

        .data-item .label {
            font-size: 0.7rem;
            color: var(--ink-muted);
            margin-bottom: 4px;
        }

        .data-item .value {
            font-weight: 600;
            font-size: 1rem;
        }

        .arabic-font {
            font-family: var(--font-arabic, "Amiri"), "Amiri", "Noto Sans Arabic", serif;
            direction: rtl;
        }

        .gloss-text {
            font-style: italic;
            color: var(--ink-secondary);
            margin: 0;
            line-height: 1.4;
        }

        .features-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .feature-tag {
            display: inline-flex;
            gap: 6px;
            border: 1px solid var(--line);
            border-radius: 999px;
            padding: 4px 10px;
            font-size: 0.78rem;
            background: rgba(255, 255, 255, 0.7);
        }

        .f-key {
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-size: 0.65rem;
            color: var(--ink-secondary);
        }

        .f-val {
            font-weight: 600;
        }

        @media (max-width: 520px) {
            .data-grid {
                grid-template-columns: 1fr;
            }
        }

        :global([data-theme="dark"]) .inspector-section {
            background: rgba(16, 16, 24, 0.7);
        }

        :global([data-theme="dark"]) .feature-tag {
            background: rgba(16, 16, 24, 0.7);
        }

        /* ── Root Distribution Panel ── */
        .root-dist-section {
            border-color: var(--accent);
            border-width: 1px 1px 1px 3px;
        }

        .root-dist-gloss {
            margin: 0 0 0.6rem;
            font-size: 0.82rem;
            color: var(--ink-secondary);
        }

        .root-dist-stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 6px;
            margin-bottom: 0.6rem;
        }

        .root-dist-stat {
            text-align: center;
            padding: 6px 4px;
            border: 1px solid var(--line);
            border-radius: 8px;
            background: var(--bg-2);
        }

        .rds-value {
            display: block;
            font-size: 1.1rem;
            font-weight: 700;
            color: var(--ink);
        }

        .rds-label {
            font-size: 0.65rem;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--ink-muted);
        }

        .root-dist-pos {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-bottom: 0.5rem;
        }

        .root-dist-forms {
            font-size: 0.82rem;
            margin-bottom: 0.4rem;
            line-height: 1.5;
        }

        .root-dist-divider {
            height: 1px;
            background: var(--line);
            margin: 0.6rem 0;
        }

        .root-dist-list-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
        }

        .root-dist-list {
            display: flex;
            flex-direction: column;
            gap: 2px;
            max-height: 350px;
            overflow-y: auto;
        }

        .root-dist-surah {
            border-bottom: 1px solid rgba(128,128,128,0.1);
        }

        .root-dist-surah-btn {
            width: 100%;
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto auto auto;
            gap: 6px;
            align-items: center;
            padding: 6px 4px;
            background: none;
            border: none;
            cursor: pointer;
            font-family: inherit;
            color: var(--ink);
            border-radius: 6px;
            transition: background 0.15s;
        }

        .root-dist-surah-btn:hover {
            background: rgba(128, 128, 128, 0.1);
        }

        .rds-surah-name {
            font-size: 0.78rem;
            text-align: start;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .rds-surah-arabic {
            font-family: var(--font-arabic, "Amiri"), "Amiri", "Noto Sans Arabic", serif;
            font-size: 0.78rem;
            color: var(--ink-secondary);
        }

        .rds-bar-track {
            width: 48px;
            height: 4px;
            background: rgba(128, 128, 128, 0.15);
            border-radius: 2px;
            overflow: hidden;
        }

        .rds-bar-fill {
            height: 100%;
            background: var(--accent);
            border-radius: 2px;
            transition: width 0.3s;
        }

        .rds-surah-count {
            font-size: 0.72rem;
            font-weight: 700;
            color: var(--accent);
            min-width: 24px;
            text-align: end;
        }

        .rds-ayah-list {
            display: flex;
            flex-wrap: wrap;
            gap: 3px;
            padding: 0 4px 6px 16px;
        }

        .rds-ayah-chip {
            font-size: 0.62rem;
            padding: 1px 6px;
            border-radius: 4px;
            background: rgba(128, 128, 128, 0.1);
            color: var(--ink-secondary);
            white-space: nowrap;
            cursor: default;
        }

        .rds-ayah-chip:hover {
            background: rgba(128, 128, 128, 0.2);
        }

        .rds-ayah-x {
            font-weight: 600;
            color: var(--accent);
            margin-left: 2px;
        }

        .rds-more {
            color: var(--ink-muted);
            font-style: italic;
        }
      `}</style>
        </div>
    );
}
