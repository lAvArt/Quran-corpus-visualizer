"use client";

import { useTranslations } from "next-intl";
import VisualizationSwitcher from "@/components/ui/VisualizationSwitcher";
import DisplaySettingsPanel from "@/components/ui/DisplaySettingsPanel";
import VizExportMenu from "@/components/ui/VizExportMenu";
import type { ExperienceLevel } from "@/lib/schema/experience";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";
import type { CustomColorTheme, CustomColorThemePalette, ColorThemeId } from "@/lib/theme/colorThemes";
import type { LexicalColorMode } from "@/lib/theme/lexicalColoring";

interface GraphToolbarProps {
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  colorThemeId: ColorThemeId;
  setColorThemeId: (id: ColorThemeId) => void;
  lexicalColorMode: LexicalColorMode;
  setLexicalColorMode: (mode: LexicalColorMode) => void;
  customColorTheme: CustomColorTheme;
  handleCustomColorThemeChange: (appearance: "light" | "dark", field: keyof CustomColorThemePalette, value: string) => void;
  handleResetCustomColorTheme: (appearance: "light" | "dark") => void;
  experienceLevel: ExperienceLevel;
  handleExperienceLevelChange: (level: ExperienceLevel) => void;
  handleReplayExperience: () => void;
  mainVizRef: React.RefObject<HTMLElement | null>;
  vizMode: VisualizationMode;
  selectedSurahId: number;
  showAdvancedModes: boolean;
  setShowAdvancedModes: (show: boolean) => void;
  handleVizModeChange: (mode: VisualizationMode) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
}

/** Floating toolbar below the graph — holds viz switcher, display settings, export, drawer toggle */
export default function GraphToolbar({
  theme,
  setTheme,
  colorThemeId,
  setColorThemeId,
  lexicalColorMode,
  setLexicalColorMode,
  customColorTheme,
  handleCustomColorThemeChange,
  handleResetCustomColorTheme,
  experienceLevel,
  handleExperienceLevelChange,
  handleReplayExperience,
  mainVizRef,
  vizMode,
  selectedSurahId,
  showAdvancedModes,
  setShowAdvancedModes,
  handleVizModeChange,
  isSidebarOpen,
  setIsSidebarOpen,
}: GraphToolbarProps) {
  const t = useTranslations("Index");

  return (
    <div className="graph-toolbar" data-tour-id="graph-toolbar">
      <div className="graph-toolbar-inner">
        <div className="graph-toolbar-switcher" data-tour-id="viz-switcher">
          <VisualizationSwitcher
            currentMode={vizMode}
            onModeChange={handleVizModeChange}
            experienceLevel={experienceLevel}
            showAdvancedModes={showAdvancedModes}
            onToggleAdvancedModes={setShowAdvancedModes}
            theme={theme}
            onThemeChange={setTheme}
          />
        </div>

        <div className="graph-toolbar-actions">
          <div data-tour-id="display-settings">
            <DisplaySettingsPanel
              theme={theme}
              onThemeChange={setTheme}
              colorTheme={colorThemeId}
              onColorThemeChange={setColorThemeId}
              lexicalColorMode={lexicalColorMode}
              onLexicalColorModeChange={setLexicalColorMode}
              customColorTheme={customColorTheme}
              onCustomColorThemeChange={handleCustomColorThemeChange}
              onResetCustomColorTheme={handleResetCustomColorTheme}
              experienceLevel={experienceLevel}
              onExperienceLevelChange={handleExperienceLevelChange}
              onReplayExperience={handleReplayExperience}
              exportTargetRef={mainVizRef}
              vizMode={vizMode}
              selectedSurahId={selectedSurahId}
            />
          </div>

          <VizExportMenu targetRef={mainVizRef} vizMode={vizMode} selectedSurahId={selectedSurahId} />

          <button
            className={`toolbar-drawer-toggle ${isSidebarOpen ? "active" : ""}`}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            data-tour-id="tools-toggle"
          >
            {isSidebarOpen ? t("hideTools") : t("showTools")}
          </button>
        </div>
      </div>

      <style jsx>{`
        .graph-toolbar {
          position: fixed;
          bottom: calc(var(--footer-height) + 12px);
          left: 50%;
          transform: translateX(-50%);
          z-index: 45;
          pointer-events: none;
          max-width: min(720px, 92vw);
          width: 100%;
        }

        .graph-toolbar-inner {
          pointer-events: auto;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 16px;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }

        :global([data-theme="dark"]) .graph-toolbar-inner {
          background: rgba(22, 22, 30, 0.9);
          border-color: rgba(255, 255, 255, 0.1);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .graph-toolbar-switcher {
          flex: 1 1 auto;
          min-width: 0;
        }

        .graph-toolbar-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .toolbar-drawer-toggle {
          background: transparent;
          color: #f97316;
          border: 2px solid #f97316;
          padding: 0.4rem 0.9rem;
          border-radius: 99px;
          font-size: 0.75rem;
          min-width: 7.2rem;
          text-align: center;
          font-weight: 600;
          letter-spacing: 0.02em;
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.2s;
        }

        .toolbar-drawer-toggle:hover {
          background: rgba(249, 115, 22, 0.1);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(249, 115, 22, 0.2);
        }

        .toolbar-drawer-toggle.active {
          background: #f97316;
          color: #fff;
        }

        .toolbar-drawer-toggle.active:hover {
          background: #ea580c;
          border-color: #ea580c;
        }

        @media (max-width: 980px) {
          .graph-toolbar {
            bottom: calc(var(--footer-height) + var(--mobile-tools-bar-clearance, 60px) + 8px);
            max-width: calc(100vw - 16px);
          }

          .graph-toolbar-inner {
            gap: 6px;
            padding: 5px 8px;
          }

          .toolbar-drawer-toggle {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
