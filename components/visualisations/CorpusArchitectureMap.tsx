"use client";

import { useEffect, useRef, useState, useMemo, useCallback, useDeferredValue } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

import * as d3 from "d3";
import { motion, AnimatePresence } from "framer-motion";
import type { CorpusToken } from "@/lib/schema/types";
import { DARK_THEME, LIGHT_THEME } from "@/lib/schema/visualizationTypes";
import { useZoom } from "@/lib/hooks/useZoom";
import { SURAH_NAMES } from "@/lib/data/surahData";
import { VizExplainerDialog, HelpIcon } from "@/components/ui/VizExplainerDialog";

interface CorpusArchitectureMapProps {
    tokens: CorpusToken[];
    onNodeSelect?: (type: "surah" | "root" | "lemma", id: string | number) => void;
    highlightRoot?: string | null;
    selectedSurahId?: number;
    theme?: "light" | "dark";
}

interface HierarchyNode {
    id: string;
    name: string;
    type: "root" | "surah" | "corpus" | "word_root";
    value: number;
    children?: HierarchyNode[];
    originalId?: number | string; // For syncing with global state
}

export default function CorpusArchitectureMap({
    tokens,
    onNodeSelect,
    highlightRoot,
    selectedSurahId,
    theme = "dark"
}: CorpusArchitectureMapProps) {
    const t = useTranslations("Visualizations.CorpusArchitecture");
    const ts = useTranslations("Visualizations.Shared");
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoomLevel, setZoomLevel] = useState(1.4);
    const [zoomTransform, setZoomTransform] = useState(d3.zoomIdentity);
    const zoomTransformRef = useRef(d3.zoomIdentity);
    const zoomRafRef = useRef<number | null>(null);
    const handleZoom = useCallback((transform: d3.ZoomTransform) => {
        zoomTransformRef.current = transform;
        if (zoomRafRef.current) return;
        zoomRafRef.current = requestAnimationFrame(() => {
            zoomRafRef.current = null;
            setZoomTransform(zoomTransformRef.current);
        });
    }, []);

    const { svgRef, gRef } = useZoom<SVGSVGElement>({
        minScale: 0.1,
        maxScale: 12,
        initialScale: 1.4,
        onZoom: handleZoom,
        onZoomEnd: (transform) =>
            setZoomLevel((prev) => {
                const next = Math.round(transform.k * 20) / 20;
                return prev === next ? prev : next;
            }),
    });

    const [dimensions] = useState({ width: 1600, height: 1600 });
    const [hoveredNode, setHoveredNode] = useState<d3.HierarchyPointNode<HierarchyNode> | null>(null);
    const [focusedSurahId, setFocusedSurahId] = useState<number | null>(null);
    const [internalSelectedRoot, setInternalSelectedRoot] = useState<string | null>(null);
    const [selectedRootInfo, setSelectedRootInfo] = useState<{
        root: string;
        count: number;
        surahId: number | null;
        surahName: string | null;
        surahArabic: string | null;
    } | null>(null);

    const [showHelp, setShowHelp] = useState(false);

    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => { setIsMounted(true); }, []);

    useEffect(() => {
        if (selectedSurahId) {
            setFocusedSurahId(selectedSurahId);
        }
    }, [selectedSurahId]);

    const focusedSurahStats = useMemo(() => {
        if (!focusedSurahId) return null;
        const surahTokens = tokens.filter(t => t.sura === focusedSurahId);
        const uniqueRoots = new Set(surahTokens.map(t => t.root).filter(Boolean)).size;
        return {
            rootsCount: uniqueRoots,
            ayahsCount: SURAH_NAMES[focusedSurahId]?.verses || 0
        };
    }, [focusedSurahId, tokens]);

    useEffect(() => {
        return () => {
            if (zoomRafRef.current) {
                cancelAnimationFrame(zoomRafRef.current);
            }
        };
    }, []);

    // Build Hierarchy Data
    // Level 0: Corpus
    // Level 1: Surahs
    // Level 2: Component Roots (Top 10 per Surah to keep performance manageable initially)
    const hierarchyData = useMemo(() => {
        const root: HierarchyNode = {
            id: "corpus",
            name: "The Noble Quran",
            type: "corpus",
            value: 1,
            children: []
        };

        // 1. Group by Surah
        const surahMap = new Map<number, {
            id: number,
            tokens: CorpusToken[],
            rootCounts: Map<string, number>
        }>();

        tokens.forEach(t => {
            if (!surahMap.has(t.sura)) {
                surahMap.set(t.sura, {
                    id: t.sura,
                    tokens: [],
                    rootCounts: new Map()
                });
            }
            const entry = surahMap.get(t.sura)!;
            entry.tokens.push(t);
            if (t.root) {
                entry.rootCounts.set(t.root, (entry.rootCounts.get(t.root) || 0) + 1);
            }
        });

        // 2. Build Tree
        Array.from(surahMap.entries())
            .sort((a, b) => a[0] - b[0])
            .forEach(([suraId, data]) => {
                const surahName = SURAH_NAMES[suraId]?.name || `Surah ${suraId}`;

                // Get top roots for this surah - limit for performance
                const topRoots = Array.from(data.rootCounts.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6) // Limit to 6 roots per Surah for performance
                    .map(([rootTxt, count]) => ({
                        id: `s${suraId}-r${rootTxt}`,
                        name: rootTxt,
                        type: "word_root" as const,
                        value: count,
                        originalId: rootTxt
                    }));

                root.children!.push({
                    id: `s-${suraId}`,
                    name: surahName,
                    type: "surah",
                    value: data.tokens.length,
                    originalId: suraId,
                    children: topRoots
                });
            });

        return root;
    }, [tokens]);

    // Layout Calculation
    const { nodes, links } = useMemo(() => {
        const hierarchy = d3.hierarchy(hierarchyData);

        // Cluster layout places leaf nodes at the same depth
        // Tree layout puts them at depth based on parent
        // For radial dendrogram, cluster is usually better for alignment
        // Keep radius smaller to reserve space for root offsets
        const layoutRadius = Math.max(180, Math.min(dimensions.width, dimensions.height) / 2 - 200);
        const layout = d3.cluster<HierarchyNode>()
            .size([360, layoutRadius])
            .separation((a, b) => (a.parent === b.parent ? 2 : 3) / a.depth);

        const root = layout(hierarchy);

        return {
            nodes: root.descendants(),
            links: root.links()
        };
    }, [hierarchyData, dimensions]);

    // Helpers
    const hoveredDescendants = useMemo(() => {
        if (!hoveredNode) return null;
        return new Set(hoveredNode.descendants().map((node) => node.data.id));
    }, [hoveredNode]);

    const getOpacity = (d: d3.HierarchyPointNode<HierarchyNode>) => {
        if (focusedSurahId) {
            const focusId = `s-${focusedSurahId}`;
            if (d.data.id === "corpus") return 0.6;
            if (d.data.id === focusId) return 1;
            if (d.parent?.data.id === focusId) return 1;
            if (d.data.type === "surah") return 0.2;
            return 0.05;
        }

        // If we are filtering by root (either from parent or internal selection):
        const activeRoot = highlightRoot || internalSelectedRoot;
        if (activeRoot) {
            const isMatch = d.data.type === 'word_root' && d.data.originalId === activeRoot;
            const isParentSurah = d.children?.some(child => child.data.originalId === activeRoot);

            if (isMatch || isParentSurah) return 1;
            return 0.1; // Dim others more
        }

        if (!hoveredNode) return 0.8; // Default opacity high

        let current: d3.HierarchyPointNode<HierarchyNode> | null = hoveredNode;
        while (current) {
            if (current === d) return 1;
            current = current.parent;
        }
        if (hoveredNode === d) return 1;
        if (hoveredDescendants?.has(d.data.id)) return 1;

        return 0.1;
    };

    const themeColors = theme === "dark" ? DARK_THEME : LIGHT_THEME;

    const lodMode = focusedSurahId ? "focus" : zoomLevel < 0.65 ? "surah" : zoomLevel < 1.25 ? "focus" : "full";
    const focusSurahNodeId = focusedSurahId ? `s-${focusedSurahId}` : null;

    const rootMeta = useMemo(() => {
        const bySurah = new Map<string, d3.HierarchyPointNode<HierarchyNode>[]>();
        nodes.forEach((node) => {
            if (node.data.type !== "word_root") return;
            const parentId = node.parent?.data.id;
            if (!parentId) return;
            const list = bySurah.get(parentId) ?? [];
            list.push(node);
            bySurah.set(parentId, list);
        });

        const rankById = new Map<string, number>();
        const indexById = new Map<string, number>();
        const countBySurah = new Map<string, number>();
        bySurah.forEach((list, parentId) => {
            list.sort((a, b) => b.data.value - a.data.value);
            countBySurah.set(parentId, list.length);
            list.forEach((node, idx) => {
                rankById.set(node.data.id, idx + 1);
                indexById.set(node.data.id, idx);
            });
        });
        return { rankById, indexById, countBySurah };
    }, [nodes]);
    const { rankById: rootRankById, indexById: rootIndexById, countBySurah: rootCountBySurah } = rootMeta;

    const rootVisibilityLimit = useMemo(() => {
        if (focusSurahNodeId) {
            if (zoomLevel < 0.9) return 18;
            if (zoomLevel < 1.2) return 30;
            if (zoomLevel < 1.6) return 50;
            return Infinity;
        }
        if (zoomLevel < 0.75) return 4;
        if (zoomLevel < 1.1) return 8;
        return 12;
    }, [focusSurahNodeId, zoomLevel]);

    const rootOffsetById = useMemo(() => {
        const maxBySurah = new Map<string, number>();
        nodes.forEach((node) => {
            if (node.data.type !== "word_root") return;
            const parentId = node.parent?.data.id;
            if (!parentId) return;
            const currentMax = maxBySurah.get(parentId) ?? 1;
            if (node.data.value > currentMax) {
                maxBySurah.set(parentId, node.data.value);
            }
        });

        const offsets = new Map<string, number>();
        nodes.forEach((node) => {
            if (node.data.type !== "word_root") return;
            const parentId = node.parent?.data.id;
            const max = maxBySurah.get(parentId ?? "") ?? 1;
            const ratio = Math.log1p(node.data.value) / Math.log1p(max);
            const rank = rootRankById.get(node.data.id) ?? 1;
            // More aggressive spacing by rank to avoid overlap
            const rankNudge = Math.min(80, rank * 12);
            const offset = 30 + ratio * 60 + rankNudge;
            offsets.set(node.data.id, offset);
        });
        return offsets;
    }, [nodes, rootRankById]);

    const rootAngleOffsetById = useMemo(() => {
        const offsets = new Map<string, number>();
        nodes.forEach((node) => {
            if (node.data.type !== "word_root") return;
            const parentId = node.parent?.data.id;
            if (!parentId) return;
            const total = rootCountBySurah.get(parentId) ?? 1;
            const index = rootIndexById.get(node.data.id) ?? 0;
            const centered = index - (total - 1) / 2;
            // Increased spread to avoid collision
            const step = focusSurahNodeId ? 5.0 : 3.5;
            const spread = Math.min(65, total * step);
            const baseOffset = centered * (spread / Math.max(1, total - 1));
            const forkNudge = (index % 2 === 0 ? 1 : -1) * Math.min(4, 0.5 * Math.max(1, index));
            offsets.set(node.data.id, baseOffset + forkNudge);
        });
        return offsets;
    }, [nodes, rootIndexById, rootCountBySurah, focusSurahNodeId]);

    const getNodeRadius = useCallback(
        (node: d3.HierarchyPointNode<HierarchyNode>) => {
            return node.y + (rootOffsetById.get(node.data.id) ?? 0);
        },
        [rootOffsetById]
    );

    const getNodeAngle = useCallback(
        (node: d3.HierarchyPointNode<HierarchyNode>) => {
            const offset = rootAngleOffsetById.get(node.data.id) ?? 0;
            return (node.x + offset) * Math.PI / 180;
        },
        [rootAngleOffsetById]
    );

    const radialLink = useMemo(
        () =>
            d3
                .linkRadial<d3.HierarchyPointLink<HierarchyNode>, d3.HierarchyPointNode<HierarchyNode>>()
                .angle((d) => getNodeAngle(d))
                .radius((d) => getNodeRadius(d)),
        [getNodeAngle, getNodeRadius]
    );

    const maxRootOffset = useMemo(() => {
        let max = 0;
        rootOffsetById.forEach((value) => {
            if (value > max) max = value;
        });
        return max;
    }, [rootOffsetById]);

    const viewRadius = useMemo(() => {
        const base = Math.max(dimensions.width, dimensions.height) / 2;
        return base + maxRootOffset + 160;
    }, [dimensions, maxRootOffset]);

    const nodePositionById = useMemo(() => {
        const map = new Map<string, { x: number; y: number; angleDeg: number }>();
        nodes.forEach((node) => {
            const angleRad = getNodeAngle(node);
            const rawAngleDeg = (angleRad * 180) / Math.PI;
            const angleDeg = ((rawAngleDeg % 360) + 360) % 360;
            const radius = getNodeRadius(node);
            const [x, y] = d3.pointRadial(angleRad, radius);
            map.set(node.data.id, { x, y, angleDeg });
        });
        return map;
    }, [nodes, getNodeAngle, getNodeRadius]);

    // Defer zoom transform updates for smoother zooming
    const deferredZoom = useDeferredValue(zoomTransform);

    const visibleNodes = useMemo(() => {
        const padding = 160;
        const minX = -viewRadius - padding;
        const maxX = viewRadius + padding;
        const minY = -viewRadius - padding;
        const maxY = viewRadius + padding;

        const shouldShowRoot = (node: d3.HierarchyPointNode<HierarchyNode>) => {
            if (focusSurahNodeId) {
                if (node.data.id === "corpus") return true;
                if (node.data.type === "surah") return true;
                if (node.parent?.data.id === focusSurahNodeId) return true;
                return node.data.id === focusSurahNodeId;
            }
            if (node.data.type !== "word_root") return true;
            if (rootVisibilityLimit !== Infinity) {
                const rank = rootRankById.get(node.data.id) ?? 999;
                if (rank > rootVisibilityLimit) return false;
            }
            if (lodMode === "full") return true;
            if (highlightRoot && node.data.originalId === highlightRoot) return true;
            if (lodMode === "focus" && hoveredNode?.data.type === "surah") {
                return node.parent?.data.id === hoveredNode.data.id;
            }
            return false;
        };

        const isInView = (node: d3.HierarchyPointNode<HierarchyNode>) => {
            const position = nodePositionById.get(node.data.id);
            if (!position) return false;
            const screenX = position.x * deferredZoom.k + deferredZoom.x;
            const screenY = position.y * deferredZoom.k + deferredZoom.y;
            return screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY;
        };

        return nodes.filter((node) => shouldShowRoot(node) && isInView(node));
    }, [nodes, lodMode, highlightRoot, hoveredNode, focusSurahNodeId, deferredZoom, rootRankById, rootVisibilityLimit, nodePositionById, viewRadius]);

    const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.data.id)), [visibleNodes]);
    const visibleLinks = useMemo(() => {
        if (!focusSurahNodeId) {
            return links.filter((link) => visibleNodeIds.has(link.source.data.id) && visibleNodeIds.has(link.target.data.id));
        }

        return links.filter((link) => {
            const sourceId = link.source.data.id;
            const targetId = link.target.data.id;
            const isCorpusToSurah = sourceId === "corpus" && link.target.data.type === "surah";
            const isFocusLink = sourceId === focusSurahNodeId || targetId === focusSurahNodeId;
            const isFocusRootLink = link.source.parent?.data.id === focusSurahNodeId || link.target.parent?.data.id === focusSurahNodeId;
            return (isCorpusToSurah || isFocusLink || isFocusRootLink) && visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
        });
    }, [links, visibleNodeIds, focusSurahNodeId]);

    const labelOffsetForNode = useCallback(
        (node: d3.HierarchyPointNode<HierarchyNode>) => {
            if (node.data.type !== "word_root") return 8;
            const offset = rootOffsetById.get(node.data.id) ?? 0;
            return 12 + Math.min(16, offset * 0.25);
        },
        [rootOffsetById]
    );

    return (
        <section
            className="immersive-viz viz-fullwidth"
            data-theme={theme}
            style={{
                width: '100%',
                height: '100vh',
                position: 'relative',
                overflow: 'hidden',
                background: theme === "dark"
                    ? "radial-gradient(circle at center, #0f172a 0%, #020617 100%)"
                    : "radial-gradient(circle at 16% 18%, rgba(15, 118, 110, 0.14), transparent 42%), radial-gradient(circle at 84% 16%, rgba(245, 158, 11, 0.14), transparent 40%), linear-gradient(160deg, #f8f4ec, #efe6d7)"
            }}
        >

            {/* Portal controls to sidebar stack */
                isMounted && (typeof document !== 'undefined') && document.getElementById('viz-sidebar-portal') && createPortal(
                    <div className="viz-left-stack">
                        <div className="viz-left-panel">
                            <strong style={{ fontSize: '0.95em' }}>{t("title")}</strong><br />
                            <span style={{ fontSize: '0.72em', opacity: 0.6, lineHeight: 1.4 }}>
                                {t("structuralView")}
                            </span>
                        </div>

                        <AnimatePresence>
                            {selectedRootInfo && (
                                <motion.div
                                    className="viz-left-panel"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                >
                                    <div className="viz-tooltip-title arabic-text" style={{ fontSize: '1.3em' }}>{selectedRootInfo.root}</div>
                                    <div className="viz-tooltip-subtitle" style={{ fontSize: '0.8em', marginTop: 4 }}>
                                        {selectedRootInfo.surahName ? `${selectedRootInfo.surahName}` : ts("root")} {" "}
                                        {selectedRootInfo.surahArabic ? `| ${selectedRootInfo.surahArabic}` : ""}
                                    </div>
                                    <div className="viz-tooltip-row" style={{ marginTop: 8 }}>
                                        <span className="viz-tooltip-label">{ts("inThisSurah")}</span>
                                        <span className="viz-tooltip-value">{selectedRootInfo.count}</span>
                                    </div>
                                    <div className="viz-tooltip-row">
                                        <span className="viz-tooltip-label">{ts("totalInQuran")}</span>
                                        {/* We can calculate total from tokens if available in scope, or just show what we have */}
                                        <span className="viz-tooltip-value">
                                            {tokens.filter(t => t.root === selectedRootInfo.root).length}
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
                            <div className="viz-legend-item" style={{ marginBottom: '6px' }}>
                                <div
                                    className="viz-legend-dot"
                                    style={{ background: themeColors.accent, width: 10, height: 10 }}
                                />
                                <span style={{ fontSize: '0.75em' }}>{ts("surah")}</span>
                            </div>
                            <div className="viz-legend-item" style={{ marginBottom: '6px' }}>
                                <div
                                    className="viz-legend-dot"
                                    style={{ background: themeColors.nodeColors.default, width: 8, height: 8 }}
                                />
                                <span style={{ fontSize: '0.75em' }}>{ts("root")}</span>
                            </div>
                            <div className="viz-legend-item">
                                <div
                                    className="viz-legend-line"
                                    style={{ background: themeColors.edgeColors.default }}
                                />
                                <span style={{ fontSize: '0.75em' }}>{ts("link")}</span>
                            </div>
                        </div>
                    </div>,
                    document.getElementById('viz-sidebar-portal')!
                )}

            <VizExplainerDialog
                isOpen={showHelp}
                onClose={() => setShowHelp(false)}
                content={{
                    title: t("Help.title"),
                    description: t("Help.description"),
                    sections: [
                        { label: t("Help.hierarchyLabel"), text: t("Help.hierarchyText") },
                        { label: t("Help.nodesLabel"), text: t("Help.nodesText") },
                        { label: t("Help.interactLabel"), text: t("Help.interactText") },
                    ]
                }}
            />

            <div ref={containerRef} className="viz-container-full">
                <svg
                    ref={svgRef}
                    viewBox={`-${viewRadius} -${viewRadius} ${viewRadius * 2} ${viewRadius * 2}`}
                    className="viz-canvas"
                    style={{ width: "100%", height: "100%", cursor: "grab" }}
                >
                    <g ref={gRef}>
                        {/* Glow Defs Enforced */}
                        <defs>
                            <filter id="glow-arch" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                                <feMerge>
                                    <feMergeNode in="coloredBlur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>

                        {/* Links */}
                        <g className="links" fill="none" strokeWidth={1}>
                            {visibleLinks.map((link, i) => {
                                const isSourceRoot = link.source.data.id === 'corpus';
                                const stroke = isSourceRoot
                                    ? theme === "dark"
                                        ? "rgba(255,255,255,0.05)"
                                        : "rgba(31, 28, 25, 0.1)"
                                    : themeColors.edgeColors.default;
                                const isFocusLink = focusSurahNodeId
                                    ? link.source.data.id === focusSurahNodeId ||
                                    link.target.data.id === focusSurahNodeId ||
                                    link.source.parent?.data.id === focusSurahNodeId ||
                                    link.target.parent?.data.id === focusSurahNodeId
                                    : false;
                                const pathD = radialLink(link) || "";
                                return (
                                    <g key={i}>
                                        <path
                                            d={pathD}
                                            stroke={stroke}
                                            opacity={
                                                isFocusLink
                                                    ? 0.9
                                                    : Math.min(getOpacity(link.source), getOpacity(link.target)) * 0.5
                                            }
                                            strokeWidth={isFocusLink ? 1.6 : 1}
                                            className="transition-all duration-500"
                                            pointerEvents="none"
                                        />
                                        <path
                                            d={pathD}
                                            stroke="transparent"
                                            strokeWidth={10}
                                            fill="none"
                                            style={{ cursor: "pointer" }}
                                            onClick={() => {
                                                if (link.target.data.type === "word_root") {
                                                    const root = link.target.data.originalId as string;
                                                    const surahId = link.target.parent?.data.originalId as number | undefined;
                                                    const surah = surahId ? SURAH_NAMES[surahId] : null;
                                                    setSelectedRootInfo({
                                                        root,
                                                        count: link.target.data.value,
                                                        surahId: surahId ?? null,
                                                        surahName: surah?.name ?? null,
                                                        surahArabic: surah?.arabic ?? null,
                                                    });
                                                }
                                            }}
                                        />
                                    </g>
                                );
                            })}
                        </g>

                        {/* Nodes */}
                        <g className="nodes">
                            {visibleNodes.map((node) => {
                                const position = nodePositionById.get(node.data.id);
                                if (!position) return null;
                                const x = position.x;
                                const y = position.y;
                                const isHighlighted = getOpacity(node) === 1;
                                const showLabel =
                                    node.data.type === "surah" ||
                                    (node.data.type === "word_root" &&
                                        (lodMode === "full" ||
                                            isHighlighted ||
                                            (highlightRoot && node.data.originalId === highlightRoot) ||
                                            (focusSurahNodeId && node.parent?.data.id === focusSurahNodeId)));

                                return (
                                    <g
                                        key={node.data.id}
                                        transform={`translate(${x},${y})`}
                                        onMouseEnter={() => setHoveredNode(node)}
                                        onMouseLeave={() => setHoveredNode(null)}
                                        onClick={() => {
                                            if (node.data.type === 'surah') {
                                                const surahId = node.data.originalId as number;
                                                setFocusedSurahId((prev) => (prev === surahId ? null : surahId));
                                                onNodeSelect?.('surah', surahId);
                                                setSelectedRootInfo(null);
                                                setInternalSelectedRoot(null);
                                            } else if (node.data.type === 'word_root') {
                                                const root = node.data.originalId as string;
                                                // Toggle: click again to deselect
                                                const isDeselect = internalSelectedRoot === root;
                                                setInternalSelectedRoot(isDeselect ? null : root);
                                                const surahId = node.parent?.data.originalId as number | undefined;
                                                const surah = surahId ? SURAH_NAMES[surahId] : null;
                                                setSelectedRootInfo(isDeselect ? null : {
                                                    root,
                                                    count: node.data.value,
                                                    surahId: surahId ?? null,
                                                    surahName: surah?.name ?? null,
                                                    surahArabic: surah?.arabic ?? null,
                                                });
                                                onNodeSelect?.('root', root);
                                            }
                                        }}
                                        style={{ cursor: 'pointer' }}
                                        opacity={getOpacity(node)}
                                        className="transition-opacity duration-300"
                                    >
                                        <circle
                                            r={node.data.type === 'surah' ? 5 : (node.data.type === 'corpus' ? 0 : 3)} // Larger nodes
                                            fill={node.data.type === 'surah' ? themeColors.accent : themeColors.nodeColors.default}
                                            filter={isHighlighted ? "url(#glow-arch)" : undefined}
                                            pointerEvents="none"
                                        />
                                        {node.data.type !== "corpus" && (
                                            <circle
                                                r={node.data.type === "surah" ? 14 : 10}
                                                fill="transparent"
                                            />
                                        )}

                                        {/* Labels */}
                                        {showLabel && (
                                            <text
                                                dy="0.35em"
                                                x={position.angleDeg < 180 ? labelOffsetForNode(node) : -labelOffsetForNode(node)}
                                                textAnchor={position.angleDeg < 180 ? "start" : "end"}
                                                transform={`rotate(${position.angleDeg < 180 ? position.angleDeg - 90 : position.angleDeg + 90})`}
                                                fontSize={node.data.type === 'surah' ? 9 : 8}
                                                fill={themeColors.textColors.primary}
                                                fontWeight={isHighlighted ? "bold" : "normal"}
                                                style={{
                                                    textShadow: theme === "dark"
                                                        ? "0 1px 3px rgba(0,0,0,0.9)"
                                                        : "0 1px 2px rgba(255,255,255,0.65)",
                                                    pointerEvents: "none"
                                                }}
                                            >
                                                {node.data.type === "surah" ? (
                                                    <tspan>
                                                        {node.data.name} | {SURAH_NAMES[node.data.originalId as number]?.arabic ?? ""}
                                                    </tspan>
                                                ) : (
                                                    node.data.name
                                                )}
                                            </text>
                                        )}
                                    </g>
                                );
                            })}
                        </g>

                        {/* Central Info Display */}
                        <g className="central-info" pointerEvents="none" style={{ transition: "opacity 0.3s ease" }}>
                            <circle
                                r={80}
                                fill={theme === "dark" ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)"}
                                filter="blur(20px)"
                            />
                            <text
                                y={-24}
                                textAnchor="middle"
                                style={{
                                    fontSize: '18px',
                                    fontWeight: '400',
                                    fill: theme === "dark" ? "rgba(255,255,255,0.7)" : "rgba(31, 28, 25, 0.7)",
                                    letterSpacing: '0.05em',
                                    textTransform: 'uppercase'
                                }}
                            >
                                {focusedSurahId ? `${ts("surahCaps")} ${focusedSurahId}` : (internalSelectedRoot ? t("selectedRoot") : t("corpus"))}
                            </text>
                            <text
                                y={10}
                                textAnchor="middle"
                                style={{
                                    fontSize: '28px',
                                    fontWeight: '600',
                                    fill: themeColors.textColors.primary,
                                    textShadow: theme === "dark" ? "0 2px 10px rgba(0,0,0,0.5)" : "0 2px 10px rgba(255,255,255,0.5)"
                                }}
                            >
                                {focusedSurahId
                                    ? SURAH_NAMES[focusedSurahId]?.name
                                    : (internalSelectedRoot ?? "Architecture")}
                            </text>
                            {focusedSurahId && (
                                <text
                                    y={50}
                                    textAnchor="middle"
                                    className="arabic-text"
                                    style={{
                                        fontSize: '24px',
                                        fill: themeColors.accent,
                                        fontFamily: 'Amiri, serif'
                                    }}
                                >
                                    {SURAH_NAMES[focusedSurahId]?.arabic}
                                </text>
                            )}
                            {focusedSurahId && focusedSurahStats && (
                                <text
                                    y={80}
                                    textAnchor="middle"
                                    style={{
                                        fontSize: '15px',
                                        fill: themeColors.textColors.secondary
                                    }}
                                >
                                    {focusedSurahStats.rootsCount} {ts("roots")} • {focusedSurahStats.ayahsCount} {ts("ayahs")}
                                </text>
                            )}
                            {internalSelectedRoot && !focusedSurahId && (
                                <text
                                    y={40}
                                    textAnchor="middle"
                                    style={{
                                        fontSize: '14px',
                                        fill: themeColors.textColors.secondary
                                    }}
                                >
                                    {selectedRootInfo?.count ? `${selectedRootInfo.count} ${ts("occurrences")}` : ""}
                                </text>
                            )}
                        </g>
                    </g>
                </svg>
            </div>
        </section>
    );
}
