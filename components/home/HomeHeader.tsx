"use client";

import Image from "next/image";
import VisualizationSwitcher from "@/components/ui/VisualizationSwitcher";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import DisplaySettingsPanel from "@/components/ui/DisplaySettingsPanel";
import GlobalSearch from "@/components/ui/GlobalSearch";
import MobileNavMenu from "@/components/ui/MobileNavMenu";
import { AuthButton } from "@/components/ui/AuthButton";
import VizExportMenu from "@/components/ui/VizExportMenu";
import AppModeNav from "@/components/ui/AppModeNav";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";
import type { CorpusToken } from "@/lib/schema/types";
import type { SearchMatchType } from "@/lib/analytics/events";
import type { CustomColorTheme, CustomColorThemePalette, ColorThemeId } from "@/lib/theme/colorThemes";
import type { LexicalColorMode } from "@/lib/theme/lexicalColoring";

interface HomeHeaderProps {
  t: (key: string) => string;
  allTokens: CorpusToken[];
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  colorThemeId: ColorThemeId;
  setColorThemeId: (themeId: ColorThemeId) => void;
  lexicalColorMode: LexicalColorMode;
  setLexicalColorMode: (mode: LexicalColorMode) => void;
  customColorTheme: CustomColorTheme;
  handleCustomColorThemeChange: (appearance: "light" | "dark", field: keyof CustomColorThemePalette, value: string) => void;
  handleResetCustomColorTheme: (appearance: "light" | "dark") => void;
  experienceLevel: "beginner" | "advanced";
  handleExperienceLevelChange: (level: "beginner" | "advanced") => void;
  handleReplayExperience: () => void;
  mainVizRef: React.RefObject<HTMLElement | null>;
  vizMode: VisualizationMode;
  selectedSurahId: number;
  showAdvancedModes: boolean;
  setShowAdvancedModes: (show: boolean) => void;
  handleVizModeChange: (mode: VisualizationMode) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  onTokenSelect: (tokenId: string) => void;
  onTokenHover: (tokenId: string | null) => void;
  onRootSelect: (root: string | null) => void;
  onSearchOpened: () => void;
  onSearchQuerySubmitted: (query: string) => void;
  onSearchResultSelected: (matchType: SearchMatchType) => void;
}

export default function HomeHeader(props: HomeHeaderProps) {
  const {
    t,
    allTokens,
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
    onTokenSelect,
    onTokenHover,
    onRootSelect,
    onSearchOpened,
    onSearchQuerySubmitted,
    onSearchResultSelected,
  } = props;

  return (
    <header className="floating-header">
      <div className="header-dock">
        <div className="brand-block" data-tour-id="header-brand">
          <Image src="/favicon.svg" alt="" className="brand-logo" width={28} height={28} />
          <div className="brand-text">
            <p className="eyebrow">{t("eyebrow")}</p>
            <div className="brand-title-row">
              <h1 className="brand-title">{t("brand")}</h1>
            </div>
          </div>
        </div>

        <div data-tour-id="global-search" className="desktop-only">
          <GlobalSearch
            tokens={allTokens}
            analyticsSurface="header"
            onTokenSelect={onTokenSelect}
            onTokenHover={onTokenHover}
            onRootSelect={onRootSelect}
            onSearchOpened={onSearchOpened}
            onSearchQuerySubmitted={onSearchQuerySubmitted}
            onSearchResultSelected={onSearchResultSelected}
          />
        </div>

        <div className="header-controls" data-tour-id="header-controls">
          <div className="desktop-only">
            <AppModeNav />
          </div>
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
          <div data-tour-id="viz-switcher">
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
          <div className="desktop-only" style={{ display: "contents" }}>
            <VizExportMenu targetRef={mainVizRef} vizMode={vizMode} selectedSurahId={selectedSurahId} />
          </div>
          <div className="desktop-only" style={{ display: "contents" }}>
            <button
              className={`sidebar-toggle-btn ${isSidebarOpen ? "active" : ""}`}
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              data-tour-id="tools-toggle"
            >
              {isSidebarOpen ? t("hideTools") : t("showTools")}
            </button>
          </div>
          <div className="desktop-only" style={{ display: "contents" }}>
            <div className="header-button-group">
              <AuthButton />
              <LanguageSwitcher />
            </div>
          </div>
          <MobileNavMenu theme={theme} onThemeChange={setTheme} />
        </div>
      </div>
    </header>
  );
}
