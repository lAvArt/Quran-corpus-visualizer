"use client";

import { useEffect, useRef, useMemo, useState, useCallback, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useVizControl } from "@/lib/hooks/VizControlContext";


import * as d3 from "d3";
import { motion, AnimatePresence } from "framer-motion";
import type { CorpusToken } from "@/lib/schema/types";
import { DARK_THEME, LIGHT_THEME, getNodeColor } from "@/lib/schema/visualizationTypes";
import { VizExplainerDialog, HelpIcon } from "@/components/ui/VizExplainerDialog";

interface RootNetworkGraphProps {
  tokens: CorpusToken[];
  onTokenHover: (tokenId: string | null) => void;
  onTokenFocus: (tokenId: string) => void;
  theme?: "light" | "dark";
  showLabels?: boolean;
  highlightRoot?: string | null;
  filterBySurahId?: number;
}

interface NetworkNode {
  id: string;
  label: string;
  type: "root" | "lemma" | "token";
  frequency: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  radius: number;
  color: string;
  tokens: CorpusToken[];
}

interface NetworkLink {
  source: string | NetworkNode;
  target: string | NetworkNode;
  weight: number;
}

export default function RootNetworkGraph({
  tokens,
  onTokenHover,
  onTokenFocus,
  theme = "dark",
  showLabels = true,
  highlightRoot,
  filterBySurahId,
}: RootNetworkGraphProps) {
  const t = useTranslations("Visualizations.RootNetwork");
  const ts = useTranslations("Visualizations.Shared");
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomLayerRef = useRef<SVGGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<NetworkNode, NetworkLink> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [dimensions, setDimensions] = useState({ width: 900, height: 650 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [links, setLinks] = useState<NetworkLink[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [rootLimit, setRootLimit] = useState<number>(filterBySurahId ? 80 : 30);
  const [zoomScale, setZoomScale] = useState(1);
  const [showHelp, setShowHelp] = useState(false);
  const rafRef = useRef<number | null>(null);
  const pendingFrameRef = useRef(false);
  const latestNodesRef = useRef<NetworkNode[]>([]);

  const { isLeftSidebarOpen, toggleLeftSidebar } = useVizControl();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const themeColors = theme === "dark" ? DARK_THEME : LIGHT_THEME;

  const totalAvailableRoots = useMemo(() => {
    const scopeTokens = filterBySurahId
      ? tokens.filter((token) => token.sura === filterBySurahId)
      : tokens;
    const roots = new Set<string>();

    for (const token of scopeTokens) {
      const root = token.root?.trim();
      if (!root) continue;
      roots.add(root);
    }

    return roots.size;
  }, [tokens, filterBySurahId]);

  const minRootLimit = filterBySurahId
    ? (totalAvailableRoots > 0 ? Math.min(20, totalAvailableRoots) : 1)
    : 10;
  const maxRootLimit = filterBySurahId
    ? Math.max(totalAvailableRoots, minRootLimit)
    : 80;
  const rootLimitStep = filterBySurahId
    ? (maxRootLimit - minRootLimit <= 80 ? 1 : 5)
    : 5;

  useEffect(() => {
    const fallback = filterBySurahId
      ? Math.min(Math.max(80, minRootLimit), maxRootLimit)
      : 30;
    setRootLimit((prev) => {
      if (prev < minRootLimit) return minRootLimit;
      if (prev > maxRootLimit) return maxRootLimit;
      return prev || fallback;
    });
  }, [filterBySurahId, minRootLimit, maxRootLimit]);

  // Build network data from tokens
  const { initialNodes, initialLinks, hasMorphology, hasScopeTokens } = useMemo(() => {
    // 1. Optional Surah Scope Filtering
    const scopeTokens = filterBySurahId
      ? tokens.filter(t => t.sura === filterBySurahId)
      : tokens;

    const hasScopeTokens = scopeTokens.length > 0;
    const hasMorphology = scopeTokens.some((t) => t.root && t.root.trim().length > 0);
    if (filterBySurahId && (!hasScopeTokens || !hasMorphology)) {
      return { initialNodes: [], initialLinks: [], hasMorphology, hasScopeTokens };
    }

    const rootMap = new Map<string, { count: number; tokens: CorpusToken[]; lemmas: Set<string> }>();
    const lemmaMap = new Map<string, { count: number; tokens: CorpusToken[]; root: string }>();

    // 2. Aggregate
    for (const token of scopeTokens) {
      if (!token.root) continue;

      if (!rootMap.has(token.root)) {
        rootMap.set(token.root, { count: 0, tokens: [], lemmas: new Set() });
      }
      const rootData = rootMap.get(token.root)!;
      rootData.count++;
      rootData.tokens.push(token);
      rootData.lemmas.add(token.lemma);

      if (!lemmaMap.has(token.lemma)) {
        lemmaMap.set(token.lemma, { count: 0, tokens: [], root: token.root });
      }
      const lemmaData = lemmaMap.get(token.lemma)!;
      lemmaData.count++;
      lemmaData.tokens.push(token);
    }

    // 3. Select Top Roots + Highlighted Root
    const maxRoots = Math.min(rootLimit, rootMap.size);
    const maxLemmasPerRoot =
      scopeTokens.length > 30000 ? 3 : rootLimit >= 80 ? 3 : rootLimit >= 60 ? 4 : 5;
    const sortedRoots = [...rootMap.entries()]
      .sort((a, b) => b[1].count - a[1].count);

    // Ensure highlighted root is included if it exists in the scope
    let topRoots = sortedRoots.slice(0, maxRoots);

    if (highlightRoot && rootMap.has(highlightRoot)) {
      const isAlreadyIncluded = topRoots.some(([r]) => r === highlightRoot);
      if (!isAlreadyIncluded) {
        // Add it to the list, maybe replacing the last one
        const highlightedEntry = sortedRoots.find(([r]) => r === highlightRoot)!;
        topRoots = [highlightedEntry, ...topRoots.slice(0, Math.max(maxRoots - 1, 0))];
      }
    }

    const maxFreq = Math.max(...topRoots.map(([, d]) => d.count), 1);
    const nodesResult: NetworkNode[] = [];
    const linksResult: NetworkLink[] = [];
    const includedLemmas = new Set<string>();

    // Add root nodes
    for (const [root, data] of topRoots) {
      const radius = 12 + (data.count / maxFreq) * 28;
      nodesResult.push({
        id: `root-${root}`,
        label: root,
        type: "root",
        frequency: data.count,
        radius,
        color: themeColors.nodeColors.default,
        tokens: data.tokens,
      });

      // Add lemma nodes for this root (limit to top 5 per root for density)
      const rootLemmas = [...data.lemmas]
        .map((l) => ({ lemma: l, data: lemmaMap.get(l)! }))
        .filter((entry) => entry.data)
        .sort((a, b) => b.data.count - a.data.count)
        .slice(0, maxLemmasPerRoot);

      for (const { lemma, data: lemmaData } of rootLemmas) {
        if (!includedLemmas.has(lemma)) {
          includedLemmas.add(lemma);
          const lemmaRadius = 6 + (lemmaData.count / maxFreq) * 14;
          nodesResult.push({
            id: `lemma-${lemma}`,
            label: lemma,
            type: "lemma",
            frequency: lemmaData.count,
            radius: lemmaRadius,
            color: getNodeColor(lemmaData.tokens[0]?.pos ?? "N"),
            tokens: lemmaData.tokens,
          });
        }

        // Create link from root to lemma
        linksResult.push({
          source: `root-${root}`,
          target: `lemma-${lemma}`,
          weight: lemmaData.count,
        });
      }
    }

    return { initialNodes: nodesResult, initialLinks: linksResult, hasMorphology, hasScopeTokens };
  }, [tokens, themeColors, highlightRoot, filterBySurahId, rootLimit]);

  const rootCount = useMemo(
    () => initialNodes.filter((n) => n.type === "root").length,
    [initialNodes]
  );
  const lemmaCount = useMemo(
    () => initialNodes.filter((n) => n.type === "lemma").length,
    [initialNodes]
  );
  const isDense = initialNodes.length > 140 || initialLinks.length > 220;

  // Update dimensions on resize
  useEffect(() => {
    setIsMounted(true);
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Use the full viewport size for the "web" feel
        setDimensions({
          width: Math.max(entry.contentRect.width, 900),
          height: Math.max(entry.contentRect.height, 800),
        });
      }
    });

    observer.observe(containerRef.current);

    // Initial size
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setDimensions({
        width: Math.max(rect.width, 600),
        height: Math.max(rect.height, 500),
      });
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || !zoomLayerRef.current) return;

    const svgSelection = d3.select(svgRef.current);
    const zoomLayerSelection = d3.select(zoomLayerRef.current);
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.35, 6])
      .on("zoom", (event) => {
        zoomLayerSelection.attr("transform", event.transform.toString());
        setZoomScale(event.transform.k);
      });

    zoomBehaviorRef.current = zoomBehavior;
    svgSelection.call(zoomBehavior);
    svgSelection.on("dblclick.zoom", null);
    svgSelection.call(zoomBehavior.transform, d3.zoomIdentity);

    return () => {
      svgSelection.on(".zoom", null);
      zoomBehaviorRef.current = null;
    };
  }, [dimensions.width, dimensions.height]);

  const handleResetZoom = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(240)
      .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
  }, []);

  // Initialize D3 force simulation
  useEffect(() => {
    if (!svgRef.current || initialNodes.length === 0) return;

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    // Clone nodes to avoid mutating original
    const nodesCopy = initialNodes.map((n) => ({ ...n }));
    const linksCopy = initialLinks.map((l) => ({ ...l }));
    latestNodesRef.current = nodesCopy;
    setNodes(nodesCopy);
    setLinks(linksCopy);

    // Create force simulation
    const simulation = d3
      .forceSimulation<NetworkNode>(nodesCopy)
      .force(
        "link",
        d3
          .forceLink<NetworkNode, NetworkLink>(linksCopy)
          .id((d) => d.id)
          .distance((d) => 80 + (d.weight ?? 1) * 5)
          .strength(0.5)
      )
      .force("charge", d3.forceManyBody().strength(isDense ? -140 : -200))
      .force("center", d3.forceCenter(centerX, centerY))
      .force(
        "collision",
        d3.forceCollide<NetworkNode>().radius((d) => d.radius + 10)
      )
      .force("radial", d3.forceRadial<NetworkNode>(
        (d) => d.type === "root" ? 120 : 220,
        centerX,
        centerY
      ).strength(0.3));

    simulationRef.current = simulation;

    const scheduleFrame = () => {
      if (pendingFrameRef.current) return;
      pendingFrameRef.current = true;
      rafRef.current = requestAnimationFrame(() => {
        pendingFrameRef.current = false;
        setNodes([...latestNodesRef.current]);
      });
    };

    simulation.alphaDecay(isDense ? 0.06 : 0.04);
    simulation.velocityDecay(isDense ? 0.5 : 0.4);

    simulation.on("tick", () => {
      latestNodesRef.current = nodesCopy;
      scheduleFrame();
    });

    // Run simulation
    simulation.alpha(1).restart();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      pendingFrameRef.current = false;
      simulation.stop();
    };
  }, [initialNodes, initialLinks, dimensions, isDense]);

  const handleNodeHover = useCallback(
    (node: NetworkNode | null) => {
      setHoveredNode(node?.id ?? null);
      if (node && node.tokens.length > 0) {
        onTokenHover(node.tokens[0].id);
      } else {
        onTokenHover(null);
      }
    },
    [onTokenHover]
  );

  const handleNodeClick = useCallback(
    (node: NetworkNode) => {
      setSelectedNode(node.id === selectedNode ? null : node.id);
      if (node.tokens.length > 0) {
        onTokenFocus(node.tokens[0].id);
      }
    },
    [selectedNode, onTokenFocus]
  );

  const handleCanvasClick = useCallback(
    (event: MouseEvent<SVGSVGElement>) => {
      // Ignore click events produced by a drag/pan gesture.
      if (event.defaultPrevented) return;
      const target = event.target as Element | null;
      if (!target) return;

      // Keep selection when clicking a node.
      if (target.closest(".node-group")) return;

      setSelectedNode(null);
      setHoveredNode(null);
      onTokenHover(null);
    },
    [onTokenHover]
  );

  const getLinkNodeIds = useCallback((link: NetworkLink) => {
    const sourceId = typeof link.source === "string" ? link.source : link.source.id;
    const targetId = typeof link.target === "string" ? link.target : link.target.id;
    return { sourceId, targetId };
  }, []);

  const { connectedNodeIds, connectedLinkKeys } = useMemo(() => {
    const nodeIds = new Set<string>();
    const linkKeys = new Set<string>();
    if (!selectedNode) return { connectedNodeIds: nodeIds, connectedLinkKeys: linkKeys };

    for (const link of links) {
      const { sourceId, targetId } = getLinkNodeIds(link);
      const isConnected = sourceId === selectedNode || targetId === selectedNode;
      if (!isConnected) continue;
      nodeIds.add(sourceId === selectedNode ? targetId : sourceId);
      const key = sourceId < targetId ? `${sourceId}::${targetId}` : `${targetId}::${sourceId}`;
      linkKeys.add(key);
    }

    return { connectedNodeIds: nodeIds, connectedLinkKeys: linkKeys };
  }, [links, selectedNode, getLinkNodeIds]);

  const getNodeVisualState = useCallback(
    (node: NetworkNode, isHovered: boolean, isSelected: boolean, isRoot: boolean) => {
      const isConnectedToSelection = Boolean(selectedNode && connectedNodeIds.has(node.id));
      const hasSelection = Boolean(selectedNode);
      const isDimmed = hasSelection && !isSelected && !isConnectedToSelection;
      const isHoverOnly = isHovered && !isSelected;

      let fill = isRoot ? themeColors.nodeColors.default : node.color;
      if (isSelected) {
        fill = themeColors.nodeColors.selected;
      } else if (isConnectedToSelection) {
        fill = themeColors.accentSecondary;
      } else if (isHoverOnly) {
        fill = themeColors.accent;
      }

      const ringColor = isSelected
        ? themeColors.nodeColors.selected
        : isConnectedToSelection
          ? themeColors.accentSecondary
          : themeColors.accent;

      const stroke = isSelected
        ? theme === "dark"
          ? "rgba(249, 115, 22, 0.95)"
          : "rgba(194, 65, 12, 0.9)"
        : isConnectedToSelection
          ? theme === "dark"
            ? "rgba(59, 130, 246, 0.9)"
            : "rgba(37, 99, 235, 0.85)"
          : isRoot
            ? theme === "dark"
              ? "rgba(255, 255, 255, 0.4)"
              : "rgba(31, 28, 25, 0.34)"
            : theme === "dark"
              ? "rgba(255, 255, 255, 0.2)"
              : "rgba(31, 28, 25, 0.22)";

      return {
        fill,
        stroke,
        ringColor,
        isConnectedToSelection,
        isDimmed,
        opacity: isDimmed ? 0.26 : 1,
        labelOpacity: isDimmed ? 0.3 : isSelected || isConnectedToSelection || isHovered ? 1 : 0.7,
      };
    },
    [selectedNode, connectedNodeIds, themeColors, theme]
  );

  const activeNode = useMemo(() => {
    const activeId = hoveredNode ?? selectedNode;
    if (!activeId) return null;
    return nodes.find((node) => node.id === activeId) ?? null;
  }, [hoveredNode, selectedNode, nodes]);

  const sidebarCards = (
    <>


      <div className={`viz-left-stack ${!isLeftSidebarOpen ? 'collapsed' : ''}`}>
        <div className="viz-left-panel" style={{ display: "grid", gap: "8px" }}>
          <div>
            {rootCount} {ts("roots")} - {lemmaCount} {ts("lemmas")} -{" "}
            {initialLinks.length} {ts("connections")}
          </div>
          <div style={{ display: "grid", gap: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="eyebrow" style={{ fontSize: "0.75rem", opacity: 0.8 }}>{t("complexity")}</span>
              </div>
              <HelpIcon onClick={() => setShowHelp(true)} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{rootLimit}</span>
              {filterBySurahId ? (
                <span style={{ fontSize: "0.72rem", opacity: 0.76 }}>
                  {t("totalAvailable")}: {totalAvailableRoots}
                </span>
              ) : null}
            </div>
            <input
              type="range"
              min={minRootLimit}
              max={maxRootLimit}
              step={rootLimitStep}
              value={rootLimit}
              onChange={(event) => setRootLimit(Number(event.target.value))}
              aria-label="Root limit"
              className="root-limit-slider"
            />
          </div>
          <div style={{ display: "grid", gap: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>{ts("zoom")}</span>
              <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{Math.round(zoomScale * 100)}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "0.72rem", opacity: 0.72 }}>{ts("panAndZoom")}</span>
              <button
                type="button"
                className="clear-focus"
                style={{ padding: "4px 9px", fontSize: "0.72rem" }}
                onClick={handleResetZoom}
              >
                Reset
              </button>
            </div>
          </div>
          {!hasScopeTokens && filterBySurahId && (
            <span style={{ fontSize: "0.75rem", opacity: 0.75 }}>
              No token data loaded for this surah yet. Keep corpus loading, then retry this surah.
            </span>
          )}
          {hasScopeTokens && !hasMorphology && filterBySurahId && (
            <span style={{ fontSize: "0.75rem", opacity: 0.75 }}>
              Morphology data unavailable for this surah. Roots/lemmas require a full morphology dataset.
            </span>
          )}
        </div>

        <AnimatePresence>
          {activeNode && (
            <motion.div
              className="viz-left-panel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <div className="viz-tooltip-title arabic-text">
                {activeNode.label}
              </div>
              <div className="viz-tooltip-subtitle">
                {activeNode.type === "root" ? ts("root") : ts("lemma")}
              </div>
              <div className="viz-tooltip-row">
                <span className="viz-tooltip-label">{ts("occurrences")}</span>
                <span className="viz-tooltip-value">{activeNode.frequency}</span>
              </div>
              {activeNode.tokens[0] && (
                <>
                  <div className="viz-tooltip-row">
                    <span className="viz-tooltip-label">{ts("example")}</span>
                    <span className="viz-tooltip-value arabic-text">
                      {activeNode.tokens[0].text}
                    </span>
                  </div>
                  <div className="viz-tooltip-row">
                    <span className="viz-tooltip-label">{ts("gloss")}</span>
                    <span className="viz-tooltip-value">
                      {activeNode.tokens[0].morphology.gloss ?? "-"}
                    </span>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="viz-legend">
          <div className="viz-legend-item">
            <div
              className="viz-legend-dot"
              style={{
                background: themeColors.nodeColors.default,
                width: 16,
                height: 16,
              }}
            />
            <span>{t("rootNodes")}</span>
          </div>
          <div className="viz-legend-item">
            <div
              className="viz-legend-dot"
              style={{ background: getNodeColor("N"), width: 10, height: 10 }}
            />
            <span>{t("lemmaNodes")}</span>
          </div>
          <div className="viz-legend-item">
            <div
              className="viz-legend-dot"
              style={{ background: getNodeColor("V"), width: 10, height: 10 }}
            />
            <span>{t("tokenNodes")}</span>
          </div>
          <div className="viz-legend-item">
            <div
              className="viz-legend-dot"
              style={{ background: themeColors.nodeColors.selected, width: 12, height: 12 }}
            />
            <span>{ts("selectedNode")}</span>
          </div>
          <div className="viz-legend-item">
            <div
              className="viz-legend-dot"
              style={{ background: themeColors.accentSecondary, width: 12, height: 12 }}
            />
            <span>{ts("directlyConnected")}</span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <section className="immersive-viz" data-theme={theme} style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* 
      <div className="panel-head">
          Removed for immersive mode 
      </div>
      */}

      {isMounted && typeof document !== "undefined" && document.getElementById("viz-sidebar-portal")
        ? createPortal(sidebarCards, document.getElementById("viz-sidebar-portal")!)
        : sidebarCards}

      <div ref={containerRef} className="viz-container" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
        {!isMounted ? null : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            className="network-graph viz-canvas"
            style={{ width: '100%', height: '100%', cursor: "grab" }}
            onClick={handleCanvasClick}
          >
            <defs>
              {/* Radial gradient for background glow */}
              <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
                <stop
                  offset="0%"
                  stopColor={theme === "dark" ? "rgba(239, 68, 68, 0.1)" : "rgba(15, 118, 110, 0.12)"}
                />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>

              {/* Glow filter for nodes */}
              <filter id="nodeGlow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="subtleGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <VizExplainerDialog
              isOpen={showHelp}
              onClose={() => setShowHelp(false)}
              content={{
                title: t("Help.title"),
                description: t("Help.description"),
                sections: [
                  { label: t("Help.rootsLabel"), text: t("Help.rootsText") },
                  { label: t("Help.distanceLabel"), text: t("Help.distanceText") },
                  { label: t("Help.sizeLabel"), text: t("Help.sizeText") },
                ]
              }}
            />

            <g ref={zoomLayerRef}>
              {/* Background orbital rings */}
              <g className="orbital-rings">
                {[150, 220, 290].map((r, i) => (
                  <circle
                    key={i}
                    cx={dimensions.width / 2}
                    cy={dimensions.height / 2}
                    r={r}
                    className="orbital-ring"
                  />
                ))}
              </g>

              {/* Center glow */}
              <circle
                cx={dimensions.width / 2}
                cy={dimensions.height / 2}
                r={100}
                fill="url(#bgGlow)"
              />

              {/* Links */}
              <g className="links">
                {links.map((link, idx) => {
                  const source = link.source as NetworkNode;
                  const target = link.target as NetworkNode;
                  const { sourceId, targetId } = getLinkNodeIds(link);
                  const linkKey = sourceId < targetId ? `${sourceId}::${targetId}` : `${targetId}::${sourceId}`;

                  if (!source.x || !source.y || !target.x || !target.y) return null;

                  const isConnectedToSelection = connectedLinkKeys.has(linkKey);
                  const isConnectedToHover =
                    Boolean(hoveredNode) && (sourceId === hoveredNode || targetId === hoveredNode);
                  const isDimmedBySelection = Boolean(selectedNode) && !isConnectedToSelection;
                  const strokeColor = isConnectedToSelection
                    ? themeColors.accentSecondary
                    : isConnectedToHover
                      ? themeColors.accent
                      : themeColors.edgeColors.default;
                  const strokeWidth = isConnectedToSelection ? 2.6 : isConnectedToHover ? 2 : 1;
                  const baseOpacity = isConnectedToSelection ? 0.92 : isConnectedToHover ? 0.8 : 0.3;
                  const targetOpacity = isDimmedBySelection ? 0.1 : baseOpacity;

                  // Calculate control point for curved line
                  const midX = (source.x + target.x) / 2;
                  const midY = (source.y + target.y) / 2;
                  const dx = target.x - source.x;
                  const dy = target.y - source.y;
                  const normalX = -dy * 0.15;
                  const normalY = dx * 0.15;

                  if (isDense) {
                    return (
                      <path
                        key={idx}
                        d={`M ${source.x} ${source.y} Q ${midX + normalX} ${midY + normalY} ${target.x} ${target.y}`}
                        className={`edge ${isConnectedToSelection || isConnectedToHover ? "highlighted" : ""}`}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        opacity={targetOpacity}
                        fill="none"
                      />
                    );
                  }

                  return (
                    <motion.path
                      key={idx}
                      d={`M ${source.x} ${source.y} Q ${midX + normalX} ${midY + normalY} ${target.x} ${target.y}`}
                      className={`edge ${isConnectedToSelection || isConnectedToHover ? "highlighted" : ""}`}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      fill="none"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{
                        pathLength: 1,
                        opacity: targetOpacity,
                      }}
                      transition={{ duration: 1, delay: idx * 0.01 }}
                      filter={isConnectedToSelection || isConnectedToHover ? "url(#subtleGlow)" : undefined}
                    />
                  );
                })}
              </g>

              {/* Nodes */}
              <g className="nodes">
                {nodes.map((node) => {
                  if (!node.x || !node.y) return null;

                  const isHovered = hoveredNode === node.id;
                  const isSelected = selectedNode === node.id;
                  const isHighlighted = isHovered || isSelected;
                  const isRoot = node.type === "root";
                  const visualState = getNodeVisualState(node, isHovered, isSelected, isRoot);
                  const showLabel =
                    showLabels && (!isDense || isHighlighted || isRoot || visualState.isConnectedToSelection);

                  if (isDense) {
                    return (
                      <g
                        key={node.id}
                        className="node-group"
                        transform={`translate(${node.x},${node.y})`}
                        style={{ cursor: "pointer" }}
                        onMouseEnter={() => handleNodeHover(node)}
                        onMouseLeave={() => handleNodeHover(null)}
                        onClick={() => handleNodeClick(node)}
                        opacity={visualState.opacity}
                      >
                        {/* Outer glow ring for highlighted root nodes */}
                        {isRoot && (isHighlighted || visualState.isConnectedToSelection) && (
                          <circle
                            r={node.radius + 12}
                            fill="none"
                            stroke={visualState.ringColor}
                            strokeWidth={2}
                            opacity={0.4}
                          />
                        )}

                        {/* Node circle */}
                        <circle
                          r={node.radius}
                          className={`node-circle ${isHighlighted ? "highlighted" : ""} ${isRoot ? "hub" : ""}`}
                          fill={visualState.fill}
                          stroke={visualState.stroke}
                          strokeWidth={isRoot ? 2 : 1}
                        />

                        {/* Inner highlight for root nodes */}
                        {isRoot && (
                          <circle
                            r={node.radius * 0.3}
                            fill={theme === "dark" ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.48)"}
                          />
                        )}

                        {/* Label */}
                        {showLabel && (
                          <text
                            className="node-label arabic-text"
                            y={node.radius + 16}
                            style={{
                              opacity: visualState.labelOpacity,
                              fontSize: isRoot ? "14px" : "11px",
                              fontWeight: isRoot ? 600 : 400,
                            }}
                          >
                            {node.label}
                          </text>
                        )}
                      </g>
                    );
                  }

                  return (
                    <motion.g
                      key={node.id}
                      className="node-group"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{
                        scale: 1,
                        opacity: 1,
                        x: node.x,
                        y: node.y,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 100,
                        damping: 15,
                      }}
                      style={{ cursor: "pointer" }}
                      onMouseEnter={() => handleNodeHover(node)}
                      onMouseLeave={() => handleNodeHover(null)}
                      onClick={() => handleNodeClick(node)}
                      opacity={visualState.opacity}
                    >
                      {/* Outer glow ring for highlighted root nodes */}
                      {isRoot && (isHighlighted || visualState.isConnectedToSelection) && (
                        <motion.circle
                          r={node.radius + 12}
                          fill="none"
                          stroke={visualState.ringColor}
                          strokeWidth={2}
                          opacity={0.5}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1.1, opacity: 0.5 }}
                          transition={{
                            repeat: Infinity,
                            repeatType: "reverse",
                            duration: 1,
                          }}
                        />
                      )}

                      {/* Node circle */}
                      <circle
                        r={node.radius}
                        className={`node-circle ${isHighlighted ? "highlighted" : ""} ${isRoot ? "hub" : ""}`}
                        fill={visualState.fill}
                        stroke={visualState.stroke}
                        strokeWidth={isRoot ? 2 : 1}
                        filter={!isDense && (isHighlighted || visualState.isConnectedToSelection) ? "url(#nodeGlow)" : undefined}
                      />

                      {/* Inner highlight for root nodes */}
                      {isRoot && (
                        <circle
                          r={node.radius * 0.3}
                          fill={theme === "dark" ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.48)"}
                        />
                      )}

                      {/* Label */}
                      {showLabel && (
                        <text
                          className="node-label arabic-text"
                          y={node.radius + 16}
                          style={{
                            opacity: visualState.labelOpacity,
                            fontSize: isRoot ? "14px" : "11px",
                            fontWeight: isRoot ? 600 : 400,
                          }}
                        >
                          {node.label}
                        </text>
                      )}
                    </motion.g>
                  );
                })}
              </g>
            </g>
          </svg>
        )}
      </div>

      <style jsx global>{`
        .root-limit-slider {
          width: 100%;
          height: 8px;
          margin: 0;
          border-radius: 999px;
          appearance: none;
          -webkit-appearance: none;
          background: color-mix(in srgb, var(--line), transparent 20%);
          accent-color: var(--accent);
          cursor: pointer;
        }

        .root-limit-slider::-webkit-slider-runnable-track {
          height: 8px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--line), transparent 20%);
        }

        .root-limit-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          margin-top: -4px;
          border-radius: 50%;
          border: 2px solid var(--accent);
          background: var(--accent);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent), transparent 78%);
        }

        .root-limit-slider::-moz-range-track {
          height: 8px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--line), transparent 20%);
          border: none;
        }

        .root-limit-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid var(--accent);
          background: var(--accent);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent), transparent 78%);
        }

        [data-theme="dark"] .root-limit-slider {
          background: rgba(255, 255, 255, 0.2);
        }

        [data-theme="dark"] .root-limit-slider::-webkit-slider-runnable-track {
          background: rgba(255, 255, 255, 0.2);
        }

        [data-theme="dark"] .root-limit-slider::-moz-range-track {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </section>
  );
}
