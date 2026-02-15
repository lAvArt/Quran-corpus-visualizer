"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAccessibleDialog } from "@/lib/hooks/useAccessibleDialog";

interface OnboardingOverlayProps {
  isOpen: boolean;
  showOnStartup: boolean;
  onShowOnStartupChange: (value: boolean) => void;
  onClose: () => void;
}

export default function OnboardingOverlay({
  isOpen,
  showOnStartup,
  onShowOnStartupChange,
  onClose,
}: OnboardingOverlayProps) {
  const t = useTranslations("Onboarding");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const { dialogRef, handleOverlayClick } = useAccessibleDialog(isOpen, onClose);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = useMemo(
    () => [
      {
        title: t("cards.purpose.title"),
        body: t("cards.purpose.body"),
      },
      {
        title: t("cards.navigation.title"),
        body: t("cards.navigation.body"),
      },
      {
        title: t("cards.graphs.title"),
        body: t("cards.graphs.body"),
      },
      {
        title: t("cards.insights.title"),
        body: t("cards.insights.body"),
      },
    ],
    [t]
  );

  useEffect(() => {
    if (isOpen) {
      setStepIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === steps.length - 1;

  return (
    <div className="onboarding-overlay" onClick={handleOverlayClick}>
      <div
        className="onboarding-panel"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        tabIndex={-1}
        style={{
          direction: isRtl ? "rtl" : "ltr",
          textAlign: isRtl ? "right" : "left",
        }}
      >
        <button
          type="button"
          className="onboarding-close"
          onClick={onClose}
          aria-label={t("close")}
          style={{
            [isRtl ? "left" : "right"]: "16px",
          }}
        >
          {"\u2715"}
        </button>

        <div className="onboarding-head">
          <h2 id="onboarding-title">{t("title")}</h2>
          <p>{t("subtitle")}</p>
        </div>

        <div className="onboarding-progress">
          {t("progress", { current: stepIndex + 1, total: steps.length })}
        </div>

        <article className="onboarding-card">
          <h3>{steps[stepIndex].title}</h3>
          <p>{steps[stepIndex].body}</p>
        </article>

        <div className="onboarding-footer">
          <label className="onboarding-startup">
            <input
              type="checkbox"
              checked={showOnStartup}
              onChange={(event) => onShowOnStartupChange(event.target.checked)}
            />
            <span>{t("showOnStartup")}</span>
          </label>

          <div className="onboarding-actions">
            <button type="button" className="ghost" onClick={onClose}>
              {t("skip")}
            </button>
            {!isFirstStep && (
              <button
                type="button"
                className="ghost"
                onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
              >
                {t("back")}
              </button>
            )}
            <button
              type="button"
              className="primary"
              onClick={() => {
                if (isLastStep) {
                  onClose();
                  return;
                }
                setStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
              }}
            >
              {isLastStep ? t("start") : t("next")}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .onboarding-overlay {
          position: fixed;
          inset: 0;
          z-index: 120;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(8, 10, 16, 0.55);
          backdrop-filter: blur(8px);
        }

        .onboarding-panel {
          width: min(680px, 100%);
          border-radius: 18px;
          border: 1px solid var(--line);
          background: color-mix(in srgb, var(--bg-0), white 10%);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
          padding: 20px;
          position: relative;
          display: grid;
          gap: 14px;
        }

        .onboarding-close {
          position: absolute;
          top: 12px;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 1px solid var(--line);
          background: transparent;
          color: var(--ink-muted);
          cursor: pointer;
        }

        .onboarding-close:hover {
          color: var(--ink);
          border-color: var(--accent);
        }

        .onboarding-head h2 {
          margin: 0;
          font-size: 1.35rem;
          font-family: var(--font-display, serif);
        }

        .onboarding-head p {
          margin: 8px 0 0;
          color: var(--ink-secondary);
          font-size: 0.9rem;
        }

        .onboarding-progress {
          font-size: 0.73rem;
          color: var(--ink-muted);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-weight: 600;
        }

        .onboarding-card {
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 14px;
          background: color-mix(in srgb, var(--bg-1), white 8%);
        }

        .onboarding-card h3 {
          margin: 0 0 8px;
          font-size: 1rem;
        }

        .onboarding-card p {
          margin: 0;
          line-height: 1.6;
          color: var(--ink-secondary);
          font-size: 0.9rem;
        }

        .onboarding-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
        }

        .onboarding-startup {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--ink-secondary);
          font-size: 0.82rem;
        }

        .onboarding-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .onboarding-actions button {
          border-radius: 10px;
          border: 1px solid var(--line);
          padding: 8px 12px;
          font-family: inherit;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
        }

        .onboarding-actions .ghost {
          background: transparent;
          color: var(--ink-secondary);
        }

        .onboarding-actions .ghost:hover {
          border-color: var(--accent);
          color: var(--ink);
        }

        .onboarding-actions .primary {
          background: var(--accent);
          border-color: var(--accent);
          color: #fff;
        }

        .onboarding-actions .primary:hover {
          filter: brightness(1.05);
        }

        :global([data-theme="dark"]) .onboarding-panel {
          background: rgba(12, 14, 22, 0.95);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
        }

        :global([data-theme="dark"]) .onboarding-card {
          background: rgba(255, 255, 255, 0.02);
        }
      `}</style>
    </div>
  );
}
