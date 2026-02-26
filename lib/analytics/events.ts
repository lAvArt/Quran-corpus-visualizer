"use client";

import { track } from "@vercel/analytics";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";

type ScriptClass = "arabic" | "latin" | "mixed" | "other";
type SearchMatchType = "text" | "root" | "lemma" | "gloss";

function safeTrack(name: string, properties?: Record<string, string | number | boolean | null | undefined>) {
  try {
    track(name, properties);
  } catch {
    // Analytics should never break UX flows.
  }
}

export function classifyQueryScript(query: string): ScriptClass {
  const hasArabic = /[\u0600-\u06FF]/.test(query);
  const hasLatin = /[A-Za-z]/.test(query);
  if (hasArabic && hasLatin) return "mixed";
  if (hasArabic) return "arabic";
  if (hasLatin) return "latin";
  return "other";
}

export function trackOnboardingStarted() {
  safeTrack("onboarding_started");
}

export function trackOnboardingCompleted() {
  safeTrack("onboarding_completed");
}

export function trackOnboardingSkipped() {
  safeTrack("onboarding_skipped");
}

export function trackModeSwitched(from: "beginner" | "advanced", to: "beginner" | "advanced") {
  safeTrack("mode_switched", { from, to });
}

export function trackVizChanged(from: VisualizationMode, to: VisualizationMode, experienceLevel: "beginner" | "advanced") {
  safeTrack("viz_changed", { from, to, experienceLevel });
}

export function trackSearchOpened(surface: "header" | "sidebar" | "mobile") {
  safeTrack("search_opened", { surface });
}

export function trackSearchQuerySubmitted(query: string, surface: "header" | "sidebar" | "mobile") {
  safeTrack("search_query_submitted", {
    query_length: query.length,
    script: classifyQueryScript(query),
    surface,
  });
}

export function trackSearchResultSelected(matchType: SearchMatchType, surface: "header" | "sidebar" | "mobile") {
  safeTrack("search_result_selected", { match_type: matchType, surface });
}

export function trackFirstTaskCompleted() {
  safeTrack("first_task_completed");
}

export function trackHelpOpened(vizMode: VisualizationMode | "unknown") {
  safeTrack("help_opened", { viz_mode: vizMode });
}

export function trackBreadcrumbUsed(level: "quran" | "surah" | "ayah" | "root") {
  safeTrack("breadcrumb_used", { level });
}

export function trackFirstTaskFeedback(rating: "helpful" | "not_helpful") {
  safeTrack("first_task_feedback", { rating });
}

export type { SearchMatchType };
