"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { trackPerformanceMetric, trackSearchRecoveryShown } from "@/lib/analytics/events";
import GlobalSearch from "@/components/ui/GlobalSearch";
import CorpusIndex from "@/components/ui/CorpusIndex";
import AppWorkspaceShell from "@/components/ui/AppWorkspaceShell";
import { readDevSearchStatus } from "@/lib/dev/testOverrides";
import { useCorpusData } from "@/lib/hooks/useCorpusData";
import { deriveCorpusStatusPresentation } from "@/lib/corpus/statusPresentation";
import type { CorpusOverviewData } from "@/lib/corpus/overviewData";
import type { CorpusToken } from "@/lib/schema/types";
import type { SearchMatchType } from "@/lib/analytics/events";

interface SearchWorkspaceProps {
  initialCorpusData?: CorpusOverviewData;
}

export default function SearchWorkspace({ initialCorpusData }: SearchWorkspaceProps) {
  const t = useTranslations("SearchWorkspace");
  const { allTokens, dataStatus, isLoadingCorpus, overview, overviewSource, readiness } = useCorpusData(initialCorpusData);
  const searchStatus = readDevSearchStatus() ?? "available";
  const [selectedToken, setSelectedToken] = useState<CorpusToken | null>(null);
  const [selectedRoot, setSelectedRoot] = useState<string | null>(null);
  const [hasTrackedShellRender, setHasTrackedShellRender] = useState(false);
  const statusPresentation = useMemo(
    () => deriveCorpusStatusPresentation(readiness, dataStatus, isLoadingCorpus),
    [dataStatus, isLoadingCorpus, readiness]
  );

  const summary = useMemo(() => {
    if (!selectedToken) return null;
    return `${selectedToken.sura}:${selectedToken.ayah}`;
  }, [selectedToken]);

  useEffect(() => {
    if (searchStatus === "unavailable") {
      trackSearchRecoveryShown("search");
    }
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
    // Intentional no-op for now; workspace keeps context in the panel itself.
  };

  const statusLabel = t(`status.${statusPresentation.statusLabel}`);

  return (
    <AppWorkspaceShell
      kicker={t("kicker")}
      title={t("title")}
      description={t("description")}
      status={<div className="ui-pill">{statusLabel}</div>}
      backgroundVariant="search"
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
        <div
          className="ui-message ui-message-error workspace-status-message"
          data-testid="search-workspace-status-message"
        >
          {t("fallbackMessage")}
        </div>
      ) : null}

      {statusPresentation.showLoadingMessage ? (
        <div
          className="ui-message workspace-status-message"
          data-testid="search-workspace-status-message"
        >
          {t("loadingMessage")}
        </div>
      ) : null}

      {searchStatus === "unavailable" ? (
        <div
          className="ui-message ui-message-error workspace-status-message"
          data-testid="search-workspace-search-message"
        >
          {t("searchUnavailableMessage")}
        </div>
      ) : null}

      <div className="ui-grid-two">
        <section className="ui-card ui-section-card ui-section-card-tall">
          <div className="ui-card-head">
              <h2>{t("quickSearch")}</h2>
              <span>{allTokens.length.toLocaleString()}</span>
          </div>
          <GlobalSearch
            tokens={allTokens}
            analyticsSurface="workspace"
            onTokenSelect={(tokenId) => {
              const token = allTokens.find((entry) => entry.id === tokenId) ?? null;
              setSelectedToken(token);
            }}
            onTokenHover={() => {}}
            onRootSelect={setSelectedRoot}
            onSearchResultSelected={handleResultSelected}
          />
          <div className="selection-card ui-card-muted workspace-selection-card">
            <p className="selection-label ui-kicker">{t("currentResult")}</p>
            {selectedToken ? (
              <>
                <strong lang="ar" dir="rtl">{selectedToken.text}</strong>
                <span className="ui-empty-copy">{summary}</span>
                <span className="ui-empty-copy">{selectedRoot || selectedToken.root || t("noRoot")}</span>
                <p className="ui-empty-copy">{selectedToken.morphology.gloss || t("noGloss")}</p>
              </>
            ) : (
              <p className="ui-empty-copy">{t("emptySelection")}</p>
            )}
          </div>
        </section>

        <section className="ui-card ui-section-card ui-section-card-tall">
          <div className="ui-card-head">
            <h2>{t("corpusIndex")}</h2>
          </div>
          <CorpusIndex
            tokens={allTokens}
            onSelectSurah={() => {}}
            onSelectRoot={setSelectedRoot}
            onSelectLemma={() => {}}
          />
        </section>
      </div>

      <style jsx>{`
        .workspace-status-message {
          margin-bottom: 1rem;
        }

        .selection-card {
          margin-top: 1rem;
        }

        .selection-label {
          margin-bottom: 0;
        }

        .workspace-ready-note {
          margin-bottom: 0.75rem;
        }
      `}</style>
    </AppWorkspaceShell>
  );
}
