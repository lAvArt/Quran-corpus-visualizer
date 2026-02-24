"use client";

import { useRef, useMemo, useState, useCallback, useEffect, useDeferredValue, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import * as d3 from "d3";
import type { CorpusToken } from "@/lib/schema/types";
import { getAyah } from "@/lib/corpus/corpusLoader";
import { getNodeColor, GRADIENT_PALETTES, resolveVisualizationTheme } from "@/lib/schema/visualizationTypes";
import { getFrequencyColor, getIdentityColor, type LexicalColorMode } from "@/lib/theme/lexicalColoring";
import { useLocale, useTranslations } from "next-intl";
import { useVizControl } from "@/lib/hooks/VizControlContext";
import { VizExplainerDialog, HelpIcon } from "@/components/ui/VizExplainerDialog";

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
  lexicalColorMode?: LexicalColorMode;
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

const POS_LABELS: Record<string, string> = {
  N: "noun",
  V: "verb",
  ADJ: "adjective",
  PRON: "pronoun",
  P: "preposition",
  PART: "particle",
  CONJ: "conjunction",
};

function getPosLabel(pos: string, ts: (key: string) => string): string {
  const key = POS_LABELS[pos];
  return key ? ts(key) : pos;
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
  lexicalColorMode = "theme",
}: ArcFlowDiagramProps) {
  const t = useTranslations("Visualizations.ArcFlow");
  const ts = useTranslations("Visualizations.Shared");
  const locale = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [zoomLevel, setZoomLevel] = useState(0.92);
  const { isLeftSidebarOpen } = useVizControl();

  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [activeGroupBy, setActiveGroupBy] = useState(groupBy);
  const [dimensions, setDimensions] = useState({ width: 1400, height: 900 });

  const [isMounted, setIsMounted] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [fullAyahText, setFullAyahText] = useState<string | null>(null);
  const [rootSearchQuery, setRootSearchQuery] = useState("");
  const deferredRootSearch = useDeferredValue(rootSearchQuery);
  const [internalSelectedRoot, setInternalSelectedRoot] = useState<string | null>(null);

  useEffect(() => {
    if (selectedSurahId && selectedAyah) {
      getAyah(selectedSurahId, selectedAyah).then((record) => {
        setFullAyahText(record ? record.textUthmani : null);
      });
    } else {
      setFullAyahText(null);
    }
  }, [selectedSurahId, selectedAyah]);

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
    if (typeof document === "undefined") return;
    const sidebarPortal = document.getElementById("viz-sidebar-portal");
    if (!sidebarPortal) return;

    sidebarPortal.classList.add("arcflow-scrollless");
    return () => {
      sidebarPortal.classList.remove("arcflow-scrollless");
    };
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

  const themeColors = resolveVisualizationTheme(theme);

  const scopedTokens = useMemo(() => {
    if (!selectedSurahId) return tokens;
    return tokens.filter((token) => token.sura === selectedSurahId);
  }, [tokens, selectedSurahId]);

  // All available roots with counts for root search
  const allRootsSorted = useMemo(() => {
    const rootMap = new Map<string, { total: number; gloss: string }>();
    scopedTokens.forEach(t => {
      if (!t.root) return;
      if (!rootMap.has(t.root)) {
        rootMap.set(t.root, { total: 0, gloss: t.morphology?.gloss ?? "" });
      }
      const entry = rootMap.get(t.root)!;
      entry.total++;
    });
    return Array.from(rootMap.entries())
      .map(([root, stats]) => ({ root, total: stats.total, gloss: stats.gloss }))
      .sort((a, b) => b.total - a.total);
  }, [scopedTokens]);

  const filteredRoots = useMemo(() => {
    if (!deferredRootSearch.trim()) return [];
    const q = deferredRootSearch.trim();
    return allRootsSorted
      .filter(r => r.root.includes(q) || r.gloss.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 20);
  }, [deferredRootSearch, allRootsSorted]);

  // The effective root for highlighting: user search selection OR prop
  const effectiveSelectedRoot = internalSelectedRoot || selectedRoot;

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

    if (activeGroupBy === "root" && effectiveSelectedRoot && groups.has(effectiveSelectedRoot)) {
      const isIncluded = sortedGroups.some(([key]) => key === effectiveSelectedRoot);
      if (!isIncluded) {
        const selectedEntry: [string, (typeof sortedGroups)[number][1]] = [
          effectiveSelectedRoot,
          groups.get(effectiveSelectedRoot)!,
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
      const frequencyRatio = Math.log1p(data.count) / Math.log1p(maxGroupCount || 1);
      const identityRatio = sortedGroups.length > 1 ? idx / (sortedGroups.length - 1) : 0.5;
      const rootIdentityColor = d3.interpolateSinebow(0.08 + identityRatio * 0.84);
      const rootFrequencyColor = d3.interpolateRgbBasis([
        "#a21caf",
        "#7c3aed",
        "#2563eb",
        "#06b6d4",
      ])(frequencyRatio);

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
        color: activeGroupBy === "pos"
          ? getNodeColor(key)
          : activeGroupBy === "root"
            ? lexicalColorMode === "frequency"
              ? getFrequencyColor(frequencyRatio, theme)
              : lexicalColorMode === "identity"
                ? getIdentityColor(key, theme)
                : d3.interpolateRgb(rootFrequencyColor, rootIdentityColor)(0.4)
            : d3.interpolateRgbBasis(GRADIENT_PALETTES.vibrant)(identityRatio),
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
    effectiveSelectedRoot,
    selectedAyah,
    selectedSurahId,
    hasContextSelection,
    tokenMatchesContext,
    maxBarHeightForLayout,
    themeColors.nodeColors.default,
    lexicalColorMode,
    theme,
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
    if (selectedSurahId) items.push({ label: ts("surah"), value: String(selectedSurahId) });
    if (selectedAyah) items.push({ label: ts("ayah"), value: String(selectedAyah) });
    if (selectedRoot) items.push({ label: ts("root"), value: selectedRoot });
    if (selectedLemma) items.push({ label: ts("lemma"), value: selectedLemma });
    return items;
  }, [selectedSurahId, selectedAyah, selectedRoot, selectedLemma, ts]);

  const activeGroupLabel =
    activeGroupBy === "root" ? ts("root") : activeGroupBy === "pos" ? ts("pos") : ts("ayah");
  const scopeLabel = selectedSurahId ? `${ts("surah")} ${selectedSurahId}` : "global corpus";
  const modeDescription =
    activeGroupBy === "root"
      ? t("linksRoot")
      : activeGroupBy === "pos"
        ? t("linksPOS")
        : t("linksAyah");

  const sidebarCards = (
    <div className={`viz-left-stack arcflow-sidebar-stack ${!isLeftSidebarOpen ? 'collapsed' : ''}`}>

      <div className="viz-left-panel" style={{ display: "grid", gap: "10px" }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 4 }}>{t("title")}</p>
          <h2 style={{ margin: 0 }}>{t("title")}</h2>
        </div>

        <div style={{ fontSize: "0.83rem", color: "var(--ink-secondary)" }}>
          {t("groups", { count: nodes.length, linkCount: connections.length })}
        </div>

        <div className="mode-switcher">
          <button
            className={`mode-switcher-btn ${activeGroupBy === "root" ? "active" : ""}`}
            onClick={() => setActiveGroupBy("root")}
          >
            {t("byRoot")}
          </button>
          <button
            className={`mode-switcher-btn ${activeGroupBy === "pos" ? "active" : ""}`}
            onClick={() => setActiveGroupBy("pos")}
          >
            {t("byPOS")}
          </button>
          <button
            className={`mode-switcher-btn ${activeGroupBy === "ayah" ? "active" : ""}`}
            onClick={() => setActiveGroupBy("ayah")}
          >
            {t("byAyah")}
          </button>
        </div>

        <div style={{ display: "grid", gap: "6px", fontSize: "0.78rem", color: "var(--ink-muted)" }}>
          <span>{t("groupedBy", { value: activeGroupLabel })}</span>
          <span>{t("scope", { value: scopeLabel })}</span>
          {selectedAyah ? <span>{t("ayahContext", { value: selectedAyah })}</span> : null}
          <span>{ts("surah")} tokens: {scopedTokens.length.toLocaleString()}</span>
          <span>{t("contextLinks")}: {contextTokenCount.toLocaleString()}</span>
          <span>{t("zoom", { value: Math.round(zoomLevel * 100) })}</span>
          <span style={{ lineHeight: 1.4 }}>{modeDescription}</span>
          {activeGroupBy === "pos" ? (
            <span style={{ lineHeight: 1.35 }}>
              {t("posMapping")}
            </span>
          ) : null}
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
              {ts("reset")}
            </button>
          </div>
          <span style={{ fontSize: "0.74rem", color: "var(--ink-muted)" }}>
            {t("modeDescription")}
          </span>
        </div>
      </div>

      {/* Root Search - only in root mode */}
      {activeGroupBy === "root" && (
        <div className="viz-left-panel" style={{ display: "grid", gap: "8px" }}>
          <div className="viz-root-search">
            <span className="viz-root-search-label">{t("searchRoot")}</span>
            <input
              type="text"
              className="viz-root-search-input"
              placeholder={t("searchRootPlaceholder")}
              value={rootSearchQuery}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setRootSearchQuery(e.target.value)}
              aria-label={t("searchRoot")}
            />
            {filteredRoots.length > 0 && (
              <div className="viz-root-search-results" role="listbox" aria-label={t("searchRoot")}>
                {filteredRoots.map(r => (
                  <button
                    key={r.root}
                    className={`viz-root-search-item ${internalSelectedRoot === r.root ? 'active' : ''}`}
                    role="option"
                    aria-selected={internalSelectedRoot === r.root}
                    onClick={() => {
                      setInternalSelectedRoot(prev => prev === r.root ? null : r.root);
                      setRootSearchQuery("");
                    }}
                  >
                    <span className="root-name">{r.root}</span>
                    <span className="root-count">{r.total.toLocaleString(locale)}{r.gloss ? ` · ${r.gloss}` : ''}</span>
                  </button>
                ))}
              </div>
            )}
            {rootSearchQuery.trim() && filteredRoots.length === 0 && (
              <span className="viz-root-search-hint">{t("noRootFound")}</span>
            )}
            {!rootSearchQuery.trim() && (
              <span className="viz-root-search-hint">
                {t("searchRootHint", { count: allRootsSorted.length })}
              </span>
            )}
            {internalSelectedRoot && (
              <button
                className="viz-root-search-item active"
                style={{ marginTop: 4 }}
                onClick={() => setInternalSelectedRoot(null)}
              >
                <span className="root-name">{internalSelectedRoot}</span>
                <span className="root-count">{ts("clear")}</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="viz-left-panel" style={{ display: "grid", gap: "8px" }}>
        <div className="viz-tooltip-title" style={{ fontSize: "0.92rem" }}>{t("linkedSelection")}</div>
        {selectedSummary.length > 0 ? (
          <div style={{ display: "grid", gap: "6px" }}>
            {selectedSummary.map((item) => (
              <div key={item.label} className="viz-tooltip-row" style={{ borderTop: "none", padding: 0 }}>
                <span className="viz-tooltip-label">{item.label}</span>
                <span className="viz-tooltip-value arabic-text">{item.value}</span>
              </div>
            ))}

            {fullAyahText && (
              <div className="viz-tooltip-subtitle arabic-text" style={{
                marginTop: '0.5rem',
                fontSize: '1.3rem',
                lineHeight: '1.6',
                textAlign: 'right',
                direction: 'rtl',
                width: '100%',
                color: 'var(--ink-primary)',
                paddingTop: '0.5rem',
                borderTop: '1px solid var(--line)',
              }}>
                {fullAyahText}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>
            {t("noSelection")}
          </div>
        )}
      </div>

      <div className="viz-legend">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', justifyContent: 'space-between', width: '100%' }}>
          <span className="eyebrow" style={{ fontSize: '0.7em' }}>{ts("legend")}</span>
          <HelpIcon onClick={() => setShowHelp(true)} />
        </div>
        <div className="viz-legend-item">
          <div
            className="viz-legend-line"
            style={{
              background: activeGroupBy === "root"
                ? lexicalColorMode === "frequency"
                  ? `linear-gradient(90deg, ${getFrequencyColor(0.05, theme)}, ${getFrequencyColor(0.45, theme)}, ${getFrequencyColor(0.95, theme)})`
                  : lexicalColorMode === "identity"
                    ? `linear-gradient(90deg, ${getIdentityColor("root-a", theme)}, ${getIdentityColor("root-b", theme)}, ${getIdentityColor("root-c", theme)})`
                    : "linear-gradient(90deg, #a21caf, #7c3aed, #2563eb, #06b6d4)"
                : `linear-gradient(90deg, ${GRADIENT_PALETTES.vibrant.join(", ")})`,
            }}
          />
          <span>
            {activeGroupBy === "root"
              ? t("rootLegend")
              : t("posLegend")}
          </span>
        </div>
        <div className="viz-legend-item">
          <div className="viz-legend-line" style={{ background: themeColors.accentSecondary }} />
          <span>{t("contextLinks")}</span>
        </div>
        <div className="viz-legend-item">
          <div className="viz-legend-dot" style={{ background: themeColors.accent, width: 12, height: 12 }} />
          <span>{t("activeNode")}</span>
        </div>
        <div className="viz-legend-item">
          <div
            className="viz-legend-dot"
            style={{
              background: theme === "dark" ? "rgba(255,255,255,0.8)" : "rgba(31, 28, 25, 0.55)",
              width: 10,
              height: 10,
            }}
          />
          <span>{t("contextMatch")}</span>
        </div>
        <div className="viz-legend-item">
          <div
            className="viz-legend-line"
            style={{
              background: theme === "dark" ? "rgba(255,255,255,0.35)" : "rgba(31, 28, 25, 0.35)",
              height: 2,
            }}
          />
          <span>
            {activeGroupBy === "root"
              ? t("linksRoot")
              : activeGroupBy === "pos"
                ? t("linksPOS")
                : t("linksAyah")}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <section className="immersive-viz" data-theme={theme} style={{ width: "100%", height: "100%", position: "relative" }}>
      {isMounted && typeof document !== "undefined" && document.getElementById("viz-sidebar-portal")
        ? createPortal(sidebarCards, document.getElementById("viz-sidebar-portal")!)
        : null}

      <VizExplainerDialog
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        content={{
          title: t("Help.title"),
          description: t("Help.description"),
          sections: [
            { label: t("Help.rootLabel"), text: t("Help.rootText") },
            { label: t("Help.posLabel"), text: t("Help.posText") },
            { label: t("Help.ayahLabel"), text: t("Help.ayahText") },
            { label: t("Help.tipsLabel"), text: t("Help.tipsText") },
          ]
        }}
        theme={theme}
      />

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
                stroke={theme === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(31, 28, 25, 0.12)"}
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

                  const showLabel =
                    isHovered ||
                    isContextNode ||
                    (activeGroupBy === "pos") ||
                    (activeGroupBy === "root"
                      ? (idx < 18 || zoomLevel > 1 || node.count > maxCount * 0.18)
                      : node.count > maxCount * 0.45);
                  const labelOffset = activeGroupBy === "root" ? 16 : 14;
                  const labelX = barEndX + Math.cos(pos.angle) * labelOffset;
                  const labelY = barEndY + Math.sin(pos.angle) * labelOffset;
                  const labelOnLeft = pos.angle > Math.PI / 2 || pos.angle < -Math.PI / 2;

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
                          stroke={theme === "dark" ? "rgba(255,255,255,0.6)" : "rgba(31, 28, 25, 0.38)"}
                          strokeWidth={1.2}
                        />
                      )}

                      {showLabel && (
                        <motion.text
                          x={labelX}
                          y={labelY}
                          fill={themeColors.textColors.secondary}
                          fontSize={isHovered || isContextNode ? 12 : activeGroupBy === "root" ? 11 : 10}
                          fontWeight={isHovered || isContextNode ? 600 : 400}
                          textAnchor={labelOnLeft ? "end" : "start"}
                          className="arabic-text"
                          style={{
                            paintOrder: "stroke",
                            stroke: theme === "dark" ? "rgba(12, 12, 18, 0.85)" : "rgba(248, 244, 236, 0.88)",
                            strokeWidth: 2.4,
                          }}
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
                {activeGroupBy === "root" ? ts("root") : activeGroupBy === "pos" ? ts("pos") : ts("ayah")}
              </div>
              {activeGroupBy === "pos" ? (
                <div className="viz-tooltip-row">
                  <span className="viz-tooltip-label">{t("posMeaning")}</span>
                  <span className="viz-tooltip-value">{getPosLabel(hoveredNodeData.label, ts)}</span>
                </div>
              ) : null}
              <div className="viz-tooltip-row">
                <span className="viz-tooltip-label">{ts("occurrences")}</span>
                <span className="viz-tooltip-value">{hoveredNodeData.count}</span>
              </div>
              {hoveredNodeData.matchCount > 0 && (
                <div className="viz-tooltip-row">
                  <span className="viz-tooltip-label">{t("contextMatches")}</span>
                  <span className="viz-tooltip-value">{hoveredNodeData.matchCount}</span>
                </div>
              )}
              {hoveredNodeData.sampleToken && (
                <>
                  <div className="viz-tooltip-row">
                    <span className="viz-tooltip-label">{ts("lemma")}</span>
                    <span className="viz-tooltip-value arabic-text">{hoveredNodeData.sampleToken.text}</span>
                  </div>
                  <div className="viz-tooltip-row">
                    <span className="viz-tooltip-label">{ts("ref")}</span>
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

      <style jsx global>{`
        .viz-sidebar-stack.arcflow-scrollless {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .viz-sidebar-stack.arcflow-scrollless::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }
      `}</style>
    </section>
  );
}
