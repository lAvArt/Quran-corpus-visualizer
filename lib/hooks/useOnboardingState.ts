"use client";

import { useCallback, useEffect, useState } from "react";
import {
  trackOnboardingCompleted,
  trackOnboardingSkipped,
  trackOnboardingStarted,
} from "@/lib/analytics/events";
import { EXPERIENCE_VERSION } from "@/lib/config/version";
import { getMissionByIntent, type MissionIntent, type MissionTaskId } from "@/lib/config/missions";
import type { MissionProgress } from "@/components/onboarding/MissionChecklist";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FirstRunState = "intent-selection" | "mission-active" | "completed" | "skipped";

const EXPERIENCE_STORAGE_KEY = "quran-corpus-onboarding";

interface ExperienceStorageState {
  version: string;
  showOnStartup: boolean;
  completed: boolean;
  lastCompletedAt?: string;
  /** Which intent the user picked (persisted so we can resume) */
  activeIntent?: MissionIntent | null;
}

export interface OnboardingState {
  firstRunState: FirstRunState;
  showOnStartup: boolean;

  /** The active mission config (null when no mission is running) */
  activeMissionIntent: MissionIntent | null;
  /** Per-task completion flags for the active mission */
  missionProgress: MissionProgress;

  // Handlers
  handleSelectIntent: (intent: MissionIntent) => void;
  handleMissionTaskComplete: (taskId: MissionTaskId) => void;
  handleMissionComplete: () => void;
  handleOnboardingSkip: () => void;
  handleOnboardingStartupChange: (value: boolean) => void;
  handleReplayExperience: () => void;

  /**
   * Call when the mission ends (skip or complete).
   * The caller must handle resetting vizMode externally.
   */
  markExperienceCompleted: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const INITIAL_PROGRESS: MissionProgress = {
  search: false,
  "select-token": false,
  "switch-viz": false,
};

export function useOnboardingState(_isMobileViewport: boolean): OnboardingState {
  const [firstRunState, setFirstRunState] = useState<FirstRunState>("completed");
  const [showOnStartup, setShowOnStartup] = useState(true);
  const [experienceCompleted, setExperienceCompleted] = useState(false);
  const [lastCompletedAt, setLastCompletedAt] = useState<string | undefined>(undefined);
  const [activeMissionIntent, setActiveMissionIntent] = useState<MissionIntent | null>(null);
  const [missionProgress, setMissionProgress] = useState<MissionProgress>(INITIAL_PROGRESS);

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  const persistState = useCallback(
    (
      showOnStartupValue: boolean,
      completed: boolean,
      completedAt?: string,
      activeIntent?: MissionIntent | null,
    ) => {
      try {
        const payload: ExperienceStorageState = {
          version: EXPERIENCE_VERSION,
          showOnStartup: showOnStartupValue,
          completed,
          ...(completedAt ? { lastCompletedAt: completedAt } : {}),
          ...(activeIntent ? { activeIntent } : {}),
        };
        localStorage.setItem(EXPERIENCE_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // Ignore localStorage errors
      }
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Hydrate from localStorage
  // ---------------------------------------------------------------------------

  useEffect(() => {
    try {
      const stored = localStorage.getItem(EXPERIENCE_STORAGE_KEY);
      if (!stored) {
        setFirstRunState("intent-selection");
        return;
      }

      const parsed = JSON.parse(stored);
      const showOnStartupValue =
        typeof parsed.showOnStartup === "boolean" ? parsed.showOnStartup : true;
      const completed = typeof parsed.completed === "boolean" ? parsed.completed : false;
      const version = typeof parsed.version === "string" ? parsed.version : null;
      const completedAt =
        typeof parsed.lastCompletedAt === "string" ? parsed.lastCompletedAt : undefined;
      const activeIntent =
        typeof parsed.activeIntent === "string" ? (parsed.activeIntent as MissionIntent) : null;

      setShowOnStartup(showOnStartupValue);
      setExperienceCompleted(completed);
      setLastCompletedAt(completedAt);

      // Version mismatch → re-show intent selection
      if (version !== EXPERIENCE_VERSION) {
        setExperienceCompleted(false);
        setLastCompletedAt(undefined);
        setFirstRunState(showOnStartupValue ? "intent-selection" : "completed");
        return;
      }

      // Resume an active mission if one was in progress
      if (!completed && activeIntent) {
        setActiveMissionIntent(activeIntent);
        setFirstRunState("mission-active");
        return;
      }

      setFirstRunState(!completed && showOnStartupValue ? "intent-selection" : "completed");
    } catch {
      setFirstRunState("intent-selection");
    }
  }, []);

  // Track onboarding started
  useEffect(() => {
    if (firstRunState === "intent-selection") {
      trackOnboardingStarted();
    }
  }, [firstRunState]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const markExperienceCompleted = useCallback(() => {
    const completedAt = new Date().toISOString();
    setExperienceCompleted(true);
    setLastCompletedAt(completedAt);
    setFirstRunState("completed");
    setActiveMissionIntent(null);
    setMissionProgress(INITIAL_PROGRESS);
    persistState(showOnStartup, true, completedAt);
  }, [persistState, showOnStartup]);

  const handleSelectIntent = useCallback(
    (intent: MissionIntent) => {
      const mission = getMissionByIntent(intent);
      if (!mission) return;
      setActiveMissionIntent(intent);
      setMissionProgress(INITIAL_PROGRESS);
      setFirstRunState("mission-active");
      persistState(showOnStartup, false, undefined, intent);
    },
    [persistState, showOnStartup],
  );

  const handleMissionTaskComplete = useCallback((taskId: MissionTaskId) => {
    setMissionProgress((prev) => ({ ...prev, [taskId]: true }));
  }, []);

  const handleMissionComplete = useCallback(() => {
    trackOnboardingCompleted();
    markExperienceCompleted();
  }, [markExperienceCompleted]);

  const handleOnboardingSkip = useCallback(() => {
    trackOnboardingSkipped();
    setFirstRunState("skipped");
    setActiveMissionIntent(null);
    setMissionProgress(INITIAL_PROGRESS);
    const completedAt = new Date().toISOString();
    setExperienceCompleted(true);
    setLastCompletedAt(completedAt);
    persistState(showOnStartup, true, completedAt);
  }, [persistState, showOnStartup]);

  const handleOnboardingStartupChange = useCallback(
    (value: boolean) => {
      setShowOnStartup(value);
      persistState(
        value,
        experienceCompleted,
        experienceCompleted ? lastCompletedAt : undefined,
        activeMissionIntent,
      );
    },
    [experienceCompleted, lastCompletedAt, persistState, activeMissionIntent],
  );

  const handleReplayExperience = useCallback(() => {
    setExperienceCompleted(false);
    setLastCompletedAt(undefined);
    setActiveMissionIntent(null);
    setMissionProgress(INITIAL_PROGRESS);
    setFirstRunState("intent-selection");
    persistState(showOnStartup, false);
  }, [persistState, showOnStartup]);

  return {
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
  };
}
