"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import * as d3 from "d3";
import { motion, AnimatePresence } from "framer-motion";
import type { CorpusToken } from "@/lib/schema/types";
import { DARK_THEME, getNodeColor } from "@/lib/schema/visualizationTypes";

interface RadialSuraMapProps {
  tokens: CorpusToken[];
  suraId: number;
  suraName: string;
  suraNameArabic: string;
  onTokenHover: (tokenId: string | null) => void;
  onTokenFocus: (tokenId: string) => void;
  theme?: "light" | "dark";
}

interface RadialNode {
  id: string;
  ayah: number;
  position: number;
  angle: number;
  radius: number;
  text: string;
  root: string;
  pos: string;
  color: string;
}

interface AyahBar {
  ayah: number;
  tokenCount: number;
  angle: number;
  barHeight: number;
  dominantPOS: string;
  color: string;
}

interface RootConnection {
  sourceAyah: number;
  targetAyah: number;
  root: string;
  count: number;
  color: string;
}

export default function RadialSuraMap({
  tokens,
  suraId,
  suraName,
  suraNameArabic,
  onTokenHover,
  onTokenFocus,
  theme = "dark",
}: RadialSuraMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 700 });
  const [hoveredRoot, setHoveredRoot] = useState<string | null>(null);
  const [selectedAyah, setSelectedAyah] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const themeColors = theme === "dark" ? DARK_THEME : DARK_THEME; // Use dark for now

  // Process tokens into visualization data
  const { ayahBars, rootConnections, ayahCount, uniqueRoots } = useMemo(() => {
    const ayahTokens = new Map<number, CorpusToken[]>();
    const rootOccurrences = new Map<string, number[]>(); // root -> list of ayahs

    // Group tokens by ayah
    for (const token of tokens) {
      if (token.sura !== suraId) continue;
      if (!ayahTokens.has(token.ayah)) {
        ayahTokens.set(token.ayah, []);
      }
      ayahTokens.get(token.ayah)!.push(token);

      // Track root occurrences across ayahs
      if (token.root) {
        if (!rootOccurrences.has(token.root)) {
          rootOccurrences.set(token.root, []);
        }
        const ayahs = rootOccurrences.get(token.root)!;
        if (!ayahs.includes(token.ayah)) {
          ayahs.push(token.ayah);
        }
      }
    }

    const ayahCount = ayahTokens.size;
    const maxTokens = Math.max(...Array.from(ayahTokens.values()).map((t) => t.length), 1);

    // Create ayah bars
    const bars: AyahBar[] = [];
    ayahTokens.forEach((ayahTokensList, ayahNum) => {
      // Find dominant POS
      const posCount = new Map<string, number>();
      for (const t of ayahTokensList) {
        posCount.set(t.pos, (posCount.get(t.pos) ?? 0) + 1);
      }
      const dominantPOS = [...posCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N";

      const angle = ((ayahNum - 1) / ayahCount) * 360 - 90; // Start from top
      const barHeight = 30 + (ayahTokensList.length / maxTokens) * 120;

      bars.push({
        ayah: ayahNum,
        tokenCount: ayahTokensList.length,
        angle,
        barHeight,
        dominantPOS,
        color: getNodeColor(dominantPOS),
      });
    });

    // Create root connections (when same root appears in multiple ayahs)
    const connections: RootConnection[] = [];
    const processedPairs = new Set<string>();

    rootOccurrences.forEach((ayahs, root) => {
      if (ayahs.length < 2) return;
      
      // Create connections between consecutive occurrences
      for (let i = 0; i < ayahs.length - 1; i++) {
        const source = ayahs[i];
        const target = ayahs[i + 1];
        const pairKey = `${source}-${target}-${root}`;
        
        if (!processedPairs.has(pairKey)) {
          processedPairs.add(pairKey);
          connections.push({
            sourceAyah: source,
            targetAyah: target,
            root,
            count: 1,
            color: getNodeColor("N"), // Default color for connections
          });
        }
      }
    });

    return {
      ayahBars: bars,
      rootConnections: connections.slice(0, 50), // Limit for performance
      ayahCount,
      uniqueRoots: [...rootOccurrences.keys()],
    };
  }, [tokens, suraId]);

  // Update dimensions on resize
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: Math.max(width, 600),
          height: Math.max(height, 600),
        });
      }
    });

    observer.observe(containerRef.current);

    // Initial check
    const rect = containerRef.current.getBoundingClientRect();
    if(rect.width > 0 && rect.height > 0) {
        setDimensions({
            width: Math.max(rect.width, 600),
            height: Math.max(rect.height, 600),
        });
    }

    return () => observer.disconnect();
  }, []);

  const centerX = dimensions.width / 2;
  const centerY = dimensions.height / 2;
  const innerRadius = Math.min(dimensions.width, dimensions.height) * 0.25;
  const outerRadius = Math.min(dimensions.width, dimensions.height) * 0.42;

  // Generate arc path for connections
  const generateConnectionPath = useCallback(
    (source: number, target: number) => {
      const sourceAngle = ((source - 1) / ayahCount) * 2 * Math.PI - Math.PI / 2;
      const targetAngle = ((target - 1) / ayahCount) * 2 * Math.PI - Math.PI / 2;

      const sourceX = centerX + Math.cos(sourceAngle) * innerRadius;
      const sourceY = centerY + Math.sin(sourceAngle) * innerRadius;
      const targetX = centerX + Math.cos(targetAngle) * innerRadius;
      const targetY = centerY + Math.sin(targetAngle) * innerRadius;

      // Calculate control point for bezier curve (inside the circle)
      const midAngle = (sourceAngle + targetAngle) / 2;
      const angleDiff = Math.abs(targetAngle - sourceAngle);
      const curveDepth = innerRadius * (0.3 + angleDiff * 0.15);
      
      const controlX = centerX + Math.cos(midAngle) * (innerRadius - curveDepth);
      const controlY = centerY + Math.sin(midAngle) * (innerRadius - curveDepth);

      return `M ${sourceX} ${sourceY} Q ${controlX} ${controlY} ${targetX} ${targetY}`;
    },
    [centerX, centerY, innerRadius, ayahCount]
  );

  const handleBarHover = (ayah: number | null) => {
    setSelectedAyah(ayah);
    if (ayah) {
      const token = tokens.find((t) => t.sura === suraId && t.ayah === ayah);
      if (token) onTokenHover(token.id);
    } else {
      onTokenHover(null);
    }
  };

  return (
    <section className="panel" data-theme={theme}>
      <div className="panel-head">
        <div>
          <p className="eyebrow">Advanced Visualization</p>
          <h2>Radial Sura Map</h2>
        </div>
        <div style={{ textAlign: "right" }}>
          <p className="arabic-text arabic-large" style={{ margin: 0 }}>
            {suraNameArabic}
          </p>
          <p className="ayah-meta">{suraName} · {ayahCount} Ayat · {uniqueRoots.length} Unique Roots</p>
        </div>
      </div>

      <div className="viz-controls">
        <span style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>
          Hover bars to explore ayah structure. Arcs show root connections across verses.
        </span>
      </div>

      <div ref={containerRef} className="viz-container" style={{ height: 650 }}>
        {!isMounted ? null : (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          className="radial-arc viz-canvas"
        >
          <defs>
            {/* Gradient for connections */}
            <linearGradient id="connectionGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={themeColors.accent} stopOpacity="0.6" />
              <stop offset="50%" stopColor={themeColors.accentSecondary} stopOpacity="0.4" />
              <stop offset="100%" stopColor={themeColors.accent} stopOpacity="0.6" />
            </linearGradient>

            {/* Glow filter */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="strongGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="8" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background orbital rings */}
          {[0.6, 0.75, 0.9, 1.05].map((scale, i) => (
            <circle
              key={i}
              cx={centerX}
              cy={centerY}
              r={innerRadius * scale}
              fill="none"
              stroke="rgba(255, 255, 255, 0.03)"
              strokeWidth={1}
            />
          ))}

          {/* Main arc (the black band) */}
          <circle
            cx={centerX}
            cy={centerY}
            r={innerRadius}
            className="main-arc"
            fill="none"
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth={3}
          />

          {/* Root connections (flowing curves inside the circle) */}
          <g className="connections">
            {rootConnections.map((conn, idx) => {
              const isHighlighted = hoveredRoot === conn.root || selectedAyah === conn.sourceAyah || selectedAyah === conn.targetAyah;
              return (
                <motion.path
                  key={`${conn.sourceAyah}-${conn.targetAyah}-${conn.root}`}
                  d={generateConnectionPath(conn.sourceAyah, conn.targetAyah)}
                  className={`connection ${isHighlighted ? "highlighted" : ""}`}
                  stroke={isHighlighted ? themeColors.accent : "url(#connectionGrad)"}
                  strokeWidth={isHighlighted ? 2.5 : 1.5}
                  fill="none"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: isHighlighted ? 1 : 0.3 }}
                  transition={{ duration: 1.5, delay: idx * 0.02 }}
                  filter={isHighlighted ? "url(#glow)" : undefined}
                  onMouseEnter={() => setHoveredRoot(conn.root)}
                  onMouseLeave={() => setHoveredRoot(null)}
                />
              );
            })}
          </g>

          {/* Ayah bars radiating outward */}
          <g className="ayah-bars">
            {ayahBars.map((bar) => {
              const angleRad = (bar.angle * Math.PI) / 180;
              const startX = centerX + Math.cos(angleRad) * innerRadius;
              const startY = centerY + Math.sin(angleRad) * innerRadius;
              const endX = centerX + Math.cos(angleRad) * (innerRadius + bar.barHeight);
              const endY = centerY + Math.sin(angleRad) * (innerRadius + bar.barHeight);

              const isSelected = selectedAyah === bar.ayah;

              return (
                <motion.g
                  key={bar.ayah}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: bar.ayah * 0.03 }}
                >
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    className="bar colored"
                    stroke={isSelected ? themeColors.accent : bar.color}
                    strokeWidth={isSelected ? 4 : 2.5}
                    strokeLinecap="round"
                    filter={isSelected ? "url(#strongGlow)" : undefined}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => handleBarHover(bar.ayah)}
                    onMouseLeave={() => handleBarHover(null)}
                    onClick={() => {
                      const token = tokens.find((t) => t.sura === suraId && t.ayah === bar.ayah);
                      if (token) onTokenFocus(token.id);
                    }}
                  />
                  {/* Small circle at the end of bar */}
                  <circle
                    cx={endX}
                    cy={endY}
                    r={isSelected ? 5 : 3}
                    fill={isSelected ? themeColors.accent : bar.color}
                    filter={isSelected ? "url(#glow)" : undefined}
                  />
                </motion.g>
              );
            })}
          </g>

          {/* Center info */}
          <g className="center-info">
            <text
              x={centerX}
              y={centerY - 20}
              textAnchor="middle"
              fill={themeColors.textColors.primary}
              fontSize="28"
              fontWeight="700"
              className="arabic-text"
            >
              {suraNameArabic}
            </text>
            <text
              x={centerX}
              y={centerY + 15}
              textAnchor="middle"
              fill={themeColors.textColors.secondary}
              fontSize="14"
            >
              {suraName}
            </text>
            <text
              x={centerX}
              y={centerY + 35}
              textAnchor="middle"
              fill={themeColors.textColors.muted}
              fontSize="12"
            >
              {ayahCount} verses
            </text>
          </g>
        </svg>
        )}

        {/* Tooltip */}
        <AnimatePresence>
          {selectedAyah && (
            <motion.div
              className="viz-tooltip"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              style={{
                position: "absolute",
                top: 20,
                right: 20,
                transform: "none",
              }}
            >
              <div className="viz-tooltip-title">Ayah {selectedAyah}</div>
              <div className="viz-tooltip-subtitle">{suraName}:{selectedAyah}</div>
              {ayahBars.find((b) => b.ayah === selectedAyah) && (
                <>
                  <div className="viz-tooltip-row">
                    <span className="viz-tooltip-label">Tokens</span>
                    <span className="viz-tooltip-value">
                      {ayahBars.find((b) => b.ayah === selectedAyah)?.tokenCount}
                    </span>
                  </div>
                  <div className="viz-tooltip-row">
                    <span className="viz-tooltip-label">Dominant POS</span>
                    <span className="viz-tooltip-value">
                      {ayahBars.find((b) => b.ayah === selectedAyah)?.dominantPOS}
                    </span>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="viz-legend">
        <div className="viz-legend-item">
          <div className="viz-legend-dot" style={{ background: getNodeColor("N") }} />
          <span>Noun</span>
        </div>
        <div className="viz-legend-item">
          <div className="viz-legend-dot" style={{ background: getNodeColor("V") }} />
          <span>Verb</span>
        </div>
        <div className="viz-legend-item">
          <div className="viz-legend-dot" style={{ background: getNodeColor("ADJ") }} />
          <span>Adjective</span>
        </div>
        <div className="viz-legend-item">
          <div className="viz-legend-dot" style={{ background: getNodeColor("P") }} />
          <span>Preposition</span>
        </div>
        <div className="viz-legend-item">
          <div className="viz-legend-line" style={{ background: "url(#connectionGrad)" }} />
          <span>Root Connection</span>
        </div>
      </div>
    </section>
  );
}
