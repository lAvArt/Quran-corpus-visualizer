"use client";

import { useMemo, useState, useEffect } from "react";
import RadialSuraMap from "@/components/visualisations/RadialSuraMap";
import RootNetworkGraph from "@/components/visualisations/RootNetworkGraph";
import ArcFlowDiagram from "@/components/visualisations/ArcFlowDiagram";
import AyahDependencyGraph from "@/components/visualisations/AyahDependencyGraph";
import RootFlowSankey from "@/components/visualisations/RootFlowSankey";
import VisualizationSwitcher from "@/components/ui/VisualizationSwitcher";
import AppSidebar from "@/components/ui/AppSidebar";
import { sampleAyahDependency } from "@/lib/corpus/sampleAyahDependency";
import { sampleTokens } from "@/lib/corpus/sampleCorpus";
import { SAMPLE_MORPHOLOGY_DATA } from "@/lib/corpus/morphologyData";
import { buildRootWordFlows, uniqueRoots } from "@/lib/search/rootFlows";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";

export default function HomePage() {
  const [hoverTokenId, setHoverTokenId] = useState<string | null>(null);
  const [focusedTokenId, setFocusedTokenId] = useState<string | null>(null);
  const [vizMode, setVizMode] = useState<VisualizationMode>("root-network");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Merge sample tokens with morphology data
  const allTokens = useMemo(() => {
    const merged = [...sampleTokens, ...sampleAyahDependency.tokens, ...SAMPLE_MORPHOLOGY_DATA];
    const byId = new Map(merged.map((token) => [token.id, token]));
    return [...byId.values()].sort(
      (a, b) => a.sura - b.sura || a.ayah - b.ayah || a.position - b.position
    );
  }, []);

  const tokenById = useMemo(
    () => new Map(allTokens.map((token) => [token.id, token])),
    [allTokens]
  );

  const flows = buildRootWordFlows(sampleTokens);
  const roots = uniqueRoots(sampleTokens);

  const inspectorToken =
    (focusedTokenId && tokenById.get(focusedTokenId)) ||
    (hoverTokenId && tokenById.get(hoverTokenId)) ||
    null;
  const inspectorMode = focusedTokenId ? "focus" : hoverTokenId ? "hover" : "idle";

  // Render the active visualization
  const renderVisualization = () => {
    switch (vizMode) {
      case "radial-sura":
        return (
          <RadialSuraMap
            tokens={allTokens}
            suraId={1}
            suraName="Al-Fatihah"
            suraNameArabic="الفاتحة"
            onTokenHover={setHoverTokenId}
            onTokenFocus={setFocusedTokenId}
            theme={theme}
          />
        );

      case "root-network":
        return (
          <RootNetworkGraph
            tokens={allTokens}
            onTokenHover={setHoverTokenId}
            onTokenFocus={setFocusedTokenId}
            theme={theme}
            showLabels={true}
          />
        );

      case "arc-flow":
        return (
          <ArcFlowDiagram
            tokens={allTokens}
            groupBy="root"
            onTokenHover={setHoverTokenId}
            onTokenFocus={setFocusedTokenId}
            theme={theme}
          />
        );

      case "dependency-tree":
        return (
          <AyahDependencyGraph
            data={sampleAyahDependency}
            onTokenHover={setHoverTokenId}
            onTokenFocus={setFocusedTokenId}
          />
        );

      case "sankey-flow":
        return (
          <RootFlowSankey
            flows={flows}
            roots={roots}
            tokenById={tokenById}
            onTokenHover={setHoverTokenId}
            onTokenFocus={setFocusedTokenId}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="immersive-dashboard" data-theme={theme}>
      <div className="neural-bg" aria-hidden />

      {/* Floating Header */}
      <header className="floating-header">
        <div className="header-glass">
            <div className="header-branding">
              <p className="eyebrow" style={{marginBottom: 0}}>Quran Corpus Visualizer v0.3</p>
              <h1 style={{fontSize: '1.2rem', margin: 0}}>Linguistics Web</h1>
            </div>

            <VisualizationSwitcher
              currentMode={vizMode}
              onModeChange={setVizMode}
              theme={theme}
              onThemeChange={setTheme}
            />
            
            <button 
                className={`sidebar-toggle-btn ${isSidebarOpen ? 'active' : ''}`}
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
                {isSidebarOpen ? 'Hide Tools →' : 'Show Tools ←'}
            </button>
        </div>
      </header>

      {/* Main Full-Screen Visualization */}
      <main className="immersive-viewport">
           {renderVisualization()}
      </main>

      {/* Collapsible Sidebar */}
      <div className={`floating-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <AppSidebar
          allTokens={allTokens}
          inspectorToken={inspectorToken}
          inspectorMode={inspectorMode}
          onClearFocus={() => setFocusedTokenId(null)}
          onTokenHover={setHoverTokenId}
          onTokenFocus={setFocusedTokenId}
        />
      </div>
    </div>
  );
}
