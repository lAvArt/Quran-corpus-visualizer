"use client";

import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAccessibleDialog } from "@/lib/hooks/useAccessibleDialog";
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
   *  fresh focus/animation lifecycle) instead of one instance mutating in place. */
  vizMode: VisualizationMode;
  /** Localized display name, e.g. `tViz(`${vizMode}.label`)` — reused from the caller. */
  modeLabel: string;
  /** Ref to the visualization stage; clicking it dismisses the card. */
  stageRef: RefObject<HTMLElement | null>;
  /** True when the card must never show (onboarding active, or deep-linked mid-task). */
  suppressed: boolean;
}

/**
 * Compact, dismissible "claim card" shown the first time a user opens a given
 * visualization mode: a one-line claim + a numbered 3-step "how to read it"
 * list. Shown once per mode — persisted in localStorage — then never again.
 */
export default function VizIntroCard({ vizMode, modeLabel, stageRef, suppressed }: VizIntroCardProps) {
  const locale = useLocale();
  const isRtl = locale === "ar";
  const t = useTranslations("VizExplainer");
  const tCard = useTranslations("VizIntroCard");
  const explainer = VIZ_EXPLAINERS[vizMode];

  // null = not yet checked. The localStorage read happens after mount so server
  // and client first paint agree (no hydration mismatch); the card fades in
  // once the check resolves to false.
  const [isDismissed, setIsDismissed] = useState<boolean | null>(null);
  useEffect(() => {
    setIsDismissed(readDismissedMap()[vizMode] === true);
  }, [vizMode]);

  const cardRef = useRef<HTMLDivElement>(null);
  const modeId = useId();
  const claimId = useId();
  const stepsId = useId();

  const isVisible = Boolean(explainer) && !suppressed && isDismissed === false;

  // Stable identity matters: useAccessibleDialog re-runs its focus effect when
  // onClose changes, which would re-steal focus on every parent re-render.
  const dismiss = useCallback(() => {
    markDismissed(vizMode);
    setIsDismissed(true);
  }, [vizMode]);

  // Escape closes; focus moves to "Got it" on open and returns to the
  // previously-focused element on close (body scroll lock is a no-op here —
  // the shell is a fixed, non-scrolling viewport).
  const { dialogRef } = useAccessibleDialog(isVisible, dismiss);

  // Clicking the stage (the visualization viewport, not the card itself)
  // dismisses the card. Capture phase: node click handlers inside the viz may
  // stopPropagation, but engaging with the stage must still dismiss the card.
  useEffect(() => {
    if (!isVisible) return;
    const stage = stageRef.current;
    if (!stage) return;
    const onStageClick = (e: MouseEvent) => {
      if (cardRef.current?.contains(e.target as Node)) return;
      dismiss();
    };
    stage.addEventListener("click", onStageClick, true);
    return () => stage.removeEventListener("click", onStageClick, true);
  }, [isVisible, stageRef, dismiss]);

  if (!isVisible || !explainer) return null;

  return (
    <div
      ref={cardRef}
      className="viz-intro-card"
      role="dialog"
      aria-labelledby={`${modeId} ${claimId}`}
      aria-describedby={stepsId}
      dir={isRtl ? "rtl" : "ltr"}
    >
      <p id={modeId} className="viz-intro-mode eyebrow">
        {modeLabel}
      </p>
      <p id={claimId} className="viz-intro-claim">
        {t(explainer.claimKey)}
      </p>

      <p className="viz-intro-how-label">{tCard("howToReadLabel")}</p>
      <ol id={stepsId} className="viz-intro-steps">
        {explainer.howToReadKeys.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ol>

      <button
        ref={dialogRef as React.Ref<HTMLButtonElement>}
        type="button"
        className="viz-intro-gotit"
        onClick={dismiss}
      >
        {tCard("gotIt")}
      </button>

      <style jsx>{`
        .viz-intro-card {
          position: fixed;
          top: calc(var(--header-clearance) + 58px);
          left: 50%;
          transform: translateX(-50%);
          /* Below the status bar / graph toolbar (45) so the viz-switcher
             dropdown can open over the card, above the side panels (40). */
          z-index: 44;
          width: min(360px, calc(100vw - 32px));
          display: grid;
          gap: 10px;
          padding: 18px 20px;
          border-radius: var(--radius-lg, 20px);
          border: 1px solid var(--panel-border);
          background: var(--panel);
          backdrop-filter: blur(16px);
          box-shadow: var(--shadow-3, 0 18px 48px rgba(0, 0, 0, 0.35));
          animation: viz-intro-fade-in 150ms ease-out both;
        }

        .viz-intro-mode {
          margin: 0;
        }

        .viz-intro-claim {
          margin: 0;
          font-family: ${isRtl ? "var(--font-arabic, serif)" : 'var(--font-display, "Fraunces"), Georgia, serif'};
          font-size: 1.14rem;
          line-height: 1.4;
          color: var(--ink);
          letter-spacing: ${isRtl ? "0" : "-0.01em"};
        }

        .viz-intro-how-label {
          margin: 4px 0 0;
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--ink-muted);
        }

        .viz-intro-steps {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 8px;
          counter-reset: viz-intro-step;
        }

        .viz-intro-steps li {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 10px;
          align-items: start;
          padding: 8px 10px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.025);
          color: var(--ink-secondary);
          font-size: 0.86rem;
          line-height: 1.4;
        }

        .viz-intro-steps li::before {
          counter-increment: viz-intro-step;
          content: counter(viz-intro-step);
          display: inline-grid;
          place-items: center;
          width: 1.4rem;
          height: 1.4rem;
          border-radius: 999px;
          background: rgba(255, 179, 64, 0.12);
          border: 1px solid rgba(255, 179, 64, 0.24);
          color: #ffbe67;
          font-size: 0.72rem;
          font-weight: 800;
          line-height: 1;
        }

        .viz-intro-gotit {
          justify-self: ${isRtl ? "start" : "end"};
          margin-top: 2px;
          padding: 7px 18px;
          border-radius: var(--radius-pill, 999px);
          border: 1px solid transparent;
          background: var(--accent);
          color: var(--accent-ink, #fff);
          font: inherit;
          font-weight: 700;
          font-size: 0.86rem;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .viz-intro-gotit:hover {
          box-shadow: 0 6px 18px color-mix(in srgb, var(--accent) 35%, transparent);
        }

        .viz-intro-gotit:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }

        :global([data-theme="light"]) .viz-intro-steps li {
          border-color: rgba(15, 23, 42, 0.08);
          background: rgba(15, 23, 42, 0.025);
        }

        @keyframes viz-intro-fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @media (max-width: 980px) {
          .viz-intro-card {
            top: calc(var(--header-clearance) + 40px);
          }
        }
      `}</style>
    </div>
  );
}
