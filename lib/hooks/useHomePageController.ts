"use client";

import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { useCorpusData } from "@/lib/hooks/useCorpusData";
import type { CorpusOverviewData } from "@/lib/corpus/overviewData";
import {
  trackBreadcrumbUsed,
  trackPerformanceMetric,
  trackVizChanged,
} from "@/lib/analytics/events";
import { VizControlProvider, useVizControl } from "@/lib/hooks/VizControlContext";
import { buildRootWordFlows, uniqueRoots } from "@/lib/search/rootFlows";
import {
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
import {
  DEFAULT_THEME_PREFERENCE_STATE,
  THEME_COOKIE_NAME,
  serializeThemePreferenceCookie,
  type ThemePreferenceState,
} from "@/lib/theme/themePreferences";
import { useSelectionState } from "@/lib/hooks/useSelectionState";
import {
  useVizModeState,
  VIEW_CONTEXT_CAPABILITIES,
  describeContextTransform,
} from "@/lib/hooks/useVizModeState";
import { useOnboardingState } from "@/lib/hooks/useOnboardingState";
import { useSearchTracking } from "@/lib/hooks/useSearchTracking";
import { getMissionByIntent, type MissionIntent } from "@/lib/config/missions";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";
import type { SearchResultItem } from "@/lib/search/searchTypes";

const STORAGE_KEY = "quran-corpus-viz-state";

export function useHomePageController(
  initialCorpusData?: CorpusOverviewData,
  initialThemePreference: ThemePreferenceState = DEFAULT_THEME_PREFERENCE_STATE
) {
  // ---------------------------------------------------------------------------
  // Layout (from VizControlContext)
  // ---------------------------------------------------------------------------
  const { isLeftSidebarOpen, isRightSidebarOpen, setRightSidebarOpen, isMobileViewport } =
    useVizControl();
  const isSidebarOpen = isRightSidebarOpen;
  const setIsSidebarOpen = setRightSidebarOpen;
  const mainVizRef = useRef<HTMLElement>(null);
  const hasTrackedShellRenderRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Corpus data
  // ---------------------------------------------------------------------------
  const {
    allTokens,
    dataStatus,
    readiness,
    overview,
    overviewSource,
    loadingProgress,
    isLoadingCorpus,
    requestSurahContext,
  } = useCorpusData(initialCorpusData);
  const flows = useMemo(() => buildRootWordFlows(allTokens), [allTokens]);
  const roots = useMemo(() => uniqueRoots(allTokens), [allTokens]);

  // ---------------------------------------------------------------------------
  // Domain: Selection
  // ---------------------------------------------------------------------------
  const {
    selectedSurahId,
    setSelectedSurahId,
    selectedRoot,
    setSelectedRoot,
    selectedLemma,
    setSelectedLemma,
    focusedTokenId,
    setFocusedTokenId,
    setHoverTokenId,
    searchLockedRoot,
    setSearchLockedRoot,
    focusedToken,
    selectedAyahInSurah,
    selectedRootValue,
    selectedLemmaValue,
    inspectorTokenFinal,
    inspectorModeFinal,
    tokenById,
  } = useSelectionState(allTokens);

  // Context-first loading: prioritise building the open surah from the QAC
  // morphology so it renders fully (POS bars + roots/arcs) without waiting for
  // the entire corpus to stream in behind it.
  useEffect(() => {
    requestSurahContext(selectedSurahId);
  }, [selectedSurahId, requestSurahContext]);

  // ---------------------------------------------------------------------------
  // Domain: Visualization mode
  // ---------------------------------------------------------------------------
  const {
    vizMode,
    setVizMode,
    experienceLevel,
    setExperienceLevel,
    showAdvancedModes,
    setShowAdvancedModes,
    visibleVizModes: _,
    isHierarchicalMode,
    contextTransformNotice,
    setContextTransformNotice,
    focusRecoveryTarget,
    setFocusRecoveryTarget,
    vizSuggestion,
    setVizSuggestion,
    handleExperienceLevelChange,
    handleDismissVizSuggestion,
    handleDismissContextTransformNotice,
    suggestVisualization,
  } = useVizModeState();

  // ---------------------------------------------------------------------------
  // Domain: Onboarding & mission
  // ---------------------------------------------------------------------------
  const {
    firstRunState,
    showOnStartup,
    activeMissionIntent,
    missionProgress,
    handleSelectIntent,
    handleMissionTaskComplete,
    handleMissionComplete,
    handleOnboardingSkip,
    handleOnboardingStartupChange,
    handleReplayExperience,
    markExperienceCompleted,
  } = useOnboardingState(isMobileViewport);

  // ---------------------------------------------------------------------------
  // Domain: Search tracking
  // ---------------------------------------------------------------------------
  const {
    searchStatus,
    showFirstTaskFeedbackPrompt,
    handleSearchOpened,
    handleSearchQuerySubmitted,
    handleSearchResultSelected,
    handleFirstTaskFeedback,
    handleDismissFirstTaskFeedback,
  } = useSearchTracking();

  // ---------------------------------------------------------------------------
  // Theme state (kept in controller — not yet extracted)
  // ---------------------------------------------------------------------------
  const [theme, setTheme] = useState<"light" | "dark">(initialThemePreference.theme);
  const [colorThemeId, setColorThemeId] = useState<ColorThemeId>(
    initialThemePreference.colorThemeId
  );
  const [lexicalColorMode, setLexicalColorMode] = useState<LexicalColorMode>("theme");
  const [customColorTheme, setCustomColorTheme] = useState<CustomColorTheme>(
    initialThemePreference.customColorTheme
  );

  // ---------------------------------------------------------------------------
  // LocalStorage hydration (spans multiple domains)
  // ---------------------------------------------------------------------------
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
        if (isValidLexicalColorMode(saved.lexicalColorMode))
          setLexicalColorMode(saved.lexicalColorMode);
        if (isValidCustomColorTheme(saved.customColorTheme))
          setCustomColorTheme(saved.customColorTheme);
        if (saved.selectedSurahId) setSelectedSurahId(saved.selectedSurahId);
        if (saved.selectedRoot !== undefined) setSelectedRoot(saved.selectedRoot);
        if (saved.selectedLemma !== undefined) setSelectedLemma(saved.selectedLemma);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Theme effects
  // ---------------------------------------------------------------------------
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    applyColorTheme(colorThemeId, theme, customColorTheme);
  }, [theme, colorThemeId, customColorTheme]);

  // ---------------------------------------------------------------------------
  // Persist to localStorage
  // ---------------------------------------------------------------------------
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
      document.cookie = `${THEME_COOKIE_NAME}=${serializeThemePreferenceCookie({
        theme,
        colorThemeId,
        customColorTheme,
      })}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      // Ignore localStorage errors
    }
  }, [
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
  ]);

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

  // ---------------------------------------------------------------------------
  // Performance tracking
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (hasTrackedShellRenderRef.current) return;
    const navigationEntry = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    const durationMs = navigationEntry
      ? Math.round(navigationEntry.domContentLoadedEventEnd)
      : Math.round(performance.now());
    trackPerformanceMetric("shell_render", "explore", durationMs, {
      shell_ready: readiness.overviewReady,
      corpus_source: overviewSource,
    });
    hasTrackedShellRenderRef.current = true;
  }, [overviewSource, readiness.overviewReady]);

  // ---------------------------------------------------------------------------
  // Recent exploration persistence
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Cross-cutting handlers (touch multiple domain hooks)
  // ---------------------------------------------------------------------------

  const handleTokenSelect = useCallback(
    (tokenId: string) => {
      setFocusedTokenId(tokenId);
      const token = tokenById.get(tokenId);
      if (token) {
        setSelectedSurahId(token.sura);
        setSelectedRoot(token.root || null);
        setSelectedLemma(token.lemma || null);
        setSearchLockedRoot(null);
      }
      setIsSidebarOpen(true);
      if (firstRunState === "mission-active") {
        handleMissionTaskComplete("select-token");
      }
    },
    [tokenById, setIsSidebarOpen, setFocusedTokenId, setSelectedSurahId, setSelectedRoot, setSelectedLemma, setSearchLockedRoot, firstRunState, handleMissionTaskComplete]
  );

  // Ref-based handleVizModeChange to allow handleAcceptVizSuggestion to call it
  const handleVizModeChangeRef = useRef<((mode: VisualizationMode) => void) | null>(null);

  const handleVizModeChange = useCallback(
    (newMode: VisualizationMode) => {
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
        setFocusRecoveryTarget({ tokenId: focusedTokenId, mode: "radial-sura" });
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
      if (firstRunState === "mission-active") {
        handleMissionTaskComplete("switch-viz");
      }
    },
    [
      experienceLevel,
      focusedTokenId,
      selectedAyahInSurah,
      selectedLemmaValue,
      selectedRootValue,
      selectedSurahId,
      vizMode,
      setVizMode,
      setFocusedTokenId,
      setHoverTokenId,
      setContextTransformNotice,
      setFocusRecoveryTarget,
      firstRunState,
      handleMissionTaskComplete,
    ]
  );

  handleVizModeChangeRef.current = handleVizModeChange;

  const handleAcceptVizSuggestion = useCallback(() => {
    if (vizSuggestion) {
      handleVizModeChangeRef.current?.(vizSuggestion.mode);
      setVizSuggestion(null);
    }
  }, [vizSuggestion, setVizSuggestion]);

  const handleSurahSelect = useCallback(
    (suraId: number, preferredView?: "root-network" | "radial-sura") => {
      // Large surahs re-render thousands of SVG elements — mark the switch as a
      // transition so the click responds instantly instead of freezing the UI.
      startTransition(() => {
        setSelectedSurahId(suraId);
        if (preferredView) {
          setVizMode(preferredView);
        }
      });
    },
    [setSelectedSurahId, setVizMode]
  );

  const handleRootSelect = useCallback(
    (root: string | null) => {
      if (searchLockedRoot && root && root !== searchLockedRoot) return;
      setSelectedRoot(root);
      if (root) {
        setFocusedTokenId(null);
        setSelectedLemma(null);
        suggestVisualization({ root });
      }
    },
    [searchLockedRoot, suggestVisualization, setSelectedRoot, setFocusedTokenId, setSelectedLemma]
  );

  const handleSearchRootSelect = useCallback(
    (root: string | null) => {
      setSearchLockedRoot(root);
      setSelectedRoot(root);
      if (root) {
        setFocusedTokenId(null);
        setSelectedLemma(null);
      }
    },
    [setSearchLockedRoot, setSelectedRoot, setFocusedTokenId, setSelectedLemma]
  );

  const handleLemmaSelect = useCallback(
    (lemma: string) => {
      setSelectedLemma(lemma);
      setFocusedTokenId(null);
      // A lemma belongs to a root family — highlight that root in the graph so
      // selecting a lemma has the same visible effect as selecting a root.
      const root = lemma ? (allTokens.find((t) => t.lemma === lemma && t.root)?.root ?? null) : null;
      setSelectedRoot(root);
      if (root) suggestVisualization({ root });
    },
    [allTokens, setSelectedLemma, setFocusedTokenId, setSelectedRoot, suggestVisualization]
  );

  const handleSelectMissionIntent = useCallback(
    (intent: MissionIntent) => {
      handleSelectIntent(intent);
      const mission = getMissionByIntent(intent);
      if (mission) {
        handleVizModeChange(mission.vizMode);
        if (mission.preset?.surahId) {
          setSelectedSurahId(mission.preset.surahId);
        }
        if (mission.preset?.rootValue) {
          setSelectedRoot(mission.preset.rootValue);
          setSearchLockedRoot(null);
        }
      }
    },
    [handleSelectIntent, handleVizModeChange, setSelectedSurahId, setSelectedRoot, setSearchLockedRoot],
  );

  const handleMissionEnd = useCallback(() => {
    handleVizModeChange("radial-sura");
    markExperienceCompleted();
  }, [handleVizModeChange, markExperienceCompleted]);

  const handleBreadcrumbNavigate = useCallback(
    (level: "quran" | "surah" | "ayah" | "root") => {
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
          const ayahToken = allTokens.find(
            (token) => token.sura === selectedSurahId && token.ayah === selectedAyahInSurah
          );
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
    },
    [
      selectedAyahInSurah,
      allTokens,
      selectedSurahId,
      selectedRootValue,
      setSelectedSurahId,
      setFocusedTokenId,
      setSelectedRoot,
      setSelectedLemma,
      setSearchLockedRoot,
    ]
  );

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
  }, [
    focusRecoveryTarget,
    tokenById,
    setVizMode,
    setSelectedSurahId,
    setSelectedRoot,
    setSelectedLemma,
    setFocusedTokenId,
    setSearchLockedRoot,
    setHoverTokenId,
    setContextTransformNotice,
    setFocusRecoveryTarget,
  ]);

  // ---------------------------------------------------------------------------
  // Mission progress tracking (automatically mark tasks done)
  // ---------------------------------------------------------------------------
  // (Wired into cross-cutting handlers below — no separate effect needed)

  // ---------------------------------------------------------------------------
  // Wrap search result handler to include mission tracking
  // ---------------------------------------------------------------------------
  const handleSearchResultSelectedWrapped = useCallback(
    (matchType: Parameters<typeof handleSearchResultSelected>[0], surface: Parameters<typeof handleSearchResultSelected>[1]) => {
      handleSearchResultSelected(matchType, surface);
      if (firstRunState === "mission-active") {
        handleMissionTaskComplete("search");
      }
    },
    [handleSearchResultSelected, firstRunState, handleMissionTaskComplete]
  );

  // ---------------------------------------------------------------------------
  // Route a chosen search result to its target visualization + selection.
  // Reads the result's actionTarget so picking an ayah/root/lemma/surah lands
  // the user on the right view with the right thing selected.
  // ---------------------------------------------------------------------------
  const handleSearchResultNavigate = useCallback(
    (result: SearchResultItem) => {
      const { visualizationMode, selection } = result.actionTarget;
      if (visualizationMode) setVizMode(visualizationMode);
      const sel = selection ?? {};
      if (sel.surahId) setSelectedSurahId(sel.surahId);
      if (sel.root) {
        setSelectedRoot(sel.root);
        setSearchLockedRoot(sel.root);
      } else {
        setSelectedRoot(null);
        setSearchLockedRoot(null);
      }
      setSelectedLemma(sel.lemma ?? null);
      setFocusedTokenId(sel.tokenId ?? null);
      setHoverTokenId(null);
      if (!isMobileViewport) setIsSidebarOpen(true);
      if (firstRunState === "mission-active") handleMissionTaskComplete("search");
    },
    [
      setVizMode,
      setSelectedSurahId,
      setSelectedRoot,
      setSearchLockedRoot,
      setSelectedLemma,
      setFocusedTokenId,
      setHoverTokenId,
      isMobileViewport,
      setIsSidebarOpen,
      firstRunState,
      handleMissionTaskComplete,
    ]
  );

  // ---------------------------------------------------------------------------
  // Return (backward-compatible 77-property interface)
  // ---------------------------------------------------------------------------
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
    firstRunState,
    activeMissionIntent,
    missionProgress,
    showOnStartup,
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
    handleOnboardingSkip,
    handleReplayExperience,
    handleSelectMissionIntent,
    handleMissionTaskComplete,
    handleMissionComplete,
    handleMissionEnd,
    handleExperienceLevelChange,
    handleTokenSelect,
    handleVizModeChange,
    handleSurahSelect,
    handleRootSelect,
    handleSearchRootSelect,
    handleLemmaSelect,
    handleBreadcrumbNavigate,
    handleSearchOpened,
    handleSearchQuerySubmitted,
    handleSearchResultSelected: handleSearchResultSelectedWrapped,
    handleSearchResultNavigate,
    handleFirstTaskFeedback,
    handleDismissFirstTaskFeedback,
    handleDismissContextTransformNotice,
    handleRestoreFocusedContext,
    setContextTransformNotice,
    vizSuggestion,
    handleAcceptVizSuggestion,
    handleDismissVizSuggestion,
  };
}

export { VizControlProvider };
