"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import TopBar from "@/components/shell/TopBar";
import StatusBar from "@/components/shell/StatusBar";
import JourneyRail from "@/components/shell/JourneyRail";
import ContextDrawer from "@/components/shell/ContextDrawer";
import GraphToolbar from "@/components/shell/GraphToolbar";
import VisualizationViewport from "@/components/home/VisualizationViewport";
import CurrentSelectionPanel from "@/components/ui/CurrentSelectionPanel";
import MobileBottomBar from "@/components/ui/MobileBottomBar";
import MobileSearchOverlay from "@/components/ui/MobileSearchOverlay";
import FirstRunMission from "@/components/onboarding/FirstRunMission";
import MissionChecklist from "@/components/onboarding/MissionChecklist";
import { deriveCorpusStatusPresentation } from "@/lib/corpus/statusPresentation";
import { SURAH_NAMES } from "@/lib/data/surahData";
import { useHomePageController, VizControlProvider } from "@/lib/hooks/useHomePageController";
import type { CorpusOverviewData } from "@/lib/corpus/overviewData";
import type { ThemePreferenceState } from "@/lib/theme/themePreferences";

interface AppShellProps {
  initialCorpusData: CorpusOverviewData;
  initialThemePreference: ThemePreferenceState;
}

function AppShellContent({ initialCorpusData, initialThemePreference }: AppShellProps) {
  const t = useTranslations("Index");
  const tViz = useTranslations("VisualizationSwitcher.modes");
  const c = useHomePageController(initialCorpusData, initialThemePreference);
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);

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
        isSidebarOpen={c.isSidebarOpen}
        setIsSidebarOpen={c.setIsSidebarOpen}
      />

      {/* ── Right context drawer ── */}
      <ContextDrawer
        isOpen={c.isSidebarOpen}
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

      {/* Left selection panel (desktop, or mobile when left sidebar open) */}
      {(!c.isMobileViewport || c.isLeftSidebarOpen) && (
        <div className={`viz-sidebar-stack ${isLeftPanelCollapsed ? "collapsed" : ""}`}>
          <button
            type="button"
            className="viz-sidebar-collapse-btn"
            onClick={() => setIsLeftPanelCollapsed(!isLeftPanelCollapsed)}
            aria-label={isLeftPanelCollapsed ? t("overlay.expandPanel") : t("overlay.collapsePanel")}
            title={isLeftPanelCollapsed ? t("overlay.expandPanel") : t("overlay.collapsePanel")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points={isLeftPanelCollapsed ? "9 18 15 12 9 6" : "15 18 9 12 15 6"} />
            </svg>
          </button>
          <div
            id="viz-sidebar-portal"
            className="viz-sidebar-content"
            aria-hidden={isLeftPanelCollapsed}
          >
            <div data-tour-id="current-selection">
              <CurrentSelectionPanel
                vizMode={c.vizMode}
                selectedSurahId={c.selectedSurahId}
                selectedAyah={c.selectedAyahInSurah}
                selectedRoot={c.selectedRootValue}
                selectedLemma={c.selectedLemmaValue}
                activeToken={c.focusedToken ?? null}
                allTokens={c.allTokens}
              />
            </div>
          </div>
        </div>
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
