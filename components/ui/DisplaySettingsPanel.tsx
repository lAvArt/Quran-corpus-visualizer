"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import ThemeSwitcher from "@/components/ui/ThemeSwitcher";
import { usePwaInstall } from "@/components/providers/PwaProvider";
import VizExportMenu from "@/components/ui/VizExportMenu";
import {
  COLOR_THEME_PRESETS,
  type CustomColorTheme,
  type CustomColorThemePalette,
  type ColorThemeId,
} from "@/lib/theme/colorThemes";
import { type LexicalColorMode } from "@/lib/theme/lexicalColoring";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";
import type { RefObject } from "react";

interface DisplaySettingsPanelProps {
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
  colorTheme: ColorThemeId;
  onColorThemeChange: (themeId: ColorThemeId) => void;
  lexicalColorMode: LexicalColorMode;
  onLexicalColorModeChange: (mode: LexicalColorMode) => void;
  customColorTheme: CustomColorTheme;
  onCustomColorThemeChange: (appearance: "light" | "dark", field: keyof CustomColorThemePalette, value: string) => void;
  onResetCustomColorTheme: (appearance: "light" | "dark") => void;
  onReplayExperience: () => void;
  exportTargetRef?: RefObject<HTMLElement | null>;
  vizMode?: VisualizationMode;
  selectedSurahId?: number;
}

export default function DisplaySettingsPanel({
  theme,
  onThemeChange,
  colorTheme,
  onColorThemeChange,
  lexicalColorMode,
  onLexicalColorModeChange,
  customColorTheme,
  onCustomColorThemeChange,
  onResetCustomColorTheme,
  onReplayExperience,
  exportTargetRef,
  vizMode,
  selectedSurahId,
}: DisplaySettingsPanelProps) {
  const t = useTranslations("DisplaySettings");
  const [isOpen, setIsOpen] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const { canInstall, isInstalled, isInstallSupported, promptInstall } = usePwaInstall();
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const activePalette = customColorTheme[theme];

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutside = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("touchstart", closeOnOutside, { passive: true });
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("touchstart", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const handleInstallApp = async () => {
    if (!canInstall || isInstalling) return;
    setIsInstalling(true);
    try {
      await promptInstall();
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="display-settings" ref={containerRef}>
      <button
        type="button"
        className={`display-settings-trigger ${isOpen ? "open" : ""}`}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={t("panelLabel")}
        data-tour-id="display-settings-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {"\u2699"}
      </button>

      {isOpen && (
        <div className="display-settings-panel" id={panelId} role="dialog" aria-label={t("panelLabel")}>
          <div className="display-settings-section">
            <div className="display-settings-title">{t("appearance")}</div>
            <ThemeSwitcher theme={theme} onThemeChange={onThemeChange} />
          </div>

          <div className="display-settings-section">
            <div className="display-settings-title">{t("palette")}</div>
            <div className="display-theme-list">
              {COLOR_THEME_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`display-theme-item ${colorTheme === preset.id ? "active" : ""}`}
                  onClick={() => onColorThemeChange(preset.id)}
                  aria-pressed={colorTheme === preset.id}
                >
                  <span className="display-theme-swatches">
                    {preset.preview.map((color) => (
                      <span key={`${preset.id}-${color}`} className="display-theme-swatch" style={{ background: color }} />
                    ))}
                  </span>
                  <span>{t(`themes.${preset.labelKey}`)}</span>
                </button>
              ))}
              <button
                type="button"
                className={`display-theme-item ${colorTheme === "custom" ? "active" : ""}`}
                onClick={() => onColorThemeChange("custom")}
                aria-pressed={colorTheme === "custom"}
              >
                <span className="display-theme-swatches">
                  {[activePalette.accent, activePalette.accent2, activePalette.bg0].map((color, index) => (
                    <span key={`custom-${index}-${color}`} className="display-theme-swatch" style={{ background: color }} />
                  ))}
                </span>
                <span>{t("themes.custom")}</span>
              </button>
            </div>
          </div>

          <div className="display-settings-section">
            <div className="display-settings-title">{t("coloring.title")}</div>
            <div className="display-theme-list">
              {(["theme", "frequency", "identity"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`display-theme-item ${lexicalColorMode === mode ? "active" : ""}`}
                  onClick={() => onLexicalColorModeChange(mode)}
                  aria-pressed={lexicalColorMode === mode}
                >
                  <span>{t(`coloring.options.${mode}`)}</span>
                </button>
              ))}
            </div>
          </div>

          {colorTheme === "custom" && (
            <div className="display-settings-section custom-colors">
              <div className="display-settings-title">{t("custom.title")}</div>
              <div className="display-settings-subtitle">
                {t("custom.editing", { mode: t(`modes.${theme}`) })}
              </div>

              <div className="custom-color-grid">
                <label className="custom-color-row">
                  <span>{t("fields.accent")}</span>
                  <input
                    type="color"
                    value={activePalette.accent}
                    onChange={(event) => onCustomColorThemeChange(theme, "accent", event.target.value)}
                  />
                </label>
                <label className="custom-color-row">
                  <span>{t("fields.accent2")}</span>
                  <input
                    type="color"
                    value={activePalette.accent2}
                    onChange={(event) => onCustomColorThemeChange(theme, "accent2", event.target.value)}
                  />
                </label>
                <label className="custom-color-row">
                  <span>{t("fields.accent3")}</span>
                  <input
                    type="color"
                    value={activePalette.accent3}
                    onChange={(event) => onCustomColorThemeChange(theme, "accent3", event.target.value)}
                  />
                </label>
                <label className="custom-color-row">
                  <span>{t("fields.bg0")}</span>
                  <input
                    type="color"
                    value={activePalette.bg0}
                    onChange={(event) => onCustomColorThemeChange(theme, "bg0", event.target.value)}
                  />
                </label>
                <label className="custom-color-row">
                  <span>{t("fields.bg1")}</span>
                  <input
                    type="color"
                    value={activePalette.bg1}
                    onChange={(event) => onCustomColorThemeChange(theme, "bg1", event.target.value)}
                  />
                </label>
                <label className="custom-color-row">
                  <span>{t("fields.bg2")}</span>
                  <input
                    type="color"
                    value={activePalette.bg2}
                    onChange={(event) => onCustomColorThemeChange(theme, "bg2", event.target.value)}
                  />
                </label>
              </div>

              <button
                type="button"
                className="custom-reset-btn"
                onClick={() => onResetCustomColorTheme(theme)}
              >
                {t("actions.resetCurrent", { mode: t(`modes.${theme}`) })}
              </button>
            </div>
          )}

          {exportTargetRef && vizMode != null && selectedSurahId != null && (
            <div className="display-settings-section custom-colors mobile-export-section">
              <div className="display-settings-title">{t("export")}</div>
              <VizExportMenu
                targetRef={exportTargetRef}
                vizMode={vizMode}
                selectedSurahId={selectedSurahId}
              />
            </div>
          )}

          <div className="display-settings-section custom-colors">
            <div className="display-settings-title">{t("actions.title")}</div>
            <button type="button" className="custom-reset-btn" onClick={onReplayExperience}>
              {t("actions.replayExperience")}
            </button>
            {(canInstall || isInstalled || isInstallSupported) && (
              <>
                <button
                  type="button"
                  className="custom-reset-btn"
                  onClick={handleInstallApp}
                  disabled={!canInstall || isInstalling || isInstalled}
                >
                  {isInstalled
                    ? t("actions.installed")
                    : isInstalling
                      ? t("actions.installing")
                      : t("actions.installApp")}
                </button>
                {!isInstalled && !canInstall && (
                  <p className="display-settings-note">{t("actions.installHint")}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .display-settings {
          position: relative;
          flex-shrink: 0;
        }

        .display-settings-trigger {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: rgba(255, 255, 255, 0.7);
          color: var(--ink);
          font-size: 1rem;
          cursor: pointer;
          transition: border-color 0.2s ease, transform 0.2s ease;
        }

        .display-settings-trigger:hover,
        .display-settings-trigger.open {
          border-color: var(--accent);
          transform: translateY(-1px);
        }

        .display-settings-trigger:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }

        .display-settings-panel {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          z-index: 70;
          min-width: 270px;
          max-height: calc(100vh - 70px);
          overflow-y: auto;
          display: grid;
          gap: 12px;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid var(--line);
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(14px);
          box-shadow: 0 14px 30px rgba(0, 0, 0, 0.18);
        }

        .display-settings-section {
          display: grid;
          gap: 8px;
        }

        .display-settings-title {
          font-size: 0.74rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink-muted);
        }

        .display-theme-list {
          display: grid;
          gap: 6px;
        }

        .display-settings-subtitle {
          font-size: 0.72rem;
          color: var(--ink-muted);
        }

        .display-theme-item {
          border: 1px solid transparent;
          border-radius: 10px;
          background: transparent;
          color: var(--ink);
          font-size: 0.77rem;
          font-family: inherit;
          padding: 8px 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          cursor: pointer;
          transition: border-color 0.18s ease, background 0.18s ease;
        }

        .display-theme-item:hover {
          border-color: var(--accent);
        }

        .display-theme-item.active {
          border-color: color-mix(in srgb, var(--accent), transparent 18%);
          background: color-mix(in srgb, var(--accent), transparent 88%);
        }

        .display-theme-swatches {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .display-theme-swatch {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.35);
        }

        .custom-colors {
          border-top: 1px solid var(--line);
          padding-top: 10px;
        }

        .custom-color-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px 10px;
        }

        .custom-color-row {
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 0.73rem;
          color: var(--ink-secondary);
        }

        .custom-color-row input[type="color"] {
          width: 28px;
          height: 22px;
          border: 1px solid var(--line);
          border-radius: 6px;
          background: transparent;
          padding: 0;
          cursor: pointer;
        }

        .custom-reset-btn {
          margin-top: 6px;
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 7px 10px;
          background: transparent;
          color: var(--ink-secondary);
          font-family: inherit;
          font-size: 0.72rem;
          cursor: pointer;
          transition: border-color 0.18s ease, color 0.18s ease;
        }

        .custom-reset-btn:hover {
          border-color: var(--accent);
          color: var(--ink);
        }

        .custom-reset-btn:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .display-settings-note {
          margin: 0;
          font-size: 0.7rem;
          color: var(--ink-muted);
          line-height: 1.4;
        }

        :global([data-theme="dark"]) .display-settings-trigger {
          background: rgba(18, 18, 26, 0.75);
        }

        :global([data-theme="dark"]) .display-settings-panel {
          background: rgba(18, 18, 26, 0.95);
          box-shadow: 0 14px 36px rgba(0, 0, 0, 0.45);
        }

        @media (max-width: 900px) {
          .display-settings-trigger {
            width: 38px;
            height: 38px;
          }

          .custom-color-grid {
            grid-template-columns: 1fr;
          }
        }

        .mobile-export-section {
          display: none;
        }

        @media (max-width: 980px) {
          .mobile-export-section {
            display: grid;
          }

          .display-settings-panel {
            position: fixed;
            top: 52px;
            right: 8px;
            left: 8px;
            min-width: 0;
            width: auto;
            max-height: calc(100vh - 60px);
            overflow-y: auto;
          }
        }
      `}</style>
    </div>
  );
}
