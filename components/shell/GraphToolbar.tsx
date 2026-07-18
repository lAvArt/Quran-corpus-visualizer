"use client";

import VisualizationSwitcher from "@/components/ui/VisualizationSwitcher";
import DisplaySettingsPanel from "@/components/ui/DisplaySettingsPanel";
import LexicalColorSwitch from "@/components/shell/LexicalColorSwitch";
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
}

/** Floating toolbar below the graph — colour switch (left) · graph selector (center) · settings + export (right) */
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
}: GraphToolbarProps) {

  return (
    <div className="graph-toolbar" data-tour-id="graph-toolbar">
      <div className="graph-toolbar-inner">
        {/* Left: colour encoding · Center: graph selector · Right: settings + export.
            The tools open/close moved to the right screen edge (the drawer handle). */}
        <div className="graph-toolbar-left">
          <LexicalColorSwitch mode={lexicalColorMode} onChange={setLexicalColorMode} />
        </div>

        <div className="graph-toolbar-center" data-tour-id="viz-switcher">
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

        <div className="graph-toolbar-right">
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
          max-width: min(820px, 94vw);
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
          background: rgba(22, 33, 39, 0.9);
          border-color: rgba(255, 255, 255, 0.1);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        /* Left: colour switch · Center: graph selector (fills) · Right: settings + export */
        .graph-toolbar-left {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }

        .graph-toolbar-center {
          flex: 1 1 auto;
          min-width: 0;
        }

        .graph-toolbar-right {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
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
        }
      `}</style>
    </div>
  );
}
