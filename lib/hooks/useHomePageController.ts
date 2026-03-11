"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCorpusData } from "@/lib/hooks/useCorpusData";
import type { CorpusOverviewData } from "@/lib/corpus/overviewData";
import { MOBILE_WALKTHROUGH_STEPS, WALKTHROUGH_STEPS } from "@/lib/data/walkthroughSteps";
import { readDevSearchStatus } from "@/lib/dev/testOverrides";
import {
  trackBreadcrumbUsed,
  trackFirstTaskCompleted,
  trackFirstTaskFeedback,
  trackModeSwitched,
  trackOnboardingCompleted,
  trackOnboardingSkipped,
  trackOnboardingStarted,
  trackPerformanceMetric,
  trackSearchRecoveryShown,
  trackSearchOpened,
  trackSearchQuerySubmitted,
  trackSearchResultSelected,
  trackVizChanged,
  type SearchMatchType,
} from "@/lib/analytics/events";
import { EXPERIENCE_VERSION } from "@/lib/config/version";
import { VizControlProvider, useVizControl } from "@/lib/hooks/VizControlContext";
import type { ExperienceLevel } from "@/lib/schema/experience";
import type { WalkthroughStepConfig } from "@/lib/schema/walkthrough";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";
import { buildRootWordFlows, uniqueRoots } from "@/lib/search/rootFlows";
import {
  DEFAULT_COLOR_THEME_ID,
  DEFAULT_CUSTOM_COLOR_THEME,
  applyColorTheme,
  isValidColorThemeId,
  isValidCustomColorTheme,
  type ColorThemeId,
  type CustomColorTheme,
  type CustomColorThemePalette,
} from "@/lib/theme/colorThemes";
import { isValidLexicalColorMode, type LexicalColorMode } from "@/lib/theme/lexicalColoring";
import { writeRecentExplorationState as persistRecentExplorationState } from "@/lib/hooks/useRecentExplorationState";

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
type SearchAvailabilityStatus = "available" | "unavailable";

interface ContextTransformNotice {
  title: string;
  description: string;
  recoveryLabel?: string;
}

interface ViewContextCapabilities {
  ayah: boolean;
  root: boolean;
  lemma: boolean;
}

const VIEW_CONTEXT_CAPABILITIES: Record<VisualizationMode, ViewContextCapabilities> = {
  "corpus-architecture": { ayah: false, root: true, lemma: false },
  "surah-distribution": { ayah: false, root: true, lemma: false },
  "radial-sura": { ayah: true, root: true, lemma: false },
  "root-network": { ayah: false, root: true, lemma: false },
  "arc-flow": { ayah: true, root: true, lemma: true },
  "dependency-tree": { ayah: true, root: false, lemma: false },
  "sankey-flow": { ayah: false, root: false, lemma: false },
  "collocation-network": { ayah: false, root: true, lemma: false },
  "knowledge-graph": { ayah: false, root: true, lemma: false },
  "heatmap": { ayah: false, root: false, lemma: false },
};

function describeContextTransform(
  nextMode: VisualizationMode,
  context: {
    surahId: number;
    ayah: number | null;
    root: string | null;
    lemma: string | null;
  }
): ContextTransformNotice | null {
  const capabilities = VIEW_CONTEXT_CAPABILITIES[nextMode];
  const hidden: string[] = [];

  if (context.ayah && !capabilities.ayah) hidden.push("ayah detail");
  if (context.root && !capabilities.root) hidden.push("root focus");
  if (context.lemma && !capabilities.lemma) hidden.push("lemma detail");

  if (nextMode === "dependency-tree" && !context.ayah) {
    return {
      title: "Switched to syntax view",
      description: `Dependency view keeps surah ${context.surahId}, but it needs a specific ayah before syntax details can appear.`,
    };
  }

  if (hidden.length === 0) return null;

  return {
    title: "Context adjusted for this view",
    description: `Switched to ${nextMode.replace(/-/g, " ")}. Preserved surah ${context.surahId}, while ${hidden.join(" and ")} ${hidden.length > 1 ? "are" : "is"} hidden in this view.`,
  };
}

interface ExperienceStorageState {
  version: string;
  showOnStartup: boolean;
  completed: boolean;
  lastCompletedAt?: string;
}

export function useHomePageController(initialCorpusData?: CorpusOverviewData) {
  const { isLeftSidebarOpen, isRightSidebarOpen, setRightSidebarOpen } = useVizControl();
  const [hoverTokenId, setHoverTokenId] = useState<string | null>(null);
  const [focusedTokenId, setFocusedTokenId] = useState<string | null>(null);
  const [vizMode, setVizMode] = useState<VisualizationMode>("radial-sura");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>("beginner");
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
  const [searchStatus, setSearchStatus] = useState<SearchAvailabilityStatus>("available");
  const [contextTransformNotice, setContextTransformNotice] = useState<ContextTransformNotice | null>(null);
  const [focusRecoveryTarget, setFocusRecoveryTarget] = useState<{ tokenId: string; mode: VisualizationMode } | null>(null);
  const [hasCompletedFirstTask, setHasCompletedFirstTask] = useState(false);
  const [showFirstTaskFeedbackPrompt, setShowFirstTaskFeedbackPrompt] = useState(false);
  const [selectedSurahId, setSelectedSurahId] = useState<number>(1);
  const [selectedRoot, setSelectedRoot] = useState<string | null>(null);
  const [selectedLemma, setSelectedLemma] = useState<string | null>(null);
  const [searchLockedRoot, setSearchLockedRoot] = useState<string | null>(null);
  const { allTokens, dataStatus, readiness, overview, overviewSource, loadingProgress, isLoadingCorpus } = useCorpusData(initialCorpusData);
  const mainVizRef = useRef<HTMLElement>(null);
  const hasTrackedShellRenderRef = useRef(false);

  const isSidebarOpen = isRightSidebarOpen;
  const setIsSidebarOpen = setRightSidebarOpen;

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

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    applyColorTheme(colorThemeId, theme, customColorTheme);
  }, [theme, colorThemeId, customColorTheme]);

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

  useEffect(() => {
    if (hasTrackedShellRenderRef.current) return;
    const navigationEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const durationMs = navigationEntry ? Math.round(navigationEntry.domContentLoadedEventEnd) : Math.round(performance.now());
    trackPerformanceMetric("shell_render", "explore", durationMs, {
      shell_ready: readiness.overviewReady,
      corpus_source: overviewSource,
    });
    hasTrackedShellRenderRef.current = true;
  }, [overviewSource, readiness.overviewReady]);

  const persistExperienceState = useCallback((showOnStartupValue: boolean, completed: boolean, completedAt?: string) => {
    try {
      const payload: ExperienceStorageState = {
        version: EXPERIENCE_VERSION,
        showOnStartup: showOnStartupValue,
        completed,
        ...(completedAt ? { lastCompletedAt: completedAt } : {}),
      };
      localStorage.setItem(EXPERIENCE_STORAGE_KEY, JSON.stringify(payload));
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
        setExperiencePhase(showOnStartupValue ? "onboarding" : "none");
        return;
      }

      setExperiencePhase(!completed && showOnStartupValue ? "onboarding" : "none");
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

  const activeWalkthroughSteps = useMemo<WalkthroughStepConfig[]>(
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

  useEffect(() => {
    const devSearchStatus = readDevSearchStatus();
    if (devSearchStatus) {
      setSearchStatus(devSearchStatus);
    }
  }, []);

  useEffect(() => {
    if (searchStatus === "unavailable") {
      trackSearchRecoveryShown("explore");
    }
  }, [searchStatus]);

  const tokenById = useMemo(() => new Map(allTokens.map((token) => [token.id, token])), [allTokens]);
  const flows = useMemo(() => buildRootWordFlows(allTokens), [allTokens]);
  const roots = useMemo(() => uniqueRoots(allTokens), [allTokens]);

  const focusedToken = useMemo(
    () => (focusedTokenId ? tokenById.get(focusedTokenId) ?? null : null),
    [focusedTokenId, tokenById]
  );
  const inspectorToken = focusedToken || (hoverTokenId ? tokenById.get(hoverTokenId) : null) || null;
  const inspectorMode = focusedTokenId ? "focus" : hoverTokenId ? "hover" : "idle";
  const selectedAyahInSurah = focusedToken && focusedToken.sura === selectedSurahId ? focusedToken.ayah : null;
  const selectedRootValue = focusedToken?.root || selectedRoot || null;
  const selectedLemmaValue = focusedToken?.lemma || selectedLemma || null;

  const representativeToken = useMemo(() => {
    if (focusedToken) return null;
    if (!selectedRoot) return null;
    const inSurah = allTokens.find((token) => token.root === selectedRoot && token.sura === selectedSurahId);
    if (inSurah) return inSurah;
    return allTokens.find((token) => token.root === selectedRoot) ?? null;
  }, [focusedToken, selectedRoot, allTokens, selectedSurahId]);

  const inspectorTokenFinal = inspectorToken || representativeToken;
  const inspectorModeFinal: "hover" | "focus" | "idle" = inspectorToken ? inspectorMode : representativeToken ? "focus" : "idle";

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

  const handleVizModeChange = useCallback((newMode: VisualizationMode) => {
    if (newMode !== vizMode) {
      trackVizChanged(vizMode, newMode, experienceLevel);
    }
    const nextCapabilities = VIEW_CONTEXT_CAPABILITIES[newMode];
    const nextNotice = describeContextTransform(newMode, {
      surahId: selectedSurahId,
      ayah: selectedAyahInSurah,
      root: selectedRootValue,
      lemma: selectedLemmaValue,
    });
    if (focusedTokenId && selectedAyahInSurah && !nextCapabilities.ayah) {
      setFocusRecoveryTarget({
        tokenId: focusedTokenId,
        mode: "radial-sura",
      });
      if (nextNotice) {
        nextNotice.recoveryLabel = "Restore focused ayah";
      }
    } else {
      setFocusRecoveryTarget(null);
    }
    setVizMode(newMode);
    setFocusedTokenId(null);
    setHoverTokenId(null);
    setContextTransformNotice(nextNotice);
  }, [experienceLevel, focusedTokenId, selectedAyahInSurah, selectedLemmaValue, selectedRootValue, selectedSurahId, vizMode]);

  useEffect(() => {
    if (!contextTransformNotice) return;
    const timeoutId = window.setTimeout(() => {
      setContextTransformNotice(null);
      setFocusRecoveryTarget(null);
    }, 5000);
    return () => window.clearTimeout(timeoutId);
  }, [contextTransformNotice]);

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

  const handleExperienceLevelChange = useCallback((level: ExperienceLevel) => {
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

  useEffect(() => {
    persistRecentExplorationState({
      lastVisualizationMode: vizMode,
      lastSurahId: selectedSurahId,
      lastAyah: selectedAyahInSurah ?? undefined,
      lastRoot: selectedRootValue ?? undefined,
      lastLemma: selectedLemmaValue ?? undefined,
      updatedAt: new Date().toISOString(),
    });
  }, [vizMode, selectedSurahId, selectedAyahInSurah, selectedRootValue, selectedLemmaValue]);

  const handleSurahSelect = useCallback((suraId: number, preferredView?: "root-network" | "radial-sura") => {
    setSelectedSurahId(suraId);
    if (preferredView) {
      setVizMode(preferredView);
    }
  }, []);

  const handleRootSelect = useCallback((root: string | null) => {
    if (searchLockedRoot && root && root !== searchLockedRoot) return;
    setSelectedRoot(root);
    if (root) {
      setFocusedTokenId(null);
      setSelectedLemma(null);
    }
  }, [searchLockedRoot]);

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

  const handleRestoreFocusedContext = useCallback(() => {
    if (!focusRecoveryTarget) return;
    const token = tokenById.get(focusRecoveryTarget.tokenId);
    setVizMode(focusRecoveryTarget.mode);
    if (token) {
      setSelectedSurahId(token.sura);
      setSelectedRoot(token.root || null);
      setSelectedLemma(token.lemma || null);
      setFocusedTokenId(token.id);
      setSearchLockedRoot(null);
    }
    setHoverTokenId(null);
    setContextTransformNotice(null);
    setFocusRecoveryTarget(null);
  }, [focusRecoveryTarget, tokenById]);

  const handleDismissContextTransformNotice = useCallback(() => {
    setContextTransformNotice(null);
    setFocusRecoveryTarget(null);
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

  return {
    mainVizRef,
    allTokens,
    flows,
    roots,
    tokenById,
    vizMode,
    experienceLevel,
    showAdvancedModes,
    theme,
    colorThemeId,
    lexicalColorMode,
    customColorTheme,
    experiencePhase,
    showOnStartup,
    walkthroughStepIndex,
    isMobileViewport,
    dataStatus,
    readiness,
    overview,
    searchStatus,
    contextTransformNotice,
    showFirstTaskFeedbackPrompt,
    isSidebarOpen,
    isLeftSidebarOpen,
    selectedSurahId,
    selectedRoot,
    selectedLemma,
    focusedToken,
    selectedAyahInSurah,
    selectedRootValue,
    selectedLemmaValue,
    inspectorTokenFinal,
    inspectorModeFinal,
    isHierarchicalMode,
    loadingProgress,
    isLoadingCorpus,
    activeWalkthroughSteps,
    setTheme,
    setColorThemeId,
    setLexicalColorMode,
    setShowAdvancedModes,
    setIsSidebarOpen,
    setHoverTokenId,
    setFocusedTokenId,
    setSelectedSurahId,
    setSelectedRoot,
    setSelectedLemma,
    setSearchLockedRoot,
    handleCustomColorThemeChange,
    handleResetCustomColorTheme,
    handleOnboardingStartupChange,
    handleOnboardingComplete,
    handleStartWalkthrough,
    handleOnboardingSkip,
    handleReplayExperience,
    handleWalkthroughNext,
    handleWalkthroughBack,
    handleExperienceLevelChange,
    handleTokenSelect,
    handleVizModeChange,
    handleSurahSelect,
    handleRootSelect,
    handleSearchRootSelect,
    handleLemmaSelect,
    handleWalkthroughSkip,
    handleWalkthroughComplete,
    handleBreadcrumbNavigate,
    handleSearchOpened,
    handleSearchQuerySubmitted,
    handleSearchResultSelected,
    handleFirstTaskFeedback,
    handleDismissFirstTaskFeedback,
    handleDismissContextTransformNotice,
    handleRestoreFocusedContext,
    setContextTransformNotice,
  };
}

export { VizControlProvider };
