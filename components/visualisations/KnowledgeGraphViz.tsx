"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import * as d3 from "d3";
import { motion, AnimatePresence } from "framer-motion";
import type { CorpusToken } from "@/lib/schema/types";
import { resolveVisualizationTheme } from "@/lib/schema/visualizationTypes";
import { useKnowledge } from "@/lib/context/KnowledgeContext";
import type { TrackedRoot } from "@/lib/cache/knowledgeCache";

// ── Types ──────────────────────────────────────────────────────────

interface KnowledgeGraphVizProps {
    tokens: CorpusToken[];
    onRootSelect?: (root: string | null) => void;
    theme?: "light" | "dark";
}

interface KGNode extends d3.SimulationNodeDatum {
    id: string;
    label: string;
    type: "tracked-root" | "ghost-root" | "lemma";
    state?: "learning" | "learned";
    frequency: number;
    radius: number;
    color: string;
    glowColor: string;
    notes?: string;
}

interface KGLink extends d3.SimulationLinkDatum<KGNode> {
    weight: number;
    color: string;
}

// ── Helpers ────────────────────────────────────────────────────────

/** Pick top-N ghost roots that share surahs with tracked roots for context. */
function pickGhostRoots(
    allRootMap: Map<string, { count: number; lemmas: Set<string> }>,
    trackedSet: Set<string>,
    limit: number
): string[] {
    return [...allRootMap.entries()]
        .filter(([r]) => !trackedSet.has(r))
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, limit)
        .map(([r]) => r);
}

// ── Component ──────────────────────────────────────────────────────

export default function KnowledgeGraphViz({
    tokens,
    onRootSelect,
    theme = "dark",
}: KnowledgeGraphVizProps) {
    const { roots: trackedRoots, stats, trackRoot } = useKnowledge();
    const themeColors = resolveVisualizationTheme(theme);

    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const gRef = useRef<SVGGElement>(null);

    const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [nodes, setNodes] = useState<KGNode[]>([]);
    const [links, setLinks] = useState<KGLink[]>([]);
    const [isMounted, setIsMounted] = useState(false);
    const [viewMode, setViewMode] = useState<"neural" | "flow">("neural");
    const viewModeRef = useRef<"neural" | "flow">("neural");
    const simulationRef = useRef<d3.Simulation<KGNode, KGLink> | null>(null);
    const liveNodesRef = useRef<KGNode[]>([]);

    // ── Palette derived from theme ───────────────────────────────────

    const palette = useMemo(() => {
        const isDark = theme === "dark";
        return {
            learningNode: isDark ? "#22d3ee" : "#0891b2",     // cyan
            learningGlow: isDark ? "rgba(34,211,238,0.5)" : "rgba(8,145,178,0.4)",
            learnedNode: isDark ? "#4ade80" : "#16a34a",      // green
            learnedGlow: isDark ? "rgba(74,222,128,0.5)" : "rgba(22,163,74,0.4)",
            ghostNode: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            ghostStroke: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
            lemmaNode: themeColors.accent,
            linkLearning: isDark ? "rgba(34,211,238,0.25)" : "rgba(8,145,178,0.18)",
            linkLearned: isDark ? "rgba(74,222,128,0.25)" : "rgba(22,163,74,0.18)",
            linkGhost: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
            coreGlow: isDark
                ? "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)"
                : "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)",
        };
    }, [theme, themeColors.accent]);

    // ── Build graph data ─────────────────────────────────────────────

    const { initialNodes, initialLinks } = useMemo(() => {
        // Aggregate roots and their lemmas
        const rootMap = new Map<string, { count: number; lemmas: Set<string> }>();
        const lemmaMap = new Map<string, { count: number; roots: Set<string> }>();

        for (const token of tokens) {
            if (!token.root) continue;
            if (!rootMap.has(token.root)) rootMap.set(token.root, { count: 0, lemmas: new Set() });
            const rd = rootMap.get(token.root)!;
            rd.count++;
            rd.lemmas.add(token.lemma);

            if (!lemmaMap.has(token.lemma)) lemmaMap.set(token.lemma, { count: 0, roots: new Set() });
            const ld = lemmaMap.get(token.lemma)!;
            ld.count++;
            ld.roots.add(token.root);
        }

        const trackedSet = new Set(trackedRoots.keys());
        const hasTracked = trackedSet.size > 0;

        // Pick ghost roots for context (only if there are tracked roots)
        const ghostLimit = hasTracked ? Math.min(20, Math.max(8, 40 - trackedSet.size * 3)) : 30;
        const ghosts = pickGhostRoots(rootMap, trackedSet, ghostLimit);

        const activeRoots = hasTracked
            ? [...trackedSet, ...ghosts].filter((r) => rootMap.has(r))
            : ghosts; // Show top roots as preview when nothing is tracked

        const maxFreq = Math.max(...activeRoots.map((r) => rootMap.get(r)?.count ?? 0), 1);

        const nodesResult: KGNode[] = [];
        const linksResult: KGLink[] = [];
        const includedLemmas = new Set<string>();

        for (const root of activeRoots) {
            const data = rootMap.get(root);
            if (!data) continue;

            const tracked = trackedRoots.get(root);
            const isTracked = !!tracked;
            const state = tracked?.state ?? "learning";
            const freqRatio = data.count / maxFreq;
            const baseRadius = isTracked ? 12 + freqRatio * 18 : 4 + freqRatio * 6;

            const nodeColor = isTracked
                ? state === "learned" ? palette.learnedNode : palette.learningNode
                : palette.ghostNode;
            const glowColor = isTracked
                ? state === "learned" ? palette.learnedGlow : palette.learningGlow
                : "transparent";

            nodesResult.push({
                id: `root-${root}`,
                label: root,
                type: isTracked ? "tracked-root" : "ghost-root",
                state: isTracked ? state : undefined,
                frequency: data.count,
                radius: baseRadius,
                color: nodeColor,
                glowColor,
                notes: tracked?.notes,
            });

            // Add lemma branches (top 4 per root for tracked, top 2 for ghosts)
            const lemmaLimit = isTracked ? 4 : 2;
            const rootLemmas = [...data.lemmas]
                .map((l) => ({ lemma: l, data: lemmaMap.get(l)! }))
                .sort((a, b) => b.data.count - a.data.count)
                .slice(0, lemmaLimit);

            for (const { lemma, data: ld } of rootLemmas) {
                if (!includedLemmas.has(lemma)) {
                    includedLemmas.add(lemma);
                    const lemmaFreq = ld.count / maxFreq;
                    nodesResult.push({
                        id: `lemma-${lemma}`,
                        label: lemma,
                        type: "lemma",
                        frequency: ld.count,
                        radius: 3 + lemmaFreq * 6,
                        color: isTracked ? palette.lemmaNode : palette.ghostNode,
                        glowColor: "transparent",
                    });
                }

                const linkColor = isTracked
                    ? state === "learned" ? palette.linkLearned : palette.linkLearning
                    : palette.linkGhost;

                linksResult.push({
                    source: `root-${root}`,
                    target: `lemma-${lemma}`,
                    weight: ld.count,
                    color: linkColor,
                });
            }
        }

        return { initialNodes: nodesResult, initialLinks: linksResult };
    }, [tokens, trackedRoots, palette]);

    // ── Resize observer ──────────────────────────────────────────────

    useEffect(() => {
        setIsMounted(true);
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setDimensions({
                    width: Math.max(entry.contentRect.width, 600),
                    height: Math.max(entry.contentRect.height, 500),
                });
            }
        });

        observer.observe(containerRef.current);
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0) {
            setDimensions({ width: Math.max(rect.width, 600), height: Math.max(rect.height, 500) });
        }

        return () => observer.disconnect();
    }, []);

    // ── D3 Force simulation ──────────────────────────────────────────

    useEffect(() => {
        if (!svgRef.current || initialNodes.length === 0) return;

        const cx = dimensions.width / 2;
        const cy = dimensions.height / 2;
        const nodeCount = initialNodes.length;
        const spread = Math.sqrt(nodeCount) * 22;

        const nodesCopy = initialNodes.map((n) => ({ ...n }));
        const linksCopy = initialLinks.map((l) => ({ ...l }));

        const simulation = d3
            .forceSimulation<KGNode>(nodesCopy)
            .force(
                "link",
                d3
                    .forceLink<KGNode, KGLink>(linksCopy)
                    .id((d) => d.id)
                    .distance((d) => 30 + Math.min((d.weight ?? 1) * 1.2, 25))
                    .strength(0.5)
            )
            .force("charge", d3.forceManyBody().strength(-60 - nodeCount * 0.4).distanceMax(spread * 1.6))
            .force("center", d3.forceCenter(cx, cy))
            .force("collision", d3.forceCollide<KGNode>().radius((d) => d.radius + 3))
            .force(
                "radial",
                d3
                    .forceRadial<KGNode>(
                        (d) => {
                            if (d.type === "tracked-root") return spread * 0.3;
                            if (d.type === "ghost-root") return spread * 0.7;
                            return spread * 0.55;
                        },
                        cx,
                        cy
                    )
                    .strength(0.35)
            );

        simulationRef.current = simulation;
        liveNodesRef.current = nodesCopy;

        simulation.on("tick", () => {
            setNodes([...nodesCopy]);
            setLinks([...linksCopy]);
        });

        simulation.alpha(1).restart();

        // Apply flow layout if already in flow mode when simulation starts
        if (viewMode === "flow") {
            applyFlowLayout(nodesCopy, dimensions);
            simulation.alpha(0.5).restart();
        }

        return () => { simulation.stop(); };
    }, [initialNodes, initialLinks, dimensions]);

    // ── Flow/Neural layout toggle ────────────────────────────────────

    function applyFlowLayout(nodeList: KGNode[], dims: { width: number; height: number }) {
        const rootNodes = nodeList.filter(n => n.type === "tracked-root" || n.type === "ghost-root");
        const lemmaNodes = nodeList.filter(n => n.type === "lemma");

        const rowTopY = dims.height * 0.22;
        const rowBotY = dims.height * 0.78;
        const margin = 60;

        // Sort roots: tracked first, then by frequency
        rootNodes.sort((a, b) => {
            if (a.type !== b.type) return a.type === "tracked-root" ? -1 : 1;
            return b.frequency - a.frequency;
        });

        // Distribute roots evenly across top row
        const rootSpacing = Math.max((dims.width - margin * 2) / Math.max(rootNodes.length - 1, 1), 30);
        rootNodes.forEach((n, i) => {
            n.fx = margin + i * rootSpacing;
            n.fy = rowTopY;
        });

        // Sort lemmas by frequency
        lemmaNodes.sort((a, b) => b.frequency - a.frequency);
        const lemmaSpacing = Math.max((dims.width - margin * 2) / Math.max(lemmaNodes.length - 1, 1), 20);
        lemmaNodes.forEach((n, i) => {
            n.fx = margin + i * lemmaSpacing;
            n.fy = rowBotY;
        });
    }

    function releaseFlowLayout(nodeList: KGNode[]) {
        nodeList.forEach(n => { n.fx = null; n.fy = null; });
    }

    useEffect(() => {
        viewModeRef.current = viewMode;
        if (!simulationRef.current || liveNodesRef.current.length === 0) return;
        const sim = simulationRef.current;
        const nodeList = liveNodesRef.current;

        if (viewMode === "flow") {
            applyFlowLayout(nodeList, dimensions);
            sim.alpha(0.5).restart();
        } else {
            releaseFlowLayout(nodeList);
            sim.alpha(0.8).restart();
        }
    }, [viewMode, dimensions]);

    // ── Zoom/Pan ─────────────────────────────────────────────────────

    useEffect(() => {
        if (!svgRef.current || !gRef.current) return;

        const svg = d3.select(svgRef.current);
        const g = d3.select(gRef.current);

        const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.15, 6])
            .on("zoom", (event) => { g.attr("transform", event.transform.toString()); });

        svg.call(zoomBehavior);

        return () => { svg.on(".zoom", null); };
    }, [isMounted, dimensions]);

    // ── D3 Drag ──────────────────────────────────────────────────────

    useEffect(() => {
        if (!gRef.current || !simulationRef.current) return;

        const simulation = simulationRef.current;
        const g = d3.select(gRef.current);

        let draggedNode: KGNode | null = null;

        const dragBehavior = d3.drag<SVGGElement, unknown>()
            .on("start", (event) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                const el = (event.sourceEvent?.target as Element)?.closest?.(".kg-node") as SVGGElement | null;
                const nodeId = el?.getAttribute("data-node-id");
                draggedNode = liveNodesRef.current.find((n) => n.id === nodeId) ?? null;
                if (draggedNode) { draggedNode.fx = draggedNode.x; draggedNode.fy = draggedNode.y; }
            })
            .on("drag", (event) => {
                if (draggedNode) { draggedNode.fx = event.x; draggedNode.fy = event.y; }
            })
            .on("end", (event) => {
                if (!event.active) simulation.alphaTarget(0);
                if (draggedNode) {
                    if (viewModeRef.current === "flow") {
                        draggedNode.fx = event.x;
                        draggedNode.fy = event.y;
                    } else {
                        draggedNode.fx = null;
                        draggedNode.fy = null;
                    }
                }
                draggedNode = null;
            });

        g.selectAll<SVGGElement, unknown>(".kg-node").call(dragBehavior);

        return () => {
            g.selectAll<SVGGElement, unknown>(".kg-node").on(".drag", null);
        };
    }, [nodes]);

    // ── Interaction handlers ─────────────────────────────────────────

    const handleNodeClick = useCallback(
        (node: KGNode) => {
            setSelectedNode(node.id === selectedNode ? null : node.id);
            if (node.type !== "lemma" && onRootSelect) {
                onRootSelect(node.label);
            }
        },
        [selectedNode, onRootSelect]
    );

    const isLinkHighlighted = useCallback(
        (link: KGLink) => {
            const highlightId = hoveredNode ?? selectedNode;
            if (!highlightId) return false;
            const sid = typeof link.source === "string" ? link.source : (link.source as KGNode).id;
            const tid = typeof link.target === "string" ? link.target : (link.target as KGNode).id;
            return sid === highlightId || tid === highlightId;
        },
        [hoveredNode, selectedNode]
    );

    // ── Empty state ──────────────────────────────────────────────────

    const hasTracked = stats.total > 0;

    // ── Render ───────────────────────────────────────────────────────

    return (
        <section className="immersive-viz" data-theme={theme}>
            {/* Floating stats pill */}
            <div className="viz-controls floating-controls" style={{ pointerEvents: "none" }}>
                <p className="ayah-meta-glass" style={{ pointerEvents: "auto" }}>
                    {nodes.filter(n => n.type === "tracked-root" || n.type === "ghost-root").length} roots · {nodes.filter(n => n.type === "lemma").length} lemmas · {links.length} connections
                    {hasTracked && ` · ${stats.total} tracked`}
                    {!hasTracked && " · Select roots to begin tracking"}
                </p>
            </div>

            {/* Graph switch toggle */}
            <div className="kg-view-switch" data-tour-id="kg-view-switch">
                <button
                    className={`kg-switch-btn ${viewMode === "neural" ? "active" : ""}`}
                    onClick={() => setViewMode("neural")}
                    title="Neural Map"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <circle cx="4" cy="6" r="2" />
                        <circle cx="20" cy="6" r="2" />
                        <circle cx="4" cy="18" r="2" />
                        <circle cx="20" cy="18" r="2" />
                        <line x1="9.5" y1="10" x2="5.5" y2="7.5" />
                        <line x1="14.5" y1="10" x2="18.5" y2="7.5" />
                        <line x1="9.5" y1="14" x2="5.5" y2="16.5" />
                        <line x1="14.5" y1="14" x2="18.5" y2="16.5" />
                    </svg>
                    Neural
                </button>
                <button
                    className={`kg-switch-btn ${viewMode === "flow" ? "active" : ""}`}
                    onClick={() => setViewMode("flow")}
                    title="Flow Chart"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="6" cy="4" r="2" />
                        <circle cx="12" cy="4" r="2" />
                        <circle cx="18" cy="4" r="2" />
                        <circle cx="8" cy="20" r="2" />
                        <circle cx="16" cy="20" r="2" />
                        <path d="M6 6 C6 12, 8 14, 8 18" />
                        <path d="M12 6 C12 12, 8 14, 8 18" />
                        <path d="M12 6 C12 12, 16 14, 16 18" />
                        <path d="M18 6 C18 12, 16 14, 16 18" />
                    </svg>
                    Flow
                </button>
            </div>

            <div
                ref={containerRef}
                className="viz-container"
                style={{ width: "100vw", height: "100vh", position: "absolute", top: 0, left: 0 }}
            >
                {/* Empty-state overlay */}
                {!hasTracked && isMounted && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 10,
                            pointerEvents: "none",
                            textAlign: "center",
                            gap: 12,
                        }}
                    >
                        <span style={{ fontSize: "3rem", opacity: 0.2 }}>🌱</span>
                        <p style={{ color: themeColors.textColors.muted, fontSize: "0.95rem", maxWidth: 320, lineHeight: 1.6 }}>
                            Your knowledge garden is empty.<br />
                            <strong style={{ color: themeColors.textColors.secondary }}>Select a root</strong> in any
                            visualization and click &ldquo;Start Learning&rdquo; to plant your first seed.
                        </p>
                    </div>
                )}

                {!isMounted ? null : (
                    <svg
                        ref={svgRef}
                        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
                        className="viz-canvas"
                        style={{ width: "100%", height: "100%", cursor: "grab" }}
                    >
                        <g ref={gRef}>
                            <defs>
                                {/* Core glow gradient */}
                                <radialGradient id="kg-coreGlow" cx="50%" cy="50%" r="50%">
                                    <stop offset="0%" stopColor={palette.learningGlow} />
                                    <stop offset="60%" stopColor="transparent" />
                                </radialGradient>

                                {/* Node glow filter */}
                                <filter id="kg-glow" x="-100%" y="-100%" width="300%" height="300%">
                                    <feGaussianBlur stdDeviation="8" result="blur" />
                                    <feMerge>
                                        <feMergeNode in="blur" />
                                        <feMergeNode in="blur" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>

                                <filter id="kg-subtleGlow" x="-50%" y="-50%" width="200%" height="200%">
                                    <feGaussianBlur stdDeviation="4" result="blur" />
                                    <feMerge>
                                        <feMergeNode in="blur" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                            </defs>

                            {/* Background core glow */}
                            {hasTracked && (
                                <circle
                                    cx={dimensions.width / 2}
                                    cy={dimensions.height / 2}
                                    r={Math.min(dimensions.width, dimensions.height) * 0.25}
                                    fill="url(#kg-coreGlow)"
                                    opacity={0.6}
                                />
                            )}

                            {/* Links — curved Bezier (quadratic in neural, cubic in flow) */}
                            <g className="links">
                                {links.map((link, idx) => {
                                    const source = link.source as KGNode;
                                    const target = link.target as KGNode;
                                    if (!source.x || !source.y || !target.x || !target.y) return null;

                                    const highlighted = isLinkHighlighted(link);

                                    let pathD: string;
                                    if (viewMode === "flow") {
                                        // Vertical cubic Bezier (Sankey-style)
                                        const cy1 = source.y + (target.y - source.y) * 0.4;
                                        const cy2 = source.y + (target.y - source.y) * 0.6;
                                        pathD = `M ${source.x} ${source.y} C ${source.x} ${cy1}, ${target.x} ${cy2}, ${target.x} ${target.y}`;
                                    } else {
                                        // Sideways quadratic Bezier (neural-style)
                                        const midX = (source.x + target.x) / 2;
                                        const midY = (source.y + target.y) / 2;
                                        const dx = target.x - source.x;
                                        const dy = target.y - source.y;
                                        const nx = -dy * 0.2;
                                        const ny = dx * 0.2;
                                        pathD = `M ${source.x} ${source.y} Q ${midX + nx} ${midY + ny} ${target.x} ${target.y}`;
                                    }

                                    return (
                                        <motion.path
                                            key={idx}
                                            d={pathD}
                                            fill="none"
                                            stroke={highlighted ? themeColors.accent : link.color}
                                            strokeWidth={highlighted ? 2.5 : 1}
                                            initial={{ pathLength: 0, opacity: 0 }}
                                            animate={{ pathLength: 1, opacity: highlighted ? 0.85 : 0.5 }}
                                            transition={{ duration: 1.2, delay: idx * 0.004 }}
                                            filter={highlighted ? "url(#kg-subtleGlow)" : undefined}
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
                                    const isHighlighted = isHovered || isSelected;
                                    const isTrackedRoot = node.type === "tracked-root";
                                    const isGhost = node.type === "ghost-root";

                                    return (
                                        <g
                                            key={node.id}
                                            className="kg-node"
                                            data-node-id={node.id}
                                            transform={`translate(${node.x},${node.y})`}
                                            style={{ cursor: "grab" }}
                                            onMouseEnter={() => setHoveredNode(node.id)}
                                            onMouseLeave={() => setHoveredNode(null)}
                                            onClick={() => handleNodeClick(node)}
                                        >
                                            {/* Pulsing ring for tracked roots */}
                                            {isTrackedRoot && (
                                                <motion.circle
                                                    r={node.radius + 10}
                                                    fill="none"
                                                    stroke={node.color}
                                                    strokeWidth={1.5}
                                                    opacity={0.4}
                                                    initial={{ scale: 0.9, opacity: 0 }}
                                                    animate={{
                                                        scale: node.state === "learning" ? [1, 1.3, 1] : 1.15,
                                                        opacity: node.state === "learning" ? [0.4, 0.1, 0.4] : 0.3,
                                                    }}
                                                    transition={
                                                        node.state === "learning"
                                                            ? { repeat: Infinity, duration: 2.5, ease: "easeInOut" }
                                                            : { duration: 0.5 }
                                                    }
                                                />
                                            )}

                                            {/* Main node circle */}
                                            <circle
                                                r={node.radius}
                                                fill={isHighlighted ? themeColors.accent : node.color}
                                                stroke={
                                                    isTrackedRoot
                                                        ? node.color
                                                        : isGhost
                                                            ? palette.ghostStroke
                                                            : "rgba(255,255,255,0.15)"
                                                }
                                                strokeWidth={isTrackedRoot ? 2 : 0.5}
                                                filter={isTrackedRoot || isHighlighted ? "url(#kg-glow)" : undefined}
                                            />

                                            {/* Inner bright dot for tracked roots */}
                                            {isTrackedRoot && (
                                                <circle r={node.radius * 0.25} fill="rgba(255,255,255,0.35)" />
                                            )}

                                            {/* Label */}
                                            {(isHighlighted || isTrackedRoot) && (
                                                <text
                                                    className="node-label arabic-text"
                                                    y={node.radius + 16}
                                                    style={{
                                                        opacity: isHighlighted ? 1 : 0.75,
                                                        fontSize: isTrackedRoot ? "13px" : "10px",
                                                        fontWeight: isTrackedRoot ? 600 : 400,
                                                        fill: themeColors.textColors.primary,
                                                        textAnchor: "middle",
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

                {/* Info card */}
                <AnimatePresence>
                    {(hoveredNode || selectedNode) && (
                        <motion.div
                            className="kg-info-card"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            transition={{ duration: 0.18 }}
                        >
                            {(() => {
                                const node = nodes.find((n) => n.id === (hoveredNode ?? selectedNode));
                                if (!node) return null;
                                const isGhost = node.type === "ghost-root";
                                const statusLabel = node.type === "tracked-root"
                                    ? node.state === "learned" ? "✓ Learned" : "Learning…"
                                    : isGhost ? "Untracked" : "Lemma";
                                return (
                                    <>
                                        <span className="kg-info-word arabic-text">{node.label}</span>
                                        <span className="kg-info-divider">·</span>
                                        <span className="kg-info-meta">{statusLabel}</span>
                                        <span className="kg-info-divider">·</span>
                                        <span className="kg-info-meta">{node.frequency}×</span>
                                        {isGhost && (
                                            <button
                                                className="kg-info-track-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    trackRoot(node.label);
                                                    setSelectedNode(null);
                                                    setHoveredNode(null);
                                                }}
                                            >
                                                + Track
                                            </button>
                                        )}
                                    </>
                                );
                            })()}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Legend portal */}
            {isMounted &&
                typeof document !== "undefined" &&
                document.getElementById("viz-sidebar-portal") &&
                createPortal(
                    <div className="viz-legend" data-tour-id="viz-legend">
                        <div className="viz-legend-item">
                            <div
                                className="viz-legend-dot"
                                style={{ background: palette.learningNode, width: 14, height: 14, borderRadius: "50%", boxShadow: `0 0 8px ${palette.learningGlow}` }}
                            />
                            <span>Learning</span>
                        </div>
                        <div className="viz-legend-item">
                            <div
                                className="viz-legend-dot"
                                style={{ background: palette.learnedNode, width: 14, height: 14, borderRadius: "50%", boxShadow: `0 0 8px ${palette.learnedGlow}` }}
                            />
                            <span>Learned</span>
                        </div>
                        <div className="viz-legend-item">
                            <div
                                className="viz-legend-dot"
                                style={{ background: palette.ghostNode, width: 10, height: 10, borderRadius: "50%", border: `1px solid ${palette.ghostStroke}` }}
                            />
                            <span>Untracked</span>
                        </div>
                        <div className="viz-legend-item">
                            <div
                                className="viz-legend-dot"
                                style={{ background: palette.lemmaNode, width: 8, height: 8, borderRadius: "50%" }}
                            />
                            <span>Lemma</span>
                        </div>
                    </div>,
                    document.getElementById("viz-sidebar-portal")!
                )}
        </section>
    );
}
