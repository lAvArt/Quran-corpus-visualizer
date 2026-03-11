"use client";

import AppSidebar from "@/components/ui/AppSidebar";
import CurrentSelectionPanel from "@/components/ui/CurrentSelectionPanel";
import MobileBottomBar from "@/components/ui/MobileBottomBar";
import MobileSearchOverlay from "@/components/ui/MobileSearchOverlay";
import OnboardingOverlay from "@/components/ui/OnboardingOverlay";
import GuidedWalkthroughOverlay from "@/components/ui/GuidedWalkthroughOverlay";
import VizBreadcrumbs from "@/components/ui/VizBreadcrumbs";
import { deriveCorpusStatusPresentation } from "@/lib/corpus/statusPresentation";
import type { CorpusToken } from "@/lib/schema/types";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";
import type { SearchMatchType } from "@/lib/analytics/events";
import type { WalkthroughStepConfig } from "@/lib/schema/walkthrough";
import type { CorpusOverviewSummary, CorpusReadinessState, DataReadinessStatus } from "@/lib/corpus/readiness";

interface HomeOverlayLayerProps {
  t: (key: string, values?: Record<string, string | number>) => string;
  tSearch: (key: string, values?: Record<string, string | number>) => string;
  dataStatus: DataReadinessStatus;
  readiness: CorpusReadinessState;
  overview: CorpusOverviewSummary;
  searchStatus: "available" | "unavailable";
  contextTransformNotice: { title: string; description: string; recoveryLabel?: string } | null;
  tViz: (key: string) => string;
  isHierarchicalMode: boolean;
  vizMode: VisualizationMode;
  selectedSurahId: number;
  selectedAyahInSurah: number | null;
  selectedRootValue: string | null;
  selectedLemmaValue: string | null;
  surahName: string;
  handleBreadcrumbNavigate: (level: "quran" | "surah" | "ayah" | "root") => void;
  isLoadingCorpus: boolean;
  loadingProgress: { currentSura: number; totalSuras: number; message: string } | null;
  showFirstTaskFeedbackPrompt: boolean;
  handleFirstTaskFeedback: (rating: "helpful" | "not_helpful") => void;
  handleDismissFirstTaskFeedback: () => void;
  isMobileViewport: boolean;
  isLeftSidebarOpen: boolean;
  focusedToken: CorpusToken | null;
  allTokens: CorpusToken[];
  isSidebarOpen: boolean;
  inspectorTokenFinal: CorpusToken | null;
  inspectorModeFinal: "hover" | "focus" | "idle";
  clearFocus: () => void;
  onTokenHover: (tokenId: string | null) => void;
  onTokenFocus: (tokenId: string | null) => void;
  onTokenSelect: (tokenId: string) => void;
  onRootSelect: (root: string | null) => void;
  onSearchRootSelect: (root: string | null) => void;
  onSelectSurah: (surahId: number, preferredView?: "radial-sura" | "root-network") => void;
  onLemmaSelect: (lemma: string) => void;
  onSearchOpenedSidebar: () => void;
  onSearchQuerySubmittedSidebar: (query: string) => void;
  onSearchResultSelectedSidebar: (matchType: SearchMatchType) => void;
  onSearchOpenedMobile: () => void;
  onSearchQuerySubmittedMobile: (query: string) => void;
  onSearchResultSelectedMobile: (matchType: SearchMatchType) => void;
  onDismissContextTransformNotice: () => void;
  onRestoreFocusedContext: () => void;
  experiencePhase: "none" | "onboarding" | "walkthrough";
  showOnStartup: boolean;
  handleOnboardingStartupChange: (checked: boolean) => void;
  handleOnboardingComplete: () => void;
  handleOnboardingSkip: () => void;
  handleStartWalkthrough: () => void;
  activeWalkthroughSteps: WalkthroughStepConfig[];
  walkthroughStepIndex: number;
  handleWalkthroughNext: () => void;
  handleWalkthroughBack: () => void;
  handleWalkthroughSkip: () => void;
  handleWalkthroughComplete: () => void;
}

export default function HomeOverlayLayer(props: HomeOverlayLayerProps) {
  const {
    t,
    tSearch,
    dataStatus,
    readiness,
    overview,
    searchStatus,
    contextTransformNotice,
    tViz,
    isHierarchicalMode,
    vizMode,
    selectedSurahId,
    selectedAyahInSurah,
    selectedRootValue,
    selectedLemmaValue,
    surahName,
    handleBreadcrumbNavigate,
    isLoadingCorpus,
    loadingProgress,
    showFirstTaskFeedbackPrompt,
    handleFirstTaskFeedback,
    handleDismissFirstTaskFeedback,
    isMobileViewport,
    isLeftSidebarOpen,
    focusedToken,
    allTokens,
    isSidebarOpen,
    inspectorTokenFinal,
    inspectorModeFinal,
    clearFocus,
    onTokenHover,
    onTokenFocus,
    onTokenSelect,
    onRootSelect,
    onSearchRootSelect,
    onSelectSurah,
    onLemmaSelect,
    onSearchOpenedSidebar,
    onSearchQuerySubmittedSidebar,
    onSearchResultSelectedSidebar,
    onSearchOpenedMobile,
    onSearchQuerySubmittedMobile,
    onSearchResultSelectedMobile,
    onDismissContextTransformNotice,
    onRestoreFocusedContext,
    experiencePhase,
    showOnStartup,
    handleOnboardingStartupChange,
    handleOnboardingComplete,
    handleOnboardingSkip,
    handleStartWalkthrough,
    activeWalkthroughSteps,
    walkthroughStepIndex,
    handleWalkthroughNext,
    handleWalkthroughBack,
    handleWalkthroughSkip,
    handleWalkthroughComplete,
  } = props;
  const statusPresentation = deriveCorpusStatusPresentation(readiness, dataStatus, isLoadingCorpus);

  return (
    <>
      {isLoadingCorpus ? (
        <div className="ui-overlay-loading" data-testid="explore-loading-indicator">
          <div className="ui-overlay-loading-bar">
            <div
              className="ui-overlay-loading-progress"
              style={{ width: loadingProgress ? `${(loadingProgress.currentSura / loadingProgress.totalSuras) * 100}%` : "28%" }}
            />
          </div>
          <span className="ui-overlay-loading-text">{t("overlay.loadingText")}</span>
        </div>
      ) : null}

      <div className="ui-overlay-pill" data-status={dataStatus}>
        <strong>{t(`dataStatus.${dataStatus}.title`)}</strong>
        <span>{t(`dataStatus.${dataStatus}.description`)}</span>
      </div>

      {statusPresentation.showFallbackMessage ? (
        <div
          className="ui-overlay-banner ui-overlay-banner-warning"
          data-testid="explore-data-recovery-message"
          role="status"
          aria-live="polite"
        >
          <strong>{t("overlay.fallbackTitle")}</strong>
          <span>
            {tSearch("fallbackMessage")}
          </span>
        </div>
      ) : null}

      {statusPresentation.showLoadingMessage ? (
        <div
          className="ui-overlay-banner"
          data-testid="explore-data-recovery-message"
          role="status"
          aria-live="polite"
        >
          <strong>{t("overlay.loadingTitle")}</strong>
          <span>
            {tSearch("loadingMessage")}
          </span>
        </div>
      ) : null}

      {statusPresentation.showShellReadyMessage ? (
        <div
          className="ui-overlay-banner"
          data-testid="explore-shell-ready-message"
          role="status"
          aria-live="polite"
        >
          <strong>{t("overlay.shellReadyTitle")}</strong>
          <span>
            {tSearch("shellReadyMessage", {
              surahCount: overview.surahCount,
              rootCount: overview.rootCount.toLocaleString(),
            })}
          </span>
        </div>
      ) : null}

      {searchStatus === "unavailable" ? (
        <div
          className="ui-overlay-banner ui-overlay-banner-search"
          data-testid="explore-search-recovery-message"
          role="status"
          aria-live="polite"
        >
          <strong>{t("overlay.searchUnavailableTitle")}</strong>
          <span>
            {t("overlay.searchUnavailableDescription")}
          </span>
        </div>
      ) : null}

      {contextTransformNotice ? (
        <div
          className="ui-overlay-banner context-transform-banner"
          data-testid="context-transform-message"
          role="status"
          aria-live="polite"
        >
          <strong>{contextTransformNotice.title}</strong>
          <span>{contextTransformNotice.description}</span>
          {contextTransformNotice.recoveryLabel ? (
          <button
            type="button"
            className="context-transform-close context-transform-recover"
            data-testid="context-transform-recover"
            onClick={onRestoreFocusedContext}
            >
              {contextTransformNotice.recoveryLabel}
            </button>
          ) : null}
          <button
            type="button"
            className="context-transform-close context-transform-dismiss"
            data-testid="context-transform-dismiss"
            onClick={onDismissContextTransformNotice}
          >
            {t("overlay.dismissContextTransform")}
          </button>
        </div>
      ) : null}

      <VizBreadcrumbs
        isHierarchical={isHierarchicalMode}
        viewLabel={tViz(`${vizMode}.label`)}
        surahId={selectedSurahId}
        surahName={surahName}
        ayah={selectedAyahInSurah}
        root={selectedRootValue}
        onNavigate={handleBreadcrumbNavigate}
      />

      {showFirstTaskFeedbackPrompt ? (
        <div className="ui-floating-feedback" role="status" aria-live="polite">
          <p>{t("feedbackPrompt.question")}</p>
          <div className="ui-floating-feedback-actions">
            <button type="button" onClick={() => handleFirstTaskFeedback("helpful")}>{t("feedbackPrompt.helpful")}</button>
            <button type="button" onClick={() => handleFirstTaskFeedback("not_helpful")}>{t("feedbackPrompt.notHelpful")}</button>
            <button type="button" onClick={handleDismissFirstTaskFeedback}>{t("feedbackPrompt.dismiss")}</button>
          </div>
        </div>
      ) : null}

      {(!isMobileViewport || isLeftSidebarOpen) ? (
        <div id="viz-sidebar-portal" className="viz-sidebar-stack">
          <div data-tour-id="current-selection">
            <CurrentSelectionPanel
              vizMode={vizMode}
              selectedSurahId={selectedSurahId}
              selectedAyah={selectedAyahInSurah}
              selectedRoot={selectedRootValue}
              selectedLemma={selectedLemmaValue}
              activeToken={focusedToken ?? null}
              allTokens={allTokens}
            />
          </div>
        </div>
      ) : null}

      <div className={`floating-sidebar ${isSidebarOpen ? "open" : ""}`} data-tour-id="tools-sidebar">
        <AppSidebar
          allTokens={allTokens}
          inspectorToken={inspectorTokenFinal}
          inspectorMode={inspectorModeFinal}
          onClearFocus={clearFocus}
          onTokenHover={onTokenHover}
          onTokenFocus={onTokenFocus}
          onTokenSelect={onTokenSelect}
          onRootSelect={onRootSelect}
          onSearchRootSelect={onSearchRootSelect}
          onSelectSurah={onSelectSurah}
          onLemmaSelect={onLemmaSelect}
          selectedSurahId={selectedSurahId}
          onSearchOpened={onSearchOpenedSidebar}
          onSearchQuerySubmitted={onSearchQuerySubmittedSidebar}
          onSearchResultSelected={onSearchResultSelectedSidebar}
        />
      </div>

      <MobileBottomBar />
      <MobileSearchOverlay
        tokens={allTokens}
        onTokenSelect={onTokenSelect}
        onTokenHover={onTokenHover}
        onRootSelect={onRootSelect}
        onSearchOpened={onSearchOpenedMobile}
        onSearchQuerySubmitted={onSearchQuerySubmittedMobile}
        onSearchResultSelected={onSearchResultSelectedMobile}
      />

      <OnboardingOverlay
        isOpen={experiencePhase === "onboarding"}
        showOnStartup={showOnStartup}
        onShowOnStartupChange={handleOnboardingStartupChange}
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
        onStartWalkthrough={handleStartWalkthrough}
      />
      <GuidedWalkthroughOverlay
        isOpen={experiencePhase === "walkthrough"}
        steps={activeWalkthroughSteps}
        stepIndex={walkthroughStepIndex}
        onNext={handleWalkthroughNext}
        onBack={handleWalkthroughBack}
        onSkip={handleWalkthroughSkip}
        onComplete={handleWalkthroughComplete}
      />

    </>
  );
}
