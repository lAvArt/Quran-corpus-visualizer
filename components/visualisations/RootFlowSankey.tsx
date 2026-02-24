"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { VizExplainerDialog, HelpIcon } from "@/components/ui/VizExplainerDialog";

import type { ChangeEvent } from "react";
import type { CorpusToken, RootWordFlow } from "@/lib/schema/types";
import { useZoom } from "@/lib/hooks/useZoom";
import { useVizControl } from "@/lib/hooks/VizControlContext";
import { getFrequencyColor, getIdentityColor, type LexicalColorMode } from "@/lib/theme/lexicalColoring";
import { resolveVisualizationTheme } from "@/lib/schema/visualizationTypes";

interface RootFlowSankeyProps {
  flows: RootWordFlow[];
  roots: string[];
  tokenById: Map<string, CorpusToken>;
  onTokenHover: (tokenId: string | null) => void;
  onTokenFocus: (tokenId: string) => void;
  selectedSurahId?: number;
  theme?: "light" | "dark";
  lexicalColorMode?: LexicalColorMode;
}

const INITIAL_VISIBLE = 50;
const LOAD_MORE_COUNT = 50;
const SVG_WIDTH = 1080;
const ROOT_COLUMN_X = 90;
const COLUMN_WIDTH = 190;
const LEMMA_COLUMN_X = 800;
const FLOW_START_X = ROOT_COLUMN_X + COLUMN_WIDTH;
const FLOW_END_X = LEMMA_COLUMN_X;
const FLOW_TOP_PADDING = 96;
const FLOW_BOTTOM_PADDING = 72;
const FLOW_LANE_GAP = 3;
const NODE_GAP = 14;
const NODE_VERTICAL_PAD = 8;

interface SankeyNodeLayout {
  id: string;
  total: number;
  y: number;
  height: number;
  stackHeight: number;
}

interface SankeyFlowLayout {
  key: string;
  flow: RootWordFlow;
  width: number;
  startY: number;
  endY: number;
}

function pathWidth(weightRatio: number): number {
  const normalized = Math.max(0, Math.min(1, weightRatio));
  return 4 + normalized * 14;
}

function ribbonPath(startX: number, endX: number, startY: number, endY: number, thickness: number): string {
  const half = Math.max(1, thickness / 2);
  const c1x = startX + (endX - startX) * 0.34;
  const c2x = startX + (endX - startX) * 0.66;

  return [
    `M ${startX} ${startY - half}`,
    `C ${c1x} ${startY - half}, ${c2x} ${endY - half}, ${endX} ${endY - half}`,
    `L ${endX} ${endY + half}`,
    `C ${c2x} ${endY + half}, ${c1x} ${startY + half}, ${startX} ${startY + half}`,
    "Z",
  ].join(" ");
}

function sortNodes(a: [string, { total: number; stackHeight: number }], b: [string, { total: number; stackHeight: number }]): number {
  if (b[1].total !== a[1].total) return b[1].total - a[1].total;
  return a[0].localeCompare(b[0]);
}

export default function RootFlowSankey({
  flows,
  roots: globalRoots,
  tokenById,
  onTokenHover,
  onTokenFocus,
  selectedSurahId,
  theme = "dark",
  lexicalColorMode = "theme",
}: RootFlowSankeyProps) {
  const t = useTranslations("Visualizations.RootFlow");
  const ts = useTranslations("Visualizations.Shared");
  const [selectedRoot, setSelectedRoot] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [showHelp, setShowHelp] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [hoveredFlowKey, setHoveredFlowKey] = useState<string | null>(null);
  const { isLeftSidebarOpen } = useVizControl();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 1. Calculate flows scoped to the current Surah (if selected)
  // This ensures counts reflect the local scope, not the global corpus
  const scopedFlows = useMemo(() => {
    if (!selectedSurahId) return flows;

    const newFlows: RootWordFlow[] = [];

    for (const flow of flows) {
      // Filter tokens that belong to the selected surah
      const flowsInSurah = flow.tokenIds.filter((id) => {
        const t = tokenById.get(id);
        return t?.sura === selectedSurahId;
      });

      if (flowsInSurah.length > 0) {
        newFlows.push({
          ...flow,
          count: flowsInSurah.length,
          tokenIds: flowsInSurah,
        });
      }
    }

    return newFlows.sort((a, b) => b.count - a.count || a.root.localeCompare(b.root));
  }, [flows, selectedSurahId, tokenById]);

  // 2. Derive available roots from the scoped flows
  const availableRoots = useMemo(() => {
    if (!selectedSurahId) return globalRoots;
    const rootsSet = new Set(scopedFlows.map((f) => f.root));
    return Array.from(rootsSet).sort((a, b) => a.localeCompare(b));
  }, [scopedFlows, globalRoots, selectedSurahId]);

  // Reset selected root if it's no longer available in the new scope
  useEffect(() => {
    if (selectedRoot !== "all" && !availableRoots.includes(selectedRoot)) {
      setSelectedRoot("all");
    }
  }, [availableRoots, selectedRoot]);

  // 3. Apply root filtering
  const filteredFlows = useMemo(() => {
    let result = scopedFlows;

    if (selectedRoot !== "all") {
      result = result.filter((flow) => flow.root === selectedRoot);
    }

    return result;
  }, [scopedFlows, selectedRoot]);

  const visibleFlows = useMemo(
    () => filteredFlows.slice(0, visibleCount),
    [filteredFlows, visibleCount]
  );

  const zoomRootCount = selectedRoot === "all" ? availableRoots.length : 1;
  const zoomDensity = Math.max(zoomRootCount, Math.ceil(filteredFlows.length / 10));
  const zoomMinScale =
    zoomDensity >= 120 ? 0.12 :
      zoomDensity >= 80 ? 0.14 :
        zoomDensity >= 50 ? 0.16 : 0.2;
  const zoomMaxScale =
    zoomDensity >= 180 ? 10 :
      zoomDensity >= 120 ? 9 :
        zoomDensity >= 80 ? 8 :
          zoomDensity >= 50 ? 7 : 6;

  const { svgRef, gRef, resetZoom } = useZoom<SVGSVGElement>({
    minScale: zoomMinScale,
    maxScale: zoomMaxScale,
    initialScale: 0.9,
    ready: `${isMounted}:${selectedRoot}:${selectedSurahId ?? 0}:${filteredFlows.length}:${zoomDensity}`,
  });

  const hasMore = filteredFlows.length > visibleCount;
  const totalFlows = filteredFlows.length;
  // Calculate scope-aware ratio (visible flows vs total flows IN SCOPE)
  const visibleRatio = totalFlows > 0 ? Math.round((visibleFlows.length / totalFlows) * 100) : 0;
  const hasVisibleFlows = visibleFlows.length > 0;
  const scopeLabel = selectedSurahId ? ts("surah") + " " + selectedSurahId : ts("global");
  const selectedRootLabel = selectedRoot === "all" ? t("allRoots") + " (" + availableRoots.length + ")" : selectedRoot;
  const maxCount = Math.max(...visibleFlows.map((flow) => flow.count), 1);
  const themeColors = resolveVisualizationTheme(theme);

  const flowColorFor = useCallback(
    (flow: RootWordFlow): string => {
      if (lexicalColorMode === "theme") return "url(#flowGrad)";
      if (lexicalColorMode === "identity") return getIdentityColor(flow.root, theme);
      const ratio = Math.log1p(flow.count) / Math.log1p(maxCount || 1);
      return getFrequencyColor(ratio, theme);
    },
    [lexicalColorMode, maxCount, theme]
  );

  const sankeyLayout = useMemo(() => {
    const rootStats = new Map<string, { total: number; stackHeight: number; flowCount: number }>();
    const lemmaStats = new Map<string, { total: number; stackHeight: number; flowCount: number }>();
    const flowWidths = visibleFlows.map((flow) => Math.max(4, pathWidth(flow.count / maxCount)));

    visibleFlows.forEach((flow, index) => {
      const width = flowWidths[index];

      const root = rootStats.get(flow.root) ?? { total: 0, stackHeight: 0, flowCount: 0 };
      root.total += flow.count;
      root.stackHeight += width;
      root.flowCount += 1;
      rootStats.set(flow.root, root);

      const lemma = lemmaStats.get(flow.lemma) ?? { total: 0, stackHeight: 0, flowCount: 0 };
      lemma.total += flow.count;
      lemma.stackHeight += width;
      lemma.flowCount += 1;
      lemmaStats.set(flow.lemma, lemma);
    });

    rootStats.forEach((stat) => {
      stat.stackHeight += Math.max(0, stat.flowCount - 1) * FLOW_LANE_GAP;
    });
    lemmaStats.forEach((stat) => {
      stat.stackHeight += Math.max(0, stat.flowCount - 1) * FLOW_LANE_GAP;
    });

    const rootEntries = [...rootStats.entries()].sort(sortNodes);
    const lemmaEntries = [...lemmaStats.entries()].sort(sortNodes);

    const rootNodesHeight = rootEntries.reduce((sum, [, stat]) => sum + Math.max(24, stat.stackHeight + NODE_VERTICAL_PAD * 2), 0)
      + Math.max(0, rootEntries.length - 1) * NODE_GAP;
    const lemmaNodesHeight = lemmaEntries.reduce((sum, [, stat]) => sum + Math.max(24, stat.stackHeight + NODE_VERTICAL_PAD * 2), 0)
      + Math.max(0, lemmaEntries.length - 1) * NODE_GAP;

    const contentHeight = Math.max(340, rootNodesHeight, lemmaNodesHeight);
    const height = Math.max(420, FLOW_TOP_PADDING + contentHeight + FLOW_BOTTOM_PADDING);

    const buildColumn = (
      entries: Array<[string, { total: number; stackHeight: number }]>,
      columnHeight: number
    ) => {
      const list: SankeyNodeLayout[] = [];
      const map = new Map<string, SankeyNodeLayout>();
      let cursor = FLOW_TOP_PADDING + (contentHeight - columnHeight) / 2;

      for (const [id, stat] of entries) {
        const nodeHeight = Math.max(24, stat.stackHeight + NODE_VERTICAL_PAD * 2);
        const node: SankeyNodeLayout = {
          id,
          total: stat.total,
          y: cursor + nodeHeight / 2,
          height: nodeHeight,
          stackHeight: stat.stackHeight,
        };
        list.push(node);
        map.set(id, node);
        cursor += nodeHeight + NODE_GAP;
      }

      return { list, map };
    };

    const roots = buildColumn(rootEntries, rootNodesHeight);
    const lemmas = buildColumn(lemmaEntries, lemmaNodesHeight);

    const rootOrder = new Map(roots.list.map((node, index) => [node.id, index]));
    const lemmaOrder = new Map(lemmas.list.map((node, index) => [node.id, index]));

    const flowOrder = visibleFlows
      .map((flow, index) => ({ flow, index }))
      .sort((a, b) => {
        const rootDelta = (rootOrder.get(a.flow.root) ?? 0) - (rootOrder.get(b.flow.root) ?? 0);
        if (rootDelta !== 0) return rootDelta;

        const lemmaDelta = (lemmaOrder.get(a.flow.lemma) ?? 0) - (lemmaOrder.get(b.flow.lemma) ?? 0);
        if (lemmaDelta !== 0) return lemmaDelta;

        return b.flow.count - a.flow.count;
      });

    const rootOffsets = new Map(roots.list.map((node) => [node.id, -node.stackHeight / 2]));
    const lemmaOffsets = new Map(lemmas.list.map((node) => [node.id, -node.stackHeight / 2]));
    const flowLayouts: SankeyFlowLayout[] = [];

    for (const { flow, index } of flowOrder) {
      const rootNode = roots.map.get(flow.root);
      const lemmaNode = lemmas.map.get(flow.lemma);
      if (!rootNode || !lemmaNode) continue;

      const width = flowWidths[index];
      const rootOffset = rootOffsets.get(flow.root) ?? 0;
      const lemmaOffset = lemmaOffsets.get(flow.lemma) ?? 0;

      const startY = rootNode.y + rootOffset + width / 2;
      const endY = lemmaNode.y + lemmaOffset + width / 2;

      rootOffsets.set(flow.root, rootOffset + width + FLOW_LANE_GAP);
      lemmaOffsets.set(flow.lemma, lemmaOffset + width + FLOW_LANE_GAP);

      flowLayouts.push({
        key: `${flow.root}-${flow.lemma}-${index}`,
        flow,
        width,
        startY,
        endY,
      });
    }

    return {
      height,
      rootNodes: roots.list,
      lemmaNodes: lemmas.list,
      flowLayouts,
    };
  }, [visibleFlows, maxCount]);

  useEffect(() => {
    if (!hoveredFlowKey) return;
    const stillExists = sankeyLayout.flowLayouts.some((flow) => flow.key === hoveredFlowKey);
    if (!stillExists) {
      setHoveredFlowKey(null);
      onTokenHover(null);
    }
  }, [hoveredFlowKey, sankeyLayout.flowLayouts, onTokenHover]);

  const hoveredFlow = useMemo(
    () => sankeyLayout.flowLayouts.find((flow) => flow.key === hoveredFlowKey) ?? null,
    [hoveredFlowKey, sankeyLayout.flowLayouts]
  );

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => prev + LOAD_MORE_COUNT);
  }, []);

  const handleRootChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedRoot(event.target.value);
    setVisibleCount(INITIAL_VISIBLE);
    setHoveredFlowKey(null);
    onTokenHover(null);
  }, [onTokenHover]);

  const sidebarCards = (
    <div className={`viz-left-stack sankey-sidebar-stack ${!isLeftSidebarOpen ? 'collapsed' : ''}`}>

      <div className="viz-left-panel sankey-control-card">
        <div className="sankey-card-head">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: "8px" }}>
            <p className="eyebrow">{t("title")}</p>
            <HelpIcon onClick={() => setShowHelp(true)} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              type="button"
              onClick={resetZoom}
              className="clear-focus"
              style={{ fontSize: "0.75rem", padding: "2px 8px", background: "var(--line)", borderRadius: "4px", border: "none", cursor: "pointer" }}
            >
              {ts("reset")}
            </button>
          </div>
        </div>

        <label className="sankey-field">
          <span className="sankey-label">{t("filterByRoot")}</span>
          <div className="sankey-select-shell">
            <select value={selectedRoot} onChange={handleRootChange} className="sankey-select">
              <option value="all">{t("allRoots")} ({availableRoots.length})</option>
              {availableRoots.slice(0, 300).map((root) => (
                <option key={root} value={root}>
                  {root}
                </option>
              ))}
            </select>
          </div>
        </label>

        <div className="sankey-meta-row">
          <span className="sankey-meta-key">{ts("scope")}</span>
          <span className="sankey-meta-value">{scopeLabel}</span>
        </div>
        <div className="sankey-meta-row">
          <span className="sankey-meta-key">{ts("activeRoot")}</span>
          <span className="sankey-meta-value sankey-meta-arabic">{selectedRootLabel}</span>
        </div>

        <div className="sankey-stats-row">
          <div className="sankey-stat-item">
            <span className="sankey-stat-value">{visibleFlows.length}</span>
            <span className="sankey-stat-key">{ts("shown")}</span>
          </div>
          <div className="sankey-stat-item">
            <span className="sankey-stat-value">{totalFlows}</span>
            <span className="sankey-stat-key">{ts("total")}</span>
          </div>
          <div className="sankey-stat-item">
            <span className="sankey-stat-value">{visibleRatio}%</span>
            <span className="sankey-stat-key">{ts("coverage")}</span>
          </div>
        </div>
      </div>

      <VizExplainerDialog
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        content={{
          title: t("Help.title"),
          description: t("Help.description"),
          sections: [
            { label: t("Help.widthLabel"), text: t("Help.widthText") },
            { label: t("Help.leftRightLabel"), text: t("Help.leftRightText") },
            { label: t("Help.scopeLabel"), text: t("Help.scopeText") },
          ]
        }}
      />
    </div >
  );

  return (
    <section className="sankey-wrapper">
      {isMounted && typeof document !== "undefined" && document.getElementById("viz-sidebar-portal")
        ? createPortal(sidebarCards, document.getElementById("viz-sidebar-portal")!)
        : sidebarCards}

      <div className="sankey-context-bar">
        <span className="sankey-pill">{ts("scope")}: {scopeLabel}</span>
        <span className="sankey-pill">{ts("activeRoot")}: {selectedRootLabel}</span>
        <span className="sankey-pill">
          {ts("showing")} {visibleFlows.length} {ts("of")} {totalFlows} {ts("flows")}
        </span>
      </div>

      <div className="sankey-scroll-area">
        {hasVisibleFlows ? (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_WIDTH} ${sankeyLayout.height}`}
            preserveAspectRatio="xMidYMin meet"
            className="sankey"
            role="img"
            aria-label="Root to lemma flow chart"
            style={{ cursor: "grab", touchAction: "none" }}
            onMouseDown={(e) => {
              (e.target as HTMLElement).style.cursor = "grabbing";
            }}
            onMouseUp={(e) => {
              (e.target as HTMLElement).style.cursor = "grab";
            }}
          >
            <defs>
              <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={themeColors.accentSecondary} />
                <stop offset="48%" stopColor={themeColors.accent} />
                <stop offset="100%" stopColor="var(--accent-3)" />
              </linearGradient>
            </defs>

            <g ref={gRef}>
              <rect x={ROOT_COLUMN_X} y="26" width={COLUMN_WIDTH} height={sankeyLayout.height - 56} rx="20" className="column root-column" />
              <rect x={LEMMA_COLUMN_X} y="26" width={COLUMN_WIDTH} height={sankeyLayout.height - 56} rx="20" className="column lemma-column" />
              <text x={ROOT_COLUMN_X + COLUMN_WIDTH / 2} y="58" className="column-title">
                {t("rootNode")}
              </text>
              <text x={LEMMA_COLUMN_X + COLUMN_WIDTH / 2} y="58" className="column-title">
                {t("lemmaNode")}
              </text>

              {sankeyLayout.flowLayouts.map((layout) => {
                const flow = layout.flow;
                const isActive = hoveredFlowKey === layout.key;
                const isDimmed = hoveredFlowKey !== null && !isActive;
                const shellOpacity = isDimmed ? 0.06 : isActive ? 0.65 : 0.28;
                const coreOpacity = isDimmed ? 0.08 : isActive ? 0.92 : 0.72;
                const sampleToken = (flow.tokenIds[0] && tokenById.get(flow.tokenIds[0])?.text) ?? "";
                return (
                  <g key={layout.key}>
                    <path
                      d={ribbonPath(FLOW_START_X, FLOW_END_X, layout.startY, layout.endY, layout.width + 3)}
                      className="flow-band-base"
                      opacity={shellOpacity}
                    />
                    <path
                      d={ribbonPath(FLOW_START_X, FLOW_END_X, layout.startY, layout.endY, layout.width)}
                      fill={flowColorFor(flow)}
                      opacity={coreOpacity}
                      onMouseEnter={() => {
                        setHoveredFlowKey(layout.key);
                        onTokenHover(flow.tokenIds[0] ?? null);
                      }}
                      onMouseLeave={() => {
                        setHoveredFlowKey(null);
                        onTokenHover(null);
                      }}
                      onClick={() => {
                        if (flow.tokenIds[0]) onTokenFocus(flow.tokenIds[0]);
                      }}
                      className="flow-path"
                    >
                      <title>{`${flow.root} -> ${flow.lemma} (${flow.count})${sampleToken ? ` | ${sampleToken}` : ""}`}</title>
                    </path>
                    {isActive && (
                      <text
                        x={(FLOW_START_X + FLOW_END_X) / 2}
                        y={(layout.startY + layout.endY) / 2 - 4}
                        className="count-label"
                      >
                        {flow.count}
                      </text>
                    )}
                  </g>
                );
              })}

              {sankeyLayout.rootNodes.map((node) => {
                const isDimmed = hoveredFlow !== null && hoveredFlow.flow.root !== node.id;
                return (
                  <g key={`root-${node.id}`} className={isDimmed ? "flow-node is-muted" : "flow-node"}>
                    <rect
                      x={ROOT_COLUMN_X + 12}
                      y={node.y - node.height / 2}
                      width={COLUMN_WIDTH - 24}
                      height={node.height}
                      rx="12"
                      className="node-chip"
                    />
                    <text x={ROOT_COLUMN_X + COLUMN_WIDTH / 2} y={node.y + 5} className="node-label root-label">
                      {node.id}
                    </text>
                    <text x={ROOT_COLUMN_X + COLUMN_WIDTH - 22} y={node.y + 4} className="node-count">
                      {node.total}
                    </text>
                  </g>
                );
              })}

              {sankeyLayout.lemmaNodes.map((node) => {
                const isDimmed = hoveredFlow !== null && hoveredFlow.flow.lemma !== node.id;
                return (
                  <g key={`lemma-${node.id}`} className={isDimmed ? "flow-node is-muted" : "flow-node"}>
                    <rect
                      x={LEMMA_COLUMN_X + 12}
                      y={node.y - node.height / 2}
                      width={COLUMN_WIDTH - 24}
                      height={node.height}
                      rx="12"
                      className="node-chip"
                    />
                    <text x={LEMMA_COLUMN_X + 18} y={node.y + 5} className="node-label lemma-label">
                      {node.id}
                    </text>
                    <text x={LEMMA_COLUMN_X + COLUMN_WIDTH - 22} y={node.y + 4} className="node-count">
                      {node.total}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        ) : (
          <div className="sankey-empty">
            {selectedRoot !== "all"
              ? t('notFound', { root: selectedRoot, scope: scopeLabel })
              : t('noFlows', { scope: scopeLabel })}
          </div>
        )}
      </div>

      {hasMore && (
        <div className="load-more-container">
          <button type="button" onClick={handleLoadMore} className="load-more-btn">
            {t("showMore")} ({totalFlows - visibleCount} {ts("remaining")})
          </button>
        </div>
      )}

      <style jsx>{`
        .sankey-wrapper {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-sizing: border-box;
          position: relative;
          padding-top: calc(var(--header-dock-height, 42px) + 20px);
          padding-bottom: calc(var(--footer-height, 42px) + env(safe-area-inset-bottom) + 12px);
          background:
            radial-gradient(circle at 12% 18%, rgba(245, 158, 11, 0.12), transparent 34%),
            radial-gradient(circle at 84% 16%, rgba(15, 118, 110, 0.1), transparent 36%),
            linear-gradient(160deg, var(--bg-0), var(--bg-1));
        }

        .sankey-context-bar {
          padding: 0 20px 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .sankey-pill {
          font-size: 0.72rem;
          color: var(--ink-secondary);
          border: 1px solid var(--line);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.65);
          padding: 4px 10px;
        }

        .sankey-scroll-area {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          padding: 8px 0 14px;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .sankey {
          width: 100%;
          height: 100%;
          min-width: 0;
          max-width: none;
        }

        .sankey-empty {
          margin: auto;
          color: var(--ink-muted);
          font-size: 0.95rem;
        }

        .column {
          fill: rgba(255, 255, 255, 0.18);
          stroke: var(--line);
          stroke-width: 1px;
        }

        .column-title {
          text-anchor: middle;
          font-weight: 700;
          fill: var(--ink-secondary);
          font-size: 0.82rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .node-label {
          font-family: "Amiri", serif;
          font-size: 1.02rem;
          fill: var(--ink);
          pointer-events: none;
        }

        .root-label {
          text-anchor: middle;
        }

        .lemma-label {
          text-anchor: start;
        }

        .node-chip {
          fill: rgba(255, 255, 255, 0.42);
          stroke: rgba(148, 163, 184, 0.34);
          stroke-width: 1;
          transition: opacity 0.18s ease;
        }

        .node-count {
          fill: var(--ink-secondary);
          font-size: 0.66rem;
          font-weight: 700;
          text-anchor: end;
          pointer-events: none;
        }

        .flow-node {
          transition: opacity 0.18s ease;
        }

        .flow-node.is-muted {
          opacity: 0.34;
        }

        .flow-band-base {
          fill: var(--accent-2-glow);
          pointer-events: none;
        }

        .flow-path {
          cursor: pointer;
          transition: opacity 0.16s ease, filter 0.16s ease;
          filter: saturate(1.06);
        }

        .flow-path:hover {
          filter: drop-shadow(0 0 6px var(--accent-glow)) brightness(1.08) saturate(1.2);
        }

        .sankey-select-menu {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          z-index: 40;
          max-height: 280px;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 6px;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(24px) saturate(1.5);
          -webkit-backdrop-filter: blur(24px) saturate(1.5);
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
          display: flex;
          flex-direction: column;
          gap: 2px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
        }

        .sankey-select-menu::-webkit-scrollbar {
          width: 6px;
        }

        .sankey-select-menu::-webkit-scrollbar-track {
          background: transparent;
        }

        .sankey-select-menu::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }

        .sankey-option {
          width: 100%;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: rgba(255, 255, 255, 0.75);
          padding: 8px 12px;
          font-size: 0.85rem;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .sankey-option:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
          transform: translateX(2px);
        }

        .sankey-option.active {
          background: rgba(56, 189, 248, 0.15);
          color: #38bdf8;
          font-weight: 600;
        }

        .sankey-option.arabic-text {
          direction: rtl;
          text-align: right;
          font-family: "Amiri", serif;
          font-size: 1.1rem;
        }

        .sankey-option.arabic-text:hover {
          transform: translateX(-2px);
        }

        .count-label {
          text-anchor: middle;
          font-size: 0.72rem;
          fill: var(--ink-secondary);
          font-weight: 700;
          paint-order: stroke;
          stroke: rgba(255, 255, 255, 0.75);
          stroke-width: 3;
        }

        .load-more-container {
          position: absolute;
          left: 18px;
          bottom: calc(var(--footer-height, 42px) + env(safe-area-inset-bottom) + 2px);
          z-index: 6;
          padding: 0;
          border: 0;
          background: transparent;
          backdrop-filter: none;
          pointer-events: none;
        }

        .load-more-btn {
          padding: 8px 18px;
          border: 1px solid var(--accent);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.2);
          color: var(--accent);
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
          pointer-events: auto;
        }

        .load-more-btn:hover {
          background: var(--accent);
          color: #fff;
        }

        .sankey-sidebar-stack .sankey-control-card h3 {
          margin: 4px 0 0;
          font-size: 1.02rem;
        }

        .sankey-control-card {
          display: grid;
          gap: 10px;
          background:
            linear-gradient(160deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.54)),
            radial-gradient(circle at 10% 12%, rgba(15, 118, 110, 0.11), transparent 46%);
        }

        .sankey-card-head {
          display: grid;
          gap: 4px;
        }

        .sankey-field {
          display: grid;
          gap: 6px;
        }

        .sankey-label {
          font-size: 0.72rem;
          letter-spacing: 0.06em;
          color: var(--ink-muted);
          text-transform: uppercase;
          font-weight: 600;
        }

        .sankey-select-shell {
          position: relative;
          border: 1px solid var(--line);
          border-radius: 12px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.13), rgba(255, 255, 255, 0.04));
        }

        .sankey-select-shell::after {
          content: "";
          position: absolute;
          right: 12px;
          top: 50%;
          width: 7px;
          height: 7px;
          border-left: 2px solid var(--ink-muted);
          border-bottom: 2px solid var(--ink-muted);
          transform: translateY(-70%) rotate(-45deg);
          pointer-events: none;
        }

        .sankey-select {
          width: 100%;
          height: 40px;
          border: 0;
          border-radius: 12px;
          padding: 0 34px 0 12px;
          color: var(--ink);
          background: transparent;
          outline: none;
          font-size: 0.85rem;
          font-weight: 550;
          appearance: none;
        }

        .sankey-meta-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          border-top: 1px solid var(--line);
          padding-top: 6px;
          font-size: 0.8rem;
        }

        .sankey-meta-key {
          color: var(--ink-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .sankey-meta-value {
          color: var(--ink-secondary);
          font-weight: 600;
          text-align: right;
        }

        .sankey-meta-arabic {
          font-family: "Amiri", serif;
          font-size: 0.96rem;
        }

        .sankey-stats-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .sankey-stat-item {
          display: grid;
          justify-items: center;
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 7px 6px;
          background: rgba(255, 255, 255, 0.05);
        }

        .sankey-stat-value {
          font-size: 0.92rem;
          font-weight: 700;
        }

        .sankey-stat-key {
          font-size: 0.62rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--ink-muted);
        }

        .sankey-help-card {
          display: grid;
          gap: 8px;
        }

        .sankey-help-title {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--ink-secondary);
        }

        .sankey-help-list {
          margin: 0;
          padding-left: 16px;
          display: grid;
          gap: 6px;
          color: var(--ink-secondary);
          font-size: 0.78rem;
          line-height: 1.35;
        }

        :global([data-theme="dark"]) .sankey-wrapper {
          background:
            radial-gradient(circle at 16% 14%, rgba(249, 115, 22, 0.2), transparent 36%),
            radial-gradient(circle at 82% 18%, rgba(34, 211, 238, 0.16), transparent 40%),
            linear-gradient(165deg, #09090f, #11131c 50%, #0c1018 100%);
        }

        :global([data-theme="dark"]) .sankey-pill {
          background: rgba(16, 16, 24, 0.72);
        }

        :global([data-theme="dark"]) .column {
          fill: rgba(255, 255, 255, 0.05);
          stroke: rgba(255, 255, 255, 0.16);
        }

        :global([data-theme="dark"]) .node-chip {
          fill: rgba(30, 41, 59, 0.5);
          stroke: rgba(148, 163, 184, 0.24);
        }

        :global([data-theme="dark"]) .count-label {
          stroke: rgba(2, 6, 23, 0.75);
          fill: #dbeafe;
        }

        :global([data-theme="dark"]) .load-more-btn {
          background: rgba(18, 18, 26, 0.72);
        }

        @media (max-width: 1200px) {
          .sankey-context-bar {
            padding-left: 18px;
          }

          .sankey-scroll-area {
            padding-left: 18px;
          }

          .load-more-container {
            left: 12px;
          }
        }
      `}</style>
    </section>
  );
}
