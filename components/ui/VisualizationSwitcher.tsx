"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";
import GlossaryChips from "@/components/ui/GlossaryChips";

interface VisualizationSwitcherProps {
  currentMode: VisualizationMode;
  onModeChange: (mode: VisualizationMode) => void;
  experienceLevel: "beginner" | "advanced";
  showAdvancedModes: boolean;
  onToggleAdvancedModes: (value: boolean) => void;
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
      mode: "collocation-network",
      label: "Collocation Network",
      description: "Analyze co-occurring roots and semantic neighborhoods",
      icon: "🕸️",
    },
    {
      mode: "knowledge-graph",
      label: "Knowledge Graph",
      description: "Neural map of your tracked roots and learning progress",
      icon: "🌱",
    },
  ];

const BEGINNER_PRIMARY_MODES: VisualizationMode[] = [
  "radial-sura",
  "surah-distribution",
  "root-network",
];

export default function VisualizationSwitcher({
  currentMode,
  onModeChange,
  experienceLevel,
  showAdvancedModes,
  onToggleAdvancedModes,
  theme: _theme,
  onThemeChange: _onThemeChange,
}: VisualizationSwitcherProps) {
  const t = useTranslations('VisualizationSwitcher');
  const [isExpanded, setIsExpanded] = useState(false);
  const dropdownId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isExpanded) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const clickedInsideTrigger = !!triggerRef.current?.contains(target);
      const clickedInsideDropdown = !!dropdownRef.current?.contains(target);
      if (!clickedInsideTrigger && !clickedInsideDropdown) {
        setIsExpanded(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsExpanded(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
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
  const coreOptions = VISUALIZATION_OPTIONS.filter((option) => BEGINNER_PRIMARY_MODES.includes(option.mode));
  const advancedOptions = VISUALIZATION_OPTIONS.filter((option) => !BEGINNER_PRIMARY_MODES.includes(option.mode));
  const visibleOptions =
    experienceLevel === "advanced" || showAdvancedModes
      ? VISUALIZATION_OPTIONS
      : coreOptions;

  return (
    <div className="ui-viz-switcher" ref={containerRef} data-tour-id="viz-switcher-root">
      <div>
        <button
          ref={triggerRef}
          type="button"
          className="ui-viz-switcher-current"
          data-testid="viz-switcher-trigger"
          aria-expanded={isExpanded}
          aria-controls={dropdownId}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="ui-viz-switcher-icon">{currentOption?.icon ?? "\u25C9"}</span>
          <div className="ui-viz-switcher-info">
            <span className="ui-viz-switcher-label">{t(`modes.${currentMode}.label`)}</span>
            <span className="ui-viz-switcher-desc">{t(`modes.${currentMode}.description`)}</span>
          </div>
          <span className={`ui-viz-switcher-arrow ${isExpanded ? "expanded" : ""}`}>{"\u25BE"}</span>
        </button>
      </div>

      {
        isExpanded && (
          <div ref={dropdownRef} className="ui-viz-switcher-dropdown" id={dropdownId}>
            <div className="ui-viz-switcher-section">
              <div className="ui-viz-switcher-section-head">
                <strong>{experienceLevel === "advanced" || showAdvancedModes ? "All views" : "Core views"}</strong>
                <span>{experienceLevel === "advanced" || showAdvancedModes ? "Full visualization catalog" : "Recommended for first exploration"}</span>
              </div>
              {experienceLevel === "beginner" && !showAdvancedModes ? (
                <div className="ui-viz-switcher-helper">
                  Start with these core views to orient yourself first, then open the full catalog when you want deeper relationship and syntax analysis.
                </div>
              ) : null}
            </div>
            <div className="ui-viz-switcher-section">
              <GlossaryChips vizMode={currentMode} />
            </div>
            <div className="ui-viz-switcher-section">
              {visibleOptions.map((option) => (
                <button
                  type="button"
                  key={option.mode}
                  className={`ui-viz-switcher-option ${currentMode === option.mode ? "active" : ""}`}
                  data-mode={option.mode}
                  data-testid={`viz-option-${option.mode}`}
                  onClick={() => handleModeSelect(option.mode)}
                >
                  <span className="ui-viz-switcher-icon">{option.icon}</span>
                  <div className="ui-viz-switcher-info">
                    <span className="ui-viz-switcher-label">{t(`modes.${option.mode}.label`)}</span>
                    <span className="ui-viz-switcher-desc">{t(`modes.${option.mode}.description`)}</span>
                  </div>
                </button>
              ))}
            </div>
            {experienceLevel === "beginner" && showAdvancedModes ? (
              <div className="ui-viz-switcher-section">
                <div className="ui-viz-switcher-section-head">
                  <strong>Advanced views unlocked</strong>
                  <span>{advancedOptions.length} specialized options are now available</span>
                </div>
              </div>
            ) : null}
            {experienceLevel === "beginner" && (
              <button
                type="button"
                className="ui-viz-switcher-toggle"
                onClick={() => onToggleAdvancedModes(!showAdvancedModes)}
              >
                {showAdvancedModes ? t("lessVisualizations") : t("moreVisualizations")}
              </button>
            )}
          </div>
        )
      }
    </div>
  );
}
