"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as d3 from "d3";
import { motion, AnimatePresence } from "framer-motion";
import type { CorpusToken } from "@/lib/schema/types";
import { DARK_THEME, getNodeColor } from "@/lib/schema/visualizationTypes";
import { useZoom } from "@/lib/hooks/useZoom";
import { SURAH_NAMES } from "@/lib/data/surahData";

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
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoomLevel, setZoomLevel] = useState(0.45);
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
        initialScale: 0.45,
        onZoom: handleZoom,
        onZoomEnd: (transform) =>
            setZoomLevel((prev) => {
                const next = Math.round(transform.k * 20) / 20;
                return prev === next ? prev : next;
            }),
    });

    const [dimensions, setDimensions] = useState({ width: 1600, height: 1600 });
    const [hoveredNode, setHoveredNode] = useState<d3.HierarchyPointNode<HierarchyNode> | null>(null);
    const [focusedSurahId, setFocusedSurahId] = useState<number | null>(null);
    const [selectedRootInfo, setSelectedRootInfo] = useState<{
        root: string;
        count: number;
        surahId: number | null;
        surahName: string | null;
        surahArabic: string | null;
    } | null>(null);

    useEffect(() => {
        if (selectedSurahId) {
            setFocusedSurahId(selectedSurahId);
        }
    }, [selectedSurahId]);

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

                // Get top roots for this surah to avoid massive DOM explosion
                // We can increase this limit or use semantic zoom to load more later
                const topRoots = Array.from(data.rootCounts.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 20) // Limit to top 20 roots per Surah for visual clarity
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
        const layoutRadius = Math.max(260, Math.min(dimensions.width, dimensions.height) / 2 - 300);
        const layout = d3.cluster<HierarchyNode>()
            .size([360, layoutRadius])
            .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);

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

        // If we are filtering by root:
        if (highlightRoot) {
            const isMatch = d.data.type === 'word_root' && d.data.originalId === highlightRoot;
            const isParentSurah = d.children?.some(child => child.data.originalId === highlightRoot);

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

    const themeColors = DARK_THEME; // Enforce dark theme for best contrast

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
            const rankNudge = Math.min(84, rank * 3);
            const offset = 40 + ratio * 240 + rankNudge;
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
            const step = focusSurahNodeId ? 1.6 : 1.05;
            const spread = Math.min(16, total * step);
            const baseOffset = centered * (spread / Math.max(1, total - 1));
            const forkNudge = (index % 2 === 0 ? 1 : -1) * Math.min(2.8, 0.25 * Math.max(1, index));
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
            const screenX = position.x * zoomTransform.k + zoomTransform.x;
            const screenY = position.y * zoomTransform.k + zoomTransform.y;
            return screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY;
        };

        return nodes.filter((node) => shouldShowRoot(node) && isInView(node));
    }, [nodes, lodMode, highlightRoot, hoveredNode, focusSurahNodeId, zoomTransform, rootRankById, rootVisibilityLimit, nodePositionById, viewRadius]);

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
            if (node.data.type !== "word_root") return 10;
            const offset = rootOffsetById.get(node.data.id) ?? 0;
            return 18 + Math.min(64, offset * 0.7);
        },
        [rootOffsetById]
    );

    return (
        <section
            className="immersive-viz viz-fullwidth"
            style={{
                width: '100%',
                height: '100vh',
                position: 'relative',
                overflow: 'hidden',
                background: 'radial-gradient(circle at center, #0f172a 0%, #020617 100%)' // Force deep dark background
            }}
        >
            <div
                className="viz-controls floating-controls"
                style={{
                    bottom: '2rem',
                    left: '2rem',
                    pointerEvents: 'none',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '12px',
                }}
            >
                <div className="ayah-meta-glass" style={{ pointerEvents: 'auto', textAlign: 'left' }}>
                    <strong>Corpus Architecture</strong><br />
                    <span style={{ fontSize: '0.8em', opacity: 0.7 }}>
                        Center: Corpus Root<br />
                        Ring 1: Surahs<br />
                        Outer: Top Roots
                    </span>
                    <br /><br />
                    <span style={{ fontSize: '0.8em', opacity: 0.7 }}>
                        Nodes: {nodes.length} | Links: {links.length}
                    </span>
                </div>
                <div className="viz-legend" style={{ pointerEvents: 'auto' }}>
                    <div className="viz-legend-item">
                        <div
                            className="viz-legend-dot"
                            style={{ background: themeColors.accent, width: 12, height: 12 }}
                        />
                        <span>Surah</span>
                    </div>
                    <div className="viz-legend-item">
                        <div
                            className="viz-legend-dot"
                            style={{ background: themeColors.nodeColors.default, width: 10, height: 10 }}
                        />
                        <span>Root</span>
                    </div>
                    <div className="viz-legend-item">
                        <div
                            className="viz-legend-line"
                            style={{ background: themeColors.edgeColors.default }}
                        />
                        <span>Root Link</span>
                    </div>
                </div>
            </div>

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
                                const stroke = isSourceRoot ? 'rgba(255,255,255,0.05)' : themeColors.edgeColors.default;
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
                                            } else if (node.data.type === 'word_root') {
                                                const root = node.data.originalId as string;
                                                const surahId = node.parent?.data.originalId as number | undefined;
                                                const surah = surahId ? SURAH_NAMES[surahId] : null;
                                                setSelectedRootInfo({
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
                                                dy="0.31em"
                                                x={position.angleDeg < 180 ? labelOffsetForNode(node) : -labelOffsetForNode(node)}
                                                textAnchor={position.angleDeg < 180 ? "start" : "end"}
                                                transform={`rotate(${position.angleDeg < 180 ? position.angleDeg - 90 : position.angleDeg + 90})`}
                                                fontSize={node.data.type === 'surah' ? 12 : 10} // Larger text
                                                fill={themeColors.textColors.primary}
                                                fontWeight={isHighlighted ? "bold" : "normal"}
                                                style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)', pointerEvents: "none" }} // Shadow for visibility
                                            >
                                                {node.data.type === "surah" ? (
                                                    <>
                                                        <tspan>{node.data.name}</tspan>
                                                        <tspan
                                                            x={position.angleDeg < 180 ? labelOffsetForNode(node) : -labelOffsetForNode(node)}
                                                            dy="1.2em"
                                                            fontSize="10"
                                                            fill="rgba(255,255,255,0.75)"
                                                            direction="rtl"
                                                            unicodeBidi="plaintext"
                                                        >
                                                            {SURAH_NAMES[node.data.originalId as number]?.arabic ?? ""}
                                                        </tspan>
                                                    </>
                                                ) : (
                                                    node.data.name
                                                )}
                                            </text>
                                        )}
                                    </g>
                                );
                            })}
                        </g>
                    </g>
                </svg>
            </div>

            <AnimatePresence>
                {selectedRootInfo && (
                    <motion.div
                        className="viz-tooltip"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        style={{
                            position: "absolute",
                            right: 24,
                            bottom: 24,
                            transform: "none",
                        }}
                    >
                        <div className="viz-tooltip-title arabic-text">{selectedRootInfo.root}</div>
                        <div className="viz-tooltip-subtitle">
                            {selectedRootInfo.surahName ? `${selectedRootInfo.surahName}` : "Root"}{" "}
                            {selectedRootInfo.surahArabic ? `· ${selectedRootInfo.surahArabic}` : ""}
                        </div>
                        <div className="viz-tooltip-row">
                            <span className="viz-tooltip-label">Occurrences</span>
                            <span className="viz-tooltip-value">{selectedRootInfo.count}</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
}
