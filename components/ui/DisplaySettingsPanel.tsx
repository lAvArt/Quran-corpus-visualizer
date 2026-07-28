"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import ThemeSwitcher from "@/components/ui/ThemeSwitcher";
import { usePwaInstall } from "@/components/providers/PwaProvider";
import { useKnowledge } from "@/lib/context/KnowledgeContext";
import VizExportMenu from "@/components/ui/VizExportMenu";
import { type ExperienceLevel } from "@/lib/schema/experience";
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
  experienceLevel: ExperienceLevel;
  onExperienceLevelChange: (level: ExperienceLevel) => void;
  onReplayExperience: () => void;
  exportTargetRef?: RefObject<HTMLElement | null>;
  vizMode?: VisualizationMode;
  selectedSurahId?: number;
  /** Controlled open state — when provided, overrides internal state and
   *  every close path (outside click, Escape, trigger click) routes through
   *  `onOpenChange` instead of a local setter. Omitted (uncontrolled)
   *  preserves the original self-managed behavior used by GraphToolbar. */
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hides the ⚙ trigger button — for callers (AppShell's mobile instance)
   *  that drive `isOpen` from elsewhere (a top-bar button owned by another
   *  component) and only want the panel body rendered. */
  hideTrigger?: boolean;
  /** Renders `children` in a mobile-only section at the bottom of the panel
   *  — the toolbar controls (colour encoding switch, export menu) that
   *  otherwise live in GraphToolbar, which is hidden entirely on mobile.
   *  Also suppresses the panel's own built-in export section (below) so a
   *  caller passing a `VizExportMenu` as a child doesn't get it rendered
   *  twice. */
  mobileExtras?: boolean;
  children?: ReactNode;
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
  experienceLevel,
  onExperienceLevelChange,
  onReplayExperience,
  exportTargetRef,
  vizMode,
  selectedSurahId,
  isOpen: controlledOpen,
  onOpenChange,
  hideTrigger,
  mobileExtras,
  children,
}: DisplaySettingsPanelProps) {
  const t = useTranslations("DisplaySettings");
  const [internalOpen, setInternalOpen] = useState(false);
  // Controlled/uncontrolled split: an external `isOpen` prop takes over
  // entirely (every setter below routes through `onOpenChange` instead of
  // the internal state), same pattern as a controlled <input>.
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof value === "function" ? (value as (prev: boolean) => boolean)(isOpen) : value;
      if (isControlled) {
        onOpenChange?.(next);
      } else {
        setInternalOpen(next);
      }
    },
    [isControlled, isOpen, onOpenChange]
  );
  const [isInstalling, setIsInstalling] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [highContrast, setHighContrast] = useState(false);
  const [semanticEnabled, setSemanticEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    try { return JSON.parse(localStorage.getItem("qcv-semantic-search-enabled") ?? "true"); } catch { return true; }
  });
  const { canInstall, isInstalled, isInstallSupported, promptInstall } = usePwaInstall();
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activePalette = customColorTheme[theme];
  const { exportKnowledge, importKnowledge, stats } = useKnowledge();

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const count = await importKnowledge(text, true);
      alert(`Imported ${count} roots successfully.`);
    } catch {
      alert('Failed to import. Please check the file format.');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [importKnowledge]);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutside = (event: PointerEvent) => {
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

    // Capture phase makes outside taps reliable on mobile before other handlers run.
    document.addEventListener("pointerdown", closeOnOutside, true);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutside, true);
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
      {!hideTrigger && (
        <button
          type="button"
          className={`display-settings-trigger ${isOpen ? "open" : ""}`}
          data-testid="display-settings-trigger"
          aria-expanded={isOpen}
          aria-controls={panelId}
          aria-label={t("panelLabel")}
          data-tour-id="display-settings-trigger"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          {"\u2699"}
        </button>
      )}

      {isOpen && (
        <div className="display-settings-panel" id={panelId} role="dialog" aria-label={t("panelLabel")}>
          <div className="display-settings-section">
            <div className="display-settings-title">{t("appearance")}</div>
            <ThemeSwitcher theme={theme} onThemeChange={onThemeChange} />
          </div>

          <div className="display-settings-section">
            <div className="display-settings-title">{t("accessibility.title")}</div>
            <label className="display-settings-row">
              <span className="display-settings-row-label">{t("accessibility.textSize")}</span>
              <input
                type="range"
                className="display-settings-slider"
                min={0.8}
                max={1.4}
                step={0.05}
                value={fontScale}
                onChange={(e) => {
                  const scale = parseFloat(e.target.value);
                  setFontScale(scale);
                  document.documentElement.style.setProperty("--user-font-scale", String(scale));
                }}
              />
              <span className="display-settings-scale-label">{Math.round(fontScale * 100)}%</span>
            </label>
            <label className="display-settings-row">
              <span className="display-settings-row-label">{t("accessibility.highContrast")}</span>
              <button
                type="button"
                role="switch"
                aria-checked={highContrast}
                className={`toggle-switch ${highContrast ? "on" : ""}`}
                onClick={() => {
                  const next = !highContrast;
                  setHighContrast(next);
                  document.documentElement.setAttribute("data-high-contrast", next ? "true" : "false");
                }}
              >
                <span className="toggle-thumb" />
              </button>
            </label>
          </div>

          <div className="display-settings-section">
            <div className="display-settings-title">{t("palette")}</div>
            <div className="display-settings-select-row">
              <span className="display-theme-swatches">
                {colorTheme === "custom"
                  ? [activePalette.accent, activePalette.accent2, activePalette.bg0].map((color, i) => (
                      <span key={`custom-${i}-${color}`} className="display-theme-swatch" style={{ background: color }} />
                    ))
                  : (COLOR_THEME_PRESETS.find((p) => p.id === colorTheme)?.preview ?? []).map((color) => (
                      <span key={`${colorTheme}-${color}`} className="display-theme-swatch" style={{ background: color }} />
                    ))
                }
              </span>
              <select
                className="display-settings-select"
                value={colorTheme}
                onChange={(e) => onColorThemeChange(e.target.value as ColorThemeId)}
              >
                {COLOR_THEME_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {t(`themes.${preset.labelKey}`)}
                  </option>
                ))}
                <option value="custom">{t("themes.custom")}</option>
              </select>
            </div>
          </div>

          <div className="display-settings-section">
            <div className="display-settings-title">{t("coloring.title")}</div>
            <select
              className="display-settings-select"
              value={lexicalColorMode}
              onChange={(e) => onLexicalColorModeChange(e.target.value as LexicalColorMode)}
            >
              {(["theme", "frequency", "identity"] as const).map((mode) => (
                <option key={mode} value={mode}>
                  {t(`coloring.options.${mode}`)}
                </option>
              ))}
            </select>
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

          {/* Suppressed when `mobileExtras` is set: that caller (AppShell's
              mobile instance) passes its own VizExportMenu as a child in the
              section below instead — rendering both would duplicate it. */}
          {!mobileExtras && exportTargetRef && vizMode != null && selectedSurahId != null && (
            <div className="display-settings-section custom-colors mobile-export-section">
              <div className="display-settings-title">{t("export")}</div>
              <VizExportMenu
                targetRef={exportTargetRef}
                vizMode={vizMode}
                selectedSurahId={selectedSurahId}
              />
            </div>
          )}

          {/* Mobile-only toolbar controls that would otherwise live in
              GraphToolbar (hidden entirely on mobile — see AppShell). No
              single existing i18n key names this mix of tools, so it's a
              plain visual divider (border-top, via `.custom-colors`) rather
              than a mislabeled section title. */}
          {mobileExtras && children && (
            <div className="display-settings-section custom-colors mobile-settings-extras">
              {children}
            </div>
          )}

          <div className="display-settings-section custom-colors">
            <div className="display-settings-title">{t("experienceLevel.title")}</div>
            <label className="display-settings-row">
              <span className="display-settings-row-label">
                {t(`experienceLevel.options.${experienceLevel}`)}
              </span>
              <button
                type="button"
                role="switch"
                data-testid="display-experience-toggle"
                aria-checked={experienceLevel === "advanced"}
                className={`toggle-switch ${experienceLevel === "advanced" ? "on" : ""}`}
                onClick={() =>
                  onExperienceLevelChange(experienceLevel === "beginner" ? "advanced" : "beginner")
                }
              >
                <span className="toggle-thumb" />
              </button>
            </label>
          </div>

          <div className="display-settings-section custom-colors">
            <div className="display-settings-title">{t("search.title")}</div>
            <label className="display-settings-row">
              <span className="display-settings-row-label">{t("search.semanticSearch")}</span>
              <button
                type="button"
                role="switch"
                aria-checked={semanticEnabled}
                className={`toggle-switch ${semanticEnabled ? "on" : ""}`}
                onClick={() => {
                  const next = !semanticEnabled;
                  setSemanticEnabled(next);
                  try {
                    localStorage.setItem("qcv-semantic-search-enabled", JSON.stringify(next));
                  } catch {
                    // Ignore storage write failures.
                  }
                }}
              >
                <span className="toggle-thumb" />
              </button>
            </label>
            <p className="display-settings-note">{t("search.semanticHint")}</p>
          </div>

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

          <div className="display-settings-section custom-colors">
            <div className="display-settings-title">{t("knowledge.title")}</div>
            <p className="display-settings-note">
              {t("knowledge.stats", { total: stats.total, learning: stats.learning, learned: stats.learned })}
            </p>
            <button type="button" className="custom-reset-btn" onClick={exportKnowledge}>
              {t("knowledge.export")}
            </button>
            <button type="button" className="custom-reset-btn" onClick={() => fileInputRef.current?.click()}>
              {t("knowledge.import")}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
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
          bottom: calc(100% + 8px);
          right: 0;
          z-index: 70;
          min-width: 270px;
          max-height: calc(100vh - 160px);
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

        .display-settings-select-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .display-settings-select {
          flex: 1;
          appearance: none;
          -webkit-appearance: none;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: transparent;
          color: var(--ink);
          font-family: inherit;
          font-size: 0.77rem;
          padding: 8px 28px 8px 10px;
          cursor: pointer;
          transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 8px center;
        }

        .display-settings-select:hover {
          border-color: var(--accent);
          background: color-mix(in srgb, var(--accent), transparent 92%);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent), transparent 88%);
        }

        .display-settings-select:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
          background: color-mix(in srgb, var(--accent), transparent 90%);
        }

        .display-settings-select option {
          background: var(--bg0, #fff);
          color: var(--ink);
          padding: 6px 10px;
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

        .display-settings-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.77rem;
          color: var(--ink-secondary);
        }

        .display-settings-row-label {
          flex: 1;
        }

        .display-settings-slider {
          width: 80px;
          accent-color: var(--accent);
        }

        .display-settings-scale-label {
          font-size: 0.7rem;
          min-width: 36px;
          text-align: right;
          color: var(--ink-muted);
        }

        :global([data-theme="dark"]) .display-settings-trigger {
          background: rgba(20, 30, 36, 0.75);
        }

        :global([data-theme="dark"]) .display-settings-panel {
          background: rgba(20, 30, 36, 0.95);
          box-shadow: 0 14px 36px rgba(0, 0, 0, 0.45);
        }

        :global([data-theme="dark"]) .display-settings-select option {
          background: #15151b;
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

        .mobile-settings-extras {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        /* LexicalColorSwitch normally lives in GraphToolbar's left slot and
           hides itself below 980px via its own styled-jsx (that toolbar is
           hidden on mobile anyway) — override for its new mobile home here.
           The .mobile-settings-extras :global(.lex-switch) selector compiles
           to 2 scoped/unscoped selector parts vs. the 1 LexicalColorSwitch's
           own rule compiles to before styled-jsx appends ITS OWN scoping
           class (which brings it to 2 as well) — the !important settles the
           tie regardless of style tag insertion order (same trap documented
           in JourneyRail's in-dock override, without the luxury of sharing a
           style block with the rule being overridden here). */
        .mobile-settings-extras :global(.lex-switch) {
          display: inline-flex !important;
        }

        /* Toggle switch */
        .toggle-switch {
          position: relative;
          width: 36px;
          height: 20px;
          border-radius: 10px;
          border: none;
          padding: 2px;
          cursor: pointer;
          background: var(--ink-muted, #999);
          transition: background 0.2s ease;
          flex-shrink: 0;
        }

        .toggle-switch.on {
          background: var(--accent);
        }

        .toggle-thumb {
          display: block;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
          transition: transform 0.2s ease;
          pointer-events: none;
        }

        .toggle-switch.on .toggle-thumb {
          transform: translateX(16px);
        }

        [dir="rtl"] .toggle-switch.on .toggle-thumb {
          transform: translateX(-16px);
        }

        @media (max-width: 980px) {
          .mobile-export-section {
            display: grid;
          }

          .display-settings-panel {
            position: fixed;
            top: var(--header-clearance);
            right: 8px;
            left: 8px;
            bottom: calc(var(--footer-height) + var(--mobile-tools-bar-clearance));
            min-width: 0;
            width: auto;
            max-height: none;
            overflow-y: auto;
            padding-bottom: calc(12px + env(safe-area-inset-bottom));
          }
        }
      `}</style>
    </div>
  );
}
