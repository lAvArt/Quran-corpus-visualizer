"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { trackPerformanceMetric, trackSearchRecoveryShown } from "@/lib/analytics/events";
import CommandBar from "@/components/search/CommandBar";
import CorpusIndex from "@/components/ui/CorpusIndex";
import AppWorkspaceShell from "@/components/ui/AppWorkspaceShell";
import { ROOT_GLOSSES } from "@/lib/data/rootGlosses";
import { SURAH_NAMES } from "@/lib/data/surahData";
import { deriveCorpusStatusPresentation } from "@/lib/corpus/statusPresentation";
import type { CorpusOverviewData } from "@/lib/corpus/overviewData";
import { readDevSearchStatus } from "@/lib/dev/testOverrides";
import { useCorpusData } from "@/lib/hooks/useCorpusData";
import { useSearch } from "@/lib/hooks/useSearch";
import type { SearchMatchType } from "@/lib/analytics/events";
import { normalizeRootFamily } from "@/lib/search/arabicNormalize";
import { parseSearchQuery } from "@/lib/search/queryParser";
import type { CorpusToken, PartOfSpeech } from "@/lib/schema/types";
import type { SearchResultItem, SearchResultKind } from "@/lib/search/searchTypes";

interface SearchWorkspaceProps {
  initialCorpusData?: CorpusOverviewData;
}

type SearchTranslate = (key: string, values?: Record<string, string | number>) => string;

export default function SearchWorkspace({ initialCorpusData }: SearchWorkspaceProps) {
  const t = useTranslations("SearchWorkspace");
  const tGlobal = useTranslations("GlobalSearch");
  const tSelection = useTranslations("CurrentSelectionPanel");
  const tShared = useTranslations("Visualizations.Shared");
  const tSemantic = useTranslations("SemanticSearchPanel");
  const tMorph = useTranslations("MorphologyInspector");
  const router = useRouter();
  const { allTokens, dataStatus, isLoadingCorpus, overview, overviewSource, readiness } = useCorpusData(initialCorpusData);
  const searchStatus = readDevSearchStatus() ?? "available";
  const [selectedToken, setSelectedToken] = useState<CorpusToken | null>(null);
  const [selectedRoot, setSelectedRoot] = useState<string | null>(null);
  const [hasTrackedShellRender, setHasTrackedShellRender] = useState(false);
  const search = useSearch({
    tokens: allTokens,
    analyticsSurface: "workspace",
    initialFiltersExpanded: true,
  });

  const statusPresentation = useMemo(
    () => deriveCorpusStatusPresentation(readiness, dataStatus, isLoadingCorpus),
    [dataStatus, isLoadingCorpus, readiness]
  );

  const parsedQuery = useMemo(() => parseSearchQuery(search.query), [search.query]);
  const hasSearchInput = useMemo(
    () =>
      Boolean(
        search.query.trim() ||
        search.filterRoot.trim() ||
        search.filterLemma.trim() ||
        search.filterAyah.trim() ||
        search.filterPos
      ),
    [search.filterAyah, search.filterLemma, search.filterPos, search.filterRoot, search.query]
  );

  const spotlightRoot = useMemo(() => {
    if (selectedRoot?.trim()) return selectedRoot.trim();
    if (search.filterRoot.trim()) return search.filterRoot.trim();
    if (parsedQuery.root?.trim()) return parsedQuery.root.trim();
    if (search.queryIntent === "arabic-root" && search.query.trim()) return search.query.trim();
    return search.results.find((result) => result.matchedRoot?.trim())?.matchedRoot?.trim() ?? "";
  }, [parsedQuery.root, search.filterRoot, search.query, search.queryIntent, search.results, selectedRoot]);

  const rootInsight = useMemo(() => {
    if (!spotlightRoot) return null;

    const rootFamily = normalizeRootFamily(spotlightRoot);
    const matchingTokens = allTokens.filter((token) => normalizeRootFamily(token.root) === rootFamily);
    if (matchingTokens.length === 0) return null;

    const rootCounts = new Map<string, number>();
    const surahMap = new Map<number, { occurrences: number; ayahs: Set<number> }>();
    const lemmaCounts = new Map<string, number>();
    const formCounts = new Map<string, number>();
    const posCounts = new Map<PartOfSpeech, number>();
    const ayahKeys = new Set<string>();
    let gloss = "";

    for (const token of matchingTokens) {
      rootCounts.set(token.root, (rootCounts.get(token.root) ?? 0) + 1);
      lemmaCounts.set(token.lemma, (lemmaCounts.get(token.lemma) ?? 0) + 1);
      formCounts.set(token.text, (formCounts.get(token.text) ?? 0) + 1);
      posCounts.set(token.pos, (posCounts.get(token.pos) ?? 0) + 1);
      ayahKeys.add(`${token.sura}:${token.ayah}`);
      if (!gloss && token.morphology.gloss) gloss = token.morphology.gloss;

      const entry = surahMap.get(token.sura) ?? { occurrences: 0, ayahs: new Set<number>() };
      entry.occurrences += 1;
      entry.ayahs.add(token.ayah);
      surahMap.set(token.sura, entry);
    }

    const displayRoot =
      [...rootCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
      matchingTokens[0]?.root ??
      spotlightRoot;

    return {
      displayRoot,
      gloss: ROOT_GLOSSES.get(displayRoot) ?? ROOT_GLOSSES.get(spotlightRoot) ?? gloss,
      occurrences: matchingTokens.length,
      surahCount: surahMap.size,
      ayahCount: ayahKeys.size,
      lemmaCount: lemmaCounts.size,
      posBreakdown: [...posCounts.entries()].sort((a, b) => b[1] - a[1]),
      topLemmas: [...lemmaCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 5),
      topForms: [...formCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 8),
      topSurahs: [...surahMap.entries()]
        .map(([surahId, value]) => ({
          surahId,
          name: SURAH_NAMES[surahId]?.name ?? `Surah ${surahId}`,
          arabic: SURAH_NAMES[surahId]?.arabic ?? "",
          occurrences: value.occurrences,
          ayahCount: value.ayahs.size,
        }))
        .sort((a, b) => b.occurrences - a.occurrences || a.surahId - b.surahId)
        .slice(0, 6),
    };
  }, [allTokens, spotlightRoot]);

  const resultBuckets = useMemo(
    () =>
      search.groupedResults
        .map((group) => ({ kind: group.kind, count: group.items.length }))
        .sort((a, b) => b.count - a.count),
    [search.groupedResults]
  );

  const activeLens = useMemo(() => {
    if (spotlightRoot) return { label: tGlobal("types.root"), value: spotlightRoot };
    if (search.filterLemma.trim() || parsedQuery.lemma?.trim()) {
      return { label: tGlobal("types.lemma"), value: search.filterLemma.trim() || parsedQuery.lemma?.trim() || "" };
    }
    if (search.filterAyah.trim() || parsedQuery.ayah?.trim() || search.queryIntent === "ayah-ref") {
      return {
        label: tShared("ayah"),
        value: search.filterAyah.trim() || parsedQuery.ayah?.trim() || search.query.trim(),
      };
    }
    if (search.queryIntent === "english-gloss") return { label: tGlobal("types.gloss"), value: search.query.trim() };
    if (search.queryIntent === "arabic-text") return { label: tGlobal("types.text"), value: search.query.trim() };
    if (search.queryIntent === "structured") {
      return { label: tGlobal("intentHints.structured"), value: search.query.trim() };
    }
    return null;
  }, [
    parsedQuery.ayah,
    parsedQuery.lemma,
    search.filterAyah,
    search.filterLemma,
    search.query,
    search.queryIntent,
    spotlightRoot,
    tGlobal,
    tShared,
  ]);

  const pinnedSurahName = useMemo(() => {
    if (!selectedToken) return null;
    const surah = SURAH_NAMES[selectedToken.sura];
    return surah ? `${selectedToken.sura}. ${surah.name}` : String(selectedToken.sura);
  }, [selectedToken]);

  const snapshotCards = useMemo(() => {
    const resultSummary = resultBuckets
      .slice(0, 3)
      .map((bucket) => `${bucket.count} ${getResultKindLabel(bucket.kind, tGlobal, tShared)}`)
      .join(" • ");

    return [
      {
        label: hasSearchInput ? t("snapshot.matches") : t("snapshot.ready"),
        value: (hasSearchInput ? search.results.length : allTokens.length).toLocaleString(),
        // Note: the "try a query" example (searchPrimerHint) is surfaced once,
        // as the standalone hint line below the cards — this detail must stay
        // distinct so the example text isn't shown twice on screen.
        detail: hasSearchInput ? resultSummary || t("snapshot.noMatches") : t("snapshot.readyHint"),
      },
      {
        label: t("snapshot.lens"),
        value: activeLens?.label ?? t("snapshot.noLens"),
        detail: activeLens?.value || t("searchPrimerDescription"),
      },
      {
        label: t("snapshot.spotlight"),
        value: rootInsight?.displayRoot ?? t("snapshot.noSpotlight"),
        detail: rootInsight?.gloss || t("snapshot.spotlightHint"),
      },
    ];
  }, [activeLens, allTokens.length, hasSearchInput, resultBuckets, rootInsight, search.results.length, t, tGlobal, tShared]);

  useEffect(() => {
    if (searchStatus === "unavailable") trackSearchRecoveryShown("search");
  }, [searchStatus]);

  useEffect(() => {
    if (hasTrackedShellRender) return;
    const navigationEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const durationMs = navigationEntry ? Math.round(navigationEntry.domContentLoadedEventEnd) : Math.round(performance.now());
    trackPerformanceMetric("shell_render", "search", durationMs, {
      shell_ready: readiness.overviewReady,
      corpus_source: overviewSource,
    });
    setHasTrackedShellRender(true);
  }, [hasTrackedShellRender, overviewSource, readiness.overviewReady]);

  const handleResultSelected = (_matchType: SearchMatchType) => {
    // Analytics handled upstream; navigation happens via handleResultNavigate.
  };

  // Picking a result opens it in the Explore view (deep link) so the dedicated
  // search page is navigable, not a dead-end dashboard.
  const handleResultNavigate = useCallback(
    (result: SearchResultItem) => {
      const sel = result.actionTarget.selection ?? {};
      const params = new URLSearchParams();
      if (result.actionTarget.visualizationMode) params.set("viz", result.actionTarget.visualizationMode);
      if (sel.surahId) params.set("surah", String(sel.surahId));
      if (sel.ayah) params.set("ayah", String(sel.ayah));
      if (sel.root) params.set("root", sel.root);
      if (sel.lemma) params.set("lemma", sel.lemma);
      if (sel.tokenId) params.set("token", sel.tokenId);
      router.push(`/?${params.toString()}`);
    },
    [router]
  );

  const statusLabel = t(`status.${statusPresentation.statusLabel}`);

  return (
    <AppWorkspaceShell
      kicker={t("kicker")}
      title={t("title")}
      description={t("description")}
      status={<div className="ui-pill">{statusLabel}</div>}
      backgroundVariant="search"
      compact
    >
      {statusPresentation.showShellReadyMessage ? (
        <div className="ui-message workspace-status-message workspace-ready-note" data-testid="search-workspace-ready-message">
          {t("shellReadyMessage", {
            surahCount: overview.surahCount,
            rootCount: overview.rootCount.toLocaleString(),
          })}
        </div>
      ) : null}

      {statusPresentation.showFallbackMessage ? (
        <div className="ui-message ui-message-error workspace-status-message" data-testid="search-workspace-status-message">
          {t("fallbackMessage")}
        </div>
      ) : null}

      {statusPresentation.showLoadingMessage ? (
        <div className="ui-message workspace-status-message" data-testid="search-workspace-status-message">
          {t("loadingMessage")}
        </div>
      ) : null}

      {searchStatus === "unavailable" ? (
        <div className="ui-message ui-message-error workspace-status-message" data-testid="search-workspace-search-message">
          {t("searchUnavailableMessage")}
        </div>
      ) : null}

      <div className="ui-grid-two">
        <section className="ui-card ui-section-card ui-section-card-tall">
          <div className="ui-card-head">
            <div className="workspace-head-copy">
              <h2>{t("quickSearch")}</h2>
              <p>{t("searchPrimerDescription")}</p>
            </div>
            <span>{allTokens.length.toLocaleString()}</span>
          </div>

          <div className="workspace-search-stack">
            <div className="workspace-command-bar">
              <CommandBar
                tokens={allTokens}
                variant="panel"
                analyticsSurface="workspace"
                search={search}
                onTokenSelect={(tokenId) => {
                  const token = allTokens.find((entry) => entry.id === tokenId) ?? null;
                  setSelectedToken(token);
                  setSelectedRoot(token?.root ?? null);
                }}
                onTokenHover={() => {}}
                onRootSelect={setSelectedRoot}
                onSearchResultSelected={handleResultSelected}
                onResultNavigate={handleResultNavigate}
              />
            </div>

            <div className="workspace-snapshot-grid">
              {snapshotCards.map((card) => (
                <article key={card.label} className="workspace-snapshot-card">
                  <span className="workspace-snapshot-label">{card.label}</span>
                  <strong className="workspace-snapshot-value">{card.value}</strong>
                  <span className="workspace-snapshot-detail">{card.detail}</span>
                </article>
              ))}
            </div>

            {resultBuckets.length > 0 ? (
              <div className="workspace-bucket-row">
                {resultBuckets.map((bucket) => (
                  <span key={bucket.kind} className="workspace-bucket-chip">
                    {bucket.count} {getResultKindLabel(bucket.kind, tGlobal, tShared)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="workspace-search-hint">{t("searchPrimerHint")}</p>
            )}

            {rootInsight ? (
              <article className="workspace-root-card">
                <div className="workspace-root-head">
                  <div>
                    <p className="ui-kicker">{t("rootInsight.title")}</p>
                    <h3 className="workspace-root-title" lang="ar" dir="rtl">{rootInsight.displayRoot}</h3>
                    {rootInsight.gloss ? <p className="workspace-root-gloss">{rootInsight.gloss}</p> : null}
                  </div>
                  <span className="workspace-root-badge">
                    {tSemantic("rootInfo.occurrences", { count: rootInsight.occurrences.toLocaleString() })}
                  </span>
                </div>

                <div className="workspace-root-metrics">
                  <div className="workspace-root-metric">
                    <span>{tMorph("rootDistribution.stats.occurrences")}</span>
                    <strong>{rootInsight.occurrences.toLocaleString()}</strong>
                  </div>
                  <div className="workspace-root-metric">
                    <span>{tSemantic("rootInfo.stats.surahs")}</span>
                    <strong>{rootInsight.surahCount.toLocaleString()}</strong>
                  </div>
                  <div className="workspace-root-metric">
                    <span>{tMorph("rootDistribution.stats.ayahs")}</span>
                    <strong>{rootInsight.ayahCount.toLocaleString()}</strong>
                  </div>
                  <div className="workspace-root-metric">
                    <span>{tSemantic("rootInfo.stats.lemmas")}</span>
                    <strong>{rootInsight.lemmaCount.toLocaleString()}</strong>
                  </div>
                </div>

                {rootInsight.posBreakdown.length > 0 ? (
                  <div className="workspace-root-section">
                    <span className="workspace-root-section-label">{t("rootInsight.posMix")}</span>
                    <div className="workspace-tag-row">
                      {rootInsight.posBreakdown.map(([pos, count]) => (
                        <span key={pos} className="workspace-tag">
                          {formatPosLabel(pos, tGlobal)} <small>{count}</small>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {rootInsight.topLemmas.length > 0 ? (
                  <div className="workspace-root-section">
                    <span className="workspace-root-section-label">{t("rootInsight.topLemmas")}</span>
                    <div className="workspace-tag-row">
                      {rootInsight.topLemmas.map(([lemma, count]) => (
                        <span key={lemma} className="workspace-tag workspace-tag-arabic" lang="ar" dir="rtl">
                          {lemma} <small>{count}</small>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {rootInsight.topForms.length > 0 ? (
                  <div className="workspace-root-section">
                    <span className="workspace-root-section-label">{tSemantic("rootInfo.formsLabel")}</span>
                    <div className="workspace-tag-row">
                      {rootInsight.topForms.map(([form, count]) => (
                        <span key={form} className="workspace-tag workspace-tag-arabic" lang="ar" dir="rtl">
                          {form} <small>{count}</small>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="workspace-root-section">
                  <span className="workspace-root-section-label">{tSemantic("rootInfo.surahDistribution")}</span>
                  <div className="workspace-surah-list">
                    {rootInsight.topSurahs.map((surah) => {
                      const maxOccurrences = rootInsight.topSurahs[0]?.occurrences ?? 1;
                      const width = Math.max(10, (surah.occurrences / maxOccurrences) * 100);
                      return (
                        <div key={surah.surahId} className="workspace-surah-item">
                          <div className="workspace-surah-copy">
                            <span className="workspace-surah-name">{surah.surahId}. {surah.name}</span>
                            {surah.arabic ? (
                              <span className="workspace-surah-arabic" lang="ar" dir="rtl">{surah.arabic}</span>
                            ) : null}
                          </div>
                          <div className="workspace-surah-bar">
                            <span style={{ width: `${width}%` }} />
                          </div>
                          <span className="workspace-surah-meta">
                            {surah.occurrences} • {surah.ayahCount} {tMorph("rootDistribution.stats.ayahs")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </article>
            ) : null}

            <div className="selection-card ui-card-muted workspace-selection-card">
              <p className="selection-label ui-kicker">{t("currentResult")}</p>
              {selectedToken ? (
                <>
                  <div className="workspace-selection-topline">
                    <strong lang="ar" dir="rtl">{selectedToken.text}</strong>
                    <span className="workspace-selection-root">{selectedToken.root || t("noRoot")}</span>
                  </div>
                  <p className="workspace-selection-gloss">
                    {selectedToken.morphology.gloss || rootInsight?.gloss || t("noGloss")}
                  </p>
                  <div className="workspace-selection-grid">
                    <div className="workspace-selection-meta">
                      <span>{tSelection("labels.surah")}</span>
                      <strong>{pinnedSurahName}</strong>
                    </div>
                    <div className="workspace-selection-meta">
                      <span>{tSelection("labels.ayah")}</span>
                      <strong>{selectedToken.ayah}</strong>
                    </div>
                    <div className="workspace-selection-meta">
                      <span>{tSelection("labels.lemma")}</span>
                      <strong lang="ar" dir="rtl">{selectedToken.lemma}</strong>
                    </div>
                    <div className="workspace-selection-meta">
                      <span>{tShared("pos")}</span>
                      <strong>{formatPosLabel(selectedToken.pos, tGlobal)}</strong>
                    </div>
                  </div>
                </>
              ) : (
                <p className="ui-empty-copy">{t("emptySelection")}</p>
              )}
            </div>
          </div>
        </section>

        <section className="ui-card ui-section-card ui-section-card-tall">
          <div className="ui-card-head">
            <h2>{t("corpusIndex")}</h2>
          </div>
          <CorpusIndex
            tokens={allTokens}
            onSelectSurah={(surahId) => {
              const token = allTokens.find((entry) => entry.sura === surahId) ?? null;
              setSelectedToken(token);
              setSelectedRoot(token?.root ?? null);
            }}
            onSelectRoot={(root) => {
              const token =
                allTokens.find((entry) => normalizeRootFamily(entry.root) === normalizeRootFamily(root)) ?? null;
              search.setQuery("");
              search.setFilterLemma("");
              search.setFilterPos("");
              search.setFilterAyah("");
              search.setFilterRoot(root);
              search.setFiltersExpanded(true);
              setSelectedToken(token);
              setSelectedRoot(root);
            }}
            onSelectLemma={(lemma) => {
              const token = allTokens.find((entry) => entry.lemma === lemma) ?? null;
              search.setQuery("");
              search.setFilterRoot("");
              search.setFilterPos("");
              search.setFilterAyah("");
              search.setFilterLemma(lemma);
              search.setFiltersExpanded(true);
              setSelectedToken(token);
              setSelectedRoot(token?.root ?? null);
            }}
          />
        </section>
      </div>

      <style jsx>{`
        .workspace-status-message {
          margin-bottom: 1rem;
        }

        .workspace-head-copy {
          display: grid;
          gap: 0.3rem;
        }

        .workspace-head-copy p {
          margin: 0;
          max-width: 44ch;
          color: var(--ink-muted);
          font-size: 0.9rem;
        }

        .workspace-search-stack {
          display: grid;
          gap: 1rem;
        }

        .workspace-command-bar :global(.global-search) {
          max-width: none;
        }

        .workspace-command-bar :global(.search-input-wrapper) {
          padding: 0.75rem 0.85rem;
          border-radius: 18px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(248, 244, 238, 0.9));
          border-color: color-mix(in srgb, var(--accent), white 36%);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
        }

        .workspace-command-bar :global(.search-input) {
          font-size: 0.92rem;
        }

        .workspace-command-bar :global(.search-overlay-container) {
          display: grid;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }

        .workspace-command-bar :global(.search-advanced-filters),
        .workspace-command-bar :global(.search-results-dropdown) {
          margin-top: 0;
          border-radius: 18px;
          border-color: rgba(17, 24, 39, 0.08);
          background: rgba(255, 255, 255, 0.92);
        }

        .workspace-command-bar :global(.search-advanced-filters) {
          padding: 0.8rem;
        }

        .workspace-snapshot-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
        }

        .workspace-snapshot-card,
        .workspace-root-card {
          padding: 1rem;
          border: 1px solid rgba(17, 24, 39, 0.08);
          border-radius: 20px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(249, 245, 239, 0.82));
        }

        .workspace-snapshot-card {
          display: grid;
          gap: 0.2rem;
          min-height: 104px;
        }

        .workspace-snapshot-label,
        .workspace-root-section-label,
        .workspace-selection-meta span {
          color: var(--ink-muted);
          font-size: 0.74rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .workspace-snapshot-value {
          font-size: 1.05rem;
          line-height: 1.25;
        }

        .workspace-snapshot-detail {
          color: var(--ink-muted);
          font-size: 0.85rem;
          line-height: 1.45;
        }

        .workspace-bucket-row,
        .workspace-tag-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem;
        }

        .workspace-bucket-chip,
        .workspace-tag,
        .workspace-selection-root,
        .workspace-root-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.38rem 0.7rem;
          border-radius: 999px;
          background: rgba(17, 24, 39, 0.06);
          color: var(--ink);
          font-size: 0.8rem;
          line-height: 1;
        }

        .workspace-tag small {
          color: var(--ink-muted);
          font-size: 0.72rem;
        }

        .workspace-tag-arabic {
          font-family: var(--font-arabic, serif);
          font-size: 1rem;
        }

        .workspace-search-hint {
          margin: 0;
          color: var(--ink-muted);
          font-size: 0.9rem;
        }

        .workspace-root-card {
          display: grid;
          gap: 1rem;
          border-color: color-mix(in srgb, var(--accent), white 68%);
          background:
            radial-gradient(circle at top right, rgba(249, 115, 22, 0.12), transparent 32%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(248, 244, 238, 0.82));
        }

        .workspace-root-head {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
        }

        .workspace-root-title {
          margin: 0.15rem 0 0;
          font-family: var(--font-arabic, serif);
          font-size: clamp(1.8rem, 4vw, 2.35rem);
          line-height: 1.05;
        }

        .workspace-root-gloss,
        .workspace-selection-gloss {
          margin: 0;
          color: var(--ink-muted);
        }

        .workspace-root-metrics,
        .workspace-selection-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.7rem;
        }

        .workspace-root-metric,
        .workspace-selection-meta {
          display: grid;
          gap: 0.3rem;
          padding: 0.8rem 0.85rem;
          border-radius: 16px;
          border: 1px solid rgba(17, 24, 39, 0.06);
          background: rgba(255, 255, 255, 0.58);
        }

        .workspace-root-metric span {
          color: var(--ink-muted);
          font-size: 0.73rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .workspace-root-section {
          display: grid;
          gap: 0.65rem;
        }

        .workspace-surah-list {
          display: grid;
          gap: 0.65rem;
        }

        .workspace-surah-item {
          display: grid;
          gap: 0.35rem;
        }

        .workspace-surah-copy,
        .workspace-selection-topline {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
        }

        .workspace-surah-name {
          font-weight: 600;
        }

        .workspace-surah-arabic {
          color: var(--ink-muted);
          font-family: var(--font-arabic, serif);
        }

        .workspace-surah-bar {
          height: 0.45rem;
          border-radius: 999px;
          background: rgba(17, 24, 39, 0.08);
          overflow: hidden;
        }

        .workspace-surah-bar span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, color-mix(in srgb, var(--accent), white 10%), #f97316);
        }

        .workspace-surah-meta {
          color: var(--ink-muted);
          font-size: 0.82rem;
        }

        .selection-card {
          margin-top: 0;
        }

        .selection-label {
          margin-bottom: 0;
        }

        .workspace-ready-note {
          margin-bottom: 0.75rem;
        }

        @media (max-width: 960px) {
          .workspace-snapshot-grid,
          .workspace-root-metrics,
          .workspace-selection-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .workspace-snapshot-grid,
          .workspace-root-metrics,
          .workspace-selection-grid {
            grid-template-columns: 1fr;
          }

          .workspace-root-head,
          .workspace-surah-copy,
          .workspace-selection-topline {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        :global([data-theme="dark"] .workspace-command-bar .search-input-wrapper) {
          background: linear-gradient(180deg, rgba(22, 28, 35, 0.94), rgba(16, 20, 27, 0.92));
        }

        :global([data-theme="dark"] .workspace-command-bar .search-advanced-filters),
        :global([data-theme="dark"] .workspace-command-bar .search-results-dropdown) {
          background: rgba(16, 20, 27, 0.94);
        }

        :global([data-theme="dark"] .workspace-snapshot-card),
        :global([data-theme="dark"] .workspace-root-card) {
          background:
            radial-gradient(circle at top right, rgba(249, 115, 22, 0.12), transparent 32%),
            linear-gradient(180deg, rgba(22, 28, 35, 0.9), rgba(16, 20, 27, 0.9));
          border-color: rgba(255, 255, 255, 0.08);
        }

        :global([data-theme="dark"] .workspace-root-metric),
        :global([data-theme="dark"] .workspace-selection-meta) {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.05);
        }

        :global([data-theme="dark"] .workspace-bucket-chip),
        :global([data-theme="dark"] .workspace-tag),
        :global([data-theme="dark"] .workspace-selection-root),
        :global([data-theme="dark"] .workspace-root-badge) {
          background: rgba(255, 255, 255, 0.06);
        }

        :global([data-theme="dark"] .workspace-surah-bar) {
          background: rgba(255, 255, 255, 0.08);
        }
      `}</style>
    </AppWorkspaceShell>
  );
}

function formatPosLabel(pos: PartOfSpeech, tGlobal: SearchTranslate) {
  switch (pos) {
    case "N":
      return tGlobal("filters.noun");
    case "V":
      return tGlobal("filters.verb");
    case "P":
      return tGlobal("filters.particle");
    case "ADJ":
      return tGlobal("filters.adjective");
    case "PRON":
      return tGlobal("filters.pronoun");
    default:
      return pos;
  }
}

function getResultKindLabel(kind: SearchResultKind, tGlobal: SearchTranslate, tShared: SearchTranslate) {
  switch (kind) {
    case "ayah":
      return tShared("ayah");
    case "surah":
      return tShared("surah");
    case "root":
      return tGlobal("types.root");
    case "lemma":
      return tGlobal("types.lemma");
    case "gloss":
      return tGlobal("types.gloss");
    case "translation":
      return tGlobal("types.translation");
    case "semantic":
      return tGlobal("types.semantic");
    case "token":
    default:
      return "Token";
  }
}
