"use client";

import { useEffect, useRef, useMemo, useState, useCallback, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import * as d3 from "d3";
import { motion, AnimatePresence } from "framer-motion";
import type { CorpusToken } from "@/lib/schema/types";
import { getAyah } from "@/lib/corpus/corpusLoader";
import { getNodeColor, resolveVisualizationTheme } from "@/lib/schema/visualizationTypes";
import { getFrequencyColor, getIdentityColor, type LexicalColorMode } from "@/lib/theme/lexicalColoring";
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
  lexicalColorMode?: LexicalColorMode;
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

interface AyahRootEntry {
  root: string;
  count: number;
  globalCount: number;
}

interface AyahRootNode extends AyahRootEntry {
  x: number;
  y: number;
  r: number;
  labelX: number;
  labelY: number;
  baseColor: string;
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
  lexicalColorMode = "theme",
}: RadialSuraMapProps) {
  const t = useTranslations("Visualizations.RadialSura");
  const ts = useTranslations("Visualizations.Shared");
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [isMounted, setIsMounted] = useState(false);
  const { svgRef, gRef, resetZoom, zoomBy } = useZoom<SVGSVGElement>({
    minScale: 0.3,
    maxScale: 6,
    ready: isMounted,
    onZoomEnd: (transform) => setZoomScale(transform.k),
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
  const prevSuraIdRef = useRef<number | null>(null);
  const shouldAnimateConnections = prevSuraIdRef.current === null || prevSuraIdRef.current !== suraId;
  const shouldAnimateBars = shouldAnimateConnections;



  const { isLeftSidebarOpen } = useVizControl();

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

  const themeColors = resolveVisualizationTheme(theme);

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
    ayahRootEntriesByAyah,
    ayahRootMax,
    maxRootsPerAyah,
    rootTokenTotals,
    maxRootTokenCount,
  } = useMemo(() => {
    const ayahTokens = new Map<number, CorpusToken[]>();
    const rootOccurrences = new Map<string, number[]>(); // root -> list of ayahs
    const rootCountsByAyah = new Map<number, Map<string, number>>();
    const rootTokenTotals = new Map<string, number>();

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
        rootTokenTotals.set(token.root, (rootTokenTotals.get(token.root) ?? 0) + 1);
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
    const maxRootTokenCount = Math.max(1, ...Array.from(rootTokenTotals.values()));
    const densityCompression = Math.max(0.38, Math.min(1, 120 / ayahCount));

    const maxByAyah = new Map<number, number>();
    const rootEntriesByAyah = new Map<number, AyahRootEntry[]>();
    let maxRootsPerAyah = 1;
    rootCountsByAyah.forEach((counts, ayahNum) => {
      let max = 1;
      counts.forEach((count) => {
        if (count > max) max = count;
      });
      maxByAyah.set(ayahNum, max);

      const entries = [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([root, count]) => ({
          root,
          count,
          globalCount: rootTokenTotals.get(root) ?? count,
        }));
      rootEntriesByAyah.set(ayahNum, entries);
      if (entries.length > maxRootsPerAyah) {
        maxRootsPerAyah = entries.length;
      }
    });

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
      const rootCountsForAyah = rootCountsByAyah.get(ayahNum);
      const rootVariantCount = rootCountsForAyah?.size ?? 0;

      // Calculate token height based on length relative to max tokens in sura
      const tokenHeight = 60 + (ayahTokensList.length / maxTokens) * 220;

      // Calculate absolute minimum height required to strictly prevent nodes from squashing together
      const minRequiredForRoots = 45 + (rootVariantCount * 24);

      const barHeight = Math.min(450, Math.max(tokenHeight, minRequiredForRoots));

      // Determine if ayah contains the highlighted root
      const containsRoot = highlightRoot
        ? ayahTokensList.some(t => t.root === highlightRoot)
        : false;

      // Adjust color if we are highlighting a root
      let barColor = getNodeColor(dominantPOS);
      let dominantRoot: string | null = null;
      let dominantRootCount = 0;
      if (rootCountsForAyah) {
        rootCountsForAyah.forEach((count, root) => {
          if (count > dominantRootCount) {
            dominantRootCount = count;
            dominantRoot = root;
          }
        });
      }

      if (!highlightRoot && dominantRoot && lexicalColorMode !== "theme") {
        const rootGlobalCount = rootTokenTotals.get(dominantRoot) ?? dominantRootCount;
        const rootRatio = Math.log1p(rootGlobalCount) / Math.log1p(maxRootTokenCount);
        barColor =
          lexicalColorMode === "frequency"
            ? getFrequencyColor(rootRatio, theme)
            : getIdentityColor(dominantRoot, theme);
      }

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
          const rootGlobalCount = rootTokenTotals.get(root) ?? 1;
          const rootRatio = Math.log1p(rootGlobalCount) / Math.log1p(maxRootTokenCount);
          const connectionColor =
            lexicalColorMode === "frequency"
              ? getFrequencyColor(rootRatio, theme)
              : lexicalColorMode === "identity"
                ? getIdentityColor(root, theme)
                : getNodeColor("N");
          connections.push({
            sourceAyah: source,
            targetAyah: target,
            root,
            count: 1,
            color: connectionColor,
          });
        }
      }
    });

    return {
      ayahBars: bars,
      rootConnections: connections,
      ayahCount,
      uniqueRoots: [...rootOccurrences.keys()],
      rootOccurrences,
      ayahRootCounts: rootCountsByAyah,
      ayahRootEntriesByAyah: rootEntriesByAyah,
      ayahRootMax: maxByAyah,
      maxRootsPerAyah,
      rootTokenTotals,
      maxRootTokenCount,
    };
  }, [tokens, suraId, highlightRoot, themeColors.accent, theme, lexicalColorMode]);

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
      const color =
        lexicalColorMode === "theme"
          ? d3.interpolateTurbo(Math.min(1, Math.max(0.15, ratio)))
          : lexicalColorMode === "frequency"
            ? getFrequencyColor(Math.log1p(rootTokenTotals.get(root) ?? count) / Math.log1p(maxRootTokenCount), theme)
            : getIdentityColor(root, theme);
      map.set(root, color);
    });
    return map;
  }, [activeAyahRootCounts, activeAyahMaxCount, lexicalColorMode, rootTokenTotals, maxRootTokenCount, theme]);

  const { ayahTokenIdByAyah, ayahTokenIdByAyahRoot } = useMemo(() => {
    const byAyah = new Map<number, string>();
    const byAyahRoot = new Map<string, string>();

    for (const token of tokens) {
      if (token.sura !== suraId) continue;
      if (!byAyah.has(token.ayah)) {
        byAyah.set(token.ayah, token.id);
      }
      if (token.root) {
        const key = `${token.ayah}::${token.root}`;
        if (!byAyahRoot.has(key)) {
          byAyahRoot.set(key, token.id);
        }
      }
    }

    return {
      ayahTokenIdByAyah: byAyah,
      ayahTokenIdByAyahRoot: byAyahRoot,
    };
  }, [tokens, suraId]);

  const getRootBaseColor = useCallback((root: string, globalCount: number) => {
    if (lexicalColorMode === "frequency") {
      const ratio = Math.log1p(globalCount) / Math.log1p(maxRootTokenCount);
      return getFrequencyColor(ratio, theme);
    }
    return getIdentityColor(root, theme);
  }, [lexicalColorMode, maxRootTokenCount, theme]);

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
  const minDimension = Math.min(dimensions.width, dimensions.height);
  const maxBarHeight = useMemo(
    () => Math.max(24, ...ayahBars.map((bar) => bar.barHeight)),
    [ayahBars]
  );
  const desiredArcSpacing = 16.0 + Math.min(6.0, maxRootsPerAyah * 0.4);
  const radiusForAyahDensity = (ayahCount * desiredArcSpacing) / (2 * Math.PI);
  const outerPadding = 80;
  const maxInnerFromCanvas = Math.max(100, minDimension / 2 - maxBarHeight - outerPadding);
  const baseInnerRadius = minDimension * 0.35;
  const desiredInnerRadius = Math.max(baseInnerRadius, radiusForAyahDensity);

  // By omitting the maxInnerFromCanvas clamp, we allow dense suras to scale up past screen boundaries, using zoom map layout
  const innerRadius = Math.max(maxInnerFromCanvas, desiredInnerRadius);
  const radiansPerAyah = (2 * Math.PI) / Math.max(ayahCount, 1);
  const arcSpacing = innerRadius * radiansPerAyah;
  const compactLayout = arcSpacing < 10.0;
  const barStrokeWidth = compactLayout ? 2.4 : arcSpacing < 14 ? 3.0 : 3.6;
  const endpointRadius = compactLayout ? 3.6 : 5.0;
  const rootDetailLevel = zoomScale >= 3.0 ? 3 : zoomScale >= 1.4 ? 2 : 1;
  const maxRootsPerAyahVisible =
    rootDetailLevel === 1
      ? compactLayout
        ? 1
        : 2
      : rootDetailLevel === 2
        ? compactLayout
          ? 3
          : 4
        : Number.POSITIVE_INFINITY;
  const showContextRootLabels = rootDetailLevel >= 2;
  const showAllRootLabels = rootDetailLevel >= 3;

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
      const key = `${conn.sourceAyah}-${conn.targetAyah}`;
      if (!map.has(key)) {
        map.set(key, generateConnectionPath(conn.sourceAyah, conn.targetAyah));
      }
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
      const rootEntries = ayahRootEntriesByAyah.get(bar.ayah) ?? [];
      const maxCountForAyah = ayahRootMax.get(bar.ayah) ?? 1;
      const minNodeRadius = compactLayout ? 2.8 : 3.8;
      const maxNodeRadius = compactLayout ? 6.0 : 8.5;
      const rootRadiusScale = d3
        .scaleSqrt<number, number>()
        .domain([1, Math.max(1, maxCountForAyah)])
        .range([minNodeRadius, maxNodeRadius]);

      const rootStartPadding = Math.min(32, Math.max(16, bar.barHeight * 0.20));
      const rootEndPadding = Math.min(24, Math.max(14, bar.barHeight * 0.15));
      const rootBandLength = Math.max(15, bar.barHeight - rootStartPadding - rootEndPadding);
      const rootNodes: AyahRootNode[] = rootEntries.map((entry, index) => {
        const positionRatio =
          rootEntries.length <= 1 ? 0.6 : (index + 1) / (rootEntries.length + 1);
        const distance = rootStartPadding + rootBandLength * positionRatio;
        const x = startX + Math.cos(angleRad) * distance;
        const y = startY + Math.sin(angleRad) * distance;
        const r = rootRadiusScale(entry.count);
        const labelOffset = r + 3;

        // Alternate perpendicular offset so texts don't stack directly on top of each other
        const flip = index % 2 === 0 ? 1 : -1;
        const perpOffset = rootEntries.length > 1 ? flip * (r + 4.5) : 0;
        const pX = Math.cos(angleRad + Math.PI / 2);
        const pY = Math.sin(angleRad + Math.PI / 2);

        return {
          ...entry,
          x,
          y,
          r,
          labelX: x + Math.cos(angleRad) * labelOffset + pX * perpOffset,
          labelY: y + Math.sin(angleRad) * (labelOffset + 0.5) + pY * perpOffset,
          baseColor: getRootBaseColor(entry.root, entry.globalCount),
        };
      });

      return { bar, angleRad, startX, startY, endX, endY, rootNodes };
    });
  }, [ayahBars, centerX, centerY, innerRadius, ayahRootEntriesByAyah, ayahRootMax, compactLayout, getRootBaseColor]);

  const selectedAyahData = useMemo(
    () => (selectedAyah ? ayahBars.find((bar) => bar.ayah === selectedAyah) ?? null : null),
    [selectedAyah, ayahBars]
  );
  const selectedAyahRootEntries = useMemo(() => {
    if (!selectedAyah) return [];
    return ayahRootEntriesByAyah.get(selectedAyah) ?? [];
  }, [selectedAyah, ayahRootEntriesByAyah]);

  const visibleConnections = useMemo(() => {
    if (!selectedConnection) return rootConnections;
    return rootConnections.filter(
      (conn) =>
        conn.root === selectedConnection.root &&
        conn.sourceAyah === selectedConnection.sourceAyah &&
        conn.targetAyah === selectedConnection.targetAyah
    );
  }, [rootConnections, selectedConnection]);

  const renderedConnections = useMemo(() => {
    return visibleConnections;
  }, [visibleConnections]);

  const barsForRender = useMemo(() => {
    return barsWithGeometry.map((entry) => {
      const isFocusedAyah =
        entry.bar.ayah === selectedAyah ||
        entry.bar.ayah === hoveredAyah ||
        highlightAyahSet.has(entry.bar.ayah);

      let visibleRootNodes = entry.rootNodes;
      if (!isFocusedAyah && Number.isFinite(maxRootsPerAyahVisible)) {
        visibleRootNodes = entry.rootNodes.slice(0, maxRootsPerAyahVisible);
      }

      if (highlightRoot) {
        const highlightedNode = entry.rootNodes.find((node) => node.root === highlightRoot);
        if (highlightedNode && !visibleRootNodes.some((node) => node.root === highlightRoot)) {
          visibleRootNodes = [...visibleRootNodes, highlightedNode];
        }
      }

      return {
        ...entry,
        isFocusedAyah,
        visibleRootNodes,
      };
    });
  }, [barsWithGeometry, selectedAyah, hoveredAyah, highlightAyahSet, maxRootsPerAyahVisible, highlightRoot]);

  const handleAyahSelect = useCallback((ayah: number, preferredRoot?: string) => {
    setSelectedAyah(ayah);
    const tokenId =
      (preferredRoot ? ayahTokenIdByAyahRoot.get(`${ayah}::${preferredRoot}`) : undefined) ??
      ayahTokenIdByAyah.get(ayah);
    if (tokenId) onTokenFocus(tokenId);
  }, [ayahTokenIdByAyahRoot, ayahTokenIdByAyah, onTokenFocus]);

  const handleBarHover = useCallback((ayah: number | null) => {
    setHoveredAyah((prev) => (prev === ayah ? prev : ayah));
    if (ayah) {
      const tokenId = ayahTokenIdByAyah.get(ayah);
      if (tokenId) onTokenHover(tokenId);
    } else {
      onTokenHover(null);
    }
  }, [ayahTokenIdByAyah, onTokenHover]);

  const handleRootNodeHover = useCallback((ayah: number | null, root: string | null) => {
    setHoveredRoot((prev) => (prev === root ? prev : root));
    handleBarHover(ayah);
  }, [handleBarHover]);

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

  const handleRootNodeSelect = (
    event: MouseEvent<SVGCircleElement | SVGTextElement>,
    ayah: number,
    root: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedConnection(null);
    setHoveredConnection(null);
    setHoveredRoot(root);
    if (onRootSelect) onRootSelect(root);
    handleAyahSelect(ayah, root);
  };

  const handleZoomStep = useCallback((factor: number) => {
    zoomBy(factor);
  }, [zoomBy]);

  const allowConnectionAnimation = shouldAnimateConnections && renderedConnections.length <= 280;
  const allowBarAnimation = shouldAnimateBars && ayahCount <= 120;

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
            {/* Zoom controls */}
            <div className="viz-left-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="eyebrow" style={{ fontSize: '0.7em' }}>{ts('zoom')}</span>
                <span style={{ fontSize: '0.72em', opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>{Math.round(zoomScale * 100)}%</span>
              </div>
              <div className="viz-zoom-row">
                <button
                  type="button"
                  className="viz-zoom-btn"
                  onClick={() => handleZoomStep(1.3)}
                  aria-label={t('zoomIn')}
                >
                  +
                </button>
                <button
                  type="button"
                  className="viz-zoom-btn"
                  onClick={() => handleZoomStep(0.75)}
                  aria-label={t('zoomOut')}
                >
                  &minus;
                </button>
                <button type="button" className="viz-zoom-reset-btn" onClick={resetZoom}>
                  {ts('reset')}
                </button>
              </div>
              <span style={{ fontSize: '0.65em', opacity: 0.45, marginTop: 4, display: 'block' }}>
                {t('dragPan')}
              </span>
            </div>

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
                  {selectedAyahRootEntries.length > 0 && (
                    <div style={{ marginTop: "0.7rem", display: "grid", gap: "0.45rem" }}>
                      <span
                        className="viz-tooltip-label"
                        style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
                      >
                        {ts("roots")}
                      </span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                        {selectedAyahRootEntries.map((entry) => {
                          const chipColor = getRootBaseColor(entry.root, entry.globalCount);
                          const isDimmed = !!highlightRoot && entry.root !== highlightRoot;
                          return (
                            <button
                              type="button"
                              key={`${selectedAyah}-${entry.root}`}
                              onClick={() => {
                                if (!selectedAyah) return;
                                setSelectedConnection(null);
                                setHoveredConnection(null);
                                setHoveredRoot(entry.root);
                                if (onRootSelect) onRootSelect(entry.root);
                                handleAyahSelect(selectedAyah, entry.root);
                              }}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.28rem",
                                borderRadius: 999,
                                border: "1px solid var(--line)",
                                background: "color-mix(in srgb, var(--surface), transparent 18%)",
                                color: "var(--ink-secondary)",
                                padding: "0.12rem 0.44rem",
                                fontSize: "0.75rem",
                                cursor: "pointer",
                                opacity: isDimmed ? 0.45 : 1,
                              }}
                            >
                              <span
                                aria-hidden
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  background: isDimmed
                                    ? (theme === "dark" ? "rgba(255,255,255,0.2)" : "rgba(31, 28, 25, 0.2)")
                                    : chipColor,
                                }}
                              />
                              <span className="arabic-text">{entry.root}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
              {lexicalColorMode === "theme" ? (
                <>
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
                </>
              ) : lexicalColorMode === "frequency" ? (
                <>
                  <div className="viz-legend-item">
                    <div className="viz-legend-dot" style={{ background: getFrequencyColor(0.2, theme) }} />
                    <span>{ts("lowerFrequency")}</span>
                  </div>
                  <div className="viz-legend-item">
                    <div className="viz-legend-dot" style={{ background: getFrequencyColor(0.9, theme) }} />
                    <span>{ts("higherFrequency")}</span>
                  </div>
                </>
              ) : (
                <div className="viz-legend-item">
                  <div className="viz-legend-dot" style={{ background: getIdentityColor("radial-identity", theme) }} />
                  <span>{ts("rootIdentity")}</span>
                </div>
              )}
              <div className="viz-legend-item">
                <div
                  className="viz-legend-line"
                  style={{
                    background:
                      lexicalColorMode === "theme"
                        ? "url(#connectionGrad)"
                        : lexicalColorMode === "frequency"
                          ? `linear-gradient(90deg, ${getFrequencyColor(0.2, theme)}, ${getFrequencyColor(0.9, theme)})`
                          : `linear-gradient(90deg, ${getIdentityColor("radial-a", theme)}, ${getIdentityColor("radial-b", theme)})`,
                  }}
                />
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

      <div className="viz-controls floating-controls">
        <div className="ayah-meta-wrapper">
          <button
            className="kg-reset-btn"
            onClick={resetZoom}
            title="Focus View"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 14v4h4M20 10V6h-4M4 10V6h4M20 14v4h-4M10 10l-6-6M14 14l6 6M10 14l-6 6M14 10l6-6" />
            </svg>
          </button>
        </div>
      </div>

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
                {renderedConnections.map((conn, idx) => {
                  const isActiveAyah =
                    !!activeAyah && (conn.sourceAyah === activeAyah || conn.targetAyah === activeAyah);
                  const countColor = isActiveAyah ? activeRootColorMap?.get(conn.root) ?? null : null;
                  const isHighlighted = hoveredRoot === conn.root || isActiveAyah;
                  const pathKey = `${conn.sourceAyah}-${conn.targetAyah}`;
                  const pathD = connectionPaths.get(pathKey) ?? "";

                  const strokeColor = countColor ??
                    (isHighlighted
                      ? themeColors.accent
                      : lexicalColorMode === "theme"
                        ? "url(#connectionGrad)"
                        : conn.color);

                  return (
                    <g key={`${conn.sourceAyah}-${conn.targetAyah}-${conn.root}`}>
                      {allowConnectionAnimation ? (
                        <motion.path
                          d={pathD}
                          className={`connection ${isHighlighted ? "highlighted" : ""}`}
                          stroke={strokeColor}
                          strokeWidth={isHighlighted ? 2.5 : 1.5}
                          fill="none"
                          pointerEvents="none"
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: isHighlighted ? 1 : 0.3 }}
                          transition={{ duration: 1.1, delay: idx * 0.012 }}
                          filter={isHighlighted ? "url(#glow)" : undefined}
                          onMouseEnter={() => handleConnectionHover(conn)}
                          onMouseLeave={() => handleConnectionHover(null)}
                        />
                      ) : (
                        <path
                          d={pathD}
                          className={`connection ${isHighlighted ? "highlighted" : ""}`}
                          stroke={strokeColor}
                          strokeWidth={isHighlighted ? 2.5 : 1.5}
                          style={{ opacity: isHighlighted ? 1 : 0.3 }}
                          fill="none"
                          pointerEvents="none"
                          filter={isHighlighted ? "url(#glow)" : undefined}
                          onMouseEnter={() => handleConnectionHover(conn)}
                          onMouseLeave={() => handleConnectionHover(null)}
                        />
                      )}
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
                {barsForRender.map(({ bar, angleRad, startX, startY, endX, endY, visibleRootNodes, isFocusedAyah }, barIndex) => {
                  const isSelected = selectedAyah === bar.ayah;
                  const labelAnchor = angleRad > Math.PI / 2 && angleRad < (3 * Math.PI) / 2 ? "end" : "start";

                  const barContent = (
                    <>
                      <line
                        x1={startX}
                        y1={startY}
                        x2={endX}
                        y2={endY}
                        className="bar colored"
                        stroke={isSelected ? themeColors.accent : bar.color}
                        strokeWidth={isSelected ? barStrokeWidth + 1.4 : barStrokeWidth}
                        strokeLinecap="round"
                        filter={isSelected ? "url(#strongGlow)" : undefined}
                        style={{ cursor: "pointer" }}
                        onMouseEnter={() => handleBarHover(bar.ayah)}
                        onMouseLeave={() => handleBarHover(null)}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedConnection(null);
                          setHoveredConnection(null);
                          handleAyahSelect(bar.ayah);
                        }}
                      />
                      {visibleRootNodes.map((node, nodeIndex) => {
                        const isRootHighlighted = hoveredRoot === node.root || highlightRoot === node.root;
                        const isDimmed = !!highlightRoot && node.root !== highlightRoot;
                        const displayRadius = isRootHighlighted ? node.r + 0.7 : node.r;
                        const tintColor = isDimmed
                          ? (theme === "dark" ? "rgba(255,255,255,0.14)" : "rgba(31, 28, 25, 0.2)")
                          : node.baseColor;
                        const highlightedRootColor = theme === "dark" ? "#FFD166" : "#E27B13";

                        const shouldShowRootLabel =
                          isRootHighlighted ||
                          (showAllRootLabels && displayRadius >= 1.75) ||
                          (showContextRootLabels && isFocusedAyah && displayRadius >= 1.55);
                        const labelYOffset = showAllRootLabels ? (nodeIndex % 2 === 0 ? -0.75 : 0.75) : 0;
                        const rootLabelFontSize = showAllRootLabels
                          ? (compactLayout ? 7.6 : 8.2)
                          : (compactLayout ? 6.8 : 7.2);

                        return (
                          <g key={`${bar.ayah}-${node.root}`}>
                            <circle
                              cx={node.x}
                              cy={node.y}
                              r={displayRadius}
                              fill="transparent"
                              stroke={isRootHighlighted ? highlightedRootColor : tintColor}
                              strokeWidth={isRootHighlighted ? 2.5 : 1.8}
                              opacity={isDimmed ? 0.35 : 0.9}
                              filter={isRootHighlighted ? "url(#glow)" : undefined}
                              style={{ cursor: "pointer" }}
                              onMouseEnter={() => handleRootNodeHover(bar.ayah, node.root)}
                              onMouseLeave={() => handleRootNodeHover(null, null)}
                              onClick={(event) => handleRootNodeSelect(event, bar.ayah, node.root)}
                            />
                            {shouldShowRootLabel && (
                              <text
                                x={node.labelX}
                                y={node.labelY + labelYOffset}
                                textAnchor={labelAnchor}
                                className="arabic-text"
                                fill={
                                  isRootHighlighted
                                    ? highlightedRootColor
                                    : theme === "dark"
                                      ? "rgba(255,255,255,0.78)"
                                      : "rgba(31, 28, 25, 0.78)"
                                }
                                fontSize={rootLabelFontSize}
                                fontWeight={isRootHighlighted ? 600 : 500}
                                pointerEvents="none"
                              >
                                {node.root}
                              </text>
                            )}
                          </g>
                        );
                      })}
                      {/* Small circle at the end of bar */}
                      <circle
                        cx={endX}
                        cy={endY}
                        r={isSelected ? endpointRadius + 1.5 : endpointRadius}
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
                          setSelectedConnection(null);
                          setHoveredConnection(null);
                          handleAyahSelect(bar.ayah);
                        }}
                      />
                      {(() => {
                        const labelRadius = innerRadius + bar.barHeight + (compactLayout ? 14 : 18);
                        const labelX = centerX + Math.cos(angleRad) * labelRadius;
                        const labelY = centerY + Math.sin(angleRad) * labelRadius;
                        const isEmphasized =
                          highlightAyahSet.has(bar.ayah) ||
                          bar.ayah === selectedAyah ||
                          bar.ayah === hoveredAyah;
                        const sparseInterval =
                          ayahCount > 180 ? 12 :
                            ayahCount > 120 ? 8 :
                              ayahCount > 80 ? 6 :
                                ayahCount > 50 ? 4 : 2;
                        const passesSparseFilter = barIndex % sparseInterval === 0;
                        const shouldShowAyahLabel =
                          isEmphasized ||
                          zoomScale >= 2.4 ||
                          (zoomScale >= 1.5 && passesSparseFilter);
                        if (!shouldShowAyahLabel) return null;
                        return (
                          <text
                            x={labelX}
                            y={labelY}
                            textAnchor={labelAnchor}
                            fill={
                              isEmphasized
                                ? theme === "dark"
                                  ? "rgba(255,255,255,0.95)"
                                  : "rgba(31, 28, 25, 0.95)"
                                : theme === "dark"
                                  ? "rgba(255,255,255,0.22)"
                                  : "rgba(31, 28, 25, 0.36)"
                            }
                            fontSize={isEmphasized ? (compactLayout ? "9.5" : "11.5") : (compactLayout ? "8.5" : "10")}
                            fontWeight={isEmphasized ? 600 : 400}
                            style={{ pointerEvents: "none" }}
                          >
                            {bar.ayah}
                          </text>
                        );
                      })()}
                    </>
                  );

                  return allowBarAnimation ? (
                    <motion.g
                      key={bar.ayah}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: bar.ayah * 0.012 }}
                    >
                      {barContent}
                    </motion.g>
                  ) : (
                    <g key={bar.ayah}>
                      {barContent}
                    </g>
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
