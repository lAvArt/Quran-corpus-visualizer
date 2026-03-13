"use client";

import { useTranslations } from "next-intl";
import HomeHeader from "@/components/home/HomeHeader";
import HomeOverlayLayer from "@/components/home/HomeOverlayLayer";
import VisualizationViewport from "@/components/home/VisualizationViewport";
import { SURAH_NAMES } from "@/lib/data/surahData";
import { useHomePageController, VizControlProvider } from "@/lib/hooks/useHomePageController";
import type { CorpusOverviewData } from "@/lib/corpus/overviewData";
import type { ThemePreferenceState } from "@/lib/theme/themePreferences";

interface HomePageClientProps {
  initialCorpusData: CorpusOverviewData;
  initialThemePreference: ThemePreferenceState;
}

function HomePageContent({ initialCorpusData, initialThemePreference }: HomePageClientProps) {
  const t = useTranslations("Index");
  const tViz = useTranslations("VisualizationSwitcher.modes");
  const tSearch = useTranslations("SearchWorkspace");
  const controller = useHomePageController(initialCorpusData, initialThemePreference);

  return (
    <div className="immersive-dashboard" data-theme={controller.theme}>
      <div className="neural-bg" aria-hidden />

      <HomeHeader
        t={t}
        allTokens={controller.allTokens}
        theme={controller.theme}
        setTheme={controller.setTheme}
        colorThemeId={controller.colorThemeId}
        setColorThemeId={controller.setColorThemeId}
        lexicalColorMode={controller.lexicalColorMode}
        setLexicalColorMode={controller.setLexicalColorMode}
        customColorTheme={controller.customColorTheme}
        handleCustomColorThemeChange={controller.handleCustomColorThemeChange}
        handleResetCustomColorTheme={controller.handleResetCustomColorTheme}
        experienceLevel={controller.experienceLevel}
        handleExperienceLevelChange={controller.handleExperienceLevelChange}
        handleReplayExperience={controller.handleReplayExperience}
        mainVizRef={controller.mainVizRef}
        vizMode={controller.vizMode}
        selectedSurahId={controller.selectedSurahId}
        showAdvancedModes={controller.showAdvancedModes}
        setShowAdvancedModes={controller.setShowAdvancedModes}
        handleVizModeChange={controller.handleVizModeChange}
        isSidebarOpen={controller.isSidebarOpen}
        setIsSidebarOpen={controller.setIsSidebarOpen}
        onTokenSelect={controller.handleTokenSelect}
        onTokenHover={controller.setHoverTokenId}
        onRootSelect={controller.handleRootSelect}
        onSearchOpened={() => controller.handleSearchOpened("header")}
        onSearchQuerySubmitted={(query) => controller.handleSearchQuerySubmitted(query, "header")}
        onSearchResultSelected={(matchType) => controller.handleSearchResultSelected(matchType, "header")}
      />

      <main ref={controller.mainVizRef} className="immersive-viewport viz-fullwidth" data-tour-id="main-viewport">
        <VisualizationViewport
          vizMode={controller.vizMode}
          allTokens={controller.allTokens}
          experienceLevel={controller.experienceLevel}
          selectedSurahId={controller.selectedSurahId}
          selectedAyahInSurah={controller.selectedAyahInSurah}
          selectedRoot={controller.selectedRoot}
          selectedRootValue={controller.selectedRootValue}
          selectedLemmaValue={controller.selectedLemmaValue}
          flows={controller.flows}
          roots={controller.roots}
          tokenById={controller.tokenById}
          theme={controller.theme}
          lexicalColorMode={controller.lexicalColorMode}
          setHoverTokenId={controller.setHoverTokenId}
          setFocusedTokenId={controller.setFocusedTokenId}
          setSelectedSurahId={controller.setSelectedSurahId}
          handleRootSelect={controller.handleRootSelect}
          handleSurahSelect={controller.handleSurahSelect}
        />
      </main>

      <HomeOverlayLayer
        t={t}
        tSearch={tSearch}
        dataStatus={controller.dataStatus}
        readiness={controller.readiness}
        overview={controller.overview}
        searchStatus={controller.searchStatus}
        contextTransformNotice={controller.contextTransformNotice}
        tViz={tViz}
        isHierarchicalMode={controller.isHierarchicalMode}
        vizMode={controller.vizMode}
        selectedSurahId={controller.selectedSurahId}
        selectedAyahInSurah={controller.selectedAyahInSurah}
        selectedRootValue={controller.selectedRootValue}
        selectedLemmaValue={controller.selectedLemmaValue}
        surahName={SURAH_NAMES[controller.selectedSurahId]?.name ?? `${controller.selectedSurahId}`}
        handleBreadcrumbNavigate={controller.handleBreadcrumbNavigate}
        isLoadingCorpus={controller.isLoadingCorpus}
        loadingProgress={controller.loadingProgress}
        showFirstTaskFeedbackPrompt={controller.showFirstTaskFeedbackPrompt}
        handleFirstTaskFeedback={controller.handleFirstTaskFeedback}
        handleDismissFirstTaskFeedback={controller.handleDismissFirstTaskFeedback}
        isMobileViewport={controller.isMobileViewport}
        isLeftSidebarOpen={controller.isLeftSidebarOpen}
        focusedToken={controller.focusedToken}
        allTokens={controller.allTokens}
        isSidebarOpen={controller.isSidebarOpen}
        inspectorTokenFinal={controller.inspectorTokenFinal}
        inspectorModeFinal={controller.inspectorModeFinal}
        clearFocus={() => {
          controller.setFocusedTokenId(null);
          controller.setSelectedRoot(null);
          controller.setSelectedLemma(null);
          controller.setSearchLockedRoot(null);
        }}
        onTokenHover={controller.setHoverTokenId}
        onTokenFocus={controller.setFocusedTokenId}
        onTokenSelect={controller.handleTokenSelect}
        onRootSelect={controller.handleRootSelect}
        onSearchRootSelect={controller.handleSearchRootSelect}
        onSelectSurah={controller.handleSurahSelect}
        onLemmaSelect={controller.handleLemmaSelect}
        onSearchOpenedSidebar={() => controller.handleSearchOpened("sidebar")}
        onSearchQuerySubmittedSidebar={(query) => controller.handleSearchQuerySubmitted(query, "sidebar")}
        onSearchResultSelectedSidebar={(matchType) => controller.handleSearchResultSelected(matchType, "sidebar")}
        onSearchOpenedMobile={() => controller.handleSearchOpened("mobile")}
        onSearchQuerySubmittedMobile={(query) => controller.handleSearchQuerySubmitted(query, "mobile")}
        onSearchResultSelectedMobile={(matchType) => controller.handleSearchResultSelected(matchType, "mobile")}
        onDismissContextTransformNotice={controller.handleDismissContextTransformNotice}
        onRestoreFocusedContext={controller.handleRestoreFocusedContext}
        experiencePhase={controller.experiencePhase}
        showOnStartup={controller.showOnStartup}
        handleOnboardingStartupChange={controller.handleOnboardingStartupChange}
        handleOnboardingComplete={controller.handleOnboardingComplete}
        handleOnboardingSkip={controller.handleOnboardingSkip}
        handleStartWalkthrough={controller.handleStartWalkthrough}
        activeWalkthroughSteps={controller.activeWalkthroughSteps}
        walkthroughStepIndex={controller.walkthroughStepIndex}
        handleWalkthroughNext={controller.handleWalkthroughNext}
        handleWalkthroughBack={controller.handleWalkthroughBack}
        handleWalkthroughSkip={controller.handleWalkthroughSkip}
        handleWalkthroughComplete={controller.handleWalkthroughComplete}
      />
    </div>
  );
}

export default function HomePageClient({ initialCorpusData, initialThemePreference }: HomePageClientProps) {
  return (
    <VizControlProvider>
      <HomePageContent initialCorpusData={initialCorpusData} initialThemePreference={initialThemePreference} />
    </VizControlProvider>
  );
}
