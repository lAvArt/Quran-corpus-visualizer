"use client";

import { useRef, useMemo, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as d3 from "d3";
import type { CorpusToken } from "@/lib/schema/types";
import { DARK_THEME, getNodeColor, GRADIENT_PALETTES } from "@/lib/schema/visualizationTypes";

interface ArcFlowDiagramProps {
  tokens: CorpusToken[];
  groupBy: "root" | "pos" | "ayah";
  onTokenHover: (tokenId: string | null) => void;
  onTokenFocus: (tokenId: string) => void;
  selectedSurahId?: number | null;
  selectedAyah?: number | null;
  selectedRoot?: string | null;
  selectedLemma?: string | null;
  theme?: "light" | "dark";
}

interface FlowNode {
  id: string;
  label: string;
  category: string;
  count: number;
  position: number;
  barHeight: number;
  color: string;
  sampleToken?: CorpusToken;
  matchCount: number;
  isContextMatch: boolean;
}

interface FlowConnection {
  id: string;
  sourceId: string;
  targetId: string;
  weight: number;
  color: string;
  isContextMatch: boolean;
}

export default function ArcFlowDiagram({
  tokens,
  groupBy = "root",
  onTokenHover,
  onTokenFocus,
  selectedSurahId,
  selectedAyah,
  selectedRoot,
  selectedLemma,
  theme = "dark",
}: ArcFlowDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [zoomLevel, setZoomLevel] = useState(0.92);

  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [activeGroupBy, setActiveGroupBy] = useState(groupBy);
  const [dimensions, setDimensions] = useState({ width: 1400, height: 900 });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setActiveGroupBy(groupBy);
  }, [groupBy]);

  useEffect(() => {
    setIsMounted(true);
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: Math.max(entry.contentRect.width, 900),
          height: Math.max(entry.contentRect.height, 700),
        });
      }
    });

    observer.observe(containerRef.current);

    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setDimensions({
        width: Math.max(rect.width, 900),
        height: Math.max(rect.height, 700),
      });
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;

    const svgSelection = d3.select(svgRef.current);
    const gSelection = d3.select(gRef.current);
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 8])
      .on("zoom", (event) => {
        gSelection.attr("transform", event.transform.toString());
        setZoomLevel((prev) => {
          const next = Math.round(event.transform.k * 20) / 20;
          return prev === next ? prev : next;
        });
      });

    zoomBehaviorRef.current = zoomBehavior;
    svgSelection.call(zoomBehavior);
    svgSelection.on("dblclick.zoom", null);
    svgSelection.call(zoomBehavior.transform, d3.zoomIdentity.scale(0.92));

    return () => {
      svgSelection.on(".zoom", null);
      zoomBehaviorRef.current = null;
    };
  }, [dimensions.width, dimensions.height]);

  const themeColors = DARK_THEME;

  const scopedTokens = useMemo(() => {
    if (!selectedSurahId) return tokens;
    return tokens.filter((token) => token.sura === selectedSurahId);
  }, [tokens, selectedSurahId]);

  const hasContextSelection = Boolean(selectedAyah || selectedRoot || selectedLemma);

  const tokenMatchesContext = useCallback(
    (token: CorpusToken) => {
      if (!hasContextSelection) return false;
      const ayahMatch = selectedAyah ? token.ayah === selectedAyah : false;
      const rootMatch = selectedRoot ? token.root === selectedRoot : false;
      const lemmaMatch = selectedLemma ? token.lemma === selectedLemma : false;
      return ayahMatch || rootMatch || lemmaMatch;
    },
    [hasContextSelection, selectedAyah, selectedRoot, selectedLemma]
  );

  const contextTokenCount = useMemo(
    () => scopedTokens.filter((token) => tokenMatchesContext(token)).length,
    [scopedTokens, tokenMatchesContext]
  );

  const { width, height } = dimensions;
  const isCompact = width < 1100;
  const leftRailOffset = width >= 980 ? 340 : 64;
  const rightPadding = 36;
  const maxBarHeightForLayout = isCompact ? 150 : 190;
  const angleSpread = width >= 1400 ? 0.64 : width >= 1100 ? 0.58 : 0.5;
  const horizontalRadiusLimit = Math.max(
    240,
    width - leftRailOffset - rightPadding - maxBarHeightForLayout
  );
  const verticalRadiusLimit = Math.max(220, height * (isCompact ? 0.34 : 0.4));
  const arcCenterX = leftRailOffset + 26;
  const arcCenterY = height * 0.5;
  const arcRadius = Math.min(horizontalRadiusLimit, verticalRadiusLimit);
  const arcStartAngle = -Math.PI * angleSpread;
  const arcEndAngle = Math.PI * angleSpread;

  const { nodes, connections, maxCount } = useMemo(() => {
    const maxGroups =
      activeGroupBy === "pos"
        ? 12
        : activeGroupBy === "ayah"
          ? zoomLevel > 1.35
            ? 130
            : zoomLevel > 0.95
              ? 90
              : 60
          : zoomLevel > 1.35
            ? 95
            : zoomLevel > 0.95
              ? 70
              : 50;

    const maxConnections =
      activeGroupBy === "pos"
        ? zoomLevel > 1.2
          ? 46
          : 30
        : zoomLevel > 1.2
          ? 70
          : 45;

    const groups = new Map<
      string,
      {
        count: number;
        sampleToken?: CorpusToken;
        category: string;
        lemmas?: Set<string>;
        matchCount: number;
      }
    >();

    for (const token of scopedTokens) {
      let key: string;
      let category: string;

      switch (activeGroupBy) {
        case "root":
          key = token.root || "unknown";
          category = token.pos;
          break;
        case "pos":
          key = token.pos;
          category = token.pos;
          break;
        case "ayah":
          key = `${token.sura}:${token.ayah}`;
          category = "ayah";
          break;
        default:
          key = token.root || "unknown";
          category = token.pos;
      }

      let group = groups.get(key);
      if (!group) {
        group = {
          count: 0,
          sampleToken: undefined,
          category,
          lemmas: activeGroupBy === "root" ? new Set<string>() : undefined,
          matchCount: 0,
        };
        groups.set(key, group);
      }

      group.count += 1;
      if (!group.sampleToken) group.sampleToken = token;
      if (activeGroupBy === "root" && token.lemma) {
        group.lemmas?.add(token.lemma);
      }
      if (tokenMatchesContext(token)) {
        group.matchCount += 1;
      }
    }

    let sortedGroups = [...groups.entries()]
      .filter(([key]) => (activeGroupBy === "root" ? key !== "unknown" && key !== "" : true))
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, maxGroups);

    if (activeGroupBy === "root" && selectedRoot && groups.has(selectedRoot)) {
      const isIncluded = sortedGroups.some(([key]) => key === selectedRoot);
      if (!isIncluded) {
        const selectedEntry: [string, (typeof sortedGroups)[number][1]] = [
          selectedRoot,
          groups.get(selectedRoot)!,
        ];
        sortedGroups = [...sortedGroups.slice(0, Math.max(maxGroups - 1, 0)), selectedEntry]
          .sort((a, b) => b[1].count - a[1].count);
      }
    }

    if (
      activeGroupBy === "ayah" &&
      selectedSurahId &&
      selectedAyah &&
      groups.has(`${selectedSurahId}:${selectedAyah}`)
    ) {
      const selectedAyahKey = `${selectedSurahId}:${selectedAyah}`;
      const isIncluded = sortedGroups.some(([key]) => key === selectedAyahKey);
      if (!isIncluded) {
        const selectedEntry: [string, (typeof sortedGroups)[number][1]] = [
          selectedAyahKey,
          groups.get(selectedAyahKey)!,
        ];
        sortedGroups = [...sortedGroups.slice(0, Math.max(maxGroups - 1, 0)), selectedEntry]
          .sort((a, b) => b[1].count - a[1].count);
      }
    }

    const maxGroupCount = Math.max(...sortedGroups.map(([, g]) => g.count), 1);

    const nodesResult: FlowNode[] = sortedGroups.map(([key, data], idx) => {
      const position = idx / (sortedGroups.length - 1 || 1);
      const barHeight = 34 + (data.count / maxGroupCount) * maxBarHeightForLayout;
      const colorPalette = GRADIENT_PALETTES.vibrant;
      const colorIndex = Math.floor((data.count / maxGroupCount) * (colorPalette.length - 1));

      const isContextMatch =
        data.matchCount > 0 ||
        (activeGroupBy === "root" && Boolean(selectedRoot && key === selectedRoot)) ||
        (activeGroupBy === "ayah" &&
          Boolean(selectedSurahId && selectedAyah && key === `${selectedSurahId}:${selectedAyah}`));

      return {
        id: key,
        label: key,
        category: data.category,
        count: data.count,
        position,
        barHeight,
        color: activeGroupBy === "pos" ? getNodeColor(key) : colorPalette[colorIndex] ?? "#ffffff",
        sampleToken: data.sampleToken,
        matchCount: data.matchCount,
        isContextMatch,
      };
    });

    const nodeById = new Map(nodesResult.map((node) => [node.id, node]));
    const nodeIds = new Set(nodesResult.map((node) => node.id));
    const connectionsResult: FlowConnection[] = [];

    if (activeGroupBy === "root") {
      const lemmaToRoots = new Map<string, Set<string>>();
      for (const [key, data] of sortedGroups) {
        if (!data.lemmas) continue;
        for (const lemma of data.lemmas) {
          const roots = lemmaToRoots.get(lemma) ?? new Set<string>();
          roots.add(key);
          lemmaToRoots.set(lemma, roots);
        }
      }

      const pairWeights = new Map<string, number>();
      lemmaToRoots.forEach((roots) => {
        const rootList = Array.from(roots);
        for (let i = 0; i < rootList.length; i++) {
          for (let j = i + 1; j < rootList.length; j++) {
            const a = rootList[i];
            const b = rootList[j];
            const pairKey = a < b ? `${a}|${b}` : `${b}|${a}`;
            pairWeights.set(pairKey, (pairWeights.get(pairKey) ?? 0) + 1);
          }
        }
      });

      [...pairWeights.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxConnections)
        .forEach(([pairKey, weight]) => {
          const [sourceId, targetId] = pairKey.split("|");
          const sourceNode = nodeById.get(sourceId);
          const targetNode = nodeById.get(targetId);
          connectionsResult.push({
            id: pairKey,
            sourceId,
            targetId,
            weight,
            color: sourceNode?.color ?? themeColors.accent,
            isContextMatch:
              Boolean(selectedRoot && (sourceId === selectedRoot || targetId === selectedRoot)) ||
              Boolean(sourceNode?.isContextMatch || targetNode?.isContextMatch),
          });
        });
    }

    if (activeGroupBy === "pos") {
      const sortedTokens = [...scopedTokens].sort(
        (a, b) => a.sura - b.sura || a.ayah - b.ayah || a.position - b.position
      );
      const pairWeights = new Map<string, number>();
      const pairContextHits = new Map<string, number>();

      for (let i = 0; i < sortedTokens.length - 1; i++) {
        const current = sortedTokens[i];
        const next = sortedTokens[i + 1];

        if (current.sura !== next.sura || current.ayah !== next.ayah) continue;
        if (Math.abs(current.position - next.position) !== 1) continue;
        if (current.pos === next.pos) continue;
        if (!nodeIds.has(current.pos) || !nodeIds.has(next.pos)) continue;

        const pairKey =
          current.pos < next.pos ? `${current.pos}|${next.pos}` : `${next.pos}|${current.pos}`;
        pairWeights.set(pairKey, (pairWeights.get(pairKey) ?? 0) + 1);

        if (tokenMatchesContext(current) || tokenMatchesContext(next)) {
          pairContextHits.set(pairKey, (pairContextHits.get(pairKey) ?? 0) + 1);
        }
      }

      [...pairWeights.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxConnections)
        .forEach(([pairKey, weight]) => {
          const [sourceId, targetId] = pairKey.split("|");
          const sourceNode = nodeById.get(sourceId);
          const targetNode = nodeById.get(targetId);
          connectionsResult.push({
            id: pairKey,
            sourceId,
            targetId,
            weight,
            color: sourceNode?.color ?? themeColors.accent,
            isContextMatch:
              (pairContextHits.get(pairKey) ?? 0) > 0 ||
              Boolean(sourceNode?.isContextMatch || targetNode?.isContextMatch),
          });
        });
    }

    if (activeGroupBy === "ayah" && hasContextSelection) {
      const sortedContextTokens = scopedTokens
        .filter((token) => tokenMatchesContext(token))
        .sort((a, b) => a.sura - b.sura || a.ayah - b.ayah || a.position - b.position);

      const pairWeights = new Map<string, number>();

      for (let i = 0; i < sortedContextTokens.length - 1; i++) {
        const current = sortedContextTokens[i];
        const next = sortedContextTokens[i + 1];
        if (current.sura !== next.sura) continue;
        if (current.ayah === next.ayah) continue;

        const currentKey = `${current.sura}:${current.ayah}`;
        const nextKey = `${next.sura}:${next.ayah}`;
        if (!nodeIds.has(currentKey) || !nodeIds.has(nextKey)) continue;

        const pairKey = currentKey < nextKey ? `${currentKey}|${nextKey}` : `${nextKey}|${currentKey}`;
        pairWeights.set(pairKey, (pairWeights.get(pairKey) ?? 0) + 1);
      }

      [...pairWeights.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxConnections)
        .forEach(([pairKey, weight]) => {
          const [sourceId, targetId] = pairKey.split("|");
          const sourceNode = nodeById.get(sourceId);
          connectionsResult.push({
            id: pairKey,
            sourceId,
            targetId,
            weight,
            color: sourceNode?.color ?? themeColors.accentSecondary,
            isContextMatch: true,
          });
        });
    }

    return {
      nodes: nodesResult,
      connections: connectionsResult,
      maxCount: maxGroupCount,
    };
  }, [
    scopedTokens,
    activeGroupBy,
    zoomLevel,
    themeColors.accent,
    themeColors.accentSecondary,
    selectedRoot,
    selectedAyah,
    selectedSurahId,
    hasContextSelection,
    tokenMatchesContext,
    maxBarHeightForLayout,
  ]);

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const contextNodeIds = useMemo(() => {
    return new Set(nodes.filter((node) => node.isContextMatch).map((node) => node.id));
  }, [nodes]);

  const getNodePosition = useCallback(
    (position: number) => {
      const angle = arcStartAngle + position * (arcEndAngle - arcStartAngle);
      const x = arcCenterX + Math.cos(angle) * arcRadius;
      const y = arcCenterY + Math.sin(angle) * arcRadius;
      return { x, y, angle };
    },
    [arcCenterX, arcCenterY, arcRadius, arcStartAngle, arcEndAngle]
  );

  const generateConnectionPath = useCallback(
    (sourceNode: FlowNode, targetNode: FlowNode) => {
      const source = getNodePosition(sourceNode.position);
      const target = getNodePosition(targetNode.position);

      const sourceEndX = source.x + Math.cos(source.angle) * sourceNode.barHeight;
      const sourceEndY = source.y + Math.sin(source.angle) * sourceNode.barHeight;
      const targetEndX = target.x + Math.cos(target.angle) * targetNode.barHeight;
      const targetEndY = target.y + Math.sin(target.angle) * targetNode.barHeight;

      const controlOffset = Math.max(52, Math.min(96, width * 0.065));
      const midX = Math.min(width - 24, (sourceEndX + targetEndX) / 2 + controlOffset);
      const midY = (sourceEndY + targetEndY) / 2;

      return `M ${sourceEndX} ${sourceEndY} Q ${midX} ${midY} ${targetEndX} ${targetEndY}`;
    },
    [getNodePosition, width]
  );

  const handleNodeHover = useCallback(
    (node: FlowNode | null) => {
      setHoveredNode(node?.id ?? null);
      if (node?.sampleToken) {
        onTokenHover(node.sampleToken.id);
      } else {
        onTokenHover(null);
      }
    },
    [onTokenHover]
  );

  const handleNodeClick = useCallback(
    (node: FlowNode) => {
      if (node.sampleToken) {
        onTokenFocus(node.sampleToken.id);
      }
    },
    [onTokenFocus]
  );

  const hoveredNodeData = useMemo(
    () => (hoveredNode ? nodeById.get(hoveredNode) ?? null : null),
    [hoveredNode, nodeById]
  );

  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(180)
      .call(zoomBehaviorRef.current.scaleBy, 1.2);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(180)
      .call(zoomBehaviorRef.current.scaleBy, 0.85);
  }, []);

  const handleResetZoom = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(220)
      .call(zoomBehaviorRef.current.transform, d3.zoomIdentity.scale(0.92));
  }, []);

  const selectedSummary = useMemo(() => {
    const items: Array<{ label: string; value: string }> = [];
    if (selectedSurahId) items.push({ label: "Surah", value: String(selectedSurahId) });
    if (selectedAyah) items.push({ label: "Ayah", value: String(selectedAyah) });
    if (selectedRoot) items.push({ label: "Root", value: selectedRoot });
    if (selectedLemma) items.push({ label: "Lemma", value: selectedLemma });
    return items;
  }, [selectedSurahId, selectedAyah, selectedRoot, selectedLemma]);

  return (
    <section className="immersive-viz" data-theme={theme} style={{ width: "100%", height: "100%", position: "relative" }}>
      <div className="viz-left-stack">
        <div className="viz-left-panel" style={{ display: "grid", gap: "10px" }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: 4 }}>Flow Analysis</p>
            <h2 style={{ margin: 0 }}>Arc Flow Diagram</h2>
          </div>

          <div style={{ fontSize: "0.83rem", color: "var(--ink-secondary)" }}>
            {nodes.length} groups - {connections.length} connections
          </div>

          <div className="mode-switcher">
            <button
              className={`mode-switcher-btn ${activeGroupBy === "root" ? "active" : ""}`}
              onClick={() => setActiveGroupBy("root")}
            >
              By Root
            </button>
            <button
              className={`mode-switcher-btn ${activeGroupBy === "pos" ? "active" : ""}`}
              onClick={() => setActiveGroupBy("pos")}
            >
              By POS
            </button>
            <button
              className={`mode-switcher-btn ${activeGroupBy === "ayah" ? "active" : ""}`}
              onClick={() => setActiveGroupBy("ayah")}
            >
              By Ayah
            </button>
          </div>

          <div style={{ display: "grid", gap: "6px", fontSize: "0.78rem", color: "var(--ink-muted)" }}>
            <span>Scope tokens: {scopedTokens.length.toLocaleString()}</span>
            <span>Context-linked tokens: {contextTokenCount.toLocaleString()}</span>
            <span>Zoom: {Math.round(zoomLevel * 100)}%</span>
          </div>

          <div style={{ display: "grid", gap: "8px" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="clear-focus" onClick={handleZoomOut}>
                -
              </button>
              <button type="button" className="clear-focus" onClick={handleZoomIn}>
                +
              </button>
              <button type="button" className="clear-focus" onClick={handleResetZoom}>
                Reset
              </button>
            </div>
            <span style={{ fontSize: "0.74rem", color: "var(--ink-muted)" }}>
              Drag canvas to pan. Wheel or +/- to zoom.
            </span>
          </div>
        </div>

        <div className="viz-left-panel" style={{ display: "grid", gap: "8px" }}>
          <div className="viz-tooltip-title" style={{ fontSize: "0.92rem" }}>Linked Selection</div>
          {selectedSummary.length > 0 ? (
            <div style={{ display: "grid", gap: "6px" }}>
              {selectedSummary.map((item) => (
                <div key={item.label} className="viz-tooltip-row" style={{ borderTop: "none", padding: 0 }}>
                  <span className="viz-tooltip-label">{item.label}</span>
                  <span className="viz-tooltip-value arabic-text">{item.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>
              No surah/ayah/root/lemma selection is active.
            </div>
          )}
        </div>

        <div className="viz-legend">
          <div className="viz-legend-item">
            <div
              className="viz-legend-line"
              style={{ background: `linear-gradient(90deg, ${GRADIENT_PALETTES.vibrant.join(", ")})` }}
            />
            <span>Bar color and length = frequency</span>
          </div>
          <div className="viz-legend-item">
            <div className="viz-legend-line" style={{ background: themeColors.accentSecondary }} />
            <span>Context-linked relationships</span>
          </div>
          <div className="viz-legend-item">
            <div className="viz-legend-dot" style={{ background: themeColors.accent, width: 12, height: 12 }} />
            <span>Hovered / active node</span>
          </div>
          <div className="viz-legend-item">
            <div className="viz-legend-dot" style={{ background: "rgba(255,255,255,0.8)", width: 10, height: 10 }} />
            <span>Selection context match</span>
          </div>
          <div className="viz-legend-item">
            <div className="viz-legend-line" style={{ background: "rgba(255,255,255,0.35)", height: 2 }} />
            <span>
              {activeGroupBy === "root"
                ? "Links = shared lemmas"
                : activeGroupBy === "pos"
                  ? "Links = adjacent POS pairs"
                  : "Links = context transitions across ayahs"}
            </span>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="viz-container"
        style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}
      >
        {!isMounted ? null : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="radial-arc viz-canvas"
            style={{ width: "100%", height: "100%", cursor: "grab", touchAction: "none" }}
          >
            <g ref={gRef}>
              <defs>
                {connections.map((conn, idx) => (
                  <linearGradient key={conn.id} id={`grad-${idx}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={conn.isContextMatch ? themeColors.accentSecondary : conn.color} stopOpacity="0.8" />
                    <stop offset="50%" stopColor={themeColors.accentSecondary} stopOpacity="0.45" />
                    <stop offset="100%" stopColor={conn.isContextMatch ? themeColors.accentSecondary : conn.color} stopOpacity="0.8" />
                  </linearGradient>
                ))}

                <filter id="barGlow" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <path
                d={`M ${arcCenterX + Math.cos(arcStartAngle) * arcRadius} ${arcCenterY + Math.sin(arcStartAngle) * arcRadius} A ${arcRadius} ${arcRadius} 0 0 1 ${arcCenterX + Math.cos(arcEndAngle) * arcRadius} ${arcCenterY + Math.sin(arcEndAngle) * arcRadius}`}
                fill="none"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth={isCompact ? 52 : 64}
                strokeLinecap="round"
              />

              <g className="connections">
                {connections.map((conn, idx) => {
                  const sourceNode = nodeById.get(conn.sourceId);
                  const targetNode = nodeById.get(conn.targetId);
                  if (!sourceNode || !targetNode) return null;

                  const isHoverHit = hoveredNode === conn.sourceId || hoveredNode === conn.targetId;
                  const isContextHit =
                    conn.isContextMatch ||
                    contextNodeIds.has(conn.sourceId) ||
                    contextNodeIds.has(conn.targetId);

                  return (
                    <motion.path
                      key={conn.id}
                      d={generateConnectionPath(sourceNode, targetNode)}
                      className={`connection ${isHoverHit ? "highlighted" : ""}`}
                      fill="none"
                      stroke={`url(#grad-${idx})`}
                      strokeWidth={isHoverHit ? 3.5 : Math.min(7, 1.2 + conn.weight * 0.55)}
                      strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{
                        pathLength: 1,
                        opacity: isHoverHit ? 0.95 : isContextHit ? 0.7 : 0.42,
                      }}
                      transition={{ duration: 1.5, delay: idx * 0.02 }}
                      filter={isHoverHit || isContextHit ? "url(#barGlow)" : undefined}
                    />
                  );
                })}
              </g>

              <g className="nodes">
                {nodes.map((node, idx) => {
                  const pos = getNodePosition(node.position);
                  const isHovered = hoveredNode === node.id;
                  const isContextNode = node.isContextMatch;

                  const barEndX = pos.x + Math.cos(pos.angle) * node.barHeight;
                  const barEndY = pos.y + Math.sin(pos.angle) * node.barHeight;

                  return (
                    <motion.g
                      key={node.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.012 }}
                      style={{ cursor: "pointer" }}
                      onMouseEnter={() => handleNodeHover(node)}
                      onMouseLeave={() => handleNodeHover(null)}
                      onClick={() => handleNodeClick(node)}
                    >
                      <motion.line
                        x1={pos.x}
                        y1={pos.y}
                        x2={barEndX}
                        y2={barEndY}
                        stroke={isHovered ? themeColors.accent : isContextNode ? themeColors.accentSecondary : node.color}
                        strokeWidth={isHovered ? 4.4 : isContextNode ? 3.4 : 2.6}
                        strokeLinecap="round"
                        filter={isHovered || isContextNode ? "url(#barGlow)" : undefined}
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.7, delay: idx * 0.01 }}
                      />

                      <circle
                        cx={barEndX}
                        cy={barEndY}
                        r={isHovered ? 5 : isContextNode ? 4.2 : 3}
                        fill={isHovered ? themeColors.accent : isContextNode ? themeColors.accentSecondary : node.color}
                        filter={isHovered || isContextNode ? "url(#barGlow)" : undefined}
                      />

                      {isContextNode && !isHovered && (
                        <circle
                          cx={barEndX}
                          cy={barEndY}
                          r={7}
                          fill="none"
                          stroke="rgba(255,255,255,0.6)"
                          strokeWidth={1.2}
                        />
                      )}

                      {(isHovered || isContextNode || node.count > maxCount * 0.45) && (
                        <motion.text
                          x={barEndX + Math.cos(pos.angle) * 14}
                          y={barEndY + Math.sin(pos.angle) * 14}
                          fill={themeColors.textColors.secondary}
                          fontSize={isHovered || isContextNode ? 12 : 10}
                          fontWeight={isHovered || isContextNode ? 600 : 400}
                          textAnchor="start"
                          className="arabic-text"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          {node.label}
                        </motion.text>
                      )}
                    </motion.g>
                  );
                })}
              </g>

              <g className="info-overlay">
                <text
                  x={width - 30}
                  y={38}
                  textAnchor="end"
                  fill={themeColors.textColors.muted}
                  fontSize="12"
                >
                  Grouped by {activeGroupBy}
                </text>
                <text
                  x={width - 30}
                  y={58}
                  textAnchor="end"
                  fill={themeColors.textColors.muted}
                  fontSize="11"
                >
                  Scope: {selectedSurahId ? `surah ${selectedSurahId}` : "global corpus"}
                </text>
                {selectedAyah ? (
                  <text
                    x={width - 30}
                    y={78}
                    textAnchor="end"
                    fill={themeColors.textColors.muted}
                    fontSize="11"
                  >
                    Ayah context: {selectedAyah}
                  </text>
                ) : null}
              </g>
            </g>
          </svg>
        )}

        <AnimatePresence>
          {hoveredNodeData && (
            <motion.div
              className="viz-tooltip"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              style={{
                position: "absolute",
                bottom: 20,
                right: 20,
                transform: "none",
              }}
            >
              <div className="viz-tooltip-title arabic-text">{hoveredNodeData.label}</div>
              <div className="viz-tooltip-subtitle">
                {activeGroupBy === "root" ? "Root" : activeGroupBy === "pos" ? "Part of Speech" : "Ayah"}
              </div>
              <div className="viz-tooltip-row">
                <span className="viz-tooltip-label">Occurrences</span>
                <span className="viz-tooltip-value">{hoveredNodeData.count}</span>
              </div>
              {hoveredNodeData.matchCount > 0 && (
                <div className="viz-tooltip-row">
                  <span className="viz-tooltip-label">Context matches</span>
                  <span className="viz-tooltip-value">{hoveredNodeData.matchCount}</span>
                </div>
              )}
              {hoveredNodeData.sampleToken && (
                <>
                  <div className="viz-tooltip-row">
                    <span className="viz-tooltip-label">Example</span>
                    <span className="viz-tooltip-value arabic-text">{hoveredNodeData.sampleToken.text}</span>
                  </div>
                  <div className="viz-tooltip-row">
                    <span className="viz-tooltip-label">Ref</span>
                    <span className="viz-tooltip-value">
                      {hoveredNodeData.sampleToken.sura}:{hoveredNodeData.sampleToken.ayah}
                    </span>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
