"use client";

import { useRef, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CorpusToken } from "@/lib/schema/types";
import { DARK_THEME, getNodeColor, GRADIENT_PALETTES } from "@/lib/schema/visualizationTypes";

interface ArcFlowDiagramProps {
  tokens: CorpusToken[];
  groupBy: "root" | "pos" | "ayah";
  onTokenHover: (tokenId: string | null) => void;
  onTokenFocus: (tokenId: string) => void;
  theme?: "light" | "dark";
}

interface FlowNode {
  id: string;
  label: string;
  category: string;
  count: number;
  position: number; // 0-1 position along the arc
  barHeight: number;
  color: string;
  tokens: CorpusToken[];
}

interface FlowConnection {
  id: string;
  sourceId: string;
  targetId: string;
  weight: number;
  color: string;
}

export default function ArcFlowDiagram({
  tokens,
  groupBy = "root",
  onTokenHover,
  onTokenFocus,
  theme = "dark",
}: ArcFlowDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [activeGroupBy, setActiveGroupBy] = useState(groupBy);

  const themeColors = DARK_THEME;
  const width = 900;
  const height = 700;
  const arcCenterX = width * 0.15;
  const arcCenterY = height * 0.5;
  const arcRadius = height * 0.45;
  const arcStartAngle = -Math.PI * 0.45;
  const arcEndAngle = Math.PI * 0.45;

  // Process tokens based on groupBy
  const { nodes, connections, maxCount } = useMemo(() => {
    const groups = new Map<string, { count: number; tokens: CorpusToken[]; connections: Map<string, number> }>();

    // Group tokens
    for (const token of tokens) {
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

      if (!groups.has(key)) {
        groups.set(key, { count: 0, tokens: [], connections: new Map() });
      }
      const group = groups.get(key)!;
      group.count++;
      group.tokens.push(token);

      // Track connections (root to lemma relationships)
      if (activeGroupBy === "root" && token.lemma) {
        const connKey = token.lemma;
        group.connections.set(connKey, (group.connections.get(connKey) ?? 0) + 1);
      }
    }

    // Sort and limit groups
    const sortedGroups = [...groups.entries()]
      .filter(([key]) => key !== "unknown" && key !== "")
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 40);

    const maxCount = Math.max(...sortedGroups.map(([, g]) => g.count), 1);

    // Create nodes
    const nodesResult: FlowNode[] = sortedGroups.map(([key, data], idx) => {
      const position = idx / (sortedGroups.length - 1 || 1);
      const barHeight = 50 + (data.count / maxCount) * 200;
      const colorPalette = GRADIENT_PALETTES.vibrant;
      const colorIndex = Math.floor((data.count / maxCount) * (colorPalette.length - 1));

      return {
        id: key,
        label: key,
        category: data.tokens[0]?.pos ?? "N",
        count: data.count,
        position,
        barHeight,
        color: activeGroupBy === "pos" ? getNodeColor(key) : colorPalette[colorIndex] ?? "#ffffff",
        tokens: data.tokens,
      };
    });

    // Create connections between nodes that share relationships
    const connectionsResult: FlowConnection[] = [];
    const processedPairs = new Set<string>();

    for (let i = 0; i < nodesResult.length; i++) {
      for (let j = i + 1; j < nodesResult.length; j++) {
        const nodeA = nodesResult[i];
        const nodeB = nodesResult[j];

        // Check if nodes share any lemmas (for root grouping)
        if (activeGroupBy === "root") {
          const lemmasA = new Set(nodeA.tokens.map((t) => t.lemma));
          const lemmasB = new Set(nodeB.tokens.map((t) => t.lemma));
          const sharedLemmas = [...lemmasA].filter((l) => lemmasB.has(l));

          if (sharedLemmas.length > 0) {
            const pairKey = `${nodeA.id}-${nodeB.id}`;
            if (!processedPairs.has(pairKey)) {
              processedPairs.add(pairKey);
              connectionsResult.push({
                id: pairKey,
                sourceId: nodeA.id,
                targetId: nodeB.id,
                weight: sharedLemmas.length,
                color: nodeA.color,
              });
            }
          }
        }

        // For POS grouping, connect if tokens are adjacent
        if (activeGroupBy === "pos") {
          const adjacentPairs = nodeA.tokens.filter((tA) =>
            nodeB.tokens.some(
              (tB) =>
                tA.sura === tB.sura &&
                tA.ayah === tB.ayah &&
                Math.abs(tA.position - tB.position) === 1
            )
          );

          if (adjacentPairs.length > 0) {
            const pairKey = `${nodeA.id}-${nodeB.id}`;
            if (!processedPairs.has(pairKey)) {
              processedPairs.add(pairKey);
              connectionsResult.push({
                id: pairKey,
                sourceId: nodeA.id,
                targetId: nodeB.id,
                weight: adjacentPairs.length,
                color: nodeA.color,
              });
            }
          }
        }
      }
    }

    return {
      nodes: nodesResult,
      connections: connectionsResult.slice(0, 30),
      maxCount,
    };
  }, [tokens, activeGroupBy]);

  // Calculate node position on arc
  const getNodePosition = useCallback(
    (position: number) => {
      const angle = arcStartAngle + position * (arcEndAngle - arcStartAngle);
      const x = arcCenterX + Math.cos(angle) * arcRadius;
      const y = arcCenterY + Math.sin(angle) * arcRadius;
      return { x, y, angle };
    },
    [arcCenterX, arcCenterY, arcRadius, arcStartAngle, arcEndAngle]
  );

  // Generate connection path
  const generateConnectionPath = useCallback(
    (sourceNode: FlowNode, targetNode: FlowNode) => {
      const source = getNodePosition(sourceNode.position);
      const target = getNodePosition(targetNode.position);

      // Calculate end of bar for source and target
      const sourceEndX = source.x + Math.cos(source.angle) * sourceNode.barHeight;
      const sourceEndY = source.y + Math.sin(source.angle) * sourceNode.barHeight;
      const targetEndX = target.x + Math.cos(target.angle) * targetNode.barHeight;
      const targetEndY = target.y + Math.sin(target.angle) * targetNode.barHeight;

      // Control point for smooth curve
      const midX = (sourceEndX + targetEndX) / 2 + 100;
      const midY = (sourceEndY + targetEndY) / 2;

      return `M ${sourceEndX} ${sourceEndY} Q ${midX} ${midY} ${targetEndX} ${targetEndY}`;
    },
    [getNodePosition]
  );

  const handleNodeHover = useCallback(
    (node: FlowNode | null) => {
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
    (node: FlowNode) => {
      if (node.tokens.length > 0) {
        onTokenFocus(node.tokens[0].id);
      }
    },
    [onTokenFocus]
  );

  return (
    <section className="panel" data-theme={theme}>
      <div className="panel-head">
        <div>
          <p className="eyebrow">Flow Analysis</p>
          <h2>Arc Flow Diagram</h2>
        </div>
        <p className="ayah-meta">
          {nodes.length} groups · {connections.length} connections
        </p>
      </div>

      <div className="viz-controls">
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
      </div>

      <div ref={containerRef} className="viz-container" style={{ height: 650 }}>
        <svg viewBox={`0 0 ${width} ${height}`} className="radial-arc viz-canvas">
          <defs>
            {/* Gradient definitions for each connection */}
            {connections.map((conn, idx) => (
              <linearGradient
                key={conn.id}
                id={`grad-${idx}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor={conn.color} stopOpacity="0.8" />
                <stop offset="50%" stopColor={themeColors.accentSecondary} stopOpacity="0.4" />
                <stop offset="100%" stopColor={conn.color} stopOpacity="0.8" />
              </linearGradient>
            ))}

            {/* Glow filter */}
            <filter id="barGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background arc */}
          <path
            d={`M ${arcCenterX + Math.cos(arcStartAngle) * arcRadius} ${
              arcCenterY + Math.sin(arcStartAngle) * arcRadius
            } A ${arcRadius} ${arcRadius} 0 0 1 ${
              arcCenterX + Math.cos(arcEndAngle) * arcRadius
            } ${arcCenterY + Math.sin(arcEndAngle) * arcRadius}`}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="60"
            strokeLinecap="round"
          />

          {/* Connections (flowing curves) */}
          <g className="connections">
            {connections.map((conn, idx) => {
              const sourceNode = nodes.find((n) => n.id === conn.sourceId);
              const targetNode = nodes.find((n) => n.id === conn.targetId);

              if (!sourceNode || !targetNode) return null;

              const isHighlighted =
                hoveredNode === conn.sourceId || hoveredNode === conn.targetId;

              return (
                <motion.path
                  key={conn.id}
                  d={generateConnectionPath(sourceNode, targetNode)}
                  className={`connection ${isHighlighted ? "highlighted" : ""}`}
                  fill="none"
                  stroke={`url(#grad-${idx})`}
                  strokeWidth={isHighlighted ? 3 : 1.5 + conn.weight * 0.5}
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{
                    pathLength: 1,
                    opacity: isHighlighted ? 0.9 : 0.5,
                  }}
                  transition={{ duration: 2, delay: idx * 0.05 }}
                  filter={isHighlighted ? "url(#barGlow)" : undefined}
                />
              );
            })}
          </g>

          {/* Node bars radiating from arc */}
          <g className="nodes">
            {nodes.map((node, idx) => {
              const pos = getNodePosition(node.position);
              const isHighlighted = hoveredNode === node.id;

              const barEndX = pos.x + Math.cos(pos.angle) * node.barHeight;
              const barEndY = pos.y + Math.sin(pos.angle) * node.barHeight;

              return (
                <motion.g
                  key={node.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.02 }}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => handleNodeHover(node)}
                  onMouseLeave={() => handleNodeHover(null)}
                  onClick={() => handleNodeClick(node)}
                >
                  {/* Bar line */}
                  <motion.line
                    x1={pos.x}
                    y1={pos.y}
                    x2={barEndX}
                    y2={barEndY}
                    stroke={isHighlighted ? themeColors.accent : node.color}
                    strokeWidth={isHighlighted ? 4 : 2.5}
                    strokeLinecap="round"
                    filter={isHighlighted ? "url(#barGlow)" : undefined}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.8, delay: idx * 0.02 }}
                  />

                  {/* End cap circle */}
                  <circle
                    cx={barEndX}
                    cy={barEndY}
                    r={isHighlighted ? 5 : 3}
                    fill={isHighlighted ? themeColors.accent : node.color}
                    filter={isHighlighted ? "url(#barGlow)" : undefined}
                  />

                  {/* Label (only show on hover or for important nodes) */}
                  {(isHighlighted || node.count > maxCount * 0.5) && (
                    <motion.text
                      x={barEndX + Math.cos(pos.angle) * 15}
                      y={barEndY + Math.sin(pos.angle) * 15}
                      fill={themeColors.textColors.secondary}
                      fontSize={isHighlighted ? 13 : 10}
                      fontWeight={isHighlighted ? 600 : 400}
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

          {/* Info overlay */}
          <g className="info-overlay">
            <text
              x={width - 30}
              y={40}
              textAnchor="end"
              fill={themeColors.textColors.muted}
              fontSize="12"
            >
              Grouped by {activeGroupBy}
            </text>
            <text
              x={width - 30}
              y={60}
              textAnchor="end"
              fill={themeColors.textColors.muted}
              fontSize="11"
            >
              Bar height = frequency
            </text>
          </g>
        </svg>

        {/* Tooltip */}
        <AnimatePresence>
          {hoveredNode && (
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
              {(() => {
                const node = nodes.find((n) => n.id === hoveredNode);
                if (!node) return null;

                return (
                  <>
                    <div className="viz-tooltip-title arabic-text">{node.label}</div>
                    <div className="viz-tooltip-subtitle">
                      {activeGroupBy === "root"
                        ? "Root"
                        : activeGroupBy === "pos"
                        ? "Part of Speech"
                        : "Verse"}
                    </div>
                    <div className="viz-tooltip-row">
                      <span className="viz-tooltip-label">Occurrences</span>
                      <span className="viz-tooltip-value">{node.count}</span>
                    </div>
                    {node.tokens[0] && (
                      <>
                        <div className="viz-tooltip-row">
                          <span className="viz-tooltip-label">Example</span>
                          <span className="viz-tooltip-value arabic-text">
                            {node.tokens[0].text}
                          </span>
                        </div>
                        <div className="viz-tooltip-row">
                          <span className="viz-tooltip-label">Gloss</span>
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

      <div className="viz-legend">
        <div className="viz-legend-item">
          <div
            className="viz-legend-line"
            style={{ background: `linear-gradient(90deg, ${GRADIENT_PALETTES.vibrant.join(", ")})` }}
          />
          <span>Frequency gradient (low → high)</span>
        </div>
        <div className="viz-legend-item">
          <div className="viz-legend-line" style={{ background: themeColors.accent }} />
          <span>Selected / Highlighted</span>
        </div>
      </div>
    </section>
  );
}
