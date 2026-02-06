"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import RadialSuraMap from "@/components/visualisations/RadialSuraMap";
import RootNetworkGraph from "@/components/visualisations/RootNetworkGraph";
import SurahDistributionGraph from "@/components/visualisations/SurahDistributionGraph";
import ArcFlowDiagram from "@/components/visualisations/ArcFlowDiagram";
import AyahDependencyGraph from "@/components/visualisations/AyahDependencyGraph";
import RootFlowSankey from "@/components/visualisations/RootFlowSankey";
import CorpusArchitectureMap from "@/components/visualisations/CorpusArchitectureMap"; // Added import
import VisualizationSwitcher from "@/components/ui/VisualizationSwitcher";
import GlobalSearch from "@/components/ui/GlobalSearch";
import AppSidebar from "@/components/ui/AppSidebar";
import CurrentSelectionPanel from "@/components/ui/CurrentSelectionPanel";
import { sampleAyahDependency } from "@/lib/corpus/sampleAyahDependency";
import { getSampleData, loadFullCorpus, type LoadingProgress } from "@/lib/corpus/corpusLoader";
import { buildRootWordFlows, uniqueRoots } from "@/lib/search/rootFlows";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";
import type { CorpusToken } from "@/lib/schema/types";
import { SURAH_NAMES } from "@/lib/data/surahData";

export default function HomePage() {
  const [hoverTokenId, setHoverTokenId] = useState<string | null>(null);
  const [focusedTokenId, setFocusedTokenId] = useState<string | null>(null);
  const [vizMode, setVizMode] = useState<VisualizationMode>("corpus-architecture"); // Changed initial state
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedSurahId, setSelectedSurahId] = useState<number>(1);
  const [selectedRoot, setSelectedRoot] = useState<string | null>(null);
  const [selectedLemma, setSelectedLemma] = useState<string | null>(null);

  // Corpus loading state
  const [tokens, setTokens] = useState<CorpusToken[]>(() => getSampleData());
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress | null>(null);
  const [isLoadingCorpus, setIsLoadingCorpus] = useState(false);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Load full corpus on mount (background)
  useEffect(() => {
    let cancelled = false;

    const loadCorpus = async () => {
      setIsLoadingCorpus(true);
      console.log('[Page] Starting corpus load...');
      try {
        const corpusTokens = await loadFullCorpus((progress) => {
          if (!cancelled) {
            setLoadingProgress(progress);
            console.log(`[Page] Progress: ${progress.message}`);
          }
        });
        if (!cancelled && corpusTokens.length > 0) {
          console.log(`[Page] Corpus loaded: ${corpusTokens.length} tokens`);
          setTokens(corpusTokens);
        }
      } catch (err) {
        console.error('[Page] Failed to load corpus:', err);
        // Keep sample data on error
      } finally {
        if (!cancelled) setIsLoadingCorpus(false);
      }
    };

    loadCorpus();
    return () => { cancelled = true; };
  }, []);

  // Merge with dependency data for visualization
  const allTokens = useMemo(() => {
    const merged = [...tokens, ...sampleAyahDependency.tokens];
    const byId = new Map(merged.map((token) => [token.id, token]));
    return [...byId.values()].sort(
      (a, b) => a.sura - b.sura || a.ayah - b.ayah || a.position - b.position
    );
  }, [tokens]);

  const tokenById = useMemo(
    () => new Map(allTokens.map((token) => [token.id, token])),
    [allTokens]
  );

  const flows = useMemo(() => buildRootWordFlows(allTokens), [allTokens]);
  const roots = useMemo(() => uniqueRoots(allTokens), [allTokens]);

  const focusedToken = useMemo(
    () => (focusedTokenId ? tokenById.get(focusedTokenId) ?? null : null),
    [focusedTokenId, tokenById]
  );
  const inspectorToken =
    focusedToken ||
    (hoverTokenId && tokenById.get(hoverTokenId)) ||
    null;
  const inspectorMode = focusedTokenId ? "focus" : hoverTokenId ? "hover" : "idle";
  const selectedAyahInSurah =
    focusedToken && focusedToken.sura === selectedSurahId ? focusedToken.ayah : null;
  const selectedRootValue = selectedRoot ?? focusedToken?.root ?? null;
  const selectedLemmaValue = selectedLemma ?? focusedToken?.lemma ?? null;

  // Handle search selection
  const handleTokenSelect = useCallback((tokenId: string) => {
    setFocusedTokenId(tokenId);
    const token = tokenById.get(tokenId);
    if (token) {
      setSelectedSurahId(token.sura);
    }
    setIsSidebarOpen(true);
  }, [tokenById]);

  const handleSurahSelect = useCallback(
    (suraId: number, preferredView?: "root-network" | "radial-sura") => {
      setSelectedSurahId(suraId);
      if (preferredView) {
        setVizMode(preferredView);
      }
    },
    []
  );

  const handleRootSelect = useCallback((root: string | null) => {
    setSelectedRoot(root);
    // Optional: Switch to root network or just stay and highlight?
    // Let's stay in current view but highlight, unless in surah distribution where it might be hard to see
  }, []);

  const handleLemmaSelect = useCallback((lemma: string) => {
    setSelectedLemma(lemma);
  }, []);

  // Compute stats for display
  const stats = useMemo(() => {
    const suraSet = new Set(allTokens.map(t => t.sura));
    const rootSet = new Set(allTokens.filter(t => t.root).map(t => t.root));
    return {
      suraCount: suraSet.size,
      tokenCount: allTokens.length,
      rootCount: rootSet.size,
    };
  }, [allTokens]);

  // Render the active visualization
  const renderVisualization = () => {
    switch (vizMode) {
      case "radial-sura":
        return (
          <RadialSuraMap
            tokens={allTokens}
            suraId={selectedSurahId}
            suraName={SURAH_NAMES[selectedSurahId]?.name || `Surah ${selectedSurahId}`}
            suraNameArabic={SURAH_NAMES[selectedSurahId]?.arabic || ""}
            onTokenHover={setHoverTokenId}
            onTokenFocus={setFocusedTokenId}
            onRootSelect={handleRootSelect}
            highlightRoot={selectedRoot}
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
            filterBySurahId={selectedSurahId}
            highlightRoot={selectedRoot}
          />
        );

      case "surah-distribution":
        return (
          <SurahDistributionGraph
            tokens={allTokens}
            onTokenHover={setHoverTokenId}
            onTokenFocus={setFocusedTokenId}
            onSurahSelect={(suraId) => handleSurahSelect(suraId, "radial-sura")}
            highlightRoot={selectedRoot}
            theme={theme}
          />
        );

      case "corpus-architecture": // Added new case
        return (
          <CorpusArchitectureMap
            tokens={allTokens}
            selectedSurahId={selectedSurahId}
            highlightRoot={selectedRoot}
            onNodeSelect={(type, id) => {
              if (type === "surah") setSelectedSurahId(id as number);
              if (type === "root") handleRootSelect(id as string);
            }}
            theme={theme}
          />
        );

      case "arc-flow":
        return (
          <ArcFlowDiagram
            tokens={allTokens}
            groupBy="root"
            onTokenHover={setHoverTokenId}
            onTokenFocus={setFocusedTokenId}
            selectedSurahId={selectedSurahId}
            selectedAyah={selectedAyahInSurah}
            selectedRoot={selectedRootValue}
            selectedLemma={selectedLemmaValue}
            theme={theme}
          />
        );

      case "dependency-tree":
        return (
          <AyahDependencyGraph
            tokens={allTokens}
            selectedSurahId={selectedSurahId}
            selectedAyah={selectedAyahInSurah}
            onTokenHover={setHoverTokenId}
            onTokenFocus={setFocusedTokenId}
            theme={theme}
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
        <div className="header-dock">
          <div className="brand-block">
            <p className="eyebrow">Quran Corpus Visualizer</p>
            <div className="brand-title-row">
              <h1 className="brand-title">Corpus Atlas</h1>
              <span className="version-pill">v0.4</span>
            </div>
            <p className="brand-meta">
              {stats.suraCount} Surahs · {stats.tokenCount.toLocaleString()} Tokens · {stats.rootCount} Roots
            </p>
          </div>

          <GlobalSearch
            tokens={allTokens}
            onTokenSelect={handleTokenSelect}
            onTokenHover={setHoverTokenId}
            theme={theme}
          />

          <div className="header-controls">
            <VisualizationSwitcher
              currentMode={vizMode}
              onModeChange={setVizMode}
              theme={theme}
              onThemeChange={setTheme}
            />

            <button
              className={`sidebar-toggle-btn ${isSidebarOpen ? "active" : ""}`}
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              {isSidebarOpen ? "Hide Tools ->" : "Show Tools <-"}
            </button>
          </div>
        </div>
      </header>

      {/* Loading indicator */}
      {isLoadingCorpus && loadingProgress && (
        <div className="loading-indicator">
          <div className="loading-bar">
            <div
              className="loading-progress"
              style={{
                width: `${(loadingProgress.currentSura / loadingProgress.totalSuras) * 100}%`,
              }}
            />
          </div>
          <span className="loading-text">{loadingProgress.message}</span>
        </div>
      )}

      {/* Main Full-Screen Visualization */}
      <main className="immersive-viewport viz-fullwidth">
        {renderVisualization()}
      </main>

      <CurrentSelectionPanel
        vizMode={vizMode}
        selectedSurahId={selectedSurahId}
        selectedAyah={selectedAyahInSurah}
        selectedRoot={selectedRootValue}
        selectedLemma={selectedLemmaValue}
        activeToken={focusedToken ?? null}
      />

      {/* Collapsible Sidebar */}
      <div className={`floating-sidebar ${isSidebarOpen ? "open" : ""}`}>
        <AppSidebar
          allTokens={allTokens}
          inspectorToken={inspectorToken}
          inspectorMode={inspectorMode}
          onClearFocus={() => setFocusedTokenId(null)}
          onTokenHover={setHoverTokenId}
          onTokenFocus={setFocusedTokenId}
          onSelectSurah={handleSurahSelect}
          onSelectRoot={handleRootSelect}
          onSelectLemma={handleLemmaSelect}
          selectedSurahId={selectedSurahId}
          vizMode={vizMode}
        />
      </div>

      <style jsx>{`
        .loading-indicator {
          position: fixed;
          top: 80px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 100;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: rgba(0, 0, 0, 0.75);
          border-radius: 12px;
          backdrop-filter: blur(8px);
        }

        .loading-bar {
          width: 200px;
          height: 4px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
          overflow: hidden;
        }

        .loading-progress {
          height: 100%;
          background: var(--accent);
          transition: width 0.3s ease;
        }

        .loading-text {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.8);
        }
      `}</style>
    </div>
  );
}
