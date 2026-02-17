"use client";

import { useMemo, useState } from "react";
import type { CorpusToken, PartOfSpeech } from "@/lib/schema/types";
import { buildPhaseOneIndexes, queryPhaseOne } from "@/lib/search/indexes";
import { SURAH_NAMES } from "@/lib/data/surahData";
import { useTranslations } from "next-intl";
import { useDebounce } from "@/lib/hooks/useDebounce";

interface SemanticSearchPanelProps {
  tokens: CorpusToken[];
  onTokenHover: (tokenId: string | null) => void;
  onTokenFocus: (tokenId: string) => void;
  onRootSelect?: (root: string | null) => void;
  onSelectSurah?: (surahId: number) => void;
  scope?: { type: "global" } | { type: "surah"; surahId: number };
}

export default function SemanticSearchPanel({
  tokens,
  onTokenHover,
  onTokenFocus,
  onRootSelect,
  onSelectSurah,
  scope = { type: "global" },
}: SemanticSearchPanelProps) {
  const [root, setRoot] = useState("");
  const [lemma, setLemma] = useState("");
  const [pos, setPos] = useState<PartOfSpeech | "">("");
  const [ayah, setAyah] = useState("");
  const t = useTranslations('SemanticSearchPanel');

  const debouncedRoot = useDebounce(root, 250);
  const debouncedLemma = useDebounce(lemma, 250);
  const debouncedAyah = useDebounce(ayah, 250);

  const scopedTokens = useMemo(() => {
    if (scope.type === "surah") {
      return tokens.filter((token) => token.sura === scope.surahId);
    }
    return tokens;
  }, [tokens, scope]);

  const tokenById = useMemo(
    () => new Map(scopedTokens.map((t) => [t.id, t])),
    [scopedTokens]
  );
  const index = useMemo(() => buildPhaseOneIndexes(scopedTokens), [scopedTokens]);

  const normalizedAyahQuery = useMemo(() => {
    if (!debouncedAyah) return "";
    if (scope.type === "surah" && !debouncedAyah.includes(":")) {
      return `${scope.surahId}:${debouncedAyah}`;
    }
    return debouncedAyah;
  }, [debouncedAyah, scope]);

  const results = useMemo(() => {
    const ids = queryPhaseOne(index, {
      root: debouncedRoot || undefined,
      lemma: debouncedLemma || undefined,
      pos: pos || undefined,
      ayah: normalizedAyahQuery || undefined
    });
    return [...ids].map((id) => tokenById.get(id)).filter((token): token is CorpusToken => !!token);
  }, [index, debouncedLemma, pos, debouncedRoot, tokenById, normalizedAyahQuery]);

  const scopeLabel = useMemo(() => {
    if (scope.type === "surah") {
      return t('surah', { id: scope.surahId });
    }
    return t('global');
  }, [scope, t]);

  // Root info: when searching by root, compute aggregated stats
  const rootInfo = useMemo(() => {
    if (!debouncedRoot.trim()) return null;

    // Find all tokens with this exact root across the entire corpus
    const matchingTokens = tokens.filter(tk => tk.root === debouncedRoot.trim());
    if (matchingTokens.length === 0) return null;

    // Surah distribution
    const surahMap = new Map<number, { count: number; forms: Set<string> }>();
    const allForms = new Set<string>();
    const allLemmas = new Set<string>();
    const posBreakdown = new Map<string, number>();
    let gloss = "";

    for (const tk of matchingTokens) {
      allForms.add(tk.text);
      if (tk.lemma) allLemmas.add(tk.lemma);
      if (tk.morphology?.gloss && !gloss) gloss = tk.morphology.gloss;

      // POS
      posBreakdown.set(tk.pos, (posBreakdown.get(tk.pos) || 0) + 1);

      // Per-surah
      if (!surahMap.has(tk.sura)) {
        surahMap.set(tk.sura, { count: 0, forms: new Set() });
      }
      const entry = surahMap.get(tk.sura)!;
      entry.count++;
      entry.forms.add(tk.text);
    }

    const surahDistribution = Array.from(surahMap.entries())
      .map(([suraId, data]) => ({
        suraId,
        name: SURAH_NAMES[suraId]?.name || `Surah ${suraId}`,
        arabic: SURAH_NAMES[suraId]?.arabic || "",
        count: data.count,
        forms: Array.from(data.forms).slice(0, 3),
      }))
      .sort((a, b) => b.count - a.count);

    return {
      root: root.trim(),
      totalOccurrences: matchingTokens.length,
      surahCount: surahMap.size,
      gloss,
      forms: Array.from(allForms).slice(0, 8),
      lemmas: Array.from(allLemmas).slice(0, 5),
      posBreakdown: Array.from(posBreakdown.entries()).sort((a, b) => b[1] - a[1]),
      surahDistribution,
    };
  }, [root, tokens]);

  // Whether we're in "root search mode" (show distribution) vs token list mode
  const isRootSearch = !!root.trim() && !!rootInfo;

  return (
    <div className="search-panel">
      {/* 
      <div className="panel-head">
        <div>
          <p className="eyebrow">Phase-1 Search</p>
          <h2>SemanticSearchPanel</h2>
        </div>
      </div> 
      Removed since Sidebar has tabs
      */}

      <div className="search-controls">
        <input
          value={root}
          onChange={(e) => setRoot(e.target.value)}
          placeholder={t('placeholders.root')}
          className="search-input"
        />
        <input
          value={lemma}
          onChange={(e) => setLemma(e.target.value)}
          placeholder={t('placeholders.lemma')}
          className="search-input"
        />
        <select
          value={pos}
          onChange={(e) => setPos(e.target.value as PartOfSpeech | "")}
          className="search-select"
        >
          <option value="">{t('pos.all')}</option>
          <option value="N">{t('pos.noun')}</option>
          <option value="V">{t('pos.verb')}</option>
          <option value="P">{t('pos.particle')}</option>
          <option value="ADJ">{t('pos.adjective')}</option>
          <option value="PRON">{t('pos.pronoun')}</option>
        </select>
        <input
          value={ayah}
          onChange={(e) => setAyah(e.target.value)}
          placeholder={t('placeholders.ayah')}
          className="search-input"
        />
      </div>

      <div className="results-scope">
        <span>{t('scope')}</span>
        <span className="scope-pill">{scopeLabel}</span>
      </div>

      <div className="results-header">
        <span>{t('found', { count: results.length })}</span>
        <span className="results-sub">{t('clickToFocus')}</span>
      </div>

      {/* Root Info Card — when searching by root, show aggregated stats */}
      {isRootSearch && rootInfo && (
        <div className="root-info-card">
          <div className="root-info-header">
            <span className="root-info-arabic" lang="ar" dir="rtl">{rootInfo.root}</span>
            <span className="root-info-total">{t('rootInfo.occurrences', { count: rootInfo.totalOccurrences.toLocaleString() })}</span>
          </div>

          {rootInfo.gloss && (
            <div className="root-info-gloss">{t('rootInfo.meaning')}: {rootInfo.gloss}</div>
          )}

          <div className="root-info-stats">
            <div className="root-stat">
              <span className="root-stat-value">{rootInfo.surahCount}</span>
              <span className="root-stat-label">{t('rootInfo.stats.surahs')}</span>
            </div>
            <div className="root-stat">
              <span className="root-stat-value">{rootInfo.lemmas.length}</span>
              <span className="root-stat-label">{t('rootInfo.stats.lemmas')}</span>
            </div>
            <div className="root-stat">
              <span className="root-stat-value">{rootInfo.forms.length}+</span>
              <span className="root-stat-label">{t('rootInfo.stats.forms')}</span>
            </div>
          </div>

          {rootInfo.posBreakdown.length > 0 && (
            <div className="root-info-pos">
              {rootInfo.posBreakdown.map(([posKey, count]) => (
                <span key={posKey} className="pos-chip">{posKey} ({count})</span>
              ))}
            </div>
          )}

          {rootInfo.forms.length > 0 && (
            <div className="root-info-forms">
              <span className="root-forms-label">{t('rootInfo.formsLabel')}:</span>
              <span className="root-forms-list" lang="ar" dir="rtl">
                {rootInfo.forms.join(" · ")}
              </span>
            </div>
          )}

          <div className="root-info-divider" />

          <div className="surah-dist-header">
            <span>{t('rootInfo.surahDistribution')}</span>
            <span className="results-sub">{t('rootInfo.clickToFocusSurah')}</span>
          </div>

          <div className="surah-dist-list">
            {rootInfo.surahDistribution.map((s) => {
              const maxCount = rootInfo.surahDistribution[0]?.count || 1;
              const barWidth = Math.max(8, (s.count / maxCount) * 100);
              return (
                <button
                  key={s.suraId}
                  type="button"
                  className="surah-dist-item"
                  onClick={() => {
                    if (onSelectSurah) onSelectSurah(s.suraId);
                    if (onRootSelect) onRootSelect(root.trim());
                  }}
                >
                  <span className="surah-dist-name">{s.suraId}. {s.name}</span>
                  <span className="surah-dist-arabic" lang="ar" dir="rtl">{s.arabic}</span>
                  <div className="surah-dist-bar-container">
                    <div className="surah-dist-bar" style={{ width: `${barWidth}%` }} />
                  </div>
                  <span className="surah-dist-count">{s.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Token list — show when NOT in root-only mode, or as secondary view */}
      {(!isRootSearch || lemma || pos || ayah) && (
      <div className="search-results-list">
        {results.length === 0 ? (
          <div className="empty-search">
            <p>{t('empty')}</p>
          </div>
        ) : (
          results.slice(0, 50).map((token) => (
            <button
              type="button"
              key={token.id}
              className="result-item"
              onMouseEnter={() => onTokenHover(token.id)}
              onMouseLeave={() => onTokenHover(null)}
              onClick={() => {
                if (scope.type === "global" && onSelectSurah) {
                  onSelectSurah(token.sura);
                }
                if (root && token.root && onRootSelect) {
                  onRootSelect(token.root);
                }
                onTokenFocus(token.id);
              }}
            >
              <span className="res-arabic" lang="ar" dir="rtl">{token.text}</span>
              <span className="res-meta">
                {token.sura}:{token.ayah} - {token.pos}
              </span>
            </button>
          ))
        )}
      </div>
      )}

      <style jsx>{`
        .search-panel {
            display: flex;
            flex-direction: column;
            height: 100%;
        }
        .search-controls {
            display: grid;
            gap: 8px;
            margin-bottom: 16px;
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .search-input, .search-select {
            padding: 9px 12px;
            border: 1px solid var(--line);
            border-radius: 8px;
            background: var(--bg-2);
            color: var(--ink);
            width: 100%;
            font-size: 0.9rem;
        }
        .search-input:focus, .search-select:focus {
            outline: none;
            border-color: var(--accent);
            background: rgba(255, 255, 255, 0.9);
        }
        .results-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.78rem;
            color: var(--ink-muted);
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }
        .results-scope {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 0.72rem;
            color: var(--ink-muted);
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }
        .scope-pill {
            padding: 4px 8px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.65);
            border: 1px solid var(--line);
            color: var(--ink-secondary);
            font-size: 0.7rem;
            text-transform: none;
            letter-spacing: 0.02em;
        }
        .results-sub {
            font-size: 0.72rem;
            color: var(--ink-secondary);
            letter-spacing: 0.04em;
            text-transform: none;
        }
        .search-results-list {
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding-right: 4px; /* Space for scrollbar */
        }
        .result-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            border: 1px solid var(--line);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.65);
            cursor: pointer;
            text-align: left;
            transition: all 0.2s;
        }
        .result-item:hover {
            background: rgba(255, 255, 255, 0.95);
            border-color: var(--accent);
            box-shadow: 0 8px 16px rgba(15, 23, 42, 0.12);
            transform: translateY(-1px);
        }
        .res-arabic {
            font-family: var(--font-arabic, "Amiri"), "Amiri", serif;
            font-size: 1.1rem;
        }
        .res-meta {
            font-size: 0.75rem;
            color: var(--ink-muted);
        }
        .empty-search {
            padding: 2rem;
            text-align: center;
            color: var(--ink-muted);
            font-size: 0.9rem;
            border: 2px dashed var(--line);
            border-radius: 8px;
        }

        /* Root Info Card */
        .root-info-card {
            margin-bottom: 12px;
            padding: 12px;
            border: 1px solid var(--accent);
            border-radius: 10px;
            background: rgba(239, 68, 68, 0.04);
        }
        .root-info-header {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            margin-bottom: 6px;
        }
        .root-info-arabic {
            font-family: var(--font-arabic, "Amiri"), "Amiri", serif;
            font-size: 1.5rem;
            font-weight: 600;
            color: var(--accent);
        }
        .root-info-total {
            font-size: 0.78rem;
            color: var(--ink-muted);
        }
        .root-info-gloss {
            font-size: 0.82rem;
            color: var(--ink-secondary);
            margin-bottom: 8px;
            font-style: italic;
        }
        .root-info-stats {
            display: flex;
            gap: 12px;
            margin-bottom: 8px;
        }
        .root-stat {
            display: flex;
            flex-direction: column;
            align-items: center;
            flex: 1;
            padding: 6px 4px;
            border-radius: 6px;
            background: rgba(255,255,255,0.5);
            border: 1px solid var(--line);
        }
        .root-stat-value {
            font-size: 1.1rem;
            font-weight: 700;
            color: var(--ink);
        }
        .root-stat-label {
            font-size: 0.65rem;
            color: var(--ink-muted);
            text-transform: uppercase;
            letter-spacing: 0.06em;
        }
        .root-info-pos {
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
            margin-bottom: 6px;
        }
        .pos-chip {
            padding: 2px 8px;
            border-radius: 999px;
            background: rgba(255,255,255,0.6);
            border: 1px solid var(--line);
            font-size: 0.7rem;
            color: var(--ink-secondary);
        }
        .root-info-forms {
            display: flex;
            align-items: baseline;
            gap: 6px;
            margin-bottom: 4px;
        }
        .root-forms-label {
            font-size: 0.72rem;
            color: var(--ink-muted);
            white-space: nowrap;
        }
        .root-forms-list {
            font-family: var(--font-arabic, "Amiri"), "Amiri", serif;
            font-size: 0.95rem;
            color: var(--ink);
        }
        .root-info-divider {
            height: 1px;
            background: var(--line);
            margin: 10px 0;
        }
        .surah-dist-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.72rem;
            color: var(--ink-muted);
            text-transform: uppercase;
            letter-spacing: 0.06em;
            margin-bottom: 6px;
        }
        .surah-dist-list {
            display: flex;
            flex-direction: column;
            gap: 3px;
            max-height: 280px;
            overflow-y: auto;
            padding-right: 3px;
        }
        .surah-dist-item {
            display: grid;
            grid-template-columns: 1fr auto auto 32px;
            align-items: center;
            gap: 6px;
            padding: 5px 8px;
            border: 1px solid var(--line);
            border-radius: 6px;
            background: rgba(255,255,255,0.5);
            cursor: pointer;
            transition: all 0.15s;
            text-align: left;
            font-size: 0.78rem;
        }
        .surah-dist-item:hover {
            background: rgba(255,255,255,0.9);
            border-color: var(--accent);
            transform: translateX(2px);
        }
        .surah-dist-name {
            color: var(--ink);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-size: 0.72rem;
        }
        .surah-dist-arabic {
            font-family: var(--font-arabic, "Amiri"), "Amiri", serif;
            font-size: 0.82rem;
            color: var(--ink-secondary);
        }
        .surah-dist-bar-container {
            width: 40px;
            height: 4px;
            background: var(--line);
            border-radius: 2px;
            overflow: hidden;
        }
        .surah-dist-bar {
            height: 100%;
            background: var(--accent);
            border-radius: 2px;
            transition: width 0.3s;
        }
        .surah-dist-count {
            font-size: 0.7rem;
            font-weight: 600;
            color: var(--accent);
            text-align: right;
        }

        @media (max-width: 640px) {
            .search-controls {
                grid-template-columns: 1fr;
            }
        }

        :global([data-theme="dark"]) .search-input,
        :global([data-theme="dark"]) .search-select {
            background: rgba(18, 18, 26, 0.75);
        }

        :global([data-theme="dark"]) .result-item {
            background: rgba(16, 16, 24, 0.65);
        }

        :global([data-theme="dark"]) .result-item:hover {
            background: rgba(20, 20, 28, 0.95);
        }
        :global([data-theme="dark"]) .scope-pill {
            background: rgba(16, 16, 24, 0.8);
        }
        :global([data-theme="dark"]) .root-info-card {
            background: rgba(239, 68, 68, 0.06);
        }
        :global([data-theme="dark"]) .root-stat {
            background: rgba(255,255,255,0.04);
        }
        :global([data-theme="dark"]) .pos-chip {
            background: rgba(255,255,255,0.06);
        }
        :global([data-theme="dark"]) .surah-dist-item {
            background: rgba(16, 16, 24, 0.5);
        }
        :global([data-theme="dark"]) .surah-dist-item:hover {
            background: rgba(20, 20, 28, 0.9);
        }
      `}</style>
    </div>
  );
}
