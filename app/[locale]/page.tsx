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
import MobileSearchOverlay from "@/components/ui/MobileSearchOverlay";
import VizExportMenu from "@/components/ui/VizExportMenu";
import OnboardingOverlay from "@/components/ui/OnboardingOverlay";
import GuidedWalkthroughOverlay from "@/components/ui/GuidedWalkthroughOverlay";
import VizBreadcrumbs from "@/components/ui/VizBreadcrumbs";
import { MOBILE_WALKTHROUGH_STEPS, WALKTHROUGH_STEPS } from "@/lib/data/walkthroughSteps";
import {
  trackBreadcrumbUsed,
  trackFirstTaskCompleted,
  trackFirstTaskFeedback,
  trackModeSwitched,
  trackOnboardingCompleted,
  trackOnboardingSkipped,
  trackOnboardingStarted,
  trackSearchOpened,
  trackSearchQuerySubmitted,
  trackSearchResultSelected,
  trackVizChanged,
  type SearchMatchType,
} from "@/lib/analytics/events";
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
const KnowledgeGraphViz = lazy(() => import("@/components/visualisations/KnowledgeGraphViz"));
const CollocationNetworkGraph = lazy(() => import("@/components/visualisations/CollocationNetworkGraph"));

const STORAGE_KEY = "quran-corpus-viz-state";
const EXPERIENCE_STORAGE_KEY = "quran-corpus-onboarding";
const FIRST_TASK_STORAGE_KEY = "quran-corpus-first-task-completed";
const FIRST_TASK_FEEDBACK_DISMISSED_KEY = "quran-corpus-first-task-feedback-dismissed";
const BEGINNER_PRIMARY_MODES: VisualizationMode[] = [
  "radial-sura",
  "surah-distribution",
  "root-network",
];

type ExperiencePhase = "none" | "onboarding" | "walkthrough";
type DataReadinessStatus = "sample" | "loading" | "full" | "fallback";

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
  const tViz = useTranslations("VisualizationSwitcher.modes");
  const { isLeftSidebarOpen, isRightSidebarOpen, setRightSidebarOpen } = useVizControl();
  const [hoverTokenId, setHoverTokenId] = useState<string | null>(null);
  const [focusedTokenId, setFocusedTokenId] = useState<string | null>(null);
  // Initialize with defaults to avoid hydration mismatch
  const [vizMode, setVizMode] = useState<VisualizationMode>("radial-sura");
  const [experienceLevel, setExperienceLevel] = useState<"beginner" | "advanced">("beginner");
  const [showAdvancedModes, setShowAdvancedModes] = useState(false);
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
  const [dataStatus, setDataStatus] = useState<DataReadinessStatus>("sample");
  const [hasCompletedFirstTask, setHasCompletedFirstTask] = useState(false);
  const [showFirstTaskFeedbackPrompt, setShowFirstTaskFeedbackPrompt] = useState(false);
  const mainVizRef = useRef<HTMLElement>(null);

  // Use context now
  // const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isSidebarOpen = isRightSidebarOpen;
  const setIsSidebarOpen = setRightSidebarOpen;

  const [selectedSurahId, setSelectedSurahId] = useState<number>(1);
  const [selectedRoot, setSelectedRoot] = useState<string | null>(null);
  const [selectedLemma, setSelectedLemma] = useState<string | null>(null);
  const [searchLockedRoot, setSearchLockedRoot] = useState<string | null>(null);

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
        if (saved.experienceLevel === "beginner" || saved.experienceLevel === "advanced") {
          setExperienceLevel(saved.experienceLevel);
        }
        if (typeof saved.showAdvancedModes === "boolean") {
          setShowAdvancedModes(saved.showAdvancedModes);
        }
        if (saved.theme) setTheme(saved.theme);
        if (isValidColorThemeId(saved.colorThemeId)) setColorThemeId(saved.colorThemeId);
        if (isValidLexicalColorMode(saved.lexicalColorMode)) setLexicalColorMode(saved.lexicalColorMode);
        if (isValidCustomColorTheme(saved.customColorTheme)) setCustomColorTheme(saved.customColorTheme);
        if (saved.selectedSurahId) setSelectedSurahId(saved.selectedSurahId);
        if (saved.selectedRoot !== undefined) setSelectedRoot(saved.selectedRoot);
        if (saved.selectedLemma !== undefined) setSelectedLemma(saved.selectedLemma);
      }
      const firstTaskCompleted = localStorage.getItem(FIRST_TASK_STORAGE_KEY) === "1";
      const feedbackDismissed = localStorage.getItem(FIRST_TASK_FEEDBACK_DISMISSED_KEY) === "1";
      setHasCompletedFirstTask(firstTaskCompleted);
      setShowFirstTaskFeedbackPrompt(firstTaskCompleted && !feedbackDismissed);
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
          experienceLevel,
          showAdvancedModes,
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
  }, [vizMode, experienceLevel, showAdvancedModes, theme, colorThemeId, lexicalColorMode, customColorTheme, selectedSurahId, selectedRoot, selectedLemma]);

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

  useEffect(() => {
    if (experiencePhase === "onboarding") {
      trackOnboardingStarted();
    }
  }, [experiencePhase]);

  const activeWalkthroughSteps = useMemo(
    () => (isMobileViewport ? MOBILE_WALKTHROUGH_STEPS : WALKTHROUGH_STEPS),
    [isMobileViewport]
  );

  const handleStartWalkthrough = useCallback(() => {
    setExperiencePhase("walkthrough");
    setWalkthroughStepIndex(0);
  }, []);

  const handleOnboardingSkip = useCallback(() => {
    trackOnboardingSkipped();
    markExperienceCompleted();
  }, [markExperienceCompleted]);

  const handleReplayExperience = useCallback(() => {
    setExperienceCompleted(false);
    setLastCompletedAt(undefined);
    setWalkthroughStepIndex(0);
    setExperiencePhase("onboarding");
    persistExperienceState(showOnStartup, false);
  }, [persistExperienceState, showOnStartup]);

  const handleWalkthroughNext = useCallback(() => {
    setWalkthroughStepIndex((prev) => Math.min(activeWalkthroughSteps.length - 1, prev + 1));
  }, [activeWalkthroughSteps.length]);

  const handleWalkthroughBack = useCallback(() => {
    setWalkthroughStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  useEffect(() => {
    setWalkthroughStepIndex((prev) => Math.min(prev, Math.max(0, activeWalkthroughSteps.length - 1)));
  }, [activeWalkthroughSteps.length]);

  // Load full corpus on mount (background)
  useEffect(() => {
    let cancelled = false;

    const loadCorpus = async () => {
      setIsLoadingCorpus(true);
      setDataStatus("loading");
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
          setDataStatus("full");
        } else if (!cancelled) {
          setDataStatus("fallback");
        }
      } catch (err) {
        console.error('[Page] Failed to load corpus:', err);
        if (!cancelled) {
          setDataStatus("fallback");
        }
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
      setSelectedRoot(token.root || null);
      setSelectedLemma(token.lemma || null);
      setSearchLockedRoot(null);
    }
    setIsSidebarOpen(true);
  }, [tokenById, setIsSidebarOpen]);

  // Clear stale selection context when switching visualization modes
  const handleVizModeChange = useCallback((newMode: VisualizationMode) => {
    if (newMode !== vizMode) {
      trackVizChanged(vizMode, newMode, experienceLevel);
    }
    setVizMode(newMode);
    // Don't clear selectedRoot and selectedLemma to make them persistent across graphs
    setFocusedTokenId(null);
    setHoverTokenId(null);
  }, [experienceLevel, vizMode]);

  const visibleVizModes = useMemo<VisualizationMode[]>(
    () => (experienceLevel === "advanced" || showAdvancedModes
      ? [
        "corpus-architecture",
        "surah-distribution",
        "radial-sura",
        "root-network",
        "arc-flow",
        "dependency-tree",
        "sankey-flow",
        "collocation-network",
        "knowledge-graph",
      ]
      : BEGINNER_PRIMARY_MODES),
    [experienceLevel, showAdvancedModes]
  );

  const handleExperienceLevelChange = useCallback((level: "beginner" | "advanced") => {
    if (level !== experienceLevel) {
      trackModeSwitched(experienceLevel, level);
    }
    setExperienceLevel(level);
    if (level === "advanced") {
      setShowAdvancedModes(true);
      return;
    }
    setShowAdvancedModes(false);
    if (!BEGINNER_PRIMARY_MODES.includes(vizMode)) {
      setVizMode("radial-sura");
    }
  }, [experienceLevel, vizMode]);

  useEffect(() => {
    if (visibleVizModes.includes(vizMode)) return;
    setVizMode(visibleVizModes[0] ?? "radial-sura");
  }, [visibleVizModes, vizMode]);

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
    // When a search-locked root is active, graph clicks do not override it
    if (searchLockedRoot && root && root !== searchLockedRoot) return;
    setSelectedRoot(root);
    // When a root is explicitly selected from a visualization, clear the
    // previously focused token so the inspector shows the new root's data
    if (root) {
      setFocusedTokenId(null);
      setSelectedLemma(null);
    }
  }, [searchLockedRoot]);

  // Callback for search panel: locks the root so graph clicks can't override it
  const handleSearchRootSelect = useCallback((root: string | null) => {
    setSearchLockedRoot(root);
    setSelectedRoot(root);
    if (root) {
      setFocusedTokenId(null);
      setSelectedLemma(null);
    }
  }, []);

  const handleLemmaSelect = useCallback((lemma: string) => {
    setSelectedLemma(lemma);
  }, []);

  const handleWalkthroughEnd = useCallback(() => {
    handleVizModeChange("radial-sura");
    markExperienceCompleted();
  }, [handleVizModeChange, markExperienceCompleted]);

  const handleWalkthroughSkip = useCallback(() => {
    trackOnboardingSkipped();
    handleWalkthroughEnd();
  }, [handleWalkthroughEnd]);

  const handleWalkthroughComplete = useCallback(() => {
    trackOnboardingCompleted();
    handleWalkthroughEnd();
  }, [handleWalkthroughEnd]);

  const isHierarchicalMode = useMemo(
    () => ["corpus-architecture", "radial-sura", "surah-distribution", "dependency-tree"].includes(vizMode),
    [vizMode]
  );

  const handleBreadcrumbNavigate = useCallback((level: "quran" | "surah" | "ayah" | "root") => {
    trackBreadcrumbUsed(level);
    if (level === "quran") {
      setSelectedSurahId(1);
      setFocusedTokenId(null);
      setSelectedRoot(null);
      setSelectedLemma(null);
      setSearchLockedRoot(null);
      return;
    }

    if (level === "surah") {
      setFocusedTokenId(null);
      setSelectedRoot(null);
      setSelectedLemma(null);
      setSearchLockedRoot(null);
      return;
    }

    if (level === "ayah") {
      if (selectedAyahInSurah) {
        const ayahToken = allTokens.find((token) => token.sura === selectedSurahId && token.ayah === selectedAyahInSurah);
        if (ayahToken) {
          setFocusedTokenId(ayahToken.id);
        }
      }
      setSelectedRoot(null);
      setSelectedLemma(null);
      setSearchLockedRoot(null);
      return;
    }

    if (selectedRootValue) {
      setFocusedTokenId(null);
      setSelectedRoot(selectedRootValue);
      setSelectedLemma(null);
      setSearchLockedRoot(selectedRootValue);
    }
  }, [selectedAyahInSurah, allTokens, selectedSurahId, selectedRootValue]);

  const handleSearchOpened = useCallback((surface: "header" | "sidebar" | "mobile") => {
    trackSearchOpened(surface);
  }, []);

  const handleSearchQuerySubmitted = useCallback((query: string, surface: "header" | "sidebar" | "mobile") => {
    trackSearchQuerySubmitted(query, surface);
  }, []);

  const handleSearchResultSelected = useCallback((matchType: SearchMatchType, surface: "header" | "sidebar" | "mobile") => {
    trackSearchResultSelected(matchType, surface);
    if (!hasCompletedFirstTask) {
      setHasCompletedFirstTask(true);
      setShowFirstTaskFeedbackPrompt(true);
      trackFirstTaskCompleted();
      try {
        localStorage.setItem(FIRST_TASK_STORAGE_KEY, "1");
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [hasCompletedFirstTask]);

  const handleFirstTaskFeedback = useCallback((rating: "helpful" | "not_helpful") => {
    trackFirstTaskFeedback(rating);
    setShowFirstTaskFeedbackPrompt(false);
    try {
      localStorage.setItem(FIRST_TASK_FEEDBACK_DISMISSED_KEY, "1");
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleDismissFirstTaskFeedback = useCallback(() => {
    setShowFirstTaskFeedbackPrompt(false);
    try {
      localStorage.setItem(FIRST_TASK_FEEDBACK_DISMISSED_KEY, "1");
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  useEffect(() => {
    if (experiencePhase !== "walkthrough") return;
    const step = activeWalkthroughSteps[walkthroughStepIndex];
    if (!step) return;

    if (step.action === "set-viz-mode" && step.actionMode) {
      handleVizModeChange(step.actionMode);
    }
    if (step.openToolsSidebar) {
      setIsSidebarOpen(true);
    }
  }, [experiencePhase, walkthroughStepIndex, activeWalkthroughSteps, handleVizModeChange, setIsSidebarOpen]);

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

        case "knowledge-graph":
          return (
            <KnowledgeGraphViz
              tokens={allTokens}
              onRootSelect={handleRootSelect}
              theme={theme}
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

        case "collocation-network":
          return (
            <CollocationNetworkGraph
              tokens={allTokens}
              onTokenHover={setHoverTokenId}
              onTokenFocus={setFocusedTokenId}
              onRootSelect={handleRootSelect}
              highlightRoot={selectedRoot}
              selectedSurahId={selectedSurahId}
              theme={theme}
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

          <div data-tour-id="global-search" className="desktop-only">
            <GlobalSearch
              tokens={allTokens}
              onTokenSelect={handleTokenSelect}
              onTokenHover={setHoverTokenId}
              onRootSelect={handleRootSelect}
              onSearchOpened={() => handleSearchOpened("header")}
              onSearchQuerySubmitted={(query) => handleSearchQuerySubmitted(query, "header")}
              onSearchResultSelected={(matchType) => handleSearchResultSelected(matchType, "header")}
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
                  experienceLevel={experienceLevel}
                  onExperienceLevelChange={handleExperienceLevelChange}
                  onReplayExperience={handleReplayExperience}
                  exportTargetRef={mainVizRef}
                  vizMode={vizMode}
                  selectedSurahId={selectedSurahId}
                />
            </div>

            <div data-tour-id="viz-switcher">
              <VisualizationSwitcher
                currentMode={vizMode}
                onModeChange={handleVizModeChange}
                experienceLevel={experienceLevel}
                showAdvancedModes={showAdvancedModes}
                onToggleAdvancedModes={setShowAdvancedModes}
                theme={theme}
                onThemeChange={setTheme}
              />
            </div>
            <div className="desktop-only" style={{ display: 'contents' }}>
              <VizExportMenu
                targetRef={mainVizRef}
                vizMode={vizMode}
                selectedSurahId={selectedSurahId}
              />
            </div>

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
        <div className={`data-status-badge data-status-${dataStatus}`}>
          <strong>{t(`dataStatus.${dataStatus}.title`)}</strong>
          <span>{t(`dataStatus.${dataStatus}.description`)}</span>
        </div>
        <VizBreadcrumbs
          isHierarchical={isHierarchicalMode}
          viewLabel={tViz(`${vizMode}.label`)}
          surahId={selectedSurahId}
          surahName={SURAH_NAMES[selectedSurahId]?.name ?? `${selectedSurahId}`}
          ayah={selectedAyahInSurah}
          root={selectedRootValue}
          onNavigate={handleBreadcrumbNavigate}
        />

      {/* Main Full-Screen Visualization */}
      <main ref={mainVizRef} className="immersive-viewport viz-fullwidth" data-tour-id="main-viewport">
        {renderVisualization()}
      </main>
      {showFirstTaskFeedbackPrompt && (
        <div className="first-task-feedback" role="status" aria-live="polite">
          <p>{t("feedbackPrompt.question")}</p>
          <div className="first-task-feedback-actions">
            <button type="button" onClick={() => handleFirstTaskFeedback("helpful")}>
              {t("feedbackPrompt.helpful")}
            </button>
            <button type="button" onClick={() => handleFirstTaskFeedback("not_helpful")}>
              {t("feedbackPrompt.notHelpful")}
            </button>
            <button type="button" onClick={handleDismissFirstTaskFeedback}>
              {t("feedbackPrompt.dismiss")}
            </button>
          </div>
        </div>
      )}

      {(!isMobileViewport || isLeftSidebarOpen) && (
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
      )}

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
            setSearchLockedRoot(null);
          }}
          onTokenHover={setHoverTokenId}
          onTokenFocus={setFocusedTokenId}
          onTokenSelect={handleTokenSelect}
          onRootSelect={handleRootSelect}
          onSearchRootSelect={handleSearchRootSelect}
          onSelectSurah={handleSurahSelect}
          onLemmaSelect={handleLemmaSelect}
          selectedSurahId={selectedSurahId}
          onSearchOpened={() => handleSearchOpened("sidebar")}
          onSearchQuerySubmitted={(query) => handleSearchQuerySubmitted(query, "sidebar")}
          onSearchResultSelected={(matchType) => handleSearchResultSelected(matchType, "sidebar")}
        />
      </div>

      <MobileBottomBar />
      <MobileSearchOverlay
        tokens={allTokens}
        onTokenSelect={handleTokenSelect}
        onTokenHover={setHoverTokenId}
        onRootSelect={handleRootSelect}
        onSearchOpened={() => handleSearchOpened("mobile")}
        onSearchQuerySubmitted={(query) => handleSearchQuerySubmitted(query, "mobile")}
        onSearchResultSelected={(matchType) => handleSearchResultSelected(matchType, "mobile")}
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

        .data-status-badge {
          position: fixed;
          top: calc(var(--header-clearance) + 44px);
          left: 50%;
          transform: translateX(-50%);
          z-index: 40;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          max-width: min(calc(100vw - 24px), 620px);
          border-radius: 999px;
          border: 1px solid var(--line);
          background: rgba(8, 10, 16, 0.72);
          backdrop-filter: blur(8px);
          color: var(--ink-secondary);
          font-size: 0.74rem;
          white-space: nowrap;
          overflow: hidden;
        }

        .data-status-badge strong {
          flex: 0 0 auto;
          color: var(--ink);
          font-weight: 700;
        }

        .data-status-badge span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .data-status-badge.data-status-full {
          border-color: rgba(14, 165, 233, 0.4);
        }

        .data-status-badge.data-status-fallback {
          border-color: rgba(251, 191, 36, 0.55);
        }

        @media (max-width: 1100px) {
          .data-status-badge {
            top: calc(var(--header-clearance) + 6px);
            max-width: calc(100vw - 20px);
            width: auto;
            padding: 4px 8px;
            font-size: 0.62rem;
            gap: 5px;
          }

          .data-status-badge span {
            display: none;
          }
        }

        .first-task-feedback {
          position: fixed;
          bottom: calc(var(--footer-height) + 18px);
          right: 18px;
          z-index: 101;
          width: min(340px, calc(100vw - 24px));
          border-radius: 12px;
          border: 1px solid var(--line);
          background: rgba(8, 10, 16, 0.86);
          backdrop-filter: blur(8px);
          padding: 10px;
          color: var(--ink-secondary);
          font-size: 0.78rem;
        }

        .first-task-feedback p {
          margin: 0 0 8px;
          color: var(--ink);
        }

        .first-task-feedback-actions {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .first-task-feedback button {
          border: 1px solid var(--line);
          border-radius: 8px;
          background: transparent;
          color: var(--ink-secondary);
          padding: 6px 8px;
          font: inherit;
          cursor: pointer;
        }

        .first-task-feedback button:hover,
        .first-task-feedback button:focus-visible {
          border-color: var(--accent);
          color: var(--ink);
          outline: none;
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
