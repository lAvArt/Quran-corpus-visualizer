"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { VizErrorBoundary } from "@/components/ErrorBoundary";
import { SURAH_NAMES } from "@/lib/data/surahData";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";
import type { CorpusToken, RootWordFlow } from "@/lib/schema/types";
import type { LexicalColorMode } from "@/lib/theme/lexicalColoring";

function VizFallback({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", minHeight: 200 }}>
      <div style={{ textAlign: "center", color: "var(--ink-muted)" }}>
        <div style={{ width: 32, height: 32, border: "3px solid var(--line)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 0.5rem" }} />
        <span style={{ fontSize: "0.85rem" }}>{label}</span>
      </div>
    </div>
  );
}

function useVizComponent<T>(loader: Parameters<typeof dynamic<T>>[0], label: string) {
  return dynamic(loader, { loading: () => <VizFallback label={label} />, ssr: false });
}

interface VisualizationViewportProps {
  vizMode: VisualizationMode;
  allTokens: CorpusToken[];
  selectedSurahId: number;
  selectedAyahInSurah: number | null;
  selectedRoot: string | null;
  selectedRootValue: string | null;
  selectedLemmaValue: string | null;
  flows: RootWordFlow[];
  roots: string[];
  tokenById: Map<string, CorpusToken>;
  theme: "light" | "dark";
  lexicalColorMode: LexicalColorMode;
  setHoverTokenId: (tokenId: string | null) => void;
  setFocusedTokenId: (tokenId: string | null) => void;
  setSelectedSurahId: (surahId: number) => void;
  handleRootSelect: (root: string | null) => void;
  handleSurahSelect: (surahId: number, nextMode?: "radial-sura" | "root-network") => void;
}

export default function VisualizationViewport({
  vizMode,
  allTokens,
  selectedSurahId,
  selectedAyahInSurah,
  selectedRoot,
  selectedRootValue,
  selectedLemmaValue,
  flows,
  roots,
  tokenById,
  theme,
  lexicalColorMode,
  setHoverTokenId,
  setFocusedTokenId,
  setSelectedSurahId,
  handleRootSelect,
  handleSurahSelect,
}: VisualizationViewportProps) {
  const t = useTranslations("Index");
  const fallbackLabel = t("overlay.visualizationLoading");
  const RadialSuraMap = useVizComponent(() => import("@/components/visualisations/RadialSuraMap"), fallbackLabel);
  const RootNetworkGraph = useVizComponent(() => import("@/components/visualisations/RootNetworkGraph"), fallbackLabel);
  const SurahDistributionGraph = useVizComponent(() => import("@/components/visualisations/SurahDistributionGraph"), fallbackLabel);
  const ArcFlowDiagram = useVizComponent(() => import("@/components/visualisations/ArcFlowDiagram"), fallbackLabel);
  const AyahDependencyGraph = useVizComponent(() => import("@/components/visualisations/AyahDependencyGraph"), fallbackLabel);
  const RootFlowSankey = useVizComponent(() => import("@/components/visualisations/RootFlowSankey"), fallbackLabel);
  const CorpusArchitectureMap = useVizComponent(() => import("@/components/visualisations/CorpusArchitectureMap"), fallbackLabel);
  const KnowledgeGraphViz = useVizComponent(() => import("@/components/visualisations/KnowledgeGraphViz"), fallbackLabel);
  const CollocationNetworkGraph = useVizComponent(() => import("@/components/visualisations/CollocationNetworkGraph"), fallbackLabel);
  const vizContent = (() => {
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
            lexicalColorMode={lexicalColorMode}
          />
        );
      case "root-network":
        return (
          <RootNetworkGraph
            tokens={allTokens}
            onTokenHover={setHoverTokenId}
            onTokenFocus={setFocusedTokenId}
            onRootSelect={handleRootSelect}
            highlightRoot={selectedRoot}
            selectedSurahId={selectedSurahId}
            theme={theme}
            showLabels={true}
            lexicalColorMode={lexicalColorMode}
          />
        );
      case "surah-distribution":
        return (
          <SurahDistributionGraph
            tokens={allTokens}
            onTokenHover={setHoverTokenId}
            onTokenFocus={setFocusedTokenId}
            onSurahSelect={(surahId) => handleSurahSelect(surahId, "radial-sura")}
            highlightRoot={selectedRoot}
            theme={theme}
            lexicalColorMode={lexicalColorMode}
          />
        );
      case "corpus-architecture":
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
            lexicalColorMode={lexicalColorMode}
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
            lexicalColorMode={lexicalColorMode}
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
            onSurahChange={setSelectedSurahId}
            theme={theme}
            lexicalColorMode={lexicalColorMode}
          />
        );
      case "knowledge-graph":
        return <KnowledgeGraphViz tokens={allTokens} onRootSelect={handleRootSelect} theme={theme} />;
      case "sankey-flow":
        return (
          <RootFlowSankey
            flows={flows}
            roots={roots}
            tokenById={tokenById}
            onTokenHover={setHoverTokenId}
            onTokenFocus={setFocusedTokenId}
            selectedSurahId={selectedSurahId}
            theme={theme}
            lexicalColorMode={lexicalColorMode}
          />
        );
      case "collocation-network":
        return (
          <CollocationNetworkGraph
            tokens={allTokens}
            onTokenHover={setHoverTokenId}
            onTokenFocus={setFocusedTokenId}
            onRootSelect={handleRootSelect}
            highlightRoot={selectedRoot}
            selectedSurahId={selectedSurahId}
            theme={theme}
          />
        );
      default:
        return null;
    }
  })();

  return <VizErrorBoundary name={vizMode}>{vizContent ?? <VizFallback label={fallbackLabel} />}</VizErrorBoundary>;
}
