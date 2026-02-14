"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import ThemeSwitcher from "@/components/ui/ThemeSwitcher";
import {
  COLOR_THEME_PRESETS,
  type ColorThemeId,
} from "@/lib/theme/colorThemes";

interface DisplaySettingsPanelProps {
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
  colorTheme: ColorThemeId;
  onColorThemeChange: (themeId: ColorThemeId) => void;
}

export default function DisplaySettingsPanel({
  theme,
  onThemeChange,
  colorTheme,
  onColorThemeChange,
}: DisplaySettingsPanelProps) {
  const t = useTranslations("DisplaySettings");
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="display-settings" ref={containerRef}>
      <button
        type="button"
        className={`display-settings-trigger ${isOpen ? "open" : ""}`}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={t("panelLabel")}
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
            </div>
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

          .display-settings-panel {
            right: -42px;
            min-width: 250px;
          }
        }
      `}</style>
    </div>
  );
}
