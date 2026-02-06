"use client";

import { useMemo, useState, useEffect } from "react";
import MorphologyInspector from "@/components/inspectors/MorphologyInspector";
import AyahDependencyGraph from "@/components/visualisations/AyahDependencyGraph";
import RootFlowSankey from "@/components/visualisations/RootFlowSankey";
import RadialSuraMap from "@/components/visualisations/RadialSuraMap";
import RootNetworkGraph from "@/components/visualisations/RootNetworkGraph";
import ArcFlowDiagram from "@/components/visualisations/ArcFlowDiagram";
import SemanticSearchPanel from "@/components/ui/SemanticSearchPanel";
import VisualizationSwitcher from "@/components/ui/VisualizationSwitcher";
import { sampleAyahDependency } from "@/lib/corpus/sampleAyahDependency";
import { sampleTokens } from "@/lib/corpus/sampleCorpus";
import { SAMPLE_MORPHOLOGY_DATA } from "@/lib/corpus/morphologyData";
import { buildRootWordFlows, uniqueRoots } from "@/lib/search/rootFlows";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";

export default function HomePage() {
  const [hoverTokenId, setHoverTokenId] = useState<string | null>(null);
  const [focusedTokenId, setFocusedTokenId] = useState<string | null>(null);
  const [vizMode, setVizMode] = useState<VisualizationMode>("radial-sura");
  const [theme, setTheme] = useState<"light" | "dark">("dark");

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
    }
  };

  return (
    <main className="page-shell neural-stage" data-theme={theme}>
      <div className="neural-bg" aria-hidden />

      <header className="hero">
        <p className="eyebrow">Quran Corpus Visualizer v0.2</p>
        <h1>Advanced Linguistic Visualization</h1>
        <p>
          Explore the morphological and syntactic structure of the Quran through
          multiple high-end visualization modes. Switch between radial maps, network
          graphs, arc flows, and traditional dependency trees.
        </p>
      </header>

      <VisualizationSwitcher
        currentMode={vizMode}
        onModeChange={setVizMode}
        theme={theme}
        onThemeChange={setTheme}
      />

      {/* Main Visualization */}
      {renderVisualization()}

      {/* Morphology Inspector */}
      <MorphologyInspector
        token={inspectorToken}
        mode={inspectorMode}
        onClearFocus={() => setFocusedTokenId(null)}
      />

      {/* Search Panel */}
      <SemanticSearchPanel
        tokens={allTokens}
        onTokenHover={setHoverTokenId}
        onTokenFocus={setFocusedTokenId}
      />

      {/* Quick Access to Other Visualizations */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Quick Access</p>
            <h2>Other Visualizations</h2>
          </div>
        </div>
        <div className="quick-viz-grid">
          {vizMode !== "radial-sura" && (
            <button
              className="quick-viz-btn"
              onClick={() => setVizMode("radial-sura")}
            >
              <span className="quick-viz-icon">◉</span>
              <span>Radial Sura Map</span>
            </button>
          )}
          {vizMode !== "root-network" && (
            <button
              className="quick-viz-btn"
              onClick={() => setVizMode("root-network")}
            >
              <span className="quick-viz-icon">⬡</span>
              <span>Root Network</span>
            </button>
          )}
          {vizMode !== "arc-flow" && (
            <button
              className="quick-viz-btn"
              onClick={() => setVizMode("arc-flow")}
            >
              <span className="quick-viz-icon">⌒</span>
              <span>Arc Flow</span>
            </button>
          )}
          {vizMode !== "dependency-tree" && (
            <button
              className="quick-viz-btn"
              onClick={() => setVizMode("dependency-tree")}
            >
              <span className="quick-viz-icon">⊏</span>
              <span>Dependency Tree</span>
            </button>
          )}
          {vizMode !== "sankey-flow" && (
            <button
              className="quick-viz-btn"
              onClick={() => setVizMode("sankey-flow")}
            >
              <span className="quick-viz-icon">≋</span>
              <span>Sankey Flow</span>
            </button>
          )}
        </div>

        <style jsx>{`
          .quick-viz-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 12px;
            padding: 16px 22px 22px;
          }

          .quick-viz-btn {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 14px 18px;
            border: 1px solid var(--line);
            border-radius: 12px;
            background: transparent;
            color: var(--ink);
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .quick-viz-btn:hover {
            background: var(--accent);
            border-color: var(--accent);
            color: white;
          }

          .quick-viz-icon {
            font-size: 1.3rem;
            opacity: 0.7;
          }

          .quick-viz-btn:hover .quick-viz-icon {
            opacity: 1;
          }
        `}</style>
      </section>
    </main>
  );
}

