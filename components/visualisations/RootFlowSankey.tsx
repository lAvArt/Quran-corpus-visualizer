"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { VizExplainerDialog, HelpIcon } from "@/components/ui/VizExplainerDialog";

import type { ChangeEvent } from "react";
import type { CorpusToken, RootWordFlow } from "@/lib/schema/types";
import type { ExperienceLevel } from "@/lib/schema/experience";
import { useZoom } from "@/lib/hooks/useZoom";
import { useVizControl } from "@/lib/hooks/VizControlContext";
import { getFrequencyColor, getIdentityColor, type LexicalColorMode } from "@/lib/theme/lexicalColoring";

interface RootFlowSankeyProps {
  flows: RootWordFlow[];
  roots: string[];
  tokenById: Map<string, CorpusToken>;
  onTokenHover: (tokenId: string | null) => void;
  onTokenFocus: (tokenId: string) => void;
  selectedSurahId?: number;
  experienceLevel?: ExperienceLevel;
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

/** A root or lemma node, used to track which column/id is being emphasized. */
interface SankeyNodeRef {
  kind: "root" | "lemma";
  id: string;
}

export default function RootFlowSankey({
  flows,
  roots: globalRoots,
  tokenById,
  onTokenHover,
  onTokenFocus,
  selectedSurahId,
  experienceLevel = "advanced",
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
  const [hoveredNode, setHoveredNode] = useState<SankeyNodeRef | null>(null);
  const [pinnedNode, setPinnedNode] = useState<SankeyNodeRef | null>(null);
  const { isLeftSidebarOpen } = useVizControl();
  const isBeginner = experienceLevel === "beginner";

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 0. Some tokens carry no root at all (e.g. prepositions, conjunctions,
  // pronouns — function words with no triliteral root in the QAC morphology
  // data). Upstream, `buildRootWordFlows` groups them into a root: "" bucket,
  // which renders as an unlabeled phantom node in the Root column. Drop those
  // (and, symmetrically, any flow with a blank lemma) before any further
  // scoping/filtering/layout math sees them.
  const cleanFlows = useMemo(
    () => flows.filter((flow) => flow.root.trim().length > 0 && flow.lemma.trim().length > 0),
    [flows]
  );
  const cleanGlobalRoots = useMemo(
    () => globalRoots.filter((root) => root.trim().length > 0),
    [globalRoots]
  );

  // 1. Calculate flows scoped to the current Surah (if selected)
  // This ensures counts reflect the local scope, not the global corpus
  const scopedFlows = useMemo(() => {
    if (!selectedSurahId) return cleanFlows;

    const newFlows: RootWordFlow[] = [];

    for (const flow of cleanFlows) {
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
  }, [cleanFlows, selectedSurahId, tokenById]);

  // 2. Derive available roots from the scoped flows
  const availableRoots = useMemo(() => {
    if (!selectedSurahId) return cleanGlobalRoots;
    const rootsSet = new Set(scopedFlows.map((f) => f.root));
    return Array.from(rootsSet).sort((a, b) => a.localeCompare(b));
  }, [scopedFlows, cleanGlobalRoots, selectedSurahId]);

  // Reset selected root if it's no longer available in the new scope
  useEffect(() => {
    if (selectedRoot !== "all" && !availableRoots.includes(selectedRoot)) {
      setSelectedRoot("all");
    }
  }, [availableRoots, selectedRoot]);

  useEffect(() => {
    if (isBeginner) {
      setSelectedRoot("all");
    }
  }, [isBeginner]);

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

  const { svgRef, gRef, fitToView } = useZoom<SVGSVGElement>({
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

  // Ribbon fill for the "identity"/"frequency" color modes only — these
  // encode real per-flow information (root identity, occurrence frequency),
  // so they keep their own hue. The default "theme" mode is handled separately
  // below: a flat, muted neutral with accent used only for hover/click
  // emphasis ("monochrome structure, accent for emphasis"), never a per-flow
  // hue that implies meaning it doesn't have.
  const flowColorFor = useCallback(
    (flow: RootWordFlow): string => {
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

  // Drop a hovered/pinned node reference once it scrolls out of the current
  // layout (root filter changed, "show more" reshuffled columns, etc.).
  useEffect(() => {
    for (const [node, setNode] of [
      [hoveredNode, setHoveredNode],
      [pinnedNode, setPinnedNode],
    ] as const) {
      if (!node) continue;
      const columns = node.kind === "root" ? sankeyLayout.rootNodes : sankeyLayout.lemmaNodes;
      if (!columns.some((n) => n.id === node.id)) setNode(null);
    }
  }, [hoveredNode, pinnedNode, sankeyLayout.rootNodes, sankeyLayout.lemmaNodes]);

  const hoveredFlow = useMemo(
    () => sankeyLayout.flowLayouts.find((flow) => flow.key === hoveredFlowKey) ?? null,
    [hoveredFlowKey, sankeyLayout.flowLayouts]
  );

  // Unified emphasis context: hovering/clicking a root or lemma node highlights
  // every ribbon touching it; hovering a ribbon directly highlights just that
  // one. `root`/`lemma` being non-null narrows the match to that side only.
  const activeNode = hoveredNode ?? pinnedNode;
  const emphasis = useMemo<{ root: string | null; lemma: string | null } | null>(() => {
    if (hoveredFlow) return { root: hoveredFlow.flow.root, lemma: hoveredFlow.flow.lemma };
    if (activeNode?.kind === "root") return { root: activeNode.id, lemma: null };
    if (activeNode?.kind === "lemma") return { root: null, lemma: activeNode.id };
    return null;
  }, [hoveredFlow, activeNode]);

  const isFlowEmphasized = useCallback(
    (flow: RootWordFlow): boolean => {
      if (!emphasis) return false;
      if (emphasis.root !== null && flow.root !== emphasis.root) return false;
      if (emphasis.lemma !== null && flow.lemma !== emphasis.lemma) return false;
      return true;
    },
    [emphasis]
  );

  // Sets of root/lemma ids reachable by the current emphasis, so node chips on
  // *either* side can tell whether they should stay lit or fade out.
  const { activeRootIds, activeLemmaIds } = useMemo(() => {
    if (!emphasis) return { activeRootIds: null as Set<string> | null, activeLemmaIds: null as Set<string> | null };
    const rootIds = new Set<string>();
    const lemmaIds = new Set<string>();
    for (const layout of sankeyLayout.flowLayouts) {
      if (isFlowEmphasized(layout.flow)) {
        rootIds.add(layout.flow.root);
        lemmaIds.add(layout.flow.lemma);
      }
    }
    return { activeRootIds: rootIds, activeLemmaIds: lemmaIds };
  }, [emphasis, sankeyLayout.flowLayouts, isFlowEmphasized]);

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => prev + LOAD_MORE_COUNT);
  }, []);

  const handleRootChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedRoot(event.target.value);
    setVisibleCount(INITIAL_VISIBLE);
    setHoveredFlowKey(null);
    setHoveredNode(null);
    setPinnedNode(null);
    onTokenHover(null);
  }, [onTokenHover]);

  const sidebarCards = (
    <div className={`viz-left-stack sankey-sidebar-stack ${!isLeftSidebarOpen ? 'collapsed' : ''}`}>

      <div className="viz-left-panel sankey-control-card" data-testid="sankey-control-card">
        <div className="sankey-card-head">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: "8px" }}>
            <p className="eyebrow">{t("title")}</p>
            <HelpIcon onClick={() => setShowHelp(true)} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => fitToView()}
              className="clear-focus"
              style={{ fontSize: "0.75rem", padding: "2px 8px", background: "var(--line)", borderRadius: "4px", border: "none", cursor: "pointer" }}
            >
              {ts("focus")}
            </button>
          </div>
        </div>

        {isBeginner ? null : (
          <label className="sankey-field" data-testid="sankey-root-filter">
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
        )}

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

      {/*
        This block is teleported into #viz-sidebar-portal via createPortal above,
        so its markup is NOT a descendant of this component's main returned JSX
        tree from the styled-jsx compiler's point of view. styled-jsx only scopes
        elements that are lexically inside the same JSX literal as the <style jsx>
        tag that styles them — a <style jsx> living in the bottom-level return
        never reaches elements built in this separate `sidebarCards` literal.
        Keeping a dedicated <style jsx> here (rather than in the main return)
        is what makes `.sankey-meta-row`/`.sankey-stats-row` actually apply
        instead of silently no-op'ing to block/inline defaults.
      */}
      <style jsx>{`
        .sankey-control-card {
          display: grid;
          gap: 10px;
          background:
            linear-gradient(160deg, var(--bg-1), var(--bg-2)),
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
          background: linear-gradient(180deg, var(--bg-2), var(--bg-1));
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

        /* Eyebrow-style label + value row (Scope / Active Root). Small-cap,
           letterspaced, muted label on the left; plain value on the right —
           the flex row is what keeps them from fusing into one word. */
        .sankey-meta-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 10px;
          border-top: 1px solid var(--line);
          padding-top: 6px;
          font-size: 0.8rem;
        }

        .sankey-meta-key {
          color: var(--ink-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 600;
          font-size: 0.7rem;
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

        /* Value stacked above its eyebrow-style label — same discipline as
           the meta rows above, just vertical instead of side-by-side. */
        .sankey-stat-item {
          display: grid;
          justify-items: center;
          gap: 2px;
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 7px 6px;
          background: var(--bg-1);
        }

        .sankey-stat-value {
          font-size: 0.92rem;
          font-weight: 700;
        }

        .sankey-stat-key {
          font-size: 0.62rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 600;
          color: var(--ink-muted);
        }
      `}</style>
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
          {ts("showing")} {visibleFlows.length} {ts("of")} {totalFlows} {ts("flows")} · {visibleRatio}% {ts("coverage").toLocaleLowerCase()}
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
                const isDirectHover = hoveredFlowKey === layout.key;
                const isThemeMode = lexicalColorMode === "theme";
                const isEmphasized = isFlowEmphasized(flow);
                const isFaded = emphasis !== null && !isEmphasized;
                // Default "theme" mode: monochrome structure, accent for emphasis —
                // every ribbon is the same muted neutral until its root or lemma
                // node (or the ribbon itself) is hovered/clicked, then it alone
                // switches to the accent color. "identity"/"frequency" modes keep
                // their own per-flow hue (it encodes real data) and only their
                // opacity responds to emphasis.
                const fill = isThemeMode ? (isEmphasized ? "var(--accent)" : "var(--ink)") : flowColorFor(flow);
                const opacity = isThemeMode
                  ? (isEmphasized ? 0.75 : isFaded ? 0.1 : 0.2)
                  : (isEmphasized ? 0.92 : isFaded ? 0.08 : 0.72);
                const sampleToken = (flow.tokenIds[0] && tokenById.get(flow.tokenIds[0])?.text) ?? "";
                return (
                  <g key={layout.key}>
                    <path
                      d={ribbonPath(FLOW_START_X, FLOW_END_X, layout.startY, layout.endY, layout.width)}
                      fill={fill}
                      opacity={opacity}
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
                    {isDirectHover && (
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
                const isDimmed = activeRootIds !== null && !activeRootIds.has(node.id);
                const isNodeActive = activeNode?.kind === "root" && activeNode.id === node.id;
                return (
                  <g
                    key={`root-${node.id}`}
                    className={`flow-node${isDimmed ? " is-muted" : ""}${isNodeActive ? " is-active" : ""}`}
                    onMouseEnter={() => setHoveredNode({ kind: "root", id: node.id })}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={() =>
                      setPinnedNode((prev) => (prev?.kind === "root" && prev.id === node.id ? null : { kind: "root", id: node.id }))
                    }
                    style={{ cursor: "pointer" }}
                  >
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
                const isDimmed = activeLemmaIds !== null && !activeLemmaIds.has(node.id);
                const isNodeActive = activeNode?.kind === "lemma" && activeNode.id === node.id;
                return (
                  <g
                    key={`lemma-${node.id}`}
                    className={`flow-node${isDimmed ? " is-muted" : ""}${isNodeActive ? " is-active" : ""}`}
                    onMouseEnter={() => setHoveredNode({ kind: "lemma", id: node.id })}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={() =>
                      setPinnedNode((prev) => (prev?.kind === "lemma" && prev.id === node.id ? null : { kind: "lemma", id: node.id }))
                    }
                    style={{ cursor: "pointer" }}
                  >
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

        /*
          StatusBar (components/shell/StatusBar.tsx) is a fixed, centered pill
          at top: var(--header-clearance) + 6px margin; it is ~35px tall idle
          and ~41px tall while the corpus-loading progress strip shows, so its
          bottom edge reaches header-clearance + 47px. In normal flow this row
          rendered at the wrapper's padding-top (header-dock-height + 20px),
          landing right in the middle of that pill and getting visually
          clipped by it. Pull it out of flow and pin it just below the status
          bar's tallest state instead (same technique as .ui-overlay-pill in
          globals.css, with extra room for the loading-state height).
        */
        .sankey-context-bar {
          position: absolute;
          top: calc(var(--header-clearance, 70px) + 52px);
          left: 0;
          right: 0;
          z-index: 20;
          padding: 0 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
          pointer-events: none;
        }

        .sankey-pill {
          font-size: 0.72rem;
          color: var(--ink-secondary);
          border: 1px solid var(--line);
          border-radius: 999px;
          background: var(--panel);
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
          fill: var(--bg-2);
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
          fill: var(--panel);
          stroke: var(--line);
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

        .flow-node.is-active .node-chip {
          stroke: var(--accent);
          stroke-width: 1.5;
        }

        /*
          animation/filter are explicitly zeroed: legacy global .flow-path
          rules (globals.css ran an infinite pulse-link opacity animation;
          styles/dark-theme.css runs a stroke-draw animation) would otherwise
          override the per-ribbon opacity attribute that carries the
          monochrome/accent emphasis states. CSS animations beat presentation
          attributes, so any opacity keyframe kills the interaction.
        */
        .flow-path {
          cursor: pointer;
          transition: opacity 0.16s ease;
          animation: none;
          filter: none;
        }

        .flow-path:hover {
          filter: drop-shadow(0 0 6px var(--accent-glow));
        }

        .count-label {
          text-anchor: middle;
          font-size: 0.72rem;
          fill: var(--ink-secondary);
          font-weight: 700;
          paint-order: stroke;
          stroke: var(--bg-0);
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
          background: var(--bg-2);
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

        :global([data-theme="dark"]) .sankey-wrapper {
          background:
            radial-gradient(circle at 16% 14%, rgba(249, 115, 22, 0.2), transparent 36%),
            radial-gradient(circle at 82% 18%, rgba(34, 211, 238, 0.16), transparent 40%),
            linear-gradient(165deg, var(--bg-0), var(--bg-1) 50%, var(--bg-0) 100%);
        }

        :global([data-theme="dark"]) .sankey-pill {
          background: var(--panel);
        }

        :global([data-theme="dark"]) .column {
          fill: var(--bg-2);
          stroke: var(--line);
        }

        :global([data-theme="dark"]) .node-chip {
          fill: var(--panel);
          stroke: var(--line);
        }

        :global([data-theme="dark"]) .count-label {
          stroke: var(--bg-0);
          fill: var(--ink);
        }

        :global([data-theme="dark"]) .load-more-btn {
          background: var(--bg-2);
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
