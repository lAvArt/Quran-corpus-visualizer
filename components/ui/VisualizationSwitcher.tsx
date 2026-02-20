"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";

interface VisualizationSwitcherProps {
  currentMode: VisualizationMode;
  onModeChange: (mode: VisualizationMode) => void;
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
}

const VISUALIZATION_OPTIONS: Array<{
  mode: VisualizationMode;
  label: string;
  description: string;
  icon: string;
}> = [
    {
      mode: "corpus-architecture",
      label: "Corpus Architecture",
      description: "Global corpus hierarchy map showing structure overview",
      icon: "⬡",
    },
    {
      mode: "surah-distribution",
      label: "Surah Distribution",
      description: "Linear distribution plot of all 114 Surahs and their sizes",
      icon: "◎",
    },
    {
      mode: "radial-sura",
      label: "Radial Sura",
      description: "Circular layout showing verse structure with root connections",
      icon: "\u25C9",
    },
    {
      mode: "root-network",
      label: "Root Network",
      description: "Force-directed graph of trilateral roots and their lemmas",
      icon: "\u2B21",
    },
    {
      mode: "arc-flow",
      label: "Arc Flow",
      description: "Arc diagram with frequency bars and flowing connections",
      icon: "\u2312",
    },
    {
      mode: "dependency-tree",
      label: "Dependency",
      description: "Traditional syntax dependency graph for single verses",
      icon: "\u228F",
    },
    {
      mode: "sankey-flow",
      label: "Sankey Flow",
      description: "Root-to-lemma flow visualization with proportional widths",
      icon: "\u224B",
    },
    {
      mode: "knowledge-graph",
      label: "Knowledge Graph",
      description: "Neural map of your tracked roots and learning progress",
      icon: "🌱",
    },
  ];

export default function VisualizationSwitcher({
  currentMode,
  onModeChange,
  theme: _theme,
  onThemeChange: _onThemeChange,
}: VisualizationSwitcherProps) {
  const t = useTranslations('VisualizationSwitcher');
  const [isExpanded, setIsExpanded] = useState(false);
  const dropdownId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsExpanded(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isExpanded]);

  const handleModeSelect = useCallback(
    (mode: VisualizationMode) => {
      onModeChange(mode);
      setIsExpanded(false);
    },
    [onModeChange]
  );

  const currentOption = VISUALIZATION_OPTIONS.find((opt) => opt.mode === currentMode);

  return (
    <div className="viz-switcher-container" ref={containerRef} data-tour-id="viz-switcher-root">
      <div className="viz-switcher-header">
        <button
          type="button"
          className="viz-switcher-current"
          aria-expanded={isExpanded}
          aria-controls={dropdownId}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="viz-switcher-icon">{currentOption?.icon ?? "\u25C9"}</span>
          <div className="viz-switcher-info">
            <span className="viz-switcher-label">{t(`modes.${currentMode}.label`)}</span>
            <span className="viz-switcher-desc">{t(`modes.${currentMode}.description`)}</span>
          </div>
          <span className={`viz-switcher-arrow ${isExpanded ? "expanded" : ""}`}>{"\u25BE"}</span>
        </button>
      </div>

      {
        isExpanded && (
          <div className="viz-switcher-dropdown" id={dropdownId}>
            <div className="viz-dropdown-title">{t('dropdownTitle')}</div>
            {VISUALIZATION_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.mode}
                className={`viz-switcher-option ${currentMode === option.mode ? "active" : ""}`}
                onClick={() => handleModeSelect(option.mode)}
              >
                <span className="viz-switcher-icon">{option.icon}</span>
                <div className="viz-switcher-info">
                  <span className="viz-switcher-label">{t(`modes.${option.mode}.label`)}</span>
                  <span className="viz-switcher-desc">{t(`modes.${option.mode}.description`)}</span>
                </div>

              </button>
            ))}
          </div>
        )
      }

      <style jsx>{`
        .viz-switcher-container {
          position: relative;
          width: 100%;
          min-width: 0;
          max-width: 620px;
        }

        .viz-switcher-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .viz-switcher-current {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.7);
          color: var(--ink);
          font-family: inherit;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        }

        .viz-switcher-current:hover {
          border-color: var(--accent);
          transform: translateY(-1px);
        }

        .viz-switcher-current:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }

        .viz-switcher-icon {
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: rgba(15, 118, 110, 0.12);
          color: var(--accent);
          font-size: 1.05rem;
          font-weight: 600;
        }

        .viz-switcher-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .viz-switcher-label {
          font-weight: 600;
          font-size: 0.88rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .viz-switcher-desc {
          font-size: 0.74rem;
          color: var(--ink-secondary);
          opacity: 0.85;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .viz-switcher-arrow {
          margin-left: auto;
          font-size: 0.9rem;
          opacity: 0.5;
          transition: transform 0.2s ease;
        }

        .viz-switcher-arrow.expanded {
          transform: rotate(180deg);
        }


        .viz-dropdown-title {
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--ink-secondary);
          padding: 6px 12px 4px;
          display: none;
        }

        .viz-switcher-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          z-index: 50;
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 8px;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(16px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
          max-height: calc(100vh - 100px);
          overflow-y: auto;
        }

        .viz-switcher-option {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border: 1px solid transparent;
          border-radius: 10px;
          background: transparent;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .viz-switcher-option:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .viz-switcher-option.active {
          background: var(--accent);
        }

        .viz-switcher-option.active .viz-switcher-label {
          color: white;
        }

        .viz-switcher-option.active .viz-switcher-desc {
          color: rgba(255, 255, 255, 0.8);
        }

        @media (max-width: 1280px) {
          .viz-switcher-desc {
            display: none;
          }

          .viz-switcher-current {
            padding: 8px 10px;
          }
        }

@media (max-width: 980px) {
          .viz-switcher-container {
            width: auto;
            min-width: 0;
            position: static; /* Allow dropdown to be fixed relative to viewport */
          }

          .viz-dropdown-title {
            display: block;
          }

          .viz-switcher-dropdown {
            position: fixed;
            top: 60px;
            left: 50%;
            transform: translateX(-50%);
            width: 94vw;
            max-width: 400px;
            max-height: calc(100vh - 80px);
            overflow-y: auto;
            z-index: 100;
            right: auto;
            box-shadow: 0 0 0 100vh rgba(0,0,0,0.5); /* Dim background */
          }

          .viz-switcher-option .viz-switcher-info {
             display: flex; /* Keep info visible in dropdown */
          }
        }

        @media (max-width: 640px) {
          .viz-switcher-current {
            padding: 8px;
            gap: 4px;
          }

          .viz-switcher-desc {
            display: none;
          }

          .viz-switcher-label {
            font-size: 0.78rem;
          }
        }

        @media (max-width: 420px) {
          .viz-switcher-current .viz-switcher-label {
            display: none;
          }
        }

        :global([data-theme="dark"]) .viz-switcher-current {
          background: rgba(18, 18, 26, 0.75);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
        }

        :global([data-theme="dark"]) .viz-switcher-icon {
          background: rgba(249, 115, 22, 0.18);
          color: var(--accent);
        }


        :global([data-theme="dark"]) .viz-switcher-dropdown {
          background: rgba(18, 18, 26, 0.92);
        }
      `}</style>
    </div >
  );
}
