"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import * as d3 from "d3";
import { motion, AnimatePresence } from "framer-motion";
import type { CorpusToken } from "@/lib/schema/types";
import { getNodeColor, resolveVisualizationTheme } from "@/lib/schema/visualizationTypes";
import { getFrequencyColor, getIdentityColor, type LexicalColorMode } from "@/lib/theme/lexicalColoring";
import { useTranslations } from "next-intl";

interface RootNetworkGraphProps {
  tokens: CorpusToken[];
  onTokenHover: (tokenId: string | null) => void;
  onTokenFocus: (tokenId: string) => void;
  onRootSelect?: (root: string | null) => void;
  highlightRoot?: string | null;
  selectedSurahId?: number;
  theme?: "light" | "dark";
  showLabels?: boolean;
  lexicalColorMode?: LexicalColorMode;
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
  onRootSelect,
  highlightRoot,
  selectedSurahId,
  theme = "dark",
  showLabels = true,
  lexicalColorMode = "theme",
}: RootNetworkGraphProps) {
  const t = useTranslations("Visualizations.RootNetwork");
  const ts = useTranslations("Visualizations.Shared");
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<NetworkNode, NetworkLink> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const gRef = useRef<SVGGElement>(null);

  const [dimensions, setDimensions] = useState({ width: 900, height: 650 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [rootLimit, setRootLimit] = useState(30);
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [links, setLinks] = useState<NetworkLink[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const liveNodesRef = useRef<NetworkNode[]>([]);

  const themeColors = resolveVisualizationTheme(theme);

  // Filter tokens by surah if selected
  const scopedTokens = useMemo(() => {
    if (!selectedSurahId) return tokens;
    return tokens.filter(t => t.sura === selectedSurahId);
  }, [tokens, selectedSurahId]);

  // Total unique roots in the scoped tokens
  const totalRoots = useMemo(() => {
    const roots = new Set<string>();
    for (const t of scopedTokens) {
      if (t.root) roots.add(t.root);
    }
    return roots.size;
  }, [scopedTokens]);

  // Clamp rootLimit when surah changes and total roots is fewer
  useEffect(() => {
    if (totalRoots > 0 && rootLimit > totalRoots) {
      setRootLimit(Math.max(5, Math.min(totalRoots, rootLimit)));
    }
  }, [totalRoots, rootLimit]); // rootLimit intentionally only triggers when totalRoots changes

  // Build network data from tokens
  const { initialNodes, initialLinks } = useMemo(() => {
    const rootMap = new Map<string, { count: number; tokens: CorpusToken[]; lemmas: Set<string> }>();
    const lemmaMap = new Map<string, { count: number; tokens: CorpusToken[]; root: string }>();

    // Aggregate by root and lemma
    for (const token of scopedTokens) {
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

    // Create nodes - limit controlled by slider
    const sortedRoots = [...rootMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, rootLimit);

    const maxFreq = Math.max(...sortedRoots.map(([, d]) => d.count), 1);
    const nodesResult: NetworkNode[] = [];
    const linksResult: NetworkLink[] = [];
    const includedLemmas = new Set<string>();

    // Add root nodes — scale radius based on how many roots are shown
    const scaleFactor = rootLimit <= 20 ? 1 : rootLimit <= 50 ? 0.7 : 0.45;
    for (const [root, data] of sortedRoots) {
      const radius = (8 + (data.count / maxFreq) * 20) * scaleFactor;
      const rootFrequencyRatio = data.count / maxFreq;
      const rootColor =
        lexicalColorMode === "frequency"
          ? getFrequencyColor(rootFrequencyRatio, theme)
          : lexicalColorMode === "identity"
            ? getIdentityColor(root, theme)
            : themeColors.nodeColors.default;
      nodesResult.push({
        id: `root-${root}`,
        label: root,
        type: "root",
        frequency: data.count,
        radius,
        color: rootColor,
        tokens: data.tokens,
      });

      // Add lemma nodes for this root (limit to top 3 per root)
      const rootLemmas = [...data.lemmas]
        .map((l) => ({ lemma: l, data: lemmaMap.get(l)! }))
        .sort((a, b) => b.data.count - a.data.count)
        .slice(0, 3);

      for (const { lemma, data: lemmaData } of rootLemmas) {
        if (!includedLemmas.has(lemma)) {
          includedLemmas.add(lemma);
          const lemmaRadius = (4 + (lemmaData.count / maxFreq) * 10) * scaleFactor;
          const lemmaFrequencyRatio = lemmaData.count / maxFreq;
          const lemmaColor =
            lexicalColorMode === "frequency"
              ? getFrequencyColor(lemmaFrequencyRatio, theme)
              : lexicalColorMode === "identity"
                ? getIdentityColor(lemma, theme)
                : getNodeColor(lemmaData.tokens[0]?.pos ?? "N");
          nodesResult.push({
            id: `lemma-${lemma}`,
            label: lemma,
            type: "lemma",
            frequency: lemmaData.count,
            radius: lemmaRadius,
            color: lemmaColor,
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

    return { initialNodes: nodesResult, initialLinks: linksResult };
  }, [scopedTokens, themeColors.nodeColors.default, rootLimit, lexicalColorMode, theme]);

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

  // Initialize D3 force simulation
  useEffect(() => {
    if (!svgRef.current || initialNodes.length === 0) return;

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    // Scale forces based on node count for better layout
    const nodeCount = initialNodes.length;
    const spread = Math.sqrt(nodeCount) * 18;  // grows with node count
    const rootRadius = Math.max(80, spread * 0.5);
    const lemmaRadius = Math.max(150, spread * 0.9);

    // Clone nodes to avoid mutating original
    const nodesCopy = initialNodes.map((n) => ({ ...n }));
    const linksCopy = initialLinks.map((l) => ({ ...l }));

    // Create force simulation
    const simulation = d3
      .forceSimulation<NetworkNode>(nodesCopy)
      .force(
        "link",
        d3
          .forceLink<NetworkNode, NetworkLink>(linksCopy)
          .id((d) => d.id)
          .distance((d) => 20 + Math.min((d.weight ?? 1) * 1.5, 20))
          .strength(0.6)
      )
      .force("charge", d3.forceManyBody().strength(-50 - nodeCount * 0.3).distanceMax(spread * 1.5))
      .force("center", d3.forceCenter(centerX, centerY))
      .force(
        "collision",
        d3.forceCollide<NetworkNode>().radius((d) => d.radius + 2)
      )
      .force("radial", d3.forceRadial<NetworkNode>(
        (d) => d.type === "root" ? rootRadius : lemmaRadius,
        centerX,
        centerY
      ).strength(0.4));

    simulationRef.current = simulation;
    liveNodesRef.current = nodesCopy;

    simulation.on("tick", () => {
      setNodes([...nodesCopy]);
      setLinks([...linksCopy]);
    });

    // Run simulation
    simulation.alpha(1).restart();

    return () => {
      simulation.stop();
    };
  }, [initialNodes, initialLinks, dimensions]);

  // Set up zoom/pan behavior
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
      });

    zoomBehaviorRef.current = zoomBehavior;
    svg.call(zoomBehavior);

    return () => {
      svg.on(".zoom", null);
    };
  }, [isMounted, dimensions]);

  // D3 Drag behavior for nodes
  useEffect(() => {
    if (!gRef.current || !simulationRef.current) return;

    const simulation = simulationRef.current;
    const g = d3.select(gRef.current);

    const dragBehavior = d3.drag<SVGGElement, unknown>()
      .on("start", (event) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        const el = event.sourceEvent?.target?.closest?.(".rn-node") as SVGGElement | null;
        const nodeId = el?.getAttribute("data-node-id");
        const node = liveNodesRef.current.find((n) => n.id === nodeId);
        if (node) { node.fx = node.x; node.fy = node.y; }
      })
      .on("drag", (event) => {
        const el = event.sourceEvent?.target?.closest?.(".rn-node") as SVGGElement | null;
        const nodeId = el?.getAttribute("data-node-id");
        const node = liveNodesRef.current.find((n) => n.id === nodeId);
        if (node) { node.fx = event.x; node.fy = event.y; }
      })
      .on("end", (event) => {
        if (!event.active) simulation.alphaTarget(0);
        const el = event.sourceEvent?.target?.closest?.(".rn-node") as SVGGElement | null;
        const nodeId = el?.getAttribute("data-node-id");
        const node = liveNodesRef.current.find((n) => n.id === nodeId);
        if (node) { node.fx = null; node.fy = null; }
      });

    g.selectAll<SVGGElement, unknown>(".rn-node").call(dragBehavior);

    return () => {
      g.selectAll<SVGGElement, unknown>(".rn-node").on(".drag", null);
    };
  }, [nodes]);

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

  // Derive the highlight node id from the highlightRoot prop
  const highlightRootNodeId = highlightRoot ? `root-${highlightRoot}` : null;

  // Check if a link is connected to hovered/selected/highlighted node
  const isLinkHighlighted = useCallback(
    (link: NetworkLink) => {
      const highlightId = hoveredNode ?? selectedNode ?? highlightRootNodeId;
      if (!highlightId) return false;

      const sourceId = typeof link.source === "string" ? link.source : link.source.id;
      const targetId = typeof link.target === "string" ? link.target : link.target.id;

      return sourceId === highlightId || targetId === highlightId;
    },
    [hoveredNode, selectedNode, highlightRootNodeId]
  );

  return (
    <section className="immersive-viz" data-theme={theme}>
      {/* 
      <div className="panel-head">
          Removed for immersive mode 
      </div>
      */}

      <div className="viz-controls floating-controls">
        <div className="ayah-meta-wrapper">
          <button
            className="kg-reset-btn"
            onClick={() => {
              if (svgRef.current && zoomBehaviorRef.current) {
                d3.select(svgRef.current)
                  .transition()
                  .duration(750)
                  .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
              }
            }}
            title="Focus View"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 14v4h4M20 10V6h-4M4 10V6h4M20 14v4h-4M10 10l-6-6M14 14l6 6M10 14l-6 6M14 10l6-6" />
            </svg>
          </button>
          <p className="ayah-meta-glass" style={{ marginLeft: 8 }}>
            {initialNodes.filter((n) => n.type === "root").length} roots ·{" "}
            {initialNodes.filter((n) => n.type === "lemma").length} lemmas ·{" "}
            {initialLinks.length} connections
            {selectedSurahId ? ` · Surah ${selectedSurahId}` : " · Global"}
          </p>
        </div>
        <div className="root-limit-control" style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto' }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>Visible roots</label>
          <input
            type="range"
            min={5}
            max={Math.max(5, totalRoots)}
            step={5}
            value={Math.min(rootLimit, totalRoots || 100)}
            onChange={(e) => setRootLimit(Number(e.target.value))}
            style={{ width: 100, accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', minWidth: 44, textAlign: 'right' }}>{Math.min(rootLimit, totalRoots)}/{totalRoots}</span>
        </div>
      </div>

      <div ref={containerRef} className="viz-container" style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0 }}>
        {!isMounted ? null : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            className="network-graph viz-canvas"
            style={{ width: '100%', height: '100%', cursor: 'grab' }}
          >
            <g ref={gRef}>
              <defs>
                {/* Radial gradient for background glow */}
                <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(239, 68, 68, 0.1)" />
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

                  if (!source.x || !source.y || !target.x || !target.y) return null;

                  const isHighlighted = isLinkHighlighted(link);

                  // Calculate control point for curved line
                  const midX = (source.x + target.x) / 2;
                  const midY = (source.y + target.y) / 2;
                  const dx = target.x - source.x;
                  const dy = target.y - source.y;
                  const normalX = -dy * 0.15;
                  const normalY = dx * 0.15;

                  return (
                    <motion.path
                      key={idx}
                      d={`M ${source.x} ${source.y} Q ${midX + normalX} ${midY + normalY} ${target.x} ${target.y}`}
                      className={`edge ${isHighlighted ? "highlighted" : ""}`}
                      style={{
                        stroke: isHighlighted ? themeColors.accent : themeColors.edgeColors.default,
                        strokeWidth: isHighlighted ? 2 : 1,
                        fill: "none",
                      }}
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{
                        pathLength: 1,
                        opacity: isHighlighted ? 0.9 : 0.3,
                      }}
                      transition={{ duration: 1, delay: idx * 0.01 }}
                      filter={isHighlighted ? "url(#subtleGlow)" : undefined}
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
                  const isSearchHighlighted = highlightRootNodeId === node.id;
                  const isHighlighted = isHovered || isSelected || isSearchHighlighted;
                  const isRoot = node.type === "root";

                  return (
                    <g
                      key={node.id}
                      className="node-group rn-node"
                      data-node-id={node.id}
                      transform={`translate(${node.x},${node.y})`}
                      style={{ cursor: "grab" }}
                      onMouseEnter={() => handleNodeHover(node)}
                      onMouseLeave={() => handleNodeHover(null)}
                      onClick={() => {
                        handleNodeClick(node);
                        if (node.type === "root" && onRootSelect) {
                          onRootSelect(node.label);
                        }
                      }}
                    >
                      {/* Outer glow ring for highlighted root nodes */}
                      {isRoot && isHighlighted && (
                        <motion.circle
                          r={node.radius + 12}
                          fill="none"
                          stroke={themeColors.accent}
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
                        style={{
                          fill: isHighlighted ? themeColors.accent : node.color,
                          stroke: isRoot
                            ? "rgba(255, 255, 255, 0.4)"
                            : "rgba(255, 255, 255, 0.2)",
                          strokeWidth: isRoot ? 2 : 1,
                        }}
                        filter={isHighlighted ? "url(#nodeGlow)" : undefined}
                      />

                      {/* Inner highlight for root nodes */}
                      {isRoot && (
                        <circle
                          r={node.radius * 0.3}
                          fill="rgba(255, 255, 255, 0.2)"
                        />
                      )}

                      {/* Label */}
                      {(showLabels || isHighlighted) && (
                        <text
                          className="node-label arabic-text"
                          y={node.radius + 16}
                          style={{
                            opacity: isHighlighted ? 1 : 0.7,
                            fontSize: isRoot ? "14px" : "11px",
                            fontWeight: isRoot ? 600 : 400,
                          }}
                        >
                          {node.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
        )}

        {/* Tooltip */}
        <AnimatePresence>
          {(hoveredNode || selectedNode) && (
            <motion.div
              className="viz-tooltip"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              style={{
                position: "absolute",
                top: 20,
                left: 20,
                transform: "none",
              }}
            >
              {(() => {
                const node = nodes.find(
                  (n) => n.id === (hoveredNode ?? selectedNode)
                );
                if (!node) return null;

                return (
                  <>
                    <div className="viz-tooltip-title arabic-text">
                      {node.label}
                    </div>
                    <div className="viz-tooltip-subtitle">
                      {node.type === "root" ? ts("root") : ts("lemma")}
                    </div>
                    <div className="viz-tooltip-row">
                      <span className="viz-tooltip-label">{ts("occurrences")}</span>
                      <span className="viz-tooltip-value">{node.frequency}</span>
                    </div>
                    {node.tokens[0] && (
                      <>
                        <div className="viz-tooltip-row">
                          <span className="viz-tooltip-label">{ts("example")}</span>
                          <span className="viz-tooltip-value arabic-text">
                            {node.tokens[0].text}
                          </span>
                        </div>
                        <div className="viz-tooltip-row">
                          <span className="viz-tooltip-label">{ts("gloss")}</span>
                          <span className="viz-tooltip-value">
                            {node.tokens[0].morphology.gloss ?? "—"}
                          </span>
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isMounted && typeof document !== 'undefined' && document.getElementById('viz-sidebar-portal') && createPortal(
        <div className="viz-legend" data-tour-id="viz-legend">
          <div className="viz-legend-item">
            <div
              className="viz-legend-dot"
              style={{
                background: themeColors.nodeColors.default,
                width: 16,
                height: 16,
              }}
            />
            <span>{lexicalColorMode === "theme" ? t("rootTrilateral") : t("rootNodes")}</span>
          </div>
          {lexicalColorMode === "theme" ? (
            <>
              <div className="viz-legend-item">
                <div
                  className="viz-legend-dot"
                  style={{ background: getNodeColor("N"), width: 10, height: 10 }}
                />
                <span>{t("nounLemma")}</span>
              </div>
              <div className="viz-legend-item">
                <div
                  className="viz-legend-dot"
                  style={{ background: getNodeColor("V"), width: 10, height: 10 }}
                />
                <span>{t("verbLemma")}</span>
              </div>
            </>
          ) : lexicalColorMode === "frequency" ? (
            <>
              <div className="viz-legend-item">
                <div
                  className="viz-legend-dot"
                  style={{ background: getFrequencyColor(0.2, theme), width: 10, height: 10 }}
                />
                <span>{ts("lowerFrequency")}</span>
              </div>
              <div className="viz-legend-item">
                <div
                  className="viz-legend-dot"
                  style={{ background: getFrequencyColor(0.9, theme), width: 10, height: 10 }}
                />
                <span>{ts("higherFrequency")}</span>
              </div>
            </>
          ) : (
            <div className="viz-legend-item">
              <div
                className="viz-legend-dot"
                style={{ background: getIdentityColor("root-color-seed", theme), width: 10, height: 10 }}
              />
              <span>{ts("uniqueLexicalIdentity")}</span>
            </div>
          )}
          <div className="viz-legend-item">
            <div
              className="viz-legend-dot"
              style={{ background: themeColors.accent, width: 12, height: 12 }}
            />
            <span>{ts("highlighted")}</span>
          </div>
        </div>,
        document.getElementById('viz-sidebar-portal')!
      )}
    </section>
  );
}
