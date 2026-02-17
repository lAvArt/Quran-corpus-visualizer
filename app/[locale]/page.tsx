"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState, useEffect, useCallback, lazy, Suspense, useRef } from "react";
import Image from "next/image";
import VisualizationSwitcher from "@/components/ui/VisualizationSwitcher";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import DisplaySettingsPanel from "@/components/ui/DisplaySettingsPanel";
import GlobalSearch from "@/components/ui/GlobalSearch";
import AppSidebar from "@/components/ui/AppSidebar";
import CurrentSelectionPanel from "@/components/ui/CurrentSelectionPanel";
import { VizErrorBoundary } from "@/components/ErrorBoundary";
import { sampleAyahDependency } from "@/lib/corpus/sampleAyahDependency";
import { getSampleData, loadFullCorpus, type LoadingProgress } from "@/lib/corpus/corpusLoader";
import { buildRootWordFlows, uniqueRoots } from "@/lib/search/rootFlows";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";
import type { CorpusToken } from "@/lib/schema/types";
import { SURAH_NAMES } from "@/lib/data/surahData";
import { VizControlProvider, useVizControl } from "@/lib/hooks/VizControlContext";
import MobileNavMenu from "@/components/ui/MobileNavMenu";
import MobileBottomBar from "@/components/ui/MobileBottomBar";
import VizExportMenu from "@/components/ui/VizExportMenu";
import OnboardingOverlay from "@/components/ui/OnboardingOverlay";
import GuidedWalkthroughOverlay from "@/components/ui/GuidedWalkthroughOverlay";
import { WALKTHROUGH_STEPS } from "@/lib/data/walkthroughSteps";
import {
  DEFAULT_COLOR_THEME_ID,
  DEFAULT_CUSTOM_COLOR_THEME,
  applyColorTheme,
  isValidCustomColorTheme,
  isValidColorThemeId,
  type CustomColorTheme,
  type CustomColorThemePalette,
  type ColorThemeId,
} from "@/lib/theme/colorThemes";
import { isValidLexicalColorMode, type LexicalColorMode } from "@/lib/theme/lexicalColoring";
import { EXPERIENCE_VERSION } from "@/lib/config/version";

// Lazy-load heavy visualization components for better initial bundle size
const RadialSuraMap = lazy(() => import("@/components/visualisations/RadialSuraMap"));
const RootNetworkGraph = lazy(() => import("@/components/visualisations/RootNetworkGraph"));
const SurahDistributionGraph = lazy(() => import("@/components/visualisations/SurahDistributionGraph"));
const ArcFlowDiagram = lazy(() => import("@/components/visualisations/ArcFlowDiagram"));
const AyahDependencyGraph = lazy(() => import("@/components/visualisations/AyahDependencyGraph"));
const RootFlowSankey = lazy(() => import("@/components/visualisations/RootFlowSankey"));
const CorpusArchitectureMap = lazy(() => import("@/components/visualisations/CorpusArchitectureMap"));

const STORAGE_KEY = "quran-corpus-viz-state";
const EXPERIENCE_STORAGE_KEY = "quran-corpus-onboarding";

type ExperiencePhase = "none" | "onboarding" | "walkthrough";

interface ExperienceStorageState {
  version: string;
  showOnStartup: boolean;
  completed: boolean;
  lastCompletedAt?: string;
}

function VizFallback() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", minHeight: 200 }}>
      <div style={{ textAlign: "center", color: "var(--ink-muted)" }}>
        <div style={{ width: 32, height: 32, border: "3px solid var(--line)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 0.5rem" }} />
        <span style={{ fontSize: "0.85rem" }}>Loading visualization...</span>
      </div>
    </div>
  );
}

function HomePageContent() {
  const t = useTranslations('Index');
  const { isRightSidebarOpen, setRightSidebarOpen } = useVizControl();
  const [hoverTokenId, setHoverTokenId] = useState<string | null>(null);
  const [focusedTokenId, setFocusedTokenId] = useState<string | null>(null);
  // Initialize with defaults to avoid hydration mismatch
  const [vizMode, setVizMode] = useState<VisualizationMode>("corpus-architecture");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [colorThemeId, setColorThemeId] = useState<ColorThemeId>(DEFAULT_COLOR_THEME_ID);
  const [lexicalColorMode, setLexicalColorMode] = useState<LexicalColorMode>("theme");
  const [customColorTheme, setCustomColorTheme] = useState<CustomColorTheme>(DEFAULT_CUSTOM_COLOR_THEME);
  const [experiencePhase, setExperiencePhase] = useState<ExperiencePhase>("none");
  const [showOnStartup, setShowOnStartup] = useState(true);
  const [experienceCompleted, setExperienceCompleted] = useState(false);
  const [lastCompletedAt, setLastCompletedAt] = useState<string | undefined>(undefined);
  const [walkthroughStepIndex, setWalkthroughStepIndex] = useState(0);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const mainVizRef = useRef<HTMLElement>(null);

  // Use context now
  // const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isSidebarOpen = isRightSidebarOpen;
  const setIsSidebarOpen = setRightSidebarOpen;

  const [selectedSurahId, setSelectedSurahId] = useState<number>(1);
  const [selectedRoot, setSelectedRoot] = useState<string | null>(null);
  const [selectedLemma, setSelectedLemma] = useState<string | null>(null);

  // Corpus loading state
  const [tokens, setTokens] = useState<CorpusToken[]>(() => getSampleData());
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress | null>(null);
  const [isLoadingCorpus, setIsLoadingCorpus] = useState(false);

  // Load persisted state after hydration (client-side only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const saved = JSON.parse(stored);
        if (saved.vizMode) setVizMode(saved.vizMode);
        if (saved.theme) setTheme(saved.theme);
        if (isValidColorThemeId(saved.colorThemeId)) setColorThemeId(saved.colorThemeId);
        if (isValidLexicalColorMode(saved.lexicalColorMode)) setLexicalColorMode(saved.lexicalColorMode);
        if (isValidCustomColorTheme(saved.customColorTheme)) setCustomColorTheme(saved.customColorTheme);
        if (saved.selectedSurahId) setSelectedSurahId(saved.selectedSurahId);
        if (saved.selectedRoot !== undefined) setSelectedRoot(saved.selectedRoot);
        if (saved.selectedLemma !== undefined) setSelectedLemma(saved.selectedLemma);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    applyColorTheme(colorThemeId, theme, customColorTheme);
  }, [theme, colorThemeId, customColorTheme]);

  // Persist state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          vizMode,
          theme,
          colorThemeId,
          lexicalColorMode,
          customColorTheme,
          selectedSurahId,
          selectedRoot,
          selectedLemma,
        })
      );
    } catch {
      // Ignore localStorage errors
    }
  }, [vizMode, theme, colorThemeId, lexicalColorMode, customColorTheme, selectedSurahId, selectedRoot, selectedLemma]);

  const handleCustomColorThemeChange = useCallback(
    (appearance: "light" | "dark", field: keyof CustomColorThemePalette, value: string) => {
      setCustomColorTheme((prev) => ({
        ...prev,
        [appearance]: {
          ...prev[appearance],
          [field]: value,
        },
      }));
      setColorThemeId("custom");
    },
    []
  );

  const handleResetCustomColorTheme = useCallback((appearance: "light" | "dark") => {
    setCustomColorTheme((prev) => ({
      ...prev,
      [appearance]: { ...DEFAULT_CUSTOM_COLOR_THEME[appearance] },
    }));
    setColorThemeId("custom");
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const sync = () => setIsMobileViewport(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
    };
  }, []);

  const persistExperienceState = useCallback((showOnStartupValue: boolean, completed: boolean, completedAt?: string) => {
    try {
      const payload: ExperienceStorageState = {
        version: EXPERIENCE_VERSION,
        showOnStartup: showOnStartupValue,
        completed,
        ...(completedAt ? { lastCompletedAt: completedAt } : {}),
      };
      localStorage.setItem(
        EXPERIENCE_STORAGE_KEY,
        JSON.stringify(payload)
      );
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(EXPERIENCE_STORAGE_KEY);
      if (!stored) {
        setExperiencePhase("onboarding");
        return;
      }

      const parsed = JSON.parse(stored);
      const showOnStartupValue = typeof parsed.showOnStartup === "boolean" ? parsed.showOnStartup : true;
      const completed = typeof parsed.completed === "boolean" ? parsed.completed : false;
      const version = typeof parsed.version === "string" ? parsed.version : null;
      const completedAt = typeof parsed.lastCompletedAt === "string" ? parsed.lastCompletedAt : undefined;

      setShowOnStartup(showOnStartupValue);
      setExperienceCompleted(completed);
      setLastCompletedAt(completedAt);

      if (version !== EXPERIENCE_VERSION) {
        setExperienceCompleted(false);
        setLastCompletedAt(undefined);
        if (showOnStartupValue) {
          setExperiencePhase("onboarding");
        } else {
          setExperiencePhase("none");
        }
        return;
      }

      if (!completed && showOnStartupValue) {
        setExperiencePhase("onboarding");
      } else {
        setExperiencePhase("none");
      }
    } catch {
      setExperiencePhase("onboarding");
    }
  }, []);

  const markExperienceCompleted = useCallback(() => {
    const completedAt = new Date().toISOString();
    setExperienceCompleted(true);
    setLastCompletedAt(completedAt);
    setExperiencePhase("none");
    setWalkthroughStepIndex(0);
    persistExperienceState(showOnStartup, true, completedAt);
  }, [persistExperienceState, showOnStartup]);

  const handleOnboardingStartupChange = useCallback(
    (value: boolean) => {
      setShowOnStartup(value);
      persistExperienceState(value, experienceCompleted, experienceCompleted ? lastCompletedAt : undefined);
    },
    [experienceCompleted, lastCompletedAt, persistExperienceState]
  );

  const handleOnboardingComplete = useCallback(() => {
    setExperiencePhase("none");
  }, []);

  const handleStartWalkthrough = useCallback(() => {
    if (isMobileViewport) {
      markExperienceCompleted();
      return;
    }
    setExperiencePhase("walkthrough");
    setWalkthroughStepIndex(0);
  }, [isMobileViewport, markExperienceCompleted]);

  const handleReplayExperience = useCallback(() => {
    setExperienceCompleted(false);
    setLastCompletedAt(undefined);
    setWalkthroughStepIndex(0);
    setExperiencePhase("onboarding");
    persistExperienceState(showOnStartup, false);
  }, [persistExperienceState, showOnStartup]);

  const handleWalkthroughNext = useCallback(() => {
    setWalkthroughStepIndex((prev) => Math.min(WALKTHROUGH_STEPS.length - 1, prev + 1));
  }, []);

  const handleWalkthroughBack = useCallback(() => {
    setWalkthroughStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  useEffect(() => {
    if (experiencePhase === "walkthrough" && isMobileViewport) {
      markExperienceCompleted();
    }
  }, [experiencePhase, isMobileViewport, markExperienceCompleted]);

  // Load full corpus on mount (background)
  useEffect(() => {
    let cancelled = false;

    const loadCorpus = async () => {
      setIsLoadingCorpus(true);
      console.log('[Page] Starting corpus load...');
      try {
        const corpusTokens = await loadFullCorpus((progress) => {
          if (!cancelled) {
            setLoadingProgress(progress);
            console.log(`[Page] Progress: ${progress.message}`);
          }
        });
        if (!cancelled && corpusTokens.length > 0) {
          console.log(`[Page] Corpus loaded: ${corpusTokens.length} tokens`);
          setTokens(corpusTokens);
        }
      } catch (err) {
        console.error('[Page] Failed to load corpus:', err);
      } finally {
        if (!cancelled) setIsLoadingCorpus(false);
      }
    };

    loadCorpus();
    return () => { cancelled = true; };
  }, []);

  // Merge with dependency data for visualization
  const allTokens = useMemo(() => {
    const merged = [...tokens, ...sampleAyahDependency.tokens];
    const byId = new Map(merged.map((token) => [token.id, token]));
    return [...byId.values()].sort(
      (a, b) => a.sura - b.sura || a.ayah - b.ayah || a.position - b.position
    );
  }, [tokens]);

  const tokenById = useMemo(
    () => new Map(allTokens.map((token) => [token.id, token])),
    [allTokens]
  );

  const flows = useMemo(() => buildRootWordFlows(allTokens), [allTokens]);
  const roots = useMemo(() => uniqueRoots(allTokens), [allTokens]);

  const focusedToken = useMemo(
    () => (focusedTokenId ? tokenById.get(focusedTokenId) ?? null : null),
    [focusedTokenId, tokenById]
  );
  const inspectorToken =
    focusedToken ||
    (hoverTokenId && tokenById.get(hoverTokenId)) ||
    null;
  const inspectorMode = focusedTokenId ? "focus" : hoverTokenId ? "hover" : "idle";
  const selectedAyahInSurah =
    focusedToken && focusedToken.sura === selectedSurahId ? focusedToken.ayah : null;
  // Focused token's root/lemma takes priority — it reflects the current interaction.
  // Fall back to explicitly selected root/lemma only when no token is focused.
  const selectedRootValue = focusedToken?.root || selectedRoot || null;
  const selectedLemmaValue = focusedToken?.lemma || selectedLemma || null;

  // When a root is selected but no specific token is focused, find a representative token
  // so the inspector can display meaningful morphology data.
  const representativeToken = useMemo(() => {
    if (focusedToken) return null; // Already have a focused token
    if (!selectedRoot) return null;
    // Find first token matching the selected root, preferring the currently selected surah
    const inSurah = allTokens.find(t => t.root === selectedRoot && t.sura === selectedSurahId);
    if (inSurah) return inSurah;
    return allTokens.find(t => t.root === selectedRoot) ?? null;
  }, [focusedToken, selectedRoot, allTokens, selectedSurahId]);

  const inspectorTokenFinal = inspectorToken || representativeToken;
  const inspectorModeFinal: "hover" | "focus" | "idle" = inspectorToken
    ? inspectorMode
    : representativeToken
      ? "focus"
      : "idle";

  // Handle search selection
  const handleTokenSelect = useCallback((tokenId: string) => {
    setFocusedTokenId(tokenId);
    const token = tokenById.get(tokenId);
    if (token) {
      setSelectedSurahId(token.sura);
    }
    setIsSidebarOpen(true);
  }, [tokenById, setIsSidebarOpen]);

  // Clear stale selection context when switching visualization modes
  const handleVizModeChange = useCallback((newMode: VisualizationMode) => {
    setVizMode(newMode);
    // Clear selection state that is contextual to the previous graph
    setSelectedRoot(null);
    setSelectedLemma(null);
    setFocusedTokenId(null);
    setHoverTokenId(null);
  }, []);

  const handleSurahSelect = useCallback(
    (suraId: number, preferredView?: "root-network" | "radial-sura") => {
      setSelectedSurahId(suraId);
      if (preferredView) {
        setVizMode(preferredView);
      }
    },
    []
  );

  const handleRootSelect = useCallback((root: string | null) => {
    setSelectedRoot(root);
    // When a root is explicitly selected from a visualization, clear the
    // previously focused token so the inspector shows the new root's data
    if (root) {
      setFocusedTokenId(null);
      setSelectedLemma(null);
    }
  }, []);

  const handleLemmaSelect = useCallback((lemma: string) => {
    setSelectedLemma(lemma);
  }, []);

  const handleWalkthroughEnd = useCallback(() => {
    handleVizModeChange("corpus-architecture");
    markExperienceCompleted();
  }, [handleVizModeChange, markExperienceCompleted]);

  useEffect(() => {
    if (experiencePhase !== "walkthrough") return;
    const step = WALKTHROUGH_STEPS[walkthroughStepIndex];
    if (!step) return;

    if (step.action === "set-viz-mode" && step.actionMode) {
      handleVizModeChange(step.actionMode);
    }
    if (step.openToolsSidebar) {
      setIsSidebarOpen(true);
    }
  }, [experiencePhase, walkthroughStepIndex, handleVizModeChange, setIsSidebarOpen]);

  // Render the active visualization
  const renderVisualization = () => {
    const vizContent = (() => {
      switch (vizMode) {
        case "radial-sura":
          return (
            <RadialSuraMap
              tokens={allTokens}
              suraId={selectedSurahId}
              suraName={SURAH_NAMES[selectedSurahId]?.name || `Surah ${selectedSurahId}`}
              suraNameArabic={SURAH_NAMES[selectedSurahId]?.arabic || ""}
              onTokenHover={setHoverTokenId}
              onTokenFocus={setFocusedTokenId}
              onRootSelect={handleRootSelect}
              highlightRoot={selectedRoot}
              theme={theme}
              lexicalColorMode={lexicalColorMode}
            />
          );

        case "root-network":
          return (
            <RootNetworkGraph
              tokens={allTokens}
              onTokenHover={setHoverTokenId}
              onTokenFocus={setFocusedTokenId}
              onRootSelect={handleRootSelect}
              highlightRoot={selectedRoot}
              selectedSurahId={selectedSurahId}
              theme={theme}
              showLabels={true}
              lexicalColorMode={lexicalColorMode}
            />
          );

        case "surah-distribution":
          return (
            <SurahDistributionGraph
              tokens={allTokens}
              onTokenHover={setHoverTokenId}
              onTokenFocus={setFocusedTokenId}
              onSurahSelect={(suraId) => handleSurahSelect(suraId, "radial-sura")}
              highlightRoot={selectedRoot}
              theme={theme}
              lexicalColorMode={lexicalColorMode}
            />
          );

        case "corpus-architecture":
          return (
            <CorpusArchitectureMap
              tokens={allTokens}
              selectedSurahId={selectedSurahId}
              highlightRoot={selectedRoot}
              onNodeSelect={(type, id) => {
                if (type === "surah") setSelectedSurahId(id as number);
                if (type === "root") handleRootSelect(id as string);
              }}
              theme={theme}
              lexicalColorMode={lexicalColorMode}
            />
          );

        case "arc-flow":
          return (
            <ArcFlowDiagram
              tokens={allTokens}
              groupBy="root"
              onTokenHover={setHoverTokenId}
              onTokenFocus={setFocusedTokenId}
              selectedSurahId={selectedSurahId}
              selectedAyah={selectedAyahInSurah}
              selectedRoot={selectedRootValue}
              selectedLemma={selectedLemmaValue}
              theme={theme}
              lexicalColorMode={lexicalColorMode}
            />
          );

        case "dependency-tree":
          return (
            <AyahDependencyGraph
              tokens={allTokens}
              selectedSurahId={selectedSurahId}
              selectedAyah={selectedAyahInSurah}
              onTokenHover={setHoverTokenId}
              onTokenFocus={setFocusedTokenId}
              onSurahChange={setSelectedSurahId}
              theme={theme}
              lexicalColorMode={lexicalColorMode}
            />
          );

        case "sankey-flow":
          return (
            <RootFlowSankey
              flows={flows}
              roots={roots}
              tokenById={tokenById}
              onTokenHover={setHoverTokenId}
              onTokenFocus={setFocusedTokenId}
              selectedSurahId={selectedSurahId}
              theme={theme}
              lexicalColorMode={lexicalColorMode}
            />
          );

        default:
          return null;
      }
    })();

    return (
      <VizErrorBoundary name={vizMode}>
        <Suspense fallback={<VizFallback />}>
          {vizContent}
        </Suspense>
      </VizErrorBoundary>
    );
  };

  return (
    <div className="immersive-dashboard" data-theme={theme}>
      <div className="neural-bg" aria-hidden />

      {/* Site Header */}
      <header className="floating-header">
        <div className="header-dock">
          <div className="brand-block" data-tour-id="header-brand">
            <Image src="/favicon.svg" alt="" className="brand-logo" width={28} height={28} />
            <div className="brand-text">
              <p className="eyebrow">{t('eyebrow')}</p>
              <div className="brand-title-row">
                <h1 className="brand-title">{t('brand')}</h1>
              </div>
            </div>
          </div>

          <div data-tour-id="global-search">
            <GlobalSearch
              tokens={allTokens}
              onTokenSelect={handleTokenSelect}
              onTokenHover={setHoverTokenId}
              onRootSelect={handleRootSelect}
            />
          </div>

          <div className="header-controls" data-tour-id="header-controls">
            {/* Desktop Only: Inline Controls */}
            {/* Desktop Only: Inline Controls */}
            <div className="desktop-only" style={{ display: 'contents' }}>
              <div className="header-button-group">
                <LanguageSwitcher />
              </div>
            </div>

            <div data-tour-id="display-settings">
              <DisplaySettingsPanel
                theme={theme}
                onThemeChange={setTheme}
                colorTheme={colorThemeId}
                onColorThemeChange={setColorThemeId}
                lexicalColorMode={lexicalColorMode}
                onLexicalColorModeChange={setLexicalColorMode}
                customColorTheme={customColorTheme}
                onCustomColorThemeChange={handleCustomColorThemeChange}
                onResetCustomColorTheme={handleResetCustomColorTheme}
                onReplayExperience={handleReplayExperience}
              />
            </div>

            <div data-tour-id="viz-switcher">
              <VisualizationSwitcher
                currentMode={vizMode}
                onModeChange={handleVizModeChange}
                theme={theme}
                onThemeChange={setTheme}
              />
            </div>
            <VizExportMenu
              targetRef={mainVizRef}
              vizMode={vizMode}
              selectedSurahId={selectedSurahId}
            />

            <div className="desktop-only" style={{ display: 'contents' }}>
              <button
                className={`sidebar-toggle-btn ${isSidebarOpen ? "active" : ""}`}
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                data-tour-id="tools-toggle"
              >
                {isSidebarOpen ? t('hideTools') : t('showTools')}
              </button>
            </div>

            {/* Mobile Only: Menu */}
            <MobileNavMenu theme={theme} onThemeChange={setTheme} />
          </div>
        </div>
      </header>

      {/* Loading indicator */}
      {
        isLoadingCorpus && loadingProgress && (
          <div className="loading-indicator">
            <div className="loading-bar">
              <div
                className="loading-progress"
                style={{
                  width: `${(loadingProgress.currentSura / loadingProgress.totalSuras) * 100}%`,
                }}
              />
            </div>
            <span className="loading-text">{loadingProgress.message}</span>
          </div>
        )
      }

      {/* Main Full-Screen Visualization */}
      <main ref={mainVizRef} className="immersive-viewport viz-fullwidth" data-tour-id="main-viewport">
        {renderVisualization()}
      </main>

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

      {/* Collapsible Sidebar */}
      <div className={`floating-sidebar ${isSidebarOpen ? "open" : ""}`} data-tour-id="tools-sidebar">
        <AppSidebar
          allTokens={allTokens}
          inspectorToken={inspectorTokenFinal}
          inspectorMode={inspectorModeFinal}
          onClearFocus={() => {
            setFocusedTokenId(null);
            setSelectedRoot(null);
            setSelectedLemma(null);
          }}
          onTokenHover={setHoverTokenId}
          onTokenFocus={setFocusedTokenId}
          onRootSelect={handleRootSelect}
          onSelectSurah={(surahId) => handleSurahSelect(surahId)}
          onLemmaSelect={handleLemmaSelect}
          selectedSurahId={selectedSurahId}
        />
      </div>

      <MobileBottomBar />

      <OnboardingOverlay
        isOpen={experiencePhase === "onboarding"}
        showOnStartup={showOnStartup}
        onShowOnStartupChange={handleOnboardingStartupChange}
        onComplete={handleOnboardingComplete}
        onSkip={markExperienceCompleted}
        onStartWalkthrough={handleStartWalkthrough}
      />
      <GuidedWalkthroughOverlay
        isOpen={experiencePhase === "walkthrough" && !isMobileViewport}
        steps={WALKTHROUGH_STEPS}
        stepIndex={walkthroughStepIndex}
        onNext={handleWalkthroughNext}
        onBack={handleWalkthroughBack}
        onSkip={handleWalkthroughEnd}
        onComplete={handleWalkthroughEnd}
      />

      <style jsx>{`
        .loading-indicator {
          position: fixed;
          top: var(--header-clearance);
          left: 50%;
          transform: translateX(-50%);
          z-index: 100;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: rgba(0, 0, 0, 0.75);
          border-radius: 12px;
          backdrop-filter: blur(8px);
        }

        .loading-bar {
          width: 200px;
          height: 4px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
          overflow: hidden;
        }

        .loading-progress {
          height: 100%;
          background: var(--accent);
          transition: width 0.3s ease;
        }

        .loading-text {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.8);
        }
      `}</style>
    </div>
  );
}

export default function HomePage() {
  return (
    <VizControlProvider>
      <HomePageContent />
    </VizControlProvider>
  );
}
