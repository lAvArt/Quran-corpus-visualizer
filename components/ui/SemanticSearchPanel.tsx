"use client";

import { useMemo, useState } from "react";
import type { CorpusToken, PartOfSpeech } from "@/lib/schema/types";
import { buildPhaseOneIndexes, queryPhaseOne } from "@/lib/search/indexes";
import { parseSearchQuery } from "@/lib/search/queryParser";
import { normalizeRootFamily } from "@/lib/search/arabicNormalize";
import { SURAH_NAMES } from "@/lib/data/surahData";
import { useTranslations } from "next-intl";
import { useDebounce } from "@/lib/hooks/useDebounce";

interface SemanticSearchPanelProps {
  tokens: CorpusToken[];
  onTokenHover: (tokenId: string | null) => void;
  onTokenFocus: (tokenId: string) => void;
  onRootSelect?: (root: string | null) => void;
  onSelectSurah?: (surahId: number, preferredView?: "root-network" | "radial-sura") => void;
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
  const [query, setQuery] = useState("");
  const [root, setRoot] = useState("");
  const [lemma, setLemma] = useState("");
  const [pos, setPos] = useState<PartOfSpeech | "">("");
  const [ayah, setAyah] = useState("");
  const t = useTranslations('SemanticSearchPanel');

  const debouncedQuery = useDebounce(query, 250);
  const debouncedRoot = useDebounce(root, 250);
  const debouncedLemma = useDebounce(lemma, 250);
  const debouncedAyah = useDebounce(ayah, 250);
  const parsedQuery = useMemo(() => parseSearchQuery(debouncedQuery), [debouncedQuery]);

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

  const effectiveRoot = useMemo(() => {
    if (debouncedRoot.trim()) return debouncedRoot.trim();
    if (parsedQuery.root?.trim()) return parsedQuery.root.trim();
    if (parsedQuery.freeText && !parsedQuery.lemma && !parsedQuery.root) return parsedQuery.freeText;
    return "";
  }, [debouncedRoot, parsedQuery]);

  const effectiveLemma = useMemo(() => {
    if (debouncedLemma.trim()) return debouncedLemma.trim();
    return parsedQuery.lemma?.trim() || "";
  }, [debouncedLemma, parsedQuery]);

  const effectivePos = useMemo<PartOfSpeech | "">(() => {
    if (pos) return pos;
    return parsedQuery.pos || "";
  }, [pos, parsedQuery]);

  const effectiveAyah = useMemo(() => {
    if (normalizedAyahQuery) return normalizedAyahQuery;
    if (parsedQuery.ayah) {
      if (scope.type === "surah" && !parsedQuery.ayah.includes(":")) {
        return `${scope.surahId}:${parsedQuery.ayah}`;
      }
      return parsedQuery.ayah;
    }
    return "";
  }, [normalizedAyahQuery, parsedQuery, scope]);

  const results = useMemo(() => {
    const ids = queryPhaseOne(index, {
      root: effectiveRoot || undefined,
      lemma: effectiveLemma || undefined,
      pos: effectivePos || undefined,
      ayah: effectiveAyah || undefined
    });
    return [...ids].map((id) => tokenById.get(id)).filter((token): token is CorpusToken => !!token);
  }, [index, effectiveRoot, effectiveLemma, effectivePos, effectiveAyah, tokenById]);

  const scopeLabel = useMemo(() => {
    if (scope.type === "surah") {
      return t('surah', { id: scope.surahId });
    }
    return t('global');
  }, [scope, t]);

  // Root info: when searching by root, compute aggregated stats
  const rootInfo = useMemo(() => {
    if (!effectiveRoot.trim()) return null;
    const rootFamily = normalizeRootFamily(effectiveRoot.trim());

    // Find all tokens with this exact root across the entire corpus
    const matchingTokens = tokens.filter(tk => normalizeRootFamily(tk.root) === rootFamily);
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
      root: effectiveRoot.trim(),
      totalOccurrences: matchingTokens.length,
      surahCount: surahMap.size,
      gloss,
      forms: Array.from(allForms).slice(0, 8),
      lemmas: Array.from(allLemmas).slice(0, 5),
      posBreakdown: Array.from(posBreakdown.entries()).sort((a, b) => b[1] - a[1]),
      surahDistribution,
    };
  }, [effectiveRoot, tokens]);

  // Whether we're in "root search mode" (show distribution) vs token list mode
  const isRootSearch = !!effectiveRoot.trim() && !!rootInfo;

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
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('placeholders.query')}
          className="search-input search-input-query"
        />
        <input
          value={root}
          onChange={(e) => setRoot(e.target.value)}
          placeholder={t('placeholders.root')}
          className="search-input"
          data-testid="semantic-search-root"
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
          data-testid="semantic-search-ayah"
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
                    if (onSelectSurah) onSelectSurah(s.suraId, "radial-sura");
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
                data-testid={`semantic-result-${token.id}`}
                onMouseEnter={() => onTokenHover(token.id)}
                onMouseLeave={() => onTokenHover(null)}
                onClick={() => {
                  if (scope.type === "global" && onSelectSurah) {
                    onSelectSurah(token.sura);
                  }
                  if (effectiveRoot && token.root && onRootSelect) {
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

    </div>
  );
}
