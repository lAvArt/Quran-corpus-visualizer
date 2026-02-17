"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAccessibleDialog } from "@/lib/hooks/useAccessibleDialog";
import type { WalkthroughStepConfig } from "@/lib/schema/walkthrough";

interface GuidedWalkthroughOverlayProps {
  isOpen: boolean;
  steps: WalkthroughStepConfig[];
  stepIndex: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface PanelPosition {
  top: number;
  left: number;
  centered: boolean;
}

export default function GuidedWalkthroughOverlay({
  isOpen,
  steps,
  stepIndex,
  onNext,
  onBack,
  onSkip,
  onComplete,
}: GuidedWalkthroughOverlayProps) {
  const t = useTranslations();
  const locale = useLocale();
  const isRtl = locale === "ar";
  const { dialogRef, handleOverlayClick } = useAccessibleDialog(isOpen, onSkip);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const [panelPosition, setPanelPosition] = useState<PanelPosition>({ top: 0, left: 0, centered: true });

  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  const updateLayout = useCallback(() => {
    if (!isOpen || !step) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const panelWidth = Math.min(420, viewportWidth - 24);
    const panelHeight = Math.min(340, viewportHeight - 24);
    const edgePadding = 12;
    const gap = 14;

    const centerPanel = () => {
      setSpotlightRect(null);
      setPanelPosition({
        top: Math.max(edgePadding, (viewportHeight - panelHeight) / 2),
        left: Math.max(edgePadding, (viewportWidth - panelWidth) / 2),
        centered: true,
      });
    };

    if (!step.targetSelector || step.placement === "center") {
      centerPanel();
      return;
    }

    const target = document.querySelector(step.targetSelector);
    if (!(target instanceof HTMLElement)) {
      centerPanel();
      return;
    }

    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      centerPanel();
      return;
    }

    const isVisible =
      rect.bottom > edgePadding &&
      rect.right > edgePadding &&
      rect.top < viewportHeight - edgePadding &&
      rect.left < viewportWidth - edgePadding;

    if (!isVisible) {
      centerPanel();
      return;
    }

    const paddedRect: SpotlightRect = {
      top: Math.max(edgePadding, rect.top - 6),
      left: Math.max(edgePadding, rect.left - 6),
      width: Math.min(viewportWidth - edgePadding * 2, rect.width + 12),
      height: Math.min(viewportHeight - edgePadding * 2, rect.height + 12),
    };

    const targetCenterX = rect.left + rect.width / 2;
    const targetCenterY = rect.top + rect.height / 2;

    let top = (viewportHeight - panelHeight) / 2;
    let left = (viewportWidth - panelWidth) / 2;

    if (step.placement === "top") {
      top = rect.top - panelHeight - gap;
      left = targetCenterX - panelWidth / 2;
    } else if (step.placement === "bottom") {
      top = rect.bottom + gap;
      left = targetCenterX - panelWidth / 2;
    } else if (step.placement === "left") {
      top = targetCenterY - panelHeight / 2;
      left = rect.left - panelWidth - gap;
    } else if (step.placement === "right") {
      top = targetCenterY - panelHeight / 2;
      left = rect.right + gap;
    }

    top = Math.max(edgePadding, Math.min(top, viewportHeight - panelHeight - edgePadding));
    left = Math.max(edgePadding, Math.min(left, viewportWidth - panelWidth - edgePadding));

    setSpotlightRect(paddedRect);
    setPanelPosition({ top, left, centered: false });
  }, [isOpen, step]);

  useEffect(() => {
    if (!isOpen) return;

    updateLayout();
    const raf = window.requestAnimationFrame(updateLayout);
    const timer = window.setTimeout(updateLayout, 180);

    const sync = () => updateLayout();
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [isOpen, stepIndex, updateLayout]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEnter = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      const targetTag = (event.target as HTMLElement | null)?.tagName;
      if (targetTag === "INPUT" || targetTag === "TEXTAREA" || targetTag === "SELECT") return;
      event.preventDefault();
      if (isLast) {
        onComplete();
        return;
      }
      onNext();
    };

    document.addEventListener("keydown", handleEnter);
    return () => {
      document.removeEventListener("keydown", handleEnter);
    };
  }, [isOpen, isLast, onComplete, onNext]);

  const panelStyle = useMemo(
    () => ({
      top: panelPosition.top,
      left: panelPosition.left,
      direction: isRtl ? ("rtl" as const) : ("ltr" as const),
      textAlign: isRtl ? ("right" as const) : ("left" as const),
    }),
    [isRtl, panelPosition.left, panelPosition.top]
  );

  if (!isOpen || !step) return null;

  return (
    <div className="walkthrough-overlay" onClick={handleOverlayClick}>
      {spotlightRect ? (
        <>
          <div
            className="walkthrough-dimmer"
            style={{
              top: 0,
              left: 0,
              width: "100vw",
              height: spotlightRect.top,
            }}
            aria-hidden="true"
          />
          <div
            className="walkthrough-dimmer"
            style={{
              top: spotlightRect.top,
              left: 0,
              width: spotlightRect.left,
              height: spotlightRect.height,
            }}
            aria-hidden="true"
          />
          <div
            className="walkthrough-dimmer"
            style={{
              top: spotlightRect.top,
              left: spotlightRect.left + spotlightRect.width,
              width: `calc(100vw - ${spotlightRect.left + spotlightRect.width}px)`,
              height: spotlightRect.height,
            }}
            aria-hidden="true"
          />
          <div
            className="walkthrough-dimmer"
            style={{
              top: spotlightRect.top + spotlightRect.height,
              left: 0,
              width: "100vw",
              height: `calc(100vh - ${spotlightRect.top + spotlightRect.height}px)`,
            }}
            aria-hidden="true"
          />
        </>
      ) : (
        <div
          className="walkthrough-dimmer"
          style={{
            inset: 0,
          }}
          aria-hidden="true"
        />
      )}

      {spotlightRect && (
        <div
          className="walkthrough-spotlight"
          style={{
            top: spotlightRect.top,
            left: spotlightRect.left,
            width: spotlightRect.width,
            height: spotlightRect.height,
          }}
          aria-hidden="true"
        />
      )}

      <section
        ref={dialogRef}
        className="walkthrough-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="walkthrough-title"
        tabIndex={-1}
        style={panelStyle}
      >
        <button type="button" className="walkthrough-close" onClick={onSkip} aria-label={t("Walkthrough.close")}>
          {"\u2715"}
        </button>

        <p className="walkthrough-progress">
          {t("Walkthrough.progress", { current: stepIndex + 1, total: steps.length })}
        </p>
        <h2 id="walkthrough-title">{t(step.titleKey)}</h2>
        <p className="walkthrough-body">{t(step.bodyKey)}</p>

        <div className="walkthrough-actions">
          <button type="button" className="ghost" onClick={onSkip}>
            {t("Walkthrough.skip")}
          </button>
          {!isFirst && (
            <button type="button" className="ghost" onClick={onBack}>
              {t("Walkthrough.back")}
            </button>
          )}
          <button
            type="button"
            className="primary"
            onClick={() => {
              if (isLast) {
                onComplete();
                return;
              }
              onNext();
            }}
          >
            {isLast ? t("Walkthrough.finish") : t("Walkthrough.next")}
          </button>
        </div>
      </section>

      <style jsx>{`
        .walkthrough-overlay {
          position: fixed;
          inset: 0;
          z-index: 130;
        }

        .walkthrough-dimmer {
          position: fixed;
          background: rgba(8, 10, 16, 0.72);
          pointer-events: none;
          transition:
            top 0.22s ease,
            left 0.22s ease,
            width 0.22s ease,
            height 0.22s ease;
          z-index: 0;
        }

        .walkthrough-spotlight {
          position: fixed;
          border-radius: 14px;
          pointer-events: none;
          box-shadow:
            0 0 0 2px var(--accent),
            0 0 36px color-mix(in srgb, var(--accent), transparent 45%);
          transition: top 0.22s ease, left 0.22s ease, width 0.22s ease, height 0.22s ease;
          z-index: 1;
        }

        .walkthrough-panel {
          position: fixed;
          width: min(420px, calc(100vw - 24px));
          border-radius: 16px;
          border: 1px solid var(--line);
          background: color-mix(in srgb, var(--bg-0), white 8%);
          box-shadow: 0 20px 48px rgba(0, 0, 0, 0.38);
          padding: 18px;
          display: grid;
          gap: 10px;
          outline: none;
          z-index: 2;
        }

        .walkthrough-close {
          position: absolute;
          top: 10px;
          inset-inline-end: 10px;
          width: 28px;
          height: 28px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: transparent;
          color: var(--ink-muted);
          cursor: pointer;
        }

        .walkthrough-close:hover {
          color: var(--ink);
          border-color: var(--accent);
        }

        .walkthrough-progress {
          margin: 0;
          font-size: 0.7rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink-muted);
          font-weight: 700;
        }

        h2 {
          margin: 0;
          font-size: 1.06rem;
        }

        .walkthrough-body {
          margin: 0;
          color: var(--ink-secondary);
          line-height: 1.6;
          font-size: 0.9rem;
        }

        .walkthrough-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 2px;
        }

        .walkthrough-actions button {
          border-radius: 10px;
          border: 1px solid var(--line);
          padding: 8px 12px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
        }

        .walkthrough-actions .ghost {
          background: transparent;
          color: var(--ink-secondary);
        }

        .walkthrough-actions .ghost:hover {
          border-color: var(--accent);
          color: var(--ink);
        }

        .walkthrough-actions .primary {
          background: var(--accent);
          border-color: var(--accent);
          color: #fff;
        }

        .walkthrough-actions .primary:hover {
          filter: brightness(1.06);
        }

        :global([data-theme="dark"]) .walkthrough-panel {
          background: rgba(12, 14, 22, 0.95);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.62);
        }
      `}</style>
    </div>
  );
}
