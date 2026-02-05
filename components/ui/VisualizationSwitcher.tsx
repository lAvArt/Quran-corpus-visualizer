"use client";

import { useState, useCallback } from "react";
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
    mode: "radial-sura",
    label: "Radial Sura",
    description: "Circular layout showing verse structure with root connections",
    icon: "◉",
  },
  {
    mode: "root-network",
    label: "Root Network",
    description: "Force-directed graph of trilateral roots and their lemmas",
    icon: "⬡",
  },
  {
    mode: "arc-flow",
    label: "Arc Flow",
    description: "Arc diagram with frequency bars and flowing connections",
    icon: "⌒",
  },
  {
    mode: "dependency-tree",
    label: "Dependency",
    description: "Traditional syntax dependency graph for single verses",
    icon: "⊏",
  },
  {
    mode: "sankey-flow",
    label: "Sankey Flow",
    description: "Root-to-lemma flow visualization with proportional widths",
    icon: "≋",
  },
];

export default function VisualizationSwitcher({
  currentMode,
  onModeChange,
  theme,
  onThemeChange,
}: VisualizationSwitcherProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleModeSelect = useCallback(
    (mode: VisualizationMode) => {
      onModeChange(mode);
      setIsExpanded(false);
    },
    [onModeChange]
  );

  const currentOption = VISUALIZATION_OPTIONS.find((opt) => opt.mode === currentMode);

  return (
    <div className="viz-switcher-container">
      <div className="viz-switcher-header">
        <div className="viz-switcher-current" onClick={() => setIsExpanded(!isExpanded)}>
          <span className="viz-switcher-icon">{currentOption?.icon ?? "◉"}</span>
          <div className="viz-switcher-info">
            <span className="viz-switcher-label">{currentOption?.label ?? "Select"}</span>
            <span className="viz-switcher-desc">{currentOption?.description ?? ""}</span>
          </div>
          <span className={`viz-switcher-arrow ${isExpanded ? "expanded" : ""}`}>▾</span>
        </div>

        <div className="viz-theme-toggle">
          <button
            className={`theme-btn ${theme === "light" ? "active" : ""}`}
            onClick={() => onThemeChange("light")}
            title="Light theme"
          >
            ☀
          </button>
          <button
            className={`theme-btn ${theme === "dark" ? "active" : ""}`}
            onClick={() => onThemeChange("dark")}
            title="Dark theme"
          >
            ☾
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="viz-switcher-dropdown">
          {VISUALIZATION_OPTIONS.map((option) => (
            <button
              key={option.mode}
              className={`viz-switcher-option ${currentMode === option.mode ? "active" : ""}`}
              onClick={() => handleModeSelect(option.mode)}
            >
              <span className="viz-switcher-icon">{option.icon}</span>
              <div className="viz-switcher-info">
                <span className="viz-switcher-label">{option.label}</span>
                <span className="viz-switcher-desc">{option.description}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <style jsx>{`
        .viz-switcher-container {
          position: relative;
          min-width: 250px;
        }

        .viz-switcher-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .viz-switcher-current {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 18px;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: var(--panel);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .viz-switcher-current:hover {
          border-color: var(--accent);
        }

        .viz-switcher-icon {
          font-size: 1.5rem;
          opacity: 0.8;
        }

        .viz-switcher-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .viz-switcher-label {
          font-weight: 600;
          font-size: 0.95rem;
        }

        .viz-switcher-desc {
          font-size: 0.8rem;
          color: var(--ink-secondary);
          opacity: 0.7;
        }

        .viz-switcher-arrow {
          font-size: 0.9rem;
          opacity: 0.5;
          transition: transform 0.2s ease;
        }

        .viz-switcher-arrow.expanded {
          transform: rotate(180deg);
        }

        .viz-theme-toggle {
          display: flex;
          gap: 4px;
          padding: 4px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: var(--panel);
        }

        .theme-btn {
          width: 36px;
          height: 36px;
          border: none;
          border-radius: 8px;
          background: transparent;
          font-size: 1.1rem;
          cursor: pointer;
          transition: all 0.2s ease;
          opacity: 0.5;
        }

        .theme-btn:hover {
          opacity: 0.8;
          background: rgba(255, 255, 255, 0.1);
        }

        .theme-btn.active {
          opacity: 1;
          background: var(--accent);
          color: white;
        }

        .viz-switcher-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 60px;
          z-index: 50;
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 8px;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: var(--panel);
          backdrop-filter: blur(16px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
        }

        .viz-switcher-option {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border: none;
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

        @media (max-width: 640px) {
          .viz-switcher-desc {
            display: none;
          }

          .viz-switcher-dropdown {
            right: 0;
          }
        }
      `}</style>
    </div>
  );
}
