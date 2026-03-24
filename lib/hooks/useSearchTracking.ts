"use client";

import { useCallback, useEffect, useState } from "react";
import {
  trackFirstTaskCompleted,
  trackFirstTaskFeedback,
  trackSearchOpened,
  trackSearchQuerySubmitted,
  trackSearchRecoveryShown,
  trackSearchResultSelected,
  type SearchMatchType,
} from "@/lib/analytics/events";
import { readDevSearchStatus } from "@/lib/dev/testOverrides";

type SearchAvailabilityStatus = "available" | "unavailable";

const FIRST_TASK_STORAGE_KEY = "quran-corpus-first-task-completed";
const FIRST_TASK_FEEDBACK_DISMISSED_KEY = "quran-corpus-first-task-feedback-dismissed";

export interface SearchTrackingState {
  searchStatus: SearchAvailabilityStatus;
  hasCompletedFirstTask: boolean;
  showFirstTaskFeedbackPrompt: boolean;

  handleSearchOpened: (surface: "header" | "sidebar" | "mobile") => void;
  handleSearchQuerySubmitted: (
    query: string,
    surface: "header" | "sidebar" | "mobile"
  ) => void;
  handleSearchResultSelected: (
    matchType: SearchMatchType,
    surface: "header" | "sidebar" | "mobile"
  ) => void;
  handleFirstTaskFeedback: (rating: "helpful" | "not_helpful") => void;
  handleDismissFirstTaskFeedback: () => void;
}

export function useSearchTracking(): SearchTrackingState {
  const [searchStatus, setSearchStatus] = useState<SearchAvailabilityStatus>("available");
  const [hasCompletedFirstTask, setHasCompletedFirstTask] = useState(false);
  const [showFirstTaskFeedbackPrompt, setShowFirstTaskFeedbackPrompt] = useState(false);

  // Hydrate first-task state from localStorage
  useEffect(() => {
    try {
      const firstTaskCompleted = localStorage.getItem(FIRST_TASK_STORAGE_KEY) === "1";
      const feedbackDismissed =
        localStorage.getItem(FIRST_TASK_FEEDBACK_DISMISSED_KEY) === "1";
      setHasCompletedFirstTask(firstTaskCompleted);
      setShowFirstTaskFeedbackPrompt(firstTaskCompleted && !feedbackDismissed);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Dev search status override
  useEffect(() => {
    const devSearchStatus = readDevSearchStatus();
    if (devSearchStatus) {
      setSearchStatus(devSearchStatus);
    }
  }, []);

  // Track search recovery shown
  useEffect(() => {
    if (searchStatus === "unavailable") {
      trackSearchRecoveryShown("explore");
    }
  }, [searchStatus]);

  const handleSearchOpened = useCallback(
    (surface: "header" | "sidebar" | "mobile") => {
      trackSearchOpened(surface);
    },
    []
  );

  const handleSearchQuerySubmitted = useCallback(
    (query: string, surface: "header" | "sidebar" | "mobile") => {
      trackSearchQuerySubmitted(query, surface);
    },
    []
  );

  const handleSearchResultSelected = useCallback(
    (matchType: SearchMatchType, surface: "header" | "sidebar" | "mobile") => {
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
    },
    [hasCompletedFirstTask]
  );

  const handleFirstTaskFeedback = useCallback(
    (rating: "helpful" | "not_helpful") => {
      trackFirstTaskFeedback(rating);
      setShowFirstTaskFeedbackPrompt(false);
      try {
        localStorage.setItem(FIRST_TASK_FEEDBACK_DISMISSED_KEY, "1");
      } catch {
        // Ignore localStorage errors
      }
    },
    []
  );

  const handleDismissFirstTaskFeedback = useCallback(() => {
    setShowFirstTaskFeedbackPrompt(false);
    try {
      localStorage.setItem(FIRST_TASK_FEEDBACK_DISMISSED_KEY, "1");
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  return {
    searchStatus,
    hasCompletedFirstTask,
    showFirstTaskFeedbackPrompt,
    handleSearchOpened,
    handleSearchQuerySubmitted,
    handleSearchResultSelected,
    handleFirstTaskFeedback,
    handleDismissFirstTaskFeedback,
  };
}
