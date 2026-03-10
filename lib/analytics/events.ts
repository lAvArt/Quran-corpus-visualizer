"use client";

import { track } from "@vercel/analytics";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";

type ScriptClass = "arabic" | "latin" | "mixed" | "other";
type SearchMatchType = "ayah" | "text" | "root" | "lemma" | "gloss" | "semantic" | "token";
type CorpusSurface = "explore" | "search" | "shared";
type SearchSurface = "header" | "sidebar" | "mobile" | "workspace" | "unknown";
type ClientErrorArea = "corpus" | "search" | "ui" | "auth";

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

export function trackCorpusShellReady(surface: CorpusSurface, tokenCount: number, surahCount: number, rootCount: number) {
  safeTrack("corpus_shell_ready", {
    surface,
    token_count: tokenCount,
    surah_count: surahCount,
    root_count: rootCount,
  });
}

export function trackCorpusDeepReady(surface: CorpusSurface, tokenCount: number, durationMs: number | null) {
  safeTrack("corpus_deep_ready", {
    surface,
    token_count: tokenCount,
    duration_ms: durationMs,
  });
}

export function trackCorpusFallbackUsed(surface: CorpusSurface, tokenCount: number, durationMs: number | null) {
  safeTrack("corpus_fallback_used", {
    surface,
    token_count: tokenCount,
    duration_ms: durationMs,
  });
}

export function trackSearchRecoveryShown(surface: Exclude<CorpusSurface, "shared">) {
  safeTrack("search_recovery_shown", { surface });
}

export function trackPerformanceMetric(
  metric: "shell_render" | "first_search_interaction",
  surface: CorpusSurface | SearchSurface,
  durationMs: number,
  properties?: Record<string, string | number | boolean | null | undefined>
) {
  safeTrack("performance_metric", {
    metric,
    surface,
    duration_ms: durationMs,
    ...properties,
  });
}

export function trackClientError(
  area: ClientErrorArea,
  code: string,
  properties?: Record<string, string | number | boolean | null | undefined>
) {
  safeTrack("client_error", {
    area,
    code,
    ...properties,
  });
}

export type { SearchMatchType };
