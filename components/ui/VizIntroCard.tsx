"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { motionSafeDuration } from "@/lib/viz/motionPrefs";
import { VIZ_EXPLAINERS } from "@/lib/config/vizExplainers";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";

const STORAGE_KEY = "quran-corpus-viz-intro";

type DismissedMap = Partial<Record<VisualizationMode, true>>;

function readDismissedMap(): DismissedMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as DismissedMap) : {};
  } catch {
    return {};
  }
}

function markDismissed(mode: VisualizationMode) {
  try {
    const map = readDismissedMap();
    map[mode] = true;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore localStorage errors (private mode, quota, disabled storage, etc.)
  }
}

interface VizIntroCardProps {
  /** The active visualization mode. Callers should mount this with `key={vizMode}`
   *  so switching modes always yields a fresh instance (fresh dismiss check,
   *  fresh auto-fade timer) instead of one instance mutating in place. */
  vizMode: VisualizationMode;
  /** True when the chip must never show (onboarding overlay active). */
  suppressed: boolean;
  /** Opens the right drawer on the Explain tab (see AppShell/ContextDrawer wiring). */
  onOpenExplain: () => void;
}

/**
 * Small, non-blocking "How to read this view" pill shown the first time a
 * user opens a given visualization mode: an icon, a label that opens the
 * drawer's Explain tab, and a dismiss button. Anchored under the breadcrumb —
 * unlike the center-screen overlay this replaces, it never covers the
 * canvas. Shown once per mode — persisted in localStorage — then never
 * again; it also quietly fades itself out after a few seconds so it never
 * lingers as clutter (that auto-fade is local only, not persisted, so the
 * chip can still greet the user next time they visit this mode).
 */
export default function VizIntroCard({ vizMode, suppressed, onOpenExplain }: VizIntroCardProps) {
  const locale = useLocale();
  const isRtl = locale === "ar";
  const tCard = useTranslations("VizIntroCard");
  const explainer = VIZ_EXPLAINERS[vizMode];

  // null = not yet checked. The localStorage read happens after mount so server
  // and client first paint agree (no hydration mismatch); the chip fades in
  // once the check resolves to false.
  const [isDismissed, setIsDismissed] = useState<boolean | null>(null);
  useEffect(() => {
    setIsDismissed(readDismissedMap()[vizMode] === true);
  }, [vizMode]);

  const canShow = Boolean(explainer) && !suppressed && isDismissed === false;

  // Auto-fade timer: play a quiet exit transition after 8s, then stop
  // rendering. `leaving` drives the CSS opacity transition; `gone` unmounts
  // once it's finished (delay collapses to ~0 under reduced motion via
  // motionSafeDuration, matching the CSS transition's own instant collapse).
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!canShow || gone) return;
    const timer = window.setTimeout(() => setLeaving(true), 8000);
    return () => window.clearTimeout(timer);
  }, [canShow, gone]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setGone(true), motionSafeDuration(200));
    return () => window.clearTimeout(timer);
  }, [leaving]);

  const dismiss = useCallback(() => {
    markDismissed(vizMode);
    setIsDismissed(true);
  }, [vizMode]);

  const handleLabelClick = useCallback(() => {
    onOpenExplain();
    dismiss();
  }, [onOpenExplain, dismiss]);

  if (!canShow || gone) return null;

  return (
    <div
      className={`viz-intro-chip ${leaving ? "is-leaving" : ""}`}
      role="status"
      aria-live="polite"
      aria-hidden={leaving || undefined}
      dir={isRtl ? "rtl" : "ltr"}
    >
      <button type="button" className="viz-intro-chip-label" onClick={handleLabelClick}>
        <span className="viz-intro-chip-icon" aria-hidden="true">{"ⓘ"}</span>
        <span>{tCard("chipLabel")}</span>
      </button>
      <button
        type="button"
        className="viz-intro-chip-dismiss"
        onClick={dismiss}
        aria-label={tCard("dismissAria")}
      >
        <span aria-hidden="true">{"×"}</span>
      </button>
    </div>
  );
}
