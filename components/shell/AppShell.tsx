"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import TopBar from "@/components/shell/TopBar";
import StatusBar from "@/components/shell/StatusBar";
import JourneyRail from "@/components/shell/JourneyRail";
import ContextDrawer from "@/components/shell/ContextDrawer";
import GraphToolbar from "@/components/shell/GraphToolbar";
import VisualizationViewport from "@/components/home/VisualizationViewport";
import MobileBottomBar from "@/components/ui/MobileBottomBar";
import MobileSearchOverlay from "@/components/ui/MobileSearchOverlay";
import FirstRunMission from "@/components/onboarding/FirstRunMission";
import MissionChecklist from "@/components/onboarding/MissionChecklist";
import { deriveCorpusStatusPresentation } from "@/lib/corpus/statusPresentation";
import { SURAH_NAMES } from "@/lib/data/surahData";
import { useHomePageController, VizControlProvider } from "@/lib/hooks/useHomePageController";
import { ALL_VIZ_MODES } from "@/lib/hooks/useVizModeState";
import { useEdgeSwipe } from "@/lib/hooks/useEdgeSwipe";
import type { CorpusOverviewData } from "@/lib/corpus/overviewData";
import type { ThemePreferenceState } from "@/lib/theme/themePreferences";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";

interface AppShellProps {
  initialCorpusData: CorpusOverviewData;
  initialThemePreference: ThemePreferenceState;
}

function AppShellContent({ initialCorpusData, initialThemePreference }: AppShellProps) {
  const t = useTranslations("Index");
  const tViz = useTranslations("VisualizationSwitcher.modes");
  const tMobile = useTranslations("MobileBottomBar");
  const c = useHomePageController(initialCorpusData, initialThemePreference);
  // Expanded by default so the zoom controls + legend are always visible in a
  // fixed, predictable dock (top-anchored, grows downward). Collapsible on demand.
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);

  // Edge-swipe gestures (touch): swipe in from the left edge to reveal the legend,
  // from the right edge to reveal the inspector; swipe back over a panel to dismiss.
  const handleOpenLeft = useCallback(() => setIsLeftPanelCollapsed(false), []);
  const handleCloseLeft = useCallback(() => setIsLeftPanelCollapsed(true), []);
  const handleOpenRight = useCallback(() => c.setIsSidebarOpen(true), [c.setIsSidebarOpen]);
  const handleCloseRight = useCallback(() => c.setIsSidebarOpen(false), [c.setIsSidebarOpen]);
  useEdgeSwipe({
    leftOpen: !isLeftPanelCollapsed,
    rightOpen: c.isSidebarOpen,
    openLeft: handleOpenLeft,
    closeLeft: handleCloseLeft,
    openRight: handleOpenRight,
    closeRight: handleCloseRight,
  });

  // Deep-link hydration: ?viz=&surah=&ayah=&root=&lemma=&token= (e.g. from /search).
  const hydratedRef = useRef(false);
  const navigateToResult = c.handleSearchResultNavigate;
  useEffect(() => {
    if (hydratedRef.current) return;
    const sp = new URLSearchParams(window.location.search);
    const root = sp.get("root");
    const lemma = sp.get("lemma");
    const surah = sp.get("surah");
    const ayah = sp.get("ayah");
    const token = sp.get("token");
    const vizParam = sp.get("viz");
    // Only honour ?viz= when it names a real, renderable mode — an unknown
    // value must not steer navigation (or unlock the advanced mode set).
    const viz = ALL_VIZ_MODES.includes(vizParam as VisualizationMode)
      ? (vizParam as VisualizationMode)
      : null;
    if (!root && !lemma && !surah && !ayah && !token && !vizParam) return;
    hydratedRef.current = true;
    navigateToResult({
      id: "deeplink",
      kind: "ayah",
      title: "",
      actionTarget: {
        routeMode: "explore",
        visualizationMode: viz ?? undefined,
        selection: {
          surahId: surah ? Number(surah) : undefined,
          ayah: ayah ? Number(ayah) : undefined,
          root: root || undefined,
          lemma: lemma || undefined,
          tokenId: token || undefined,
        },
      },
    });
  }, [navigateToResult]);

  const clearFocus = useCallback(() => {
    c.setFocusedTokenId(null);
    c.setSelectedRoot(null);
    c.setSelectedLemma(null);
    c.setSearchLockedRoot(null);
  }, [c.setFocusedTokenId, c.setSelectedRoot, c.setSelectedLemma, c.setSearchLockedRoot]);

  const statusPresentation = deriveCorpusStatusPresentation(c.readiness, c.dataStatus, c.isLoadingCorpus);
  const surahName = SURAH_NAMES[c.selectedSurahId]?.name ?? `${c.selectedSurahId}`;

  return (
    <div className="immersive-dashboard" data-theme={c.theme}>
      <div className="neural-bg" aria-hidden />

      {/* ── Top bar ── */}
      <TopBar
        allTokens={c.allTokens}
        theme={c.theme}
        setTheme={c.setTheme}
        onTokenSelect={c.handleTokenSelect}
        onTokenHover={c.setHoverTokenId}
        onRootSelect={c.handleRootSelect}
        onSearchOpened={() => c.handleSearchOpened("header")}
        onSearchQuerySubmitted={(q) => c.handleSearchQuerySubmitted(q, "header")}
        onSearchResultSelected={(m) => c.handleSearchResultSelected(m, "header")}
        onResultNavigate={c.handleSearchResultNavigate}
      />

      {/* ── Left journey rail (desktop only via CSS) ── */}
      <JourneyRail
        vizMode={c.vizMode}
        onVizModeChange={c.handleVizModeChange}
      />

      {/* ── Main visualization area ── */}
      <main ref={c.mainVizRef} className="immersive-viewport viz-fullwidth" data-tour-id="main-viewport">
        <VisualizationViewport
          vizMode={c.vizMode}
          allTokens={c.allTokens}
          experienceLevel={c.experienceLevel}
          selectedSurahId={c.selectedSurahId}
          selectedAyahInSurah={c.selectedAyahInSurah}
          selectedRoot={c.selectedRoot}
          selectedRootValue={c.selectedRootValue}
          selectedLemmaValue={c.selectedLemmaValue}
          flows={c.flows}
          roots={c.roots}
          tokenById={c.tokenById}
          theme={c.theme}
          lexicalColorMode={c.lexicalColorMode}
          setHoverTokenId={c.setHoverTokenId}
          setFocusedTokenId={c.setFocusedTokenId}
          setSelectedSurahId={c.setSelectedSurahId}
          handleRootSelect={c.handleRootSelect}
          handleSurahSelect={c.handleSurahSelect}
        />
      </main>

      {/* ── Bottom graph toolbar ── */}
      <GraphToolbar
        theme={c.theme}
        setTheme={c.setTheme}
        colorThemeId={c.colorThemeId}
        setColorThemeId={c.setColorThemeId}
        lexicalColorMode={c.lexicalColorMode}
        setLexicalColorMode={c.setLexicalColorMode}
        customColorTheme={c.customColorTheme}
        handleCustomColorThemeChange={c.handleCustomColorThemeChange}
        handleResetCustomColorTheme={c.handleResetCustomColorTheme}
        experienceLevel={c.experienceLevel}
        handleExperienceLevelChange={c.handleExperienceLevelChange}
        handleReplayExperience={c.handleReplayExperience}
        mainVizRef={c.mainVizRef}
        vizMode={c.vizMode}
        selectedSurahId={c.selectedSurahId}
        showAdvancedModes={c.showAdvancedModes}
        setShowAdvancedModes={c.setShowAdvancedModes}
        handleVizModeChange={c.handleVizModeChange}
      />

      {/* ── Right context drawer ── */}
      <ContextDrawer
        isOpen={c.isSidebarOpen}
        onToggleOpen={() => c.setIsSidebarOpen(!c.isSidebarOpen)}
        allTokens={c.allTokens}
        vizMode={c.vizMode}
        inspectorToken={c.inspectorTokenFinal}
        inspectorMode={c.inspectorModeFinal}
        selectedSurahId={c.selectedSurahId}
        clearFocus={clearFocus}
        onTokenHover={c.setHoverTokenId}
        onTokenSelect={c.handleTokenSelect}
        onRootSelect={c.handleRootSelect}
        onSelectSurah={c.handleSurahSelect}
        onLemmaSelect={c.handleLemmaSelect}
        onSearchOpened={() => c.handleSearchOpened("sidebar")}
        onSearchQuerySubmitted={(q) => c.handleSearchQuerySubmitted(q, "sidebar")}
        onSearchResultSelected={(m) => c.handleSearchResultSelected(m, "sidebar")}
        onResultNavigate={c.handleSearchResultNavigate}
      />

      {/* ── Consolidated status / notification bar ── */}
      <StatusBar
        isLoading={c.isLoadingCorpus}
        loadingProgress={c.loadingProgress}
        dataStatus={c.dataStatus}
        statusPresentation={statusPresentation}
        searchStatus={c.searchStatus}
        overviewSurahCount={c.overview.surahCount}
        overviewRootCount={c.overview.rootCount}
        contextTransformNotice={c.contextTransformNotice}
        onRestoreFocusedContext={c.handleRestoreFocusedContext}
        onDismissContextTransformNotice={c.handleDismissContextTransformNotice}
        isHierarchicalMode={c.isHierarchicalMode}
        vizModeLabel={tViz(`${c.vizMode}.label`)}
        selectedSurahId={c.selectedSurahId}
        surahName={surahName}
        selectedAyah={c.selectedAyahInSurah}
        selectedRoot={c.selectedRootValue}
        onBreadcrumbNavigate={c.handleBreadcrumbNavigate}
      />

      {/* First-task feedback prompt */}
      {c.showFirstTaskFeedbackPrompt && (
        <div className="ui-floating-feedback" role="status" aria-live="polite">
          <p>{t("feedbackPrompt.question")}</p>
          <div className="ui-floating-feedback-actions">
            <button type="button" onClick={() => c.handleFirstTaskFeedback("helpful")}>{t("feedbackPrompt.helpful")}</button>
            <button type="button" onClick={() => c.handleFirstTaskFeedback("not_helpful")}>{t("feedbackPrompt.notHelpful")}</button>
            <button type="button" onClick={c.handleDismissFirstTaskFeedback}>{t("feedbackPrompt.dismiss")}</button>
          </div>
        </div>
      )}

      {/* Left controls drawer — a full-height panel mirroring the right tools
          drawer, holding the active viz's zoom + legend. The toggle is a sibling
          (not a child) so it stays visible when the panel slides away. */}
      {(!c.isMobileViewport || c.isLeftSidebarOpen) && (
        <>
          {/* Full-height left panel. Layout: legend pinned top, transient
              selection cards in the middle, zoom controls + collapse at the
              bottom. The portal renders legend/selection/zoom; CSS orders them. */}
          <aside
            className={`viz-sidebar-stack ${isLeftPanelCollapsed ? "collapsed" : ""}`}
            aria-hidden={isLeftPanelCollapsed || undefined}
          >
            <div id="viz-sidebar-portal" className="viz-sidebar-content" />
            <button
              type="button"
              className="viz-left-collapse"
              onClick={() => setIsLeftPanelCollapsed(true)}
              aria-label={t("overlay.collapsePanel")}
              title={t("overlay.collapsePanel")}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span>{t("overlay.collapsePanel")}</span>
            </button>
          </aside>
          {/* Left-edge handle — open/close the legend panel from the screen edge,
              mirroring the inspector's right-edge handle. Slides to the panel's
              edge when open; sits at the left edge (clearing the rail) when collapsed. */}
          <button
            type="button"
            className={`legend-edge-handle ${isLeftPanelCollapsed ? "is-collapsed" : ""}`}
            onClick={() => setIsLeftPanelCollapsed(!isLeftPanelCollapsed)}
            aria-label={isLeftPanelCollapsed ? tMobile("showLegend") : t("overlay.collapsePanel")}
            aria-expanded={!isLeftPanelCollapsed}
            title={isLeftPanelCollapsed ? tMobile("showLegend") : t("overlay.collapsePanel")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </>
      )}

      {/* Viz suggestion toast */}
      {c.vizSuggestion && (
        <div className="viz-suggestion-toast" role="status" aria-live="polite">
          <span className="viz-suggestion-text">{t(`${c.vizSuggestion.reason}`)}</span>
          <button type="button" className="viz-suggestion-accept" onClick={c.handleAcceptVizSuggestion}>
            {t("vizSuggestion.switch")}
          </button>
          <button type="button" className="viz-suggestion-dismiss" onClick={c.handleDismissVizSuggestion} aria-label={t("vizSuggestion.dismiss")}>
            ×
          </button>
        </div>
      )}

      {/* Mobile overlays */}
      <MobileBottomBar />
      <MobileSearchOverlay
        tokens={c.allTokens}
        onTokenSelect={c.handleTokenSelect}
        onTokenHover={c.setHoverTokenId}
        onRootSelect={c.handleRootSelect}
        onSearchOpened={() => c.handleSearchOpened("mobile")}
        onSearchQuerySubmitted={(q) => c.handleSearchQuerySubmitted(q, "mobile")}
        onSearchResultSelected={(m) => c.handleSearchResultSelected(m, "mobile")}
        onResultNavigate={c.handleSearchResultNavigate}
      />

      {/* Onboarding overlays */}
      <FirstRunMission
        isOpen={c.firstRunState === "intent-selection"}
        onSelectIntent={c.handleSelectMissionIntent}
        onSkip={c.handleOnboardingSkip}
        showOnStartup={c.showOnStartup}
        onShowOnStartupChange={c.handleOnboardingStartupChange}
      />
      {c.firstRunState === "mission-active" && c.activeMissionIntent && (
        <MissionChecklist
          isOpen
          missionIntent={c.activeMissionIntent}
          progress={c.missionProgress}
          onDismiss={c.handleMissionEnd}
          onComplete={c.handleMissionComplete}
        />
      )}
    </div>
  );
}

export default function AppShell({ initialCorpusData, initialThemePreference }: AppShellProps) {
  return (
    <VizControlProvider>
      <AppShellContent initialCorpusData={initialCorpusData} initialThemePreference={initialThemePreference} />
    </VizControlProvider>
  );
}
