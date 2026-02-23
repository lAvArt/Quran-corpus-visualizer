"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import * as d3 from "d3";
import { motion, AnimatePresence } from "framer-motion";
import type { CorpusToken } from "@/lib/schema/types";
import { resolveVisualizationTheme } from "@/lib/schema/visualizationTypes";
import { useTranslations } from "next-intl";
import { calculateRootFrequencies, getCollocations, type CollocationOptions } from "@/lib/search/collocation";
import { HelpIcon, VizExplainerDialog } from "@/components/ui/VizExplainerDialog";

interface CollocationNetworkGraphProps {
    tokens: CorpusToken[];
    onTokenHover: (tokenId: string | null) => void;
    onTokenFocus: (tokenId: string) => void;
    onRootSelect?: (root: string | null) => void;
    highlightRoot?: string | null;
    selectedSurahId?: number;
    theme?: "light" | "dark";
}

interface CollocationNode {
    id: string;
    label: string;
    type: "target" | "collocate" | "tendril";
    count: number;
    pmi: number;
    anchorAngle: number;
    anchorDistance: number;
    cluster: number;
    parentId?: string;
    x?: number;
    y?: number;
    fx?: number | null;
    fy?: number | null;
    radius: number;
    color: string;
    sampleLemmas: string[];
}

interface CollocationLink {
    source: string | CollocationNode;
    target: string | CollocationNode;
    pmi: number;
    weight: number;
    kind: "trunk" | "branch";
    color: string;
    intensity: number;
}

interface StarPoint {
    x: number;
    y: number;
    radius: number;
    opacity: number;
    color: string;
}

const FALLBACK_NEON_PALETTE = ["#66F8FF", "#92A7FF", "#D493FF", "#76FFC7", "#FFD39D", "#7CC2FF"];

function hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function mulberry32(seed: number) {
    let t = seed;
    return () => {
        t += 0x6d2b79f5;
        let x = Math.imul(t ^ (t >>> 15), 1 | t);
        x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}

function withAlpha(colorValue: string, alpha: number): string {
    const color = d3.color(colorValue);
    if (!color) return colorValue;
    color.opacity = Math.max(0, Math.min(1, alpha));
    return color.formatRgb();
}

function brighten(colorValue: string, amount: number): string {
    const color = d3.hsl(colorValue);
    color.l = Math.min(0.92, color.l + amount * 0.35);
    color.s = Math.min(1, color.s + amount * 0.2);
    return color.formatHex();
}

function tuneForTheme(colorValue: string, theme: "light" | "dark", lift: number): string {
    const color = d3.hsl(colorValue);
    if (theme === "dark") {
        color.l = Math.min(0.88, color.l + lift);
        color.s = Math.min(1, color.s + 0.08);
    } else {
        color.l = Math.max(0.25, color.l - lift * 0.35);
        color.s = Math.min(1, color.s + 0.05);
    }
    return color.formatHex();
}

function buildCurvedPath(source: CollocationNode, target: CollocationNode, bendScale: number): string {
    const sx = source.x ?? 0;
    const sy = source.y ?? 0;
    const tx = target.x ?? 0;
    const ty = target.y ?? 0;
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.max(Math.hypot(dx, dy), 1);
    const nx = -dy / dist;
    const ny = dx / dist;
    const direction = hashString(`${source.id}:${target.id}`) % 2 === 0 ? 1 : -1;
    const bend = Math.min(120, dist * bendScale) * direction;
    const cx = (sx + tx) / 2 + nx * bend;
    const cy = (sy + ty) / 2 + ny * bend;
    return `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;
}

export default function CollocationNetworkGraph({
    tokens,
    onTokenHover: _onTokenHover,
    onTokenFocus: _onTokenFocus,
    onRootSelect,
    highlightRoot,
    selectedSurahId: _selectedSurahId,
    theme = "dark",
}: CollocationNetworkGraphProps) {
    const t = useTranslations("Visualizations.CollocationNetwork");
    const ts = useTranslations("Visualizations.Shared");
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const simulationRef = useRef<d3.Simulation<CollocationNode, CollocationLink> | null>(null);
    const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    const gRef = useRef<SVGGElement>(null);

    const [dimensions, setDimensions] = useState({ width: 900, height: 650 });
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [nodes, setNodes] = useState<CollocationNode[]>([]);
    const [links, setLinks] = useState<CollocationLink[]>([]);
    const [isMounted, setIsMounted] = useState(false);
    const [isTouchPrimaryInput, setIsTouchPrimaryInput] = useState(false);
    const liveNodesRef = useRef<CollocationNode[]>([]);

    // Controls
    const [windowType, setWindowType] = useState<CollocationOptions["windowType"]>("ayah");
    const [distance, setDistance] = useState<number>(3);
    const [minFrequency, setMinFrequency] = useState<number>(2);
    const [showHelp, setShowHelp] = useState(false);

    const themeColors = resolveVisualizationTheme(theme);
    const neonPalette = useMemo(() => {
        const source = [
            themeColors.accent,
            themeColors.accentSecondary,
            themeColors.glowColors.accent,
            themeColors.glowColors.secondary,
            themeColors.nodeColors.default,
            themeColors.nodeColors.selected,
        ].filter(Boolean);
        const base = source.length >= 4 ? source : FALLBACK_NEON_PALETTE;
        return base.map((color, index) => tuneForTheme(color, theme, 0.1 + index * 0.03));
    }, [
        theme,
        themeColors.accent,
        themeColors.accentSecondary,
        themeColors.glowColors.accent,
        themeColors.glowColors.secondary,
        themeColors.nodeColors.default,
        themeColors.nodeColors.selected,
    ]);
    const starPalette = useMemo(
        () => neonPalette.map((color, index) => tuneForTheme(color, theme, 0.18 + index * 0.02)),
        [neonPalette, theme]
    );
    const canvasSurface = useMemo(() => {
        const base = d3.hsl(themeColors.background);
        const inner = base.copy();
        inner.l = Math.min(0.96, base.l + (theme === "dark" ? 0.16 : 0.08));
        inner.s = Math.min(1, base.s + 0.08);
        const mid = base.copy();
        mid.l = Math.min(0.92, base.l + (theme === "dark" ? 0.07 : 0.04));
        mid.s = Math.min(1, base.s + 0.04);
        const outer = base.copy();
        outer.l = Math.max(0.03, base.l - (theme === "dark" ? 0.03 : 0.01));
        outer.s = Math.max(0.05, base.s - 0.03);
        return {
            inner: inner.formatHex(),
            mid: mid.formatHex(),
            outer: outer.formatHex(),
            section: `radial-gradient(circle at 50% 45%, ${inner.formatHex()} 0%, ${mid.formatHex()} 42%, ${outer.formatHex()} 100%)`,
        };
    }, [theme, themeColors.background]);
    const panelBg = useMemo(
        () => (theme === "dark" ? "rgba(5, 10, 21, 0.74)" : "rgba(247, 251, 255, 0.9)"),
        [theme]
    );
    const panelBorder = useMemo(
        () => (theme === "dark" ? "rgba(126, 168, 255, 0.34)" : "rgba(35, 74, 133, 0.24)"),
        [theme]
    );
    const labelStroke = theme === "dark" ? "#05080e" : "rgba(255, 255, 255, 0.95)";
    const targetNodeFill = theme === "dark" ? "#E7F2FF" : tuneForTheme(themeColors.nodeColors.default, theme, 0.04);
    const legendStrong = withAlpha(themeColors.accentSecondary, theme === "dark" ? 0.88 : 0.8);
    const legendSoft = withAlpha(themeColors.edgeColors.default, theme === "dark" ? 0.75 : 0.6);

    const vizId = useMemo(() => `colloc-neural-${hashString(highlightRoot ?? "none")}`, [highlightRoot]);

    const freqData = useMemo(() => calculateRootFrequencies(tokens), [tokens]);

    const { initialNodes, initialLinks } = useMemo(() => {
        if (!highlightRoot) return { initialNodes: [], initialLinks: [] };

        const results = getCollocations(highlightRoot, tokens, freqData, { windowType, distance, minFrequency });
        if (results.length === 0) return { initialNodes: [], initialLinks: [] };

        const topResults = results.slice(0, 34);
        const [rawMinPmi = 0, rawMaxPmi = 1] = d3.extent(topResults, (d) => d.pmi);
        const minPmi = Number.isFinite(rawMinPmi) ? rawMinPmi : 0;
        const maxPmi = Number.isFinite(rawMaxPmi) ? rawMaxPmi : 1;
        const pmiDomain: [number, number] = minPmi === maxPmi ? [minPmi - 1, maxPmi + 1] : [minPmi, maxPmi];
        const maxCount = Math.max(...topResults.map((d) => d.count), 1);

        const pmiNorm = d3.scaleLinear().domain(pmiDomain).range([0, 1]).clamp(true);
        const radiusScale = d3.scaleSqrt().domain(pmiDomain).range([6, 16]).clamp(true);
        const distanceScale = d3.scaleLinear().domain([pmiDomain[1], pmiDomain[0]]).range([140, 370]).clamp(true);
        const tendrilScale = d3.scaleLinear().domain([1, maxCount]).range([2, 10]).clamp(true);

        const nodesResult: CollocationNode[] = [];
        const linksResult: CollocationLink[] = [];

        const sectorCount = Math.min(7, Math.max(4, Math.ceil(Math.sqrt(topResults.length))));
        const sectorAngles = d3
            .range(sectorCount)
            .map((idx) => (-Math.PI * 0.95) + (idx * Math.PI * 1.9) / Math.max(1, sectorCount - 1));

        nodesResult.push({
            id: `root-${highlightRoot}`,
            label: highlightRoot,
            type: "target",
            count: windowType === "ayah" ? (freqData.rootAyahFrequencies.get(highlightRoot) || 0) : (freqData.rootFrequencies.get(highlightRoot) || 0),
            pmi: pmiDomain[1],
            radius: 13,
            color: themeColors.accent,
            sampleLemmas: [],
            cluster: -1,
            anchorAngle: 0,
            anchorDistance: 0,
        });

        for (let index = 0; index < topResults.length; index++) {
            const res = topResults[index];
            const rng = mulberry32(hashString(`${highlightRoot}:${res.root}:${index}`));
            const cluster = hashString(res.root) % sectorCount;
            const angle = sectorAngles[cluster] + (rng() - 0.5) * 0.52;
            const anchorDistance = distanceScale(res.pmi) + rng() * 40;
            const baseColor = neonPalette[(hashString(res.root + highlightRoot) + index) % neonPalette.length];
            const intensity = pmiNorm(res.pmi);
            const nodeColor = brighten(baseColor, 0.2 + intensity * 0.45);

            nodesResult.push({
                id: `root-${res.root}`,
                label: res.root,
                type: "collocate",
                count: res.count,
                pmi: res.pmi,
                radius: radiusScale(res.pmi),
                color: nodeColor,
                sampleLemmas: res.sampleLemmas,
                cluster,
                anchorAngle: angle,
                anchorDistance,
            });

            linksResult.push({
                source: `root-${highlightRoot}`,
                target: `root-${res.root}`,
                pmi: res.pmi,
                weight: res.count,
                kind: "trunk",
                color: baseColor,
                intensity,
            });

            const branchLabels = Array.from(new Set(res.sampleWindows.length > 0 ? res.sampleWindows : res.sampleLemmas));
            const baseTendrilCount = Math.max(2, Math.round(tendrilScale(res.count) + intensity * 2));
            const tendrilCount = Math.max(1, Math.min(baseTendrilCount, branchLabels.length || 1));
            for (let i = 0; i < tendrilCount; i++) {
                const tendrilAngle = angle + (rng() - 0.5) * 1.1;
                const tendrilDistance = anchorDistance + 28 + rng() * 110;
                const tendrilRadius = 1.2 + rng() * 1.9 + intensity * 0.8;
                const tendrilColor = brighten(baseColor, 0.35 + rng() * 0.4);
                const tendrilId = `tendril-${res.root}-${i}`;
                const tendrilLabel = branchLabels[i] ?? `${res.root}:${i + 1}`;

                nodesResult.push({
                    id: tendrilId,
                    label: tendrilLabel,
                    type: "tendril",
                    count: 1,
                    pmi: res.pmi,
                    radius: tendrilRadius,
                    color: tendrilColor,
                    sampleLemmas: [],
                    cluster,
                    anchorAngle: tendrilAngle,
                    anchorDistance: tendrilDistance,
                    parentId: `root-${res.root}`,
                });

                linksResult.push({
                    source: `root-${res.root}`,
                    target: tendrilId,
                    pmi: res.pmi,
                    weight: 1 + rng(),
                    kind: "branch",
                    color: tendrilColor,
                    intensity,
                });
            }
        }

        return { initialNodes: nodesResult, initialLinks: linksResult };
    }, [highlightRoot, tokens, freqData, windowType, distance, minFrequency, themeColors.accent, neonPalette]);

    const stars = useMemo(() => {
        const seed = hashString(`${highlightRoot ?? "none"}:${dimensions.width}:${dimensions.height}`);
        const rng = mulberry32(seed);
        const count = Math.max(120, Math.round((dimensions.width * dimensions.height) / 13000));
        const points: StarPoint[] = [];

        for (let i = 0; i < count; i++) {
            points.push({
                x: rng() * dimensions.width,
                y: rng() * dimensions.height,
                radius: 0.3 + rng() * 1.35,
                opacity: 0.12 + rng() * 0.55,
                color: starPalette[Math.floor(rng() * starPalette.length)],
            });
        }

        return points;
    }, [highlightRoot, dimensions.width, dimensions.height, starPalette]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const hoverPrimaryMedia = window.matchMedia("(hover: hover)");
        const hoverAnyMedia = window.matchMedia("(any-hover: hover)");
        const coarsePrimaryMedia = window.matchMedia("(pointer: coarse)");
        const updateInputMode = () => {
            // Keep desktop hover whenever any hover-capable pointer exists (mouse/trackpad),
            // even on hybrid devices that also have touch input.
            const hasAnyHover = hoverPrimaryMedia.matches || hoverAnyMedia.matches;
            const isCoarsePrimary = coarsePrimaryMedia.matches;
            setIsTouchPrimaryInput(!hasAnyHover && isCoarsePrimary);
        };

        updateInputMode();
        hoverPrimaryMedia.addEventListener("change", updateInputMode);
        hoverAnyMedia.addEventListener("change", updateInputMode);
        coarsePrimaryMedia.addEventListener("change", updateInputMode);
        return () => {
            hoverPrimaryMedia.removeEventListener("change", updateInputMode);
            hoverAnyMedia.removeEventListener("change", updateInputMode);
            coarsePrimaryMedia.removeEventListener("change", updateInputMode);
        };
    }, []);

    useEffect(() => {
        if (!isTouchPrimaryInput) return;
        // Hover does not apply on touch-first devices; keep panel state selection-driven.
        setHoveredNode(null);
    }, [isTouchPrimaryInput]);

    // Handle Resize
    useEffect(() => {
        setIsMounted(true);
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setDimensions({
                    width: Math.max(entry.contentRect.width, 900),
                    height: Math.max(entry.contentRect.height, 800),
                });
            }
        });

        observer.observe(containerRef.current);
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            setDimensions({ width: Math.max(rect.width, 600), height: Math.max(rect.height, 500) });
        }
        return () => observer.disconnect();
    }, []);

    // Initialize D3 force simulation
    useEffect(() => {
        if (!svgRef.current || initialNodes.length === 0) {
            setNodes([]);
            setLinks([]);
            return;
        }

        const centerX = dimensions.width / 2;
        const centerY = dimensions.height / 2;
        const nodesCopy = initialNodes.map((node) => ({ ...node }));
        const linksCopy = initialLinks.map((link) => ({ ...link }));

        for (const node of nodesCopy) {
            const rng = mulberry32(hashString(`${highlightRoot ?? "none"}:${node.id}`));
            const anchorX = centerX + Math.cos(node.anchorAngle) * node.anchorDistance;
            const anchorY = centerY + Math.sin(node.anchorAngle) * node.anchorDistance;
            node.x = anchorX + (rng() - 0.5) * 18;
            node.y = anchorY + (rng() - 0.5) * 18;
            node.fx = null;
            node.fy = null;
        }

        const targetNode = nodesCopy.find((node) => node.type === "target");
        if (targetNode) {
            targetNode.fx = centerX;
            targetNode.fy = centerY;
            targetNode.x = centerX;
            targetNode.y = centerY;
        }

        const simulation = d3
            .forceSimulation<CollocationNode>(nodesCopy)
            .force(
                "link",
                d3
                    .forceLink<CollocationNode, CollocationLink>(linksCopy)
                    .id((d) => d.id)
                    .distance((d) => {
                        if (d.kind === "trunk") {
                            const target = typeof d.target === "string"
                                ? nodesCopy.find((n) => n.id === d.target)
                                : d.target;
                            return Math.max(95, (target?.anchorDistance ?? 160) * 0.55);
                        }
                        return 22 + d.weight * 26;
                    })
                    .strength((d) => (d.kind === "trunk" ? 0.12 : 0.52))
            )
            .force(
                "charge",
                d3
                    .forceManyBody<CollocationNode>()
                    .strength((d) => {
                        if (d.type === "target") return -320;
                        if (d.type === "collocate") return -60;
                        return -8;
                    })
                    .distanceMax(320)
            )
            .force(
                "collision",
                d3.forceCollide<CollocationNode>().radius((d) => (d.type === "tendril" ? d.radius + 1.1 : d.radius + 4))
            )
            .force(
                "x",
                d3
                    .forceX<CollocationNode>((d) => centerX + Math.cos(d.anchorAngle) * d.anchorDistance)
                    .strength((d) => (d.type === "target" ? 1 : d.type === "collocate" ? 0.06 : 0.01))
            )
            .force(
                "y",
                d3
                    .forceY<CollocationNode>((d) => centerY + Math.sin(d.anchorAngle) * d.anchorDistance)
                    .strength((d) => (d.type === "target" ? 1 : d.type === "collocate" ? 0.06 : 0.01))
            )
            .alphaDecay(0.028);

        simulationRef.current = simulation;
        liveNodesRef.current = nodesCopy;

        simulation.on("tick", () => {
            setNodes([...nodesCopy]);
            setLinks([...linksCopy]);
        });

        simulation.alpha(1).restart();
        return () => {
            simulation.stop();
        };
    }, [initialNodes, initialLinks, dimensions, highlightRoot]);

    // Setup Zoom/Pan
    useEffect(() => {
        if (!svgRef.current || !gRef.current) return;
        const svg = d3.select(svgRef.current);
        const g = d3.select(gRef.current);

        const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.25, 9])
            .on("zoom", (event) => {
                g.attr("transform", event.transform.toString());
            });

        zoomBehaviorRef.current = zoomBehavior;
        svg.call(zoomBehavior);

        const initialTransform = d3.zoomIdentity
            .translate(dimensions.width / 2, dimensions.height / 2)
            .scale(0.92)
            .translate(-dimensions.width / 2, -dimensions.height / 2);
        svg.call(zoomBehavior.transform, initialTransform);

        return () => { svg.on(".zoom", null); };
    }, [isMounted, dimensions]);

    // Drag behavior
    useEffect(() => {
        if (!gRef.current || !simulationRef.current) return;
        const simulation = simulationRef.current;
        const g = d3.select(gRef.current);

        const dragBehavior = d3.drag<SVGGElement, unknown, { id?: string }>()
            .subject((event) => {
                const el = (event.sourceEvent?.target as Element)?.closest?.(".cn-draggable");
                const id = el?.getAttribute("data-node-id");
                return { id: id ?? undefined };
            })
            .clickDistance(isTouchPrimaryInput ? 10 : 2)
            .on("start", (event) => {
                if (!event.active) simulation.alphaTarget(0.35).restart();
                const nodeId = event.subject?.id;
                if (!nodeId) return;
                const node = liveNodesRef.current.find((n) => n.id === nodeId);
                if (node) { node.fx = node.x; node.fy = node.y; }
            })
            .on("drag", (event) => {
                const nodeId = event.subject?.id;
                if (!nodeId) return;
                const node = liveNodesRef.current.find((n) => n.id === nodeId);
                if (node) { node.fx = event.x; node.fy = event.y; }
            })
            .on("end", (event) => {
                if (!event.active) simulation.alphaTarget(0);
                const nodeId = event.subject?.id;
                if (!nodeId) return;
                const node = liveNodesRef.current.find((n) => n.id === nodeId);
                if (node && node.type === "collocate") {
                    // Keep dragged collocates where the user drops them.
                    node.fx = event.x;
                    node.fy = event.y;
                }
            });

        g.selectAll<SVGGElement, unknown>(".cn-draggable").call(dragBehavior);
        return () => { g.selectAll<SVGGElement, unknown>(".cn-draggable").on(".drag", null); };
    }, [nodes, isTouchPrimaryInput]);

    const handleNodeMouseEnter = useCallback(
        (nodeId: string) => {
            if (isTouchPrimaryInput) return;
            setHoveredNode(nodeId);
        },
        [isTouchPrimaryInput]
    );

    const handleNodeMouseLeave = useCallback(
        (nodeId: string) => {
            if (isTouchPrimaryInput) return;
            setHoveredNode((current) => (current === nodeId ? null : current));
        },
        [isTouchPrimaryInput]
    );

    const handleNodeClick = useCallback(
        (node: CollocationNode) => {
            if (node.type === "tendril") return;
            const next = selectedNode === node.id ? null : node.id;
            setSelectedNode(next);
            if (onRootSelect) onRootSelect(next ? node.label : null);
        },
        [selectedNode, onRootSelect]
    );

    const sidebarNode = useMemo(() => {
        const targetId = highlightRoot ? `root-${highlightRoot}` : null;
        const currentId = isTouchPrimaryInput
            ? (selectedNode ?? targetId)
            : (hoveredNode ?? selectedNode ?? targetId);
        if (!currentId) return null;

        const current = nodes.find((n) => n.id === currentId);
        if (!current) {
            if (!highlightRoot) return null;
            return {
                id: targetId!,
                label: highlightRoot,
                type: "target",
                count: windowType === "ayah"
                    ? (freqData.rootAyahFrequencies.get(highlightRoot) || 0)
                    : (freqData.rootFrequencies.get(highlightRoot) || 0),
                pmi: 0,
                anchorAngle: 0,
                anchorDistance: 0,
                cluster: -1,
                radius: 13,
                color: themeColors.accent,
                sampleLemmas: [],
            } satisfies CollocationNode;
        }

        return current;
    }, [nodes, hoveredNode, selectedNode, highlightRoot, windowType, freqData, themeColors.accent, isTouchPrimaryInput]);
    const sidebarParentNode = useMemo(() => {
        if (!sidebarNode || sidebarNode.type !== "tendril" || !sidebarNode.parentId) return null;
        return nodes.find((n) => n.id === sidebarNode.parentId) ?? null;
    }, [sidebarNode, nodes]);
    const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

    if (!highlightRoot) {
        return (
            <section
                className="immersive-viz"
                data-theme={theme}
                style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    background: canvasSurface.section,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 16 }}>
                    <div style={{ fontSize: "2.6rem", opacity: 0.2, color: "#9bb8ff" }}>0</div>
                    <p style={{ color: "#b7c3e2", textAlign: "center", maxWidth: 420 }}>{t("noData")}</p>
                </div>
            </section>
        );
    }

    return (
        <section
            className="immersive-viz"
            data-theme={theme}
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
                overflow: "hidden",
                background: canvasSurface.section,
            }}
        >
            <VizExplainerDialog
                isOpen={showHelp}
                onClose={() => setShowHelp(false)}
                content={{
                    title: t("Help.title"),
                    description: t("Help.description"),
                    sections: [
                        { label: t("Help.graphLabel"), text: t("Help.graphText") },
                        { label: t("Help.pmiLabel"), text: t("Help.pmiText") },
                        { label: t("Help.windowLabel"), text: t("Help.windowText") },
                    ],
                }}
                theme={theme}
            />


            <div className="viz-controls floating-controls">
                <div className="ayah-meta-wrapper" style={{ background: panelBg, borderColor: panelBorder }}>
                    <button
                        className="kg-reset-btn"
                        onClick={() => {
                            if (svgRef.current && zoomBehaviorRef.current) {
                                d3.select(svgRef.current).transition().duration(650)
                                    .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
                            }
                        }}
                        title={ts("reset")}
                        style={{ background: "rgba(26, 36, 66, 0.55)", color: "#d5e6ff" }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 14v4h4M20 10V6h-4M4 10V6h4M20 14v4h-4M10 10l-6-6M14 14l6 6M10 14l-6 6M14 10l6-6" />
                        </svg>
                    </button>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginLeft: 12 }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            <span style={{ fontSize: "0.75rem", color: "#9cb4df" }}>{t("windowType")}</span>
                            <select
                                value={windowType}
                                onChange={e => setWindowType(e.target.value as "ayah" | "distance")}
                                style={{
                                    background: "rgba(17, 26, 48, 0.85)",
                                    color: "#e4f0ff",
                                    border: "1px solid rgba(151, 186, 255, 0.4)",
                                    borderRadius: 6,
                                    padding: "2px 6px",
                                    fontSize: "0.75rem",
                                }}
                            >
                                <option value="ayah">{t("ayahWindow")}</option>
                                <option value="distance">{t("distanceWindow")}</option>
                            </select>
                        </div>
                        <div style={{ fontSize: "0.73rem", color: "#a8bfeb", maxWidth: 260, lineHeight: 1.35 }}>
                            {windowType === "ayah" ? t("windowTypeHintAyah") : t("windowTypeHintDistance")}
                        </div>

                        <AnimatePresence>
                            {windowType === "distance" && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    style={{ overflow: "hidden", display: "flex", alignItems: "center", gap: 8 }}
                                >
                                    <span style={{ fontSize: "0.75rem", color: "#9cb4df" }}>
                                        {t("distanceRange", { distance })}
                                    </span>
                                    <input type="range" min={1} max={10} value={distance} onChange={e => setDistance(parseInt(e.target.value, 10))} style={{ width: 68 }} />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
                            <span style={{ fontSize: "0.75rem", color: "#9cb4df" }}>{t("minFrequency")} ({minFrequency})</span>
                            <input type="range" min={1} max={20} value={minFrequency} onChange={e => setMinFrequency(parseInt(e.target.value, 10))} style={{ width: 68 }} />
                        </div>
                    </div>
                </div>
            </div>

            <div ref={containerRef} className="viz-container" style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0 }}>
                {!isMounted ? null : (
                    <svg
                        ref={svgRef}
                        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
                        className="viz-canvas"
                        style={{ width: "100%", height: "100%", cursor: "grab" }}
                    >
                        <defs>
                            <radialGradient id={`${vizId}-canvasGlow`} cx="52%" cy="44%" r="64%">
                                <stop offset="0%" stopColor={canvasSurface.inner} stopOpacity="0.96" />
                                <stop offset="42%" stopColor={canvasSurface.mid} stopOpacity="0.9" />
                                <stop offset="100%" stopColor={canvasSurface.outer} stopOpacity="1" />
                            </radialGradient>

                            <radialGradient id={`${vizId}-hubGlow`} cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor={withAlpha(themeColors.accent, 0.35)} />
                                <stop offset="35%" stopColor={withAlpha(themeColors.accentSecondary, 0.14)} />
                                <stop offset="100%" stopColor="transparent" />
                            </radialGradient>

                            <filter id={`${vizId}-softGlow`} x="-90%" y="-90%" width="280%" height="280%">
                                <feGaussianBlur stdDeviation="1.4" result="blurred" />
                                <feMerge>
                                    <feMergeNode in="blurred" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>

                            <filter id={`${vizId}-nodeGlow`} x="-120%" y="-120%" width="340%" height="340%">
                                <feGaussianBlur stdDeviation="2" result="blurred" />
                                <feMerge>
                                    <feMergeNode in="blurred" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>

                        <rect x={0} y={0} width={dimensions.width} height={dimensions.height} fill={`url(#${vizId}-canvasGlow)`} />

                        <g>
                            {stars.map((star, index) => (
                                <circle
                                    key={`star-${index}`}
                                    cx={star.x}
                                    cy={star.y}
                                    r={star.radius}
                                    fill={withAlpha(star.color, star.opacity)}
                                />
                            ))}
                        </g>

                        <g ref={gRef}>
                            <circle
                                cx={dimensions.width / 2}
                                cy={dimensions.height / 2}
                                r={118}
                                fill={`url(#${vizId}-hubGlow)`}
                            />

                            {/* Links */}
                            <g className="links">
                                {links.map((link, idx) => {
                                    const source = typeof link.source === "string" ? nodeById.get(link.source) : link.source;
                                    const target = typeof link.target === "string" ? nodeById.get(link.target) : link.target;
                                    if (!source || !target) return null;
                                    if (source.x === undefined || source.y === undefined || target.x === undefined || target.y === undefined) return null;

                                    const path = buildCurvedPath(source, target, link.kind === "trunk" ? 0.22 : 0.35);
                                    const outerOpacity = link.kind === "trunk" ? 0.05 + link.intensity * 0.12 : 0.04 + link.intensity * 0.08;
                                    const coreOpacity = link.kind === "trunk" ? 0.18 + link.intensity * 0.22 : 0.12 + link.intensity * 0.14;
                                    const outerWidth = link.kind === "trunk" ? Math.min(3.2, 1 + link.weight * 0.2) : 1.1;
                                    const coreWidth = link.kind === "trunk" ? Math.min(1.8, 0.5 + link.weight * 0.1) : 0.7;

                                    return (
                                        <g key={`link-${idx}`} style={{ pointerEvents: "none" }}>
                                            <path
                                                d={path}
                                                stroke={withAlpha(link.color, outerOpacity)}
                                                fill="none"
                                                strokeWidth={outerWidth}
                                                filter={`url(#${vizId}-softGlow)`}
                                                strokeLinecap="round"
                                            />
                                            <path
                                                d={path}
                                                stroke={withAlpha(link.color, coreOpacity)}
                                                fill="none"
                                                strokeWidth={coreWidth}
                                                strokeLinecap="round"
                                            />
                                        </g>
                                    );
                                })}
                            </g>

                            {/* Nodes */}
                            <g className="nodes">
                                {nodes.map((node) => {
                                    if (node.x === undefined || node.y === undefined) return null;

                                    const isHovered = hoveredNode === node.id;
                                    const isSelected = selectedNode === node.id;
                                    const isHighlighted = isHovered || isSelected;

                                    if (node.type === "tendril") {
                                        return (
                                            <g
                                                key={node.id}
                                                transform={`translate(${node.x},${node.y})`}
                                                style={{ cursor: "pointer" }}
                                                onMouseEnter={() => handleNodeMouseEnter(node.id)}
                                                onMouseLeave={() => handleNodeMouseLeave(node.id)}
                                                onClick={() => {
                                                    setSelectedNode((current) => (current === node.id ? null : node.id));
                                                }}
                                            >
                                                <circle
                                                    r={node.radius}
                                                    fill={withAlpha(node.color, isHighlighted ? 0.85 : 0.62)}
                                                    filter={`url(#${vizId}-softGlow)`}
                                                />
                                                {isHighlighted && node.label && (
                                                    <text
                                                        y={-8}
                                                        textAnchor="middle"
                                                        paintOrder="stroke"
                                                        stroke={labelStroke}
                                                        strokeWidth={3}
                                                        strokeLinejoin="round"
                                                        style={{
                                                            fontSize: "10px",
                                                            fontWeight: 600,
                                                            fill: themeColors.textColors.primary,
                                                            pointerEvents: "none",
                                                        }}
                                                    >
                                                        {node.label}
                                                    </text>
                                                )}
                                            </g>
                                        );
                                    }

                                    const showLabel = true;
                                    const isCollocate = node.type === "collocate";

                                    return (
                                        <g
                                            key={node.id}
                                            className={isCollocate ? "cn-draggable" : undefined}
                                            data-node-id={node.id}
                                            transform={`translate(${node.x},${node.y})`}
                                            style={{ cursor: isCollocate ? "grab" : "pointer" }}
                                            onMouseEnter={() => handleNodeMouseEnter(node.id)}
                                            onMouseLeave={() => handleNodeMouseLeave(node.id)}
                                            onClick={() => handleNodeClick(node)}
                                        >
                                            {node.type === "target" && (
                                                <motion.circle
                                                    r={node.radius + 6}
                                                    fill="none"
                                                    stroke={withAlpha(themeColors.accent, 0.28)}
                                                    strokeWidth={1.1}
                                                    animate={{ opacity: [0.06, 0.2, 0.06], scale: [0.98, 1.06, 0.98] }}
                                                    transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut" }}
                                                />
                                            )}

                                            <circle
                                                r={node.radius}
                                                fill={node.type === "target" ? targetNodeFill : withAlpha(node.color, isHighlighted ? 1 : 0.92)}
                                                stroke={node.type === "target" ? withAlpha(themeColors.accent, 0.55) : withAlpha(themeColors.foreground, 0.3)}
                                                strokeWidth={node.type === "target" ? 1.8 : 0.9}
                                                filter={node.type === "target" || isHighlighted ? `url(#${vizId}-nodeGlow)` : undefined}
                                            />

                                            {node.type === "target" && (
                                                <circle
                                                    r={node.radius * 0.34}
                                                    fill={withAlpha(themeColors.accentSecondary, 0.18)}
                                                    style={{ pointerEvents: "none" }}
                                                />
                                            )}

                                            {showLabel && (
                                                <text
                                                    y={node.type === "target" ? node.radius + 20 : node.radius + 14}
                                                    textAnchor="middle"
                                                    paintOrder="stroke"
                                                    stroke={labelStroke}
                                                    strokeWidth={4}
                                                    strokeLinejoin="round"
                                                    style={{
                                                        fontSize: node.type === "target" ? "22px" : "14px",
                                                        fontWeight: node.type === "target" ? 700 : 500,
                                                        fill: themeColors.textColors.primary,
                                                        pointerEvents: "none",
                                                        letterSpacing: "0.04em",
                                                    }}
                                                    className="arabic-text"
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
            </div>

            {isMounted && typeof document !== 'undefined' && document.getElementById('viz-sidebar-portal') && createPortal(
                <div className="viz-left-stack">
                    {sidebarNode && (
                        <div className="viz-left-panel" style={{ background: panelBg, borderColor: panelBorder }}>
                            <div className="viz-tooltip-title arabic-text">{sidebarNode.label}</div>
                            <div className="viz-tooltip-subtitle">
                                {sidebarNode.type === "target"
                                    ? t("targetNode")
                                    : sidebarNode.type === "collocate"
                                        ? t("collocateNode")
                                        : t("tertiaryNode")}
                            </div>
                            {sidebarNode.type !== "tendril" && (
                                <div className="viz-tooltip-row">
                                    <span className="viz-tooltip-label">{t("rawCount")}</span>
                                    <span className="viz-tooltip-value">{sidebarNode.count}</span>
                                </div>
                            )}
                            {sidebarNode.type === "tendril" && (
                                <>
                                    <div className="viz-tooltip-row">
                                        <span className="viz-tooltip-label">{t("contextWindowRef")}</span>
                                        <span className="viz-tooltip-value">{sidebarNode.label}</span>
                                    </div>
                                    <div className="viz-tooltip-row">
                                        <span className="viz-tooltip-label">{t("contextWindowRefFormat")}</span>
                                        <span className="viz-tooltip-value">
                                            {windowType === "ayah"
                                                ? t("contextWindowRefFormatAyah")
                                                : t("contextWindowRefFormatDistance")}
                                        </span>
                                    </div>
                                    <div
                                        style={{
                                            marginTop: 6,
                                            fontSize: "0.8rem",
                                            lineHeight: 1.45,
                                            color: themeColors.textColors.secondary,
                                        }}
                                    >
                                        {windowType === "ayah"
                                            ? t("contextWindowRefHelpAyah")
                                            : t("contextWindowRefHelpDistance")}
                                    </div>
                                    {sidebarParentNode && (
                                        <div className="viz-tooltip-row">
                                            <span className="viz-tooltip-label">{t("collocateNode")}</span>
                                            <span className="viz-tooltip-value arabic-text">{sidebarParentNode.label}</span>
                                        </div>
                                    )}
                                </>
                            )}
                            {sidebarNode.type === "collocate" && (
                                <>
                                    <div className="viz-tooltip-row">
                                        <span className="viz-tooltip-label">{t("Help.pmiLabel")}</span>
                                        <span className="viz-tooltip-value">{sidebarNode.pmi.toFixed(2)}</span>
                                    </div>
                                    {sidebarNode.sampleLemmas.length > 0 && (
                                        <div className="viz-tooltip-row" style={{ marginTop: 8 }}>
                                            <span className="viz-tooltip-label" style={{ display: "block", marginBottom: 4 }}>Lemmas</span>
                                            <span className="viz-tooltip-value arabic-text" style={{ fontSize: "1rem", display: "flex", gap: 6, flexWrap: "wrap" }}>
                                                {sidebarNode.sampleLemmas.map((lemma) => (
                                                    <span
                                                        key={lemma}
                                                        style={{
                                                            background: "rgba(16, 24, 46, 0.86)",
                                                            padding: "2px 6px",
                                                            borderRadius: 4,
                                                            border: "1px solid rgba(120, 158, 236, 0.35)",
                                                            letterSpacing: "0.06em",
                                                        }}
                                                    >
                                                        {lemma}
                                                    </span>
                                                ))}
                                            </span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    <div className="viz-legend" style={{ background: panelBg, borderColor: panelBorder }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: "0.75rem", color: themeColors.textColors.secondary, letterSpacing: "0.03em", textTransform: "uppercase" }}>
                                {t("legendTitle")}
                            </span>
                            <HelpIcon onClick={() => setShowHelp(true)} />
                        </div>
                        <div className="viz-legend-item">
                            <div className="viz-legend-dot" style={{ background: targetNodeFill, width: 14, height: 14, boxShadow: `0 0 4px ${withAlpha(themeColors.accent, 0.28)}` }} />
                            <span>{t("targetNode")}</span>
                        </div>
                        <div className="viz-legend-item">
                            <div className="viz-legend-line" style={{ background: legendStrong, height: 3 }} />
                            <span>{t("pmiHigher")}</span>
                        </div>
                        <div className="viz-legend-item">
                            <div className="viz-legend-line" style={{ background: legendSoft, height: 2 }} />
                            <span>{t("pmiLower")}</span>
                        </div>
                    </div>
                </div>,
                document.getElementById('viz-sidebar-portal')!
            )}
        </section>
    );
}
