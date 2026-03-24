"use client";

import { useTranslations, useLocale } from "next-intl";
import { MISSIONS, type MissionIntent } from "@/lib/config/missions";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";

interface FirstRunMissionProps {
  isOpen: boolean;
  onSelectIntent: (intent: MissionIntent) => void;
  onSkip: () => void;
  showOnStartup: boolean;
  onShowOnStartupChange: (value: boolean) => void;
}

/**
 * Replaces the old OnboardingOverlay 3-step tour.
 * Shows 4 intent cards on a blurred overlay — user picks what they want to explore.
 * Selecting a card transitions to "mission-active" and injects preset state.
 */
export default function FirstRunMission({
  isOpen,
  onSelectIntent,
  onSkip,
  showOnStartup,
  onShowOnStartupChange,
}: FirstRunMissionProps) {
  const t = useTranslations("FirstRunMission");
  const locale = useLocale();
  const isRtl = locale === "ar";

  if (!isOpen) return null;

  return (
    <div
      className="first-run-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="first-run-panel">
        <div className="first-run-head">
          <div className="first-run-head-row">
            <h2>{t("title")}</h2>
            <div className="first-run-head-actions">
              <LanguageSwitcher />
              <button
                type="button"
                className="first-run-close"
                onClick={onSkip}
                aria-label={t("skip")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
          <p>{t("subtitle")}</p>
        </div>

        <div className="first-run-grid">
          {MISSIONS.map((mission) => (
            <button
              key={mission.intent}
              type="button"
              className="first-run-card"
              onClick={() => onSelectIntent(mission.intent)}
            >
              <h3>{t(mission.titleKey)}</h3>
              <p>{t(mission.descriptionKey)}</p>
            </button>
          ))}
        </div>

        <div className="first-run-footer">
          <label className="first-run-startup">
            <input
              type="checkbox"
              checked={showOnStartup}
              onChange={(e) => onShowOnStartupChange(e.target.checked)}
            />
            <span>{t("showOnStartup")}</span>
          </label>

          <button type="button" className="first-run-skip" onClick={onSkip}>
            {t("skip")}
          </button>
        </div>
      </div>

      <style jsx>{`
        .first-run-overlay {
          position: fixed;
          inset: 0;
          z-index: 120;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(8, 10, 16, 0.55);
          backdrop-filter: blur(8px);
        }

        .first-run-panel {
          width: min(720px, 100%);
          border-radius: 18px;
          border: 1px solid var(--line);
          background: color-mix(in srgb, var(--bg-0), white 10%);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
          padding: 24px;
          position: relative;
          display: grid;
          gap: 18px;
        }

        .first-run-head-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .first-run-close {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 1px solid var(--line);
          background: transparent;
          color: var(--ink-muted);
          cursor: pointer;
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }

        .first-run-close:hover {
          color: var(--ink);
          border-color: var(--accent);
        }

        .first-run-head-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .first-run-head h2 {
          margin: 0;
          font-size: 1.35rem;
          font-family: var(--font-display, serif);
        }

        .first-run-head p {
          margin: 8px 0 0;
          color: var(--ink-secondary);
          font-size: 0.92rem;
        }

        .first-run-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        @media (max-width: 520px) {
          .first-run-grid {
            grid-template-columns: 1fr;
          }
        }

        .first-run-card {
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 16px;
          background: color-mix(in srgb, var(--bg-1), white 8%);
          cursor: pointer;
          text-align: start;
          transition: border-color 0.15s, box-shadow 0.15s;
        }

        .first-run-card:hover {
          border-color: var(--accent);
          box-shadow: 0 0 0 1px var(--accent);
        }

        .first-run-card:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }

        .first-run-card h3 {
          margin: 0 0 6px;
          font-size: 0.95rem;
          color: var(--ink);
        }

        .first-run-card p {
          margin: 0;
          line-height: 1.55;
          color: var(--ink-secondary);
          font-size: 0.84rem;
        }

        .first-run-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .first-run-startup {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--ink-secondary);
          font-size: 0.82rem;
          cursor: pointer;
        }

        .first-run-skip {
          border-radius: 10px;
          border: 1px solid var(--line);
          padding: 8px 14px;
          background: transparent;
          color: var(--ink-secondary);
          font-family: inherit;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
        }

        .first-run-skip:hover {
          border-color: var(--accent);
          color: var(--ink);
        }

        :global([data-theme="dark"]) .first-run-panel {
          background: rgba(12, 14, 22, 0.95);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
        }

        :global([data-theme="dark"]) .first-run-card {
          background: rgba(255, 255, 255, 0.02);
        }
      `}</style>
    </div>
  );
}
