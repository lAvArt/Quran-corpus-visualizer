"use client";

import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

import * as d3 from "d3";
import { SURAH_NAMES } from "@/lib/data/surahData";
import { getAyah } from "@/lib/corpus/corpusLoader";
import { quranApi, type QuranWord } from "@/lib/api/quranApi";
import type { CorpusToken, AyahDependencyData, DependencyEdge } from "@/lib/schema/types";
import { getNodeColor } from "@/lib/schema/visualizationTypes";
import { getFrequencyColor, getIdentityColor, type LexicalColorMode } from "@/lib/theme/lexicalColoring";
import { useVizControl } from "@/lib/hooks/VizControlContext";
import { VizExplainerDialog, HelpIcon } from "@/components/ui/VizExplainerDialog";

interface AyahDependencyGraphProps {
  tokens: CorpusToken[];
  selectedSurahId: number;
  selectedAyah?: number | null;
  onTokenHover: (tokenId: string | null) => void;
  onTokenFocus: (tokenId: string) => void;
  onSurahChange?: (surahId: number) => void;
  theme?: "light" | "dark";
  lexicalColorMode?: LexicalColorMode;
}

interface RelationMeta {
  short: string;
  arabic: string;
}

interface EdgeLayout {
  edge: DependencyEdge;
  startX: number;
  endX: number;
  startY: number;
  midX: number;
  controlY: number;
  labelControlY: number;
  arcPath: string;
  labelPath: string;
  labelPathId: string;
  labelText: string;
}

const RELATION_META: Record<string, RelationMeta> = {
  pred: { short: "PRED", arabic: "خبر/مسند" },
  nom: { short: "NOM", arabic: "اسمي" },
  arg: { short: "ARG", arabic: "معمول/مفعول" },
  part: { short: "PART", arabic: "حرف/أداة" },
  attr: { short: "ATTR", arabic: "نعت" },
  dep: { short: "DEP", arabic: "تعلق" },
};

function relationForPos(pos: CorpusToken["pos"]): string {
  if (pos === "V") return "pred";
  if (pos === "PRON") return "arg";
  if (pos === "N") return "nom";
  if (pos === "P") return "part";
  if (pos === "ADJ") return "attr";
  return "dep";
}

function buildFallbackDependencies(ayahId: string, ayahTokens: CorpusToken[]): DependencyEdge[] {
  if (ayahTokens.length < 2) return [];

  const headToken =
    ayahTokens.find((token) => token.pos === "V") ??
    ayahTokens[Math.max(0, Math.floor(ayahTokens.length / 2))];

  return ayahTokens
    .filter((token) => token.id !== headToken.id)
    .map((token) => ({
      id: `${ayahId}:dep:${token.position}`,
      ayahId,
      dependentTokenId: token.id,
      headTokenId: headToken.id,
      relation: relationForPos(token.pos),
    }));
}

function getRelationMeta(relation: string): RelationMeta {
  const key = relation.toLowerCase();
  const fallback: RelationMeta = { short: relation.toUpperCase(), arabic: "علاقة نحوية" };
  return RELATION_META[key] ?? fallback;
}

export default function AyahDependencyGraph({
  tokens,
  selectedSurahId,
  selectedAyah,
  onTokenHover,
  onTokenFocus,
  onSurahChange,
  theme = "dark",
  lexicalColorMode = "theme",
}: AyahDependencyGraphProps) {
  const t = useTranslations("Visualizations.AyahDependency");
  const ts = useTranslations("Visualizations.Shared");
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomLayerRef = useRef<SVGGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [activeSurah, setActiveSurah] = useState<number>(selectedSurahId);
  const [activeAyah, setActiveAyah] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 620 });
  const [isMounted, setIsMounted] = useState(false);
  const [fullAyahText, setFullAyahText] = useState<string | null>(null);
  const [ayahWords, setAyahWords] = useState<Map<number, QuranWord>>(new Map());
  const { isLeftSidebarOpen } = useVizControl();

  useEffect(() => {
    setActiveSurah(selectedSurahId);
  }, [selectedSurahId]);

  // Fetch the real Uthmani ayah text (with tashkeel) and per-word Arabic from the API
  useEffect(() => {
    if (activeSurah && activeAyah) {
      // Fetch full ayah text from corpus loader
      getAyah(activeSurah, activeAyah).then(record => {
        setFullAyahText(record ? record.textUthmani : null);
      });
      // Fetch per-word Arabic text from Quran.com API
      const verseKey = `${activeSurah}:${activeAyah}`;
      quranApi.getVerse(verseKey, { words: true, wordFields: ["text_uthmani"] }).then(verse => {
        const wordMap = new Map<number, QuranWord>();
        if (verse.words) {
          for (const w of verse.words) {
            if (w.char_type_name === "word") {
              wordMap.set(w.position, w);
            }
          }
        }
        setAyahWords(wordMap);
      }).catch(() => {
        setAyahWords(new Map());
      });
    } else {
      setFullAyahText(null);
      setAyahWords(new Map());
    }
  }, [activeSurah, activeAyah]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSurahChange = useCallback(
    (surahId: number) => {
      setActiveSurah(surahId);
      onSurahChange?.(surahId);
    },
    [onSurahChange]
  );

  const surahTokens = useMemo(
    () => tokens.filter((token) => token.sura === activeSurah),
    [tokens, activeSurah]
  );

  const availableAyahs = useMemo(() => {
    const ayahs = new Set<number>();
    for (const token of surahTokens) ayahs.add(token.ayah);
    return [...ayahs].sort((a, b) => a - b);
  }, [surahTokens]);

  useEffect(() => {
    if (availableAyahs.length === 0) {
      setActiveAyah(null);
      return;
    }

    if (selectedAyah && availableAyahs.includes(selectedAyah)) {
      setActiveAyah(selectedAyah);
      return;
    }

    setActiveAyah((prev) => (prev && availableAyahs.includes(prev) ? prev : availableAyahs[0]));
  }, [availableAyahs, selectedAyah, activeSurah]);

  const data = useMemo<AyahDependencyData | null>(() => {
    if (!activeAyah) return null;

    const ayahTokens = surahTokens
      .filter((token) => token.ayah === activeAyah)
      .sort((a, b) => a.position - b.position);

    if (ayahTokens.length === 0) return null;

    const ayahId = `${activeSurah}:${activeAyah}`;
    const textUthmani = ayahTokens.map((token) => token.text).join(" ");

    return {
      ayah: {
        id: ayahId,
        suraId: activeSurah,
        ayahNumber: activeAyah,
        textUthmani,
        tokenIds: ayahTokens.map((token) => token.id),
      },
      tokens: ayahTokens,
      dependencies: buildFallbackDependencies(ayahId, ayahTokens),
    };
  }, [activeAyah, activeSurah, surahTokens]);

  const sortedTokens = useMemo(
    () => [...(data?.tokens ?? [])].sort((a, b) => a.position - b.position),
    [data]
  );

  const tokenMap = useMemo(() => new Map(sortedTokens.map((token) => [token.id, token])), [sortedTokens]);
  const rootTokenCounts = useMemo(() => {
    const counts = new Map<string, number>();
    sortedTokens.forEach((token) => {
      if (!token.root) return;
      counts.set(token.root, (counts.get(token.root) ?? 0) + 1);
    });
    return counts;
  }, [sortedTokens]);
  const maxRootTokenCount = useMemo(() => Math.max(1, ...Array.from(rootTokenCounts.values())), [rootTokenCounts]);
  const lexicalNodeColor = useCallback(
    (token: CorpusToken): string => {
      if (lexicalColorMode === "theme" || !token.root) return getNodeColor(token.pos);
      if (lexicalColorMode === "identity") return getIdentityColor(token.root, theme);
      const ratio = Math.log1p(rootTokenCounts.get(token.root) ?? 1) / Math.log1p(maxRootTokenCount || 1);
      return getFrequencyColor(ratio, theme);
    },
    [lexicalColorMode, maxRootTokenCount, rootTokenCounts, theme]
  );

  const nodeWidth = 150;
  const nodeHeight = 104;
  const spacing = 170;
  const horizontalPadding = 120;
  const graphWidth = Math.max(dimensions.width, sortedTokens.length * spacing + horizontalPadding * 2);
  const graphHeight = Math.max(dimensions.height, 620);
  const baseY = Math.max(320, Math.min(graphHeight - 170, graphHeight * 0.68));
  const tokenTopY = baseY - nodeHeight / 2 - 8;
  const tokenXById = useMemo(() => {
    const xById = new Map<string, number>();
    sortedTokens.forEach((token, idx) => {
      // Quranic Arabic reading order is RTL, so render token 1 on the right.
      const rtlIndex = sortedTokens.length - 1 - idx;
      xById.set(token.id, horizontalPadding + rtlIndex * spacing);
    });
    return xById;
  }, [sortedTokens, horizontalPadding, spacing]);

  const edgeLayouts = useMemo<EdgeLayout[]>(() => {
    if (!data) return [];

    return data.dependencies
      .map((edge, idx) => {
        const dependent = tokenMap.get(edge.dependentTokenId);
        const head = tokenMap.get(edge.headTokenId);
        if (!dependent || !head) return null;

        const startX = tokenXById.get(dependent.id);
        const endX = tokenXById.get(head.id);
        if (startX == null || endX == null) return null;
        const span = Math.abs(endX - startX);
        const midX = (startX + endX) / 2;
        const controlY = tokenTopY - (54 + span * 0.22);
        const labelControlY = controlY - (30 + span * 0.08);

        const arcPath = `M ${startX} ${tokenTopY} Q ${midX} ${controlY} ${endX} ${tokenTopY}`;

        const labelStartX = Math.min(startX, endX);
        const labelEndX = Math.max(startX, endX);
        const labelMidX = (labelStartX + labelEndX) / 2;
        const labelPath = `M ${labelStartX} ${tokenTopY - 2} Q ${labelMidX} ${labelControlY} ${labelEndX} ${tokenTopY - 2}`;

        const meta = getRelationMeta(edge.relation);
        const labelText = `${meta.short} (${meta.arabic})`;

        return {
          edge,
          startX,
          endX,
          startY: tokenTopY,
          midX,
          controlY,
          labelControlY,
          arcPath,
          labelPath,
          labelPathId: `dep-label-path-${edge.id.replace(/[^a-zA-Z0-9_-]/g, "_")}-${idx}`,
          labelText,
        };
      })
      .filter((layout): layout is EdgeLayout => Boolean(layout));
  }, [data, tokenMap, tokenXById, tokenTopY]);

  const hoveredEdgeLayout = useMemo(
    () => edgeLayouts.find((layout) => layout.edge.id === hoveredEdgeId) ?? null,
    [edgeLayouts, hoveredEdgeId]
  );

  const hoveredEdgeTokenIds = useMemo(() => {
    if (!hoveredEdgeLayout) return new Set<string>();
    return new Set<string>([
      hoveredEdgeLayout.edge.dependentTokenId,
      hoveredEdgeLayout.edge.headTokenId,
    ]);
  }, [hoveredEdgeLayout]);

  const hoveredToken = useMemo(
    () => (hoveredTokenId ? tokenMap.get(hoveredTokenId) ?? null : null),
    [hoveredTokenId, tokenMap]
  );

  const selectedToken = useMemo(
    () => (selectedTokenId ? tokenMap.get(selectedTokenId) ?? null : null),
    [selectedTokenId, tokenMap]
  );

  const inspectorToken = selectedToken ?? hoveredToken;

  useEffect(() => {
    setHoveredTokenId(null);
    setSelectedTokenId(null);
    setHoveredEdgeId(null);
    onTokenHover(null);
  }, [activeSurah, activeAyah, onTokenHover]);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: Math.max(entry.contentRect.width, 960),
          height: Math.max(entry.contentRect.height, 560),
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || !zoomLayerRef.current) return;

    const svgSelection = d3.select(svgRef.current);
    const zoomLayerSelection = d3.select(zoomLayerRef.current);

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 4.5])
      .on("zoom", (event) => {
        zoomLayerSelection.attr("transform", event.transform.toString());
        setZoomScale(event.transform.k);
      });

    const initialX = (dimensions.width - graphWidth) / 2;
    const initialY = 26;

    zoomBehaviorRef.current = zoomBehavior;
    svgSelection.call(zoomBehavior);
    svgSelection.on("dblclick.zoom", null);
    svgSelection.call(
      zoomBehavior.transform,
      d3.zoomIdentity.translate(initialX, initialY)
    );

    return () => {
      svgSelection.on(".zoom", null);
      zoomBehaviorRef.current = null;
    };
  }, [dimensions.width, graphWidth, activeSurah, activeAyah, sortedTokens.length]);

  const handleResetZoom = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const initialX = (dimensions.width - graphWidth) / 2;
    const initialY = 26;
    d3.select(svgRef.current)
      .transition()
      .duration(260)
      .call(zoomBehaviorRef.current.transform, d3.zoomIdentity.translate(initialX, initialY));
  }, [dimensions.width, graphWidth]);

  const handleNextAyah = useCallback(() => {
    if (!activeAyah || availableAyahs.length === 0) return;
    const idx = availableAyahs.indexOf(activeAyah);
    if (idx < availableAyahs.length - 1) {
      setActiveAyah(availableAyahs[idx + 1]);
    }
  }, [activeAyah, availableAyahs]);

  const handlePrevAyah = useCallback(() => {
    if (!activeAyah || availableAyahs.length === 0) return;
    const idx = availableAyahs.indexOf(activeAyah);
    if (idx > 0) {
      setActiveAyah(availableAyahs[idx - 1]);
    }
  }, [activeAyah, availableAyahs]);

  const allSurahs = useMemo(() => {
    return Object.entries(SURAH_NAMES).map(([id, info]) => ({
      id: Number(id),
      name: info.name,
      arabic: info.arabic,
    }));
  }, []);

  const surahName = SURAH_NAMES[activeSurah]?.name ?? `Surah ${activeSurah}`;

  const hasEdgeHover = Boolean(hoveredEdgeId);
  const minAyah = availableAyahs[0] ?? 0;
  const maxAyah = availableAyahs[availableAyahs.length - 1] ?? 0;
  const canGoPrevAyah = Boolean(activeAyah && activeAyah > minAyah);
  const canGoNextAyah = Boolean(activeAyah && activeAyah < maxAyah);

  const sidebarCards = (
    <div className={`viz-left-stack dep-sidebar-stack ${!isLeftSidebarOpen ? 'collapsed' : ''}`}>

      <div className="viz-left-panel dep-control-card">
        <div className="dep-card-head">
          <p className="eyebrow">{ts("advancedViz")}</p>
          <h3>{t("title")}</h3>
        </div>

        <div className="dep-control-grid">
          <label className="dep-field dep-field-full">
            <div className="dep-field-head">
              <span className="dep-label">{ts("surah")}</span>
              <span className="dep-field-hint">{allSurahs.length} {ts("total")}</span>
            </div>
            <div className="dep-select-shell dep-select-shell-surah">
              <select
                className="dep-select dep-select-surah"
                value={activeSurah}
                onChange={(event) => handleSurahChange(Number(event.target.value))}
              >
                {allSurahs.map((surah) => (
                  <option key={surah.id} value={surah.id}>
                    {surah.id}. {surah.name} ({surah.arabic})
                  </option>
                ))}
              </select>
            </div>
          </label>

          <div className="dep-ayah-field">
            <div className="dep-field-head">
              <span className="dep-label">{ts("ayah")}</span>
              <span className="dep-ayah-range">
                {activeAyah ?? "-"} / {maxAyah}
              </span>
            </div>
            <div className="dep-ayah-controls">
              <button
                type="button"
                className="dep-nav-btn"
                onClick={handlePrevAyah}
                disabled={!canGoPrevAyah}
                aria-label={t("prevAyah")}
              >
                {"\u2190"}
              </button>
              <div className="dep-select-shell dep-select-shell-ayah">
                <select
                  className="dep-select dep-select-ayah"
                  value={activeAyah ?? undefined}
                  onChange={(event) => setActiveAyah(Number(event.target.value))}
                >
                  {availableAyahs.map((ayahNumber) => (
                    <option key={ayahNumber} value={ayahNumber}>
                      {ayahNumber}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="dep-nav-btn"
                onClick={handleNextAyah}
                disabled={!canGoNextAyah}
                aria-label={t("nextAyah")}
              >
                {"\u2192"}
              </button>
            </div>
          </div>
        </div>

        {(fullAyahText || data) && (
          <p
            className="dep-ayah-preview arabic-font"
            lang="ar"
            style={{
              fontSize: "1.4rem",
              lineHeight: "1.6",
              textAlign: "right",
              direction: "rtl",
              borderBottom: "1px solid var(--border)",
              paddingBottom: "0.75rem",
              marginBottom: "0.75rem",
            }}
          >
            {fullAyahText ?? data?.ayah.textUthmani}
          </p>
        )}

        <div className="dep-stats-row">
          <div className="dep-stat-item">
            <span className="dep-stat-value">{sortedTokens.length}</span>
            <span className="dep-stat-key">{ts("occurrences")}</span>
          </div>
          <div className="dep-stat-item">
            <span className="dep-stat-value">{edgeLayouts.length}</span>
            <span className="dep-stat-key">{ts("total")}</span>
          </div>
          <div className="dep-stat-item">
            <span className="dep-stat-value">{Math.round(zoomScale * 100)}%</span>
            <span className="dep-stat-key">{ts("zoom")}</span>
          </div>
        </div>

        <div className="dep-view-row">
          <span className="dep-label">{ts("zoom")}</span>
          <div className="dep-zoom-row">
            <button
              type="button"
              className="dep-zoom-btn dep-zoom-step-btn"
              onClick={() => {
                if (!svgRef.current || !zoomBehaviorRef.current) return;
                d3.select(svgRef.current).transition().duration(140).call(zoomBehaviorRef.current.scaleBy, 1.2);
              }}
              aria-label={ts("zoomIn")}
            >
              +
            </button>
            <button
              type="button"
              className="dep-zoom-btn dep-zoom-step-btn"
              onClick={() => {
                if (!svgRef.current || !zoomBehaviorRef.current) return;
                d3.select(svgRef.current).transition().duration(140).call(zoomBehaviorRef.current.scaleBy, 0.85);
              }}
              aria-label={ts("zoomOut")}
            >
              -
            </button>
            <button type="button" className="dep-fit-btn" onClick={handleResetZoom}>
              {ts("reset")}
            </button>
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
            { label: t("Help.treeLabel"), text: t("Help.treeText") },
            { label: t("Help.linksLabel"), text: t("Help.linksText") },
          ]
        }}
      />

      <div className="viz-left-panel dep-legend-card">
        <div className="dep-legend-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {ts("legend")}
          <HelpIcon onClick={() => setShowHelp(true)} />
        </div>
        {Object.entries(RELATION_META).map(([key, meta]) => (
          <div key={key} className="dep-legend-row">
            <span className="dep-legend-key">{meta.short}</span>
            <span className="dep-legend-ar arabic-font">{meta.arabic}</span>
          </div>
        ))}
      </div>

      <div className="viz-left-panel dep-token-card">
        <div className="dep-token-head">
          <div>
            <div className="dep-legend-title">
              {selectedToken ? ts("selectedToken") : hoveredToken ? ts("hoveredToken") : t("analysisSummary")}
            </div>
            {inspectorToken ? (
              <div className="dep-token-id">{inspectorToken.id}</div>
            ) : (
              <div className="dep-token-id">{t("hoverToken")}</div>
            )}
          </div>
          {selectedToken && (
            <button
              type="button"
              className="dep-clear-btn"
              onClick={() => setSelectedTokenId(null)}
            >
              {ts("clear")}
            </button>
          )}
        </div>

        {inspectorToken ? (
          <div className="dep-token-body">
            <div className="dep-token-main arabic-font">{inspectorToken.text}</div>
            <div className="dep-token-meta">
              <span className="dep-meta-k">POS</span>
              <span className="dep-meta-v">{inspectorToken.pos}</span>
            </div>
            <div className="dep-token-meta">
              <span className="dep-meta-k">{ts("root")}</span>
              <span className="dep-meta-v arabic-font">{inspectorToken.root || "-"}</span>
            </div>
            <div className="dep-token-meta">
              <span className="dep-meta-k">{ts("lemma")}</span>
              <span className="dep-meta-v arabic-font">{inspectorToken.lemma || "-"}</span>
            </div>
            <div className="dep-token-meta">
              <span className="dep-meta-k">{ts("gloss")}</span>
              <span className="dep-meta-v">{inspectorToken.morphology?.gloss || "-"}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (!data || sortedTokens.length === 0) {
    return (
      <section className="immersive-viz dep-graph-wrapper" data-theme={theme}>
        {isMounted && typeof document !== "undefined" && document.getElementById("viz-sidebar-portal")
          ? createPortal(sidebarCards, document.getElementById("viz-sidebar-portal")!)
          : sidebarCards}
        <div className="dep-empty-msg">{ts("noData")} {surahName}</div>
        <style jsx>{`
          .dep-graph-wrapper {
            position: relative;
            width: 100%;
            height: 100%;
          }
          .dep-empty-msg {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            color: var(--ink-muted);
            font-size: 0.95rem;
          }
        `}</style>
      </section>
    );
  }

  return (
    <section className="immersive-viz dep-graph-wrapper" data-theme={theme} style={{ width: "100%", height: "100%", position: "relative" }}>
      {isMounted && typeof document !== "undefined" && document.getElementById("viz-sidebar-portal")
        ? createPortal(sidebarCards, document.getElementById("viz-sidebar-portal")!)
        : sidebarCards}

      <div ref={containerRef} className="dep-canvas-container">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${dimensions.width} ${graphHeight}`}
          className="dep-svg"
          style={{ cursor: "grab" }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setHoveredEdgeId(null);
              setHoveredTokenId(null);
              onTokenHover(null);
            }
          }}
        >
          <defs>
            <filter id="depNodeGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <marker id="depArrowhead" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="var(--accent)" />
            </marker>
          </defs>

          <g ref={zoomLayerRef}>
            <g className="dep-edge-layer">
              {edgeLayouts.map((layout) => {
                const isHovered = hoveredEdgeId === layout.edge.id;
                const arcOpacity = hasEdgeHover ? (isHovered ? 1 : 0.12) : 0.78;
                const labelOpacity = hasEdgeHover ? (isHovered ? 1 : 0.16) : 0.92;
                return (
                  <g key={layout.edge.id}>
                    <path
                      d={layout.arcPath}
                      className={`dep-arc ${isHovered ? "is-hovered" : ""}`}
                      markerEnd="url(#depArrowhead)"
                      style={{
                        opacity: arcOpacity,
                        strokeWidth: isHovered ? 3.1 : 1.8,
                      }}
                    />

                    <path
                      d={layout.arcPath}
                      className="dep-arc-hit"
                      onMouseEnter={() => setHoveredEdgeId(layout.edge.id)}
                      onMouseLeave={() => setHoveredEdgeId(null)}
                    />

                    <path id={layout.labelPathId} d={layout.labelPath} className="dep-label-path" />
                    <text
                      className={`dep-relation-label ${isHovered ? "is-hovered" : ""}`}
                      style={{
                        opacity: labelOpacity,
                      }}
                    >
                      <textPath href={`#${layout.labelPathId}`} startOffset="50%" textAnchor="middle">
                        {layout.labelText}
                      </textPath>
                    </text>
                  </g>
                );
              })}
            </g>

            <g className="dep-token-layer">
              {sortedTokens.map((token) => {
                const x = tokenXById.get(token.id) ?? horizontalPadding + (token.position - 1) * spacing;
                const y = baseY;
                const nodeColor = lexicalNodeColor(token);
                const isHovered = hoveredTokenId === token.id;
                const isSelected = selectedTokenId === token.id;
                const inHoveredEdge = hoveredEdgeTokenIds.has(token.id);

                return (
                  <g key={token.id}>
                    <g pointerEvents="none" transform={`translate(${x}, ${y})`} className="dep-token-visual">
                      <rect
                        x={-nodeWidth / 2}
                        y={-nodeHeight / 2}
                        width={nodeWidth}
                        height={nodeHeight}
                        rx={13}
                        className="dep-node-rect"
                        style={{
                          fill: isHovered || isSelected ? "var(--bg-2)" : "var(--bg-1)",
                          stroke: inHoveredEdge ? "var(--accent-2)" : nodeColor,
                          strokeWidth: isSelected ? 2.8 : isHovered ? 2.3 : inHoveredEdge ? 2.1 : 1.5,
                        }}
                        filter={isHovered || isSelected ? "url(#depNodeGlow)" : undefined}
                      />

                      <rect x={-23} y={-nodeHeight / 2 - 10} width={46} height={20} rx={10} fill={nodeColor} />
                      <text x={0} y={-nodeHeight / 2 + 4} className="dep-pos-badge">
                        {token.pos}
                      </text>

                      <text x={0} y={-11} className="dep-token-text arabic-font">
                        {token.text}
                      </text>
                      <text x={0} y={13} className="dep-token-root arabic-font">
                        {token.root || "-"}
                      </text>
                      <text x={0} y={35} className="dep-token-gloss">
                        {(token.morphology?.gloss || "-").slice(0, 20)}
                        {(token.morphology?.gloss || "").length > 20 ? "..." : ""}
                      </text>
                    </g>

                    <rect
                      x={x - nodeWidth / 2 - 3}
                      y={y - nodeHeight / 2 - 3}
                      width={nodeWidth + 6}
                      height={nodeHeight + 6}
                      rx={14}
                      className="dep-token-hitbox"
                      onMouseEnter={() => {
                        setHoveredTokenId(token.id);
                        onTokenHover(token.id);
                      }}
                      onMouseLeave={() => {
                        setHoveredTokenId(null);
                        onTokenHover(null);
                      }}
                      onClick={() => {
                        setSelectedTokenId(token.id);
                        onTokenFocus(token.id);
                      }}
                    />
                  </g>
                );
              })}
            </g>
          </g>
        </svg>
      </div>

      {/* Ayah text strip — anchored at bottom, bidirectional highlighting with graph nodes */}
      <div className="dep-ayah-strip" dir="rtl" lang="ar">
        <span className="dep-ayah-strip-label">{t("ayahTextLabel")}</span>
        <div className="dep-ayah-strip-words">
          {sortedTokens.map((token) => {
            const isHovered = hoveredTokenId === token.id;
            const isSelected = selectedTokenId === token.id;
            const nodeColor = lexicalNodeColor(token);
            return (
              <button
                key={token.id}
                type="button"
                className={`dep-ayah-word arabic-font${isHovered ? " is-hovered" : ""}${isSelected ? " is-selected" : ""}`}
                style={{
                  borderColor: isSelected ? nodeColor : isHovered ? nodeColor : undefined,
                  backgroundColor: isSelected ? `${nodeColor}18` : isHovered ? `${nodeColor}10` : undefined,
                }}
                onMouseEnter={() => {
                  setHoveredTokenId(token.id);
                  onTokenHover(token.id);
                }}
                onMouseLeave={() => {
                  setHoveredTokenId(null);
                  onTokenHover(null);
                }}
                onClick={() => {
                  setSelectedTokenId(token.id);
                  onTokenFocus(token.id);
                }}
                title={token.morphology?.gloss || token.root || ""}
              >
                <span className="dep-ayah-word-text">{ayahWords.get(token.position)?.text_uthmani ?? ayahWords.get(token.position)?.text ?? token.text}</span>
                <span className="dep-ayah-word-token">{token.text}</span>
                <span className="dep-ayah-word-gloss" dir="ltr">{(token.morphology?.gloss || ayahWords.get(token.position)?.translation?.text || token.root || "-").slice(0, 18)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sidebar styles moved to globals.css to fix createPortal scoping */}
      <style jsx>{`
        .dep-graph-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background: radial-gradient(circle at 50% 28%, var(--bg-1, #0a0a0f) 0%, var(--bg-0, #000) 80%);
        }

        .dep-canvas-container {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          padding-top: 24px;
          z-index: 1;
        }

        .dep-svg {
          width: 100%;
          height: 100%;
        }
      `}</style>

      <style jsx global>{`
        .dep-arc {
          fill: none;
          stroke: var(--accent);
          stroke-linecap: round;
          transition: opacity 0.15s ease, stroke-width 0.15s ease;
        }

        .dep-arc.is-hovered {
          filter: drop-shadow(0 0 8px var(--accent-glow));
        }

        .dep-arc-hit {
          fill: none;
          stroke: transparent;
          stroke-width: 18;
          pointer-events: stroke;
          cursor: pointer;
        }

        .dep-label-path {
          fill: none;
          stroke: none;
          pointer-events: none;
        }

        .dep-relation-label {
          fill: var(--ink-secondary);
          font-size: 10px;
          font-weight: 650;
          letter-spacing: 0.03em;
          transition: opacity 0.15s ease;
          text-transform: uppercase;
          pointer-events: none;
        }

        .dep-relation-label.is-hovered {
          fill: var(--accent-2);
          font-weight: 800;
        }

        .dep-node-rect {
          transition: stroke-width 0.12s ease, fill 0.12s ease;
        }

        .dep-pos-badge {
          fill: #fff;
          font-size: 9px;
          text-anchor: middle;
          font-weight: 700;
          letter-spacing: 0.03em;
        }

        [data-theme="light"] .dep-pos-badge {
          fill: #111827;
        }

        .dep-token-text {
          fill: var(--ink);
          font-size: 22px;
          text-anchor: middle;
          font-weight: 500;
        }

        .dep-token-root {
          fill: var(--ink-secondary);
          font-size: 14px;
          text-anchor: middle;
        }

        .dep-token-gloss {
          fill: var(--ink-muted);
          font-size: 10px;
          text-anchor: middle;
          font-weight: 500;
        }

        .dep-token-hitbox {
          fill: transparent;
          cursor: pointer;
        }
      `}</style>
    </section>
  );
}
