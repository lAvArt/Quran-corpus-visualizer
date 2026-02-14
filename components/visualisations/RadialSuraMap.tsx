"use client";

import { useEffect, useRef, useMemo, useState, useCallback, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import * as d3 from "d3";
import { motion, AnimatePresence } from "framer-motion";
import type { CorpusToken } from "@/lib/schema/types";
import { getAyah } from "@/lib/corpus/corpusLoader";
import { DARK_THEME, LIGHT_THEME, getNodeColor } from "@/lib/schema/visualizationTypes";
import { useZoom } from "@/lib/hooks/useZoom";
import { useTranslations } from "next-intl";
import { VizExplainerDialog, HelpIcon } from "@/components/ui/VizExplainerDialog";
import { useVizControl } from "@/lib/hooks/VizControlContext";

interface RadialSuraMapProps {
  tokens: CorpusToken[];
  suraId: number;
  suraName: string;
  suraNameArabic: string;
  onTokenHover: (tokenId: string | null) => void;
  onTokenFocus: (tokenId: string) => void;
  onRootSelect?: (root: string | null) => void;
  highlightRoot?: string | null;
  theme?: "light" | "dark";
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
  onRootSelect,
  highlightRoot,
  theme = "dark",
}: RadialSuraMapProps) {
  const t = useTranslations("Visualizations.RadialSura");
  const ts = useTranslations("Visualizations.Shared");
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const { svgRef, gRef, resetZoom } = useZoom<SVGSVGElement>({
    minScale: 0.3,
    maxScale: 6,
    onZoom: (transform) => setZoomScale(transform.k),
  });
  const [showHelp, setShowHelp] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 700 });
  const [hoveredRoot, setHoveredRoot] = useState<string | null>(null);
  const [hoveredAyah, setHoveredAyah] = useState<number | null>(null);
  const [selectedAyah, setSelectedAyah] = useState<number | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<RootConnection | null>(null);
  const [hoveredConnection, setHoveredConnection] = useState<RootConnection | null>(null);
  const [fullAyahText, setFullAyahText] = useState<string | null>(null);
  const [showHints, setShowHints] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const prevSuraIdRef = useRef<number | null>(null);
  const shouldAnimateConnections = prevSuraIdRef.current === null || prevSuraIdRef.current !== suraId;
  const shouldAnimateBars = shouldAnimateConnections;



  const { isLeftSidebarOpen, toggleLeftSidebar } = useVizControl();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setSelectedConnection(null);
    setSelectedAyah(null);
    setHoveredAyah(null);
    setHoveredRoot(null);
    setHoveredConnection(null);
  }, [suraId]);

  useEffect(() => {
    prevSuraIdRef.current = suraId;
  }, [suraId]);

  useEffect(() => {
    if (selectedAyah) {
      getAyah(suraId, selectedAyah).then(record => {
        if (record) {
          setFullAyahText(record.textUthmani);
        } else {
          setFullAyahText(null);
        }
      });
    } else {
      setFullAyahText(null);
    }
  }, [selectedAyah, suraId]);

  const themeColors = theme === "dark" ? DARK_THEME : LIGHT_THEME;

  // ... displayArabicName useMemo ...

  const displayArabicName = useMemo(() => {
    if (!suraNameArabic) return "";
    if (suraNameArabic.includes("\\u")) {
      return suraNameArabic.replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16))
      );
    }
    return suraNameArabic;
  }, [suraNameArabic]);

  // Process tokens into visualization data
  const {
    ayahBars,
    rootConnections,
    ayahCount,
    uniqueRoots,
    rootOccurrences,
    ayahRootCounts,
    ayahRootMax,
  } = useMemo(() => {
    const ayahTokens = new Map<number, CorpusToken[]>();
    const rootOccurrences = new Map<string, number[]>(); // root -> list of ayahs
    const rootCountsByAyah = new Map<number, Map<string, number>>();

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
        if (!rootCountsByAyah.has(token.ayah)) {
          rootCountsByAyah.set(token.ayah, new Map<string, number>());
        }
        const rootCounts = rootCountsByAyah.get(token.ayah)!;
        rootCounts.set(token.root, (rootCounts.get(token.root) ?? 0) + 1);
      }
    }

    const ayahCount = ayahTokens.size || 1;
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

      // Determine if ayah contains the highlighted root
      const containsRoot = highlightRoot
        ? ayahTokensList.some(t => t.root === highlightRoot)
        : false;

      // Adjust color if we are highlighting a root
      let barColor = getNodeColor(dominantPOS);
      if (highlightRoot) {
        barColor = containsRoot
          ? themeColors.accent
          : theme === "dark"
            ? "rgba(255,255,255,0.1)"
            : "rgba(31, 28, 25, 0.16)";
      }

      bars.push({
        ayah: ayahNum,
        tokenCount: ayahTokensList.length,
        angle,
        barHeight,
        dominantPOS,
        color: barColor,
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

    const highlightList = highlightRoot ? (rootOccurrences.get(highlightRoot) ?? []) : [];
    highlightList.sort((a, b) => a - b);
    const maxByAyah = new Map<number, number>();
    rootCountsByAyah.forEach((counts, ayahNum) => {
      let max = 1;
      counts.forEach((count) => {
        if (count > max) max = count;
      });
      maxByAyah.set(ayahNum, max);
    });

    return {
      ayahBars: bars,
      rootConnections: connections,
      ayahCount,
      uniqueRoots: [...rootOccurrences.keys()],
      rootOccurrences,
      ayahRootCounts: rootCountsByAyah,
      ayahRootMax: maxByAyah,
    };
  }, [tokens, suraId, highlightRoot, themeColors.accent, theme]);

  const highlightAyahs = useMemo(() => {
    if (!highlightRoot) return [];
    const list = rootOccurrences.get(highlightRoot) ?? [];
    return [...list].sort((a, b) => a - b);
  }, [highlightRoot, rootOccurrences]);

  const highlightAyahSet = useMemo(() => new Set(highlightAyahs), [highlightAyahs]);
  const activeAyah = selectedAyah ?? hoveredAyah;
  const activeAyahRootCounts = useMemo(() => {
    if (!activeAyah) return null;
    return ayahRootCounts.get(activeAyah) ?? null;
  }, [activeAyah, ayahRootCounts]);
  const activeAyahMaxCount = useMemo(() => {
    if (!activeAyah) return 1;
    return ayahRootMax.get(activeAyah) ?? 1;
  }, [activeAyah, ayahRootMax]);
  const activeRootColorMap = useMemo(() => {
    if (!activeAyahRootCounts) return null;
    const map = new Map<string, string>();
    activeAyahRootCounts.forEach((count, root) => {
      const ratio = activeAyahMaxCount > 0 ? count / activeAyahMaxCount : 0;
      const color = d3.interpolateTurbo(Math.min(1, Math.max(0.15, ratio)));
      map.set(root, color);
    });
    return map;
  }, [activeAyahRootCounts, activeAyahMaxCount]);

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
    if (rect.width > 0 && rect.height > 0) {
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

  const connectionPaths = useMemo(() => {
    const map = new Map<string, string>();
    rootConnections.forEach((conn) => {
      const key = `${conn.sourceAyah}-${conn.targetAyah}-${conn.root}`;
      map.set(key, generateConnectionPath(conn.sourceAyah, conn.targetAyah));
    });
    return map;
  }, [rootConnections, generateConnectionPath]);

  const barsWithGeometry = useMemo(() => {
    return ayahBars.map((bar) => {
      const angleRad = (bar.angle * Math.PI) / 180;
      const startX = centerX + Math.cos(angleRad) * innerRadius;
      const startY = centerY + Math.sin(angleRad) * innerRadius;
      const endX = centerX + Math.cos(angleRad) * (innerRadius + bar.barHeight);
      const endY = centerY + Math.sin(angleRad) * (innerRadius + bar.barHeight);
      return { bar, angleRad, startX, startY, endX, endY };
    });
  }, [ayahBars, centerX, centerY, innerRadius]);

  const selectedAyahData = useMemo(
    () => (selectedAyah ? ayahBars.find((bar) => bar.ayah === selectedAyah) ?? null : null),
    [selectedAyah, ayahBars]
  );

  const visibleConnections = useMemo(() => {
    if (!selectedConnection) return rootConnections;
    return rootConnections.filter(
      (conn) =>
        conn.root === selectedConnection.root &&
        conn.sourceAyah === selectedConnection.sourceAyah &&
        conn.targetAyah === selectedConnection.targetAyah
    );
  }, [rootConnections, selectedConnection]);

  const handleBarHover = (ayah: number | null) => {
    setHoveredAyah(ayah);
    if (ayah) {
      const token = tokens.find((t) => t.sura === suraId && t.ayah === ayah);
      if (token) onTokenHover(token.id);
    } else {
      onTokenHover(null);
    }
  };

  const handleConnectionHover = (connection: RootConnection | null) => {
    setHoveredConnection(connection);
    setHoveredRoot(connection?.root ?? null);
  };

  const handleConnectionSelect = (event: MouseEvent<SVGPathElement>, connection: RootConnection) => {
    event.preventDefault();
    event.stopPropagation();
    const isSameSelection =
      selectedConnection?.root === connection.root &&
      selectedConnection?.sourceAyah === connection.sourceAyah &&
      selectedConnection?.targetAyah === connection.targetAyah;

    if (isSameSelection) {
      setSelectedConnection(null);
      if (onRootSelect) onRootSelect(null);
      return;
    }

    setSelectedConnection(connection);
    if (onRootSelect) onRootSelect(connection.root);
  };

  const handleZoomStep = useCallback((factor: number) => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoomTransform(svgRef.current);
    svg.transition().duration(200).call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 6])
        .on("zoom", (event) => {
          if (gRef.current) {
            d3.select(gRef.current).attr("transform", event.transform);
            setZoomScale(event.transform.k);
          }
        })
        .scaleTo,
      zoom.k * factor
    );
  }, [svgRef, gRef]);

  return (
    <section className="panel" data-theme={theme} style={{ width: "100%", height: "100%", position: "relative" }}>
      <div className="panel-head">
        <div>
          <p className="eyebrow">{ts("advancedViz")}</p>
          <h2>{t("structuralMap")}</h2>
        </div>
        <div style={{ textAlign: "right" }}>
          <p className="arabic-text arabic-large" style={{ margin: 0 }}>
            {displayArabicName}
          </p>
          <p className="ayah-meta">{suraName} · {ayahCount} {ts("ayah")} · {uniqueRoots.length} {ts("uniqueRoots")}</p>
        </div>
      </div>

      <div className="viz-controls">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            className="hint-toggle"
            onClick={() => setShowHints((prev) => !prev)}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              background: "color-mix(in srgb, var(--line), transparent 22%)",
              border: "1px solid var(--line)",
              color: "var(--ink-secondary)",
              fontSize: "0.75rem",
              cursor: "pointer",
            }}
          >
            {showHints ? ts("hideHelp") : ts("showHelp")}
          </button>
          {showHints && (
            <span style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>
              {t("hints")}
              {highlightRoot && ` ${ts("filtering")}: ${highlightRoot}`}
            </span>
          )}
        </div>
        {highlightRoot && highlightAyahs.length > 0 && (
          <div style={{ marginTop: 8, color: "var(--ink-muted)", fontSize: "0.78rem" }}>
            {ts("linkedAyahs")}: {highlightAyahs.join(", ")}
          </div>
        )}
      </div>

      {isMounted && document.getElementById('viz-sidebar-portal') && createPortal(
        <>


          <div className={`viz-left-stack ${!isLeftSidebarOpen ? 'collapsed' : ''}`}>
            {highlightRoot && (
              <div className="viz-left-panel">
                <div className="viz-tooltip-title">{ts("selectedRoot")}</div>
                <div className="viz-tooltip-subtitle arabic-text">{highlightRoot}</div>
                {highlightAyahs.length > 0 && (
                  <div className="viz-tooltip-row">
                    <span className="viz-tooltip-label">{ts("linkedAyahs")}</span>
                    <span className="viz-tooltip-value">{highlightAyahs.join(", ")}</span>
                  </div>
                )}
              </div>
            )}

            <AnimatePresence>
              {selectedAyahData && (
                <motion.div
                  className="viz-left-panel"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                >
                  <div className="viz-tooltip-title">{ts("ayahCaps")} {selectedAyah}</div>
                  <div className="viz-tooltip-subtitle">{suraName}:{selectedAyah}</div>

                  {fullAyahText && (
                    <div className="viz-tooltip-subtitle arabic-text" style={{
                      marginTop: '0.5rem',
                      fontSize: '1.4rem',
                      lineHeight: '1.6',
                      textAlign: 'right',
                      direction: 'rtl',
                      width: '100%',
                      color: 'var(--ink)',
                      paddingBottom: '0.5rem',
                      borderBottom: '1px solid var(--line)'
                    }}>
                      {fullAyahText}
                    </div>
                  )}
                  <div className="viz-tooltip-row">
                    <span className="viz-tooltip-label">{ts("occurrences")}</span>
                    <span className="viz-tooltip-value">{selectedAyahData.tokenCount}</span>
                  </div>
                  <div className="viz-tooltip-row">
                    <span className="viz-tooltip-label">{ts("dominantPOS")}</span>
                    <span className="viz-tooltip-value">{selectedAyahData.dominantPOS}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {(selectedConnection || hoveredConnection) && (
                <motion.div
                  className="viz-left-panel"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                >
                  <div className="viz-tooltip-title">{t("rootConnection")}</div>
                  <div className="viz-tooltip-subtitle arabic-text">
                    {(selectedConnection ?? hoveredConnection)?.root}
                  </div>
                  <div className="viz-tooltip-row">
                    <span className="viz-tooltip-label">{t("from")}</span>
                    <span className="viz-tooltip-value">
                      {ts("ayah")} {(selectedConnection ?? hoveredConnection)?.sourceAyah}
                    </span>
                  </div>
                  <div className="viz-tooltip-row">
                    <span className="viz-tooltip-label">{t("to")}</span>
                    <span className="viz-tooltip-value">
                      {ts("ayah")} {(selectedConnection ?? hoveredConnection)?.targetAyah}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="viz-legend" style={{ marginTop: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', justifyContent: 'space-between' }}>
                <span className="eyebrow" style={{ fontSize: '0.7em' }}>{ts("legend")}</span>
                <HelpIcon onClick={() => setShowHelp(true)} />
              </div>
              <div className="viz-legend-item">
                <div className="viz-legend-dot" style={{ background: getNodeColor("N") }} />
                <span>{ts("noun")}</span>
              </div>
              <div className="viz-legend-item">
                <div className="viz-legend-dot" style={{ background: getNodeColor("V") }} />
                <span>{ts("verb")}</span>
              </div>
              <div className="viz-legend-item">
                <div className="viz-legend-dot" style={{ background: getNodeColor("ADJ") }} />
                <span>{ts("adjective")}</span>
              </div>
              <div className="viz-legend-item">
                <div className="viz-legend-dot" style={{ background: getNodeColor("P") }} />
                <span>{ts("preposition")}</span>
              </div>
              <div className="viz-legend-item">
                <div className="viz-legend-line" style={{ background: "url(#connectionGrad)" }} />
                <span>{t("rootConnection")}</span>
              </div>
              <div className="viz-legend-item">
                <div className="viz-legend-line" style={{ background: themeColors.accent, height: 6 }} />
                <span>{t("ayahBar")}</span>
              </div>
            </div>
          </div>
        </>,
        document.getElementById('viz-sidebar-portal')!
      )}

      <div ref={containerRef} className="viz-container" style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}>
        {!isMounted ? null : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            className="radial-sura-map viz-canvas"
            style={{ width: "100%", height: "100%", cursor: "grab" }}
            onClick={(event) => {
              if (event.target !== event.currentTarget) return;
              if (onRootSelect) onRootSelect(null);
              setSelectedAyah(null);
              setSelectedConnection(null);
              setHoveredRoot(null);
              setHoveredConnection(null);
              setHoveredAyah(null);
            }}
          >
            <g ref={gRef}>
              <defs>
                {/* Gradient for connections */}
                <linearGradient id="connectionGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={themeColors.accent} stopOpacity="0.6" />
                  <stop offset="50%" stopColor={themeColors.accentSecondary} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={themeColors.accent} stopOpacity="0.6" />
                </linearGradient>

                <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={themeColors.glowColors.primary} stopOpacity="0.2" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>

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
              <VizExplainerDialog
                isOpen={showHelp}
                onClose={() => setShowHelp(false)}
                content={{
                  title: t("Help.title"),
                  description: t("Help.description"),
                  sections: [
                    { label: t("Help.ringsLabel"), text: t("Help.ringsText") },
                    { label: t("Help.dotsLabel"), text: t("Help.dotsText") },
                    { label: t("Help.navLabel"), text: t("Help.navText") },
                  ]
                }}
              />

              {/* Background orbital rings */}
              {[0.6, 0.75, 0.9, 1.05].map((scale, i) => (
                <circle
                  key={i}
                  cx={centerX}
                  cy={centerY}
                  r={innerRadius * scale}
                  fill="none"
                  stroke={theme === "dark" ? "rgba(255, 255, 255, 0.03)" : "rgba(31, 28, 25, 0.08)"}
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
                stroke={theme === "dark" ? "rgba(255, 255, 255, 0.15)" : "rgba(31, 28, 25, 0.24)"}
                strokeWidth={3}
              />

              {/* Center Title */}
              <g className="center-title" transform={`translate(${centerX}, ${centerY})`}>
                <circle r={80} fill="url(#centerGlow)" />
                <text
                  y={-10}
                  textAnchor="middle"
                  className="arabic-text"
                  fill={themeColors.textColors.primary}
                  fontSize="32"
                  fontWeight="bold"
                >
                  {displayArabicName}
                </text>
                <text
                  y={25}
                  textAnchor="middle"
                  fill={themeColors.textColors.secondary}
                  fontSize="14"
                  letterSpacing="2px"
                >
                  {suraName}
                </text>
                <text
                  y={45}
                  textAnchor="middle"
                  fill={themeColors.textColors.muted}
                  fontSize="12"
                >
                  {ayahCount} {ts("ayah")}
                </text>
              </g>

              {/* Root connections (flowing curves inside the circle) */}
              <g className="connections">
                {visibleConnections.map((conn, idx) => {
                  const isActiveAyah =
                    !!activeAyah && (conn.sourceAyah === activeAyah || conn.targetAyah === activeAyah);
                  const countColor = isActiveAyah ? activeRootColorMap?.get(conn.root) ?? null : null;
                  const isHighlighted = hoveredRoot === conn.root || isActiveAyah;
                  const pathKey = `${conn.sourceAyah}-${conn.targetAyah}-${conn.root}`;
                  const pathD = connectionPaths.get(pathKey) ?? "";
                  return (
                    <g key={`${conn.sourceAyah}-${conn.targetAyah}-${conn.root}`}>
                      <motion.path
                        d={pathD}
                        className={`connection ${isHighlighted ? "highlighted" : ""}`}
                        stroke={countColor ?? (isHighlighted ? themeColors.accent : "url(#connectionGrad)")}
                        strokeWidth={isHighlighted ? 2.5 : 1.5}
                        fill="none"
                        pointerEvents="none"
                        initial={shouldAnimateConnections ? { pathLength: 0, opacity: 0 } : false}
                        animate={{ pathLength: 1, opacity: isHighlighted ? 1 : 0.3 }}
                        transition={shouldAnimateConnections ? { duration: 1.5, delay: idx * 0.02 } : { duration: 0 }}
                        filter={isHighlighted ? "url(#glow)" : undefined}
                        onMouseEnter={() => handleConnectionHover(conn)}
                        onMouseLeave={() => handleConnectionHover(null)}
                      />
                      <path
                        d={pathD}
                        stroke="transparent"
                        strokeWidth={12}
                        fill="none"
                        pointerEvents="stroke"
                        style={{ cursor: "pointer" }}
                        onPointerDown={(event) => event.stopPropagation()}
                        onMouseEnter={() => handleConnectionHover(conn)}
                        onMouseLeave={() => handleConnectionHover(null)}
                        onClick={(event) => handleConnectionSelect(event, conn)}
                      />
                    </g>
                  );
                })}
              </g>

              {/* Ayah bars radiating outward */}
              <g className="ayah-bars">
                {barsWithGeometry.map(({ bar, angleRad, startX, startY, endX, endY }) => {
                  const isSelected = selectedAyah === bar.ayah;

                  return (
                    <motion.g
                      key={bar.ayah}
                      initial={shouldAnimateBars ? { opacity: 0 } : false}
                      animate={{ opacity: 1 }}
                      transition={shouldAnimateBars ? { delay: bar.ayah * 0.03 } : { duration: 0 }}
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
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedAyah(bar.ayah);
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
                      <circle
                        cx={endX}
                        cy={endY}
                        r={12}
                        fill="transparent"
                        style={{ cursor: "pointer" }}
                        onMouseEnter={() => handleBarHover(bar.ayah)}
                        onMouseLeave={() => handleBarHover(null)}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedAyah(bar.ayah);
                          const token = tokens.find((t) => t.sura === suraId && t.ayah === bar.ayah);
                          if (token) onTokenFocus(token.id);
                        }}
                      />
                      {(() => {
                        const labelRadius = innerRadius + bar.barHeight + 18;
                        const labelX = centerX + Math.cos(angleRad) * labelRadius;
                        const labelY = centerY + Math.sin(angleRad) * labelRadius;
                        const isEmphasized =
                          highlightAyahSet.has(bar.ayah) ||
                          bar.ayah === selectedAyah ||
                          bar.ayah === hoveredAyah;
                        return (
                          <text
                            x={labelX}
                            y={labelY}
                            textAnchor={angleRad > Math.PI / 2 && angleRad < (3 * Math.PI) / 2 ? "end" : "start"}
                            fill={
                              isEmphasized
                                ? theme === "dark"
                                  ? "rgba(255,255,255,0.45)"
                                  : "rgba(31, 28, 25, 0.62)"
                                : theme === "dark"
                                  ? "rgba(255,255,255,0.22)"
                                  : "rgba(31, 28, 25, 0.36)"
                            }
                            fontSize={isEmphasized ? "8.5" : "8"}
                            fontWeight={isEmphasized ? 600 : 400}
                            style={{ pointerEvents: "none" }}
                          >
                            {bar.ayah}
                          </text>
                        );
                      })()}
                    </motion.g>
                  );
                })}
              </g>
            </g>
          </svg>
        )}

      </div>
    </section >
  );
}
