"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import * as d3 from "d3";
import { motion, AnimatePresence } from "framer-motion";
import type { CorpusToken } from "@/lib/schema/types";
import { DARK_THEME, LIGHT_THEME } from "@/lib/schema/visualizationTypes";
import { useZoom } from "@/lib/hooks/useZoom";
import { SURAH_NAMES } from "@/lib/data/surahData";

interface SurahDistributionGraphProps {
    tokens: CorpusToken[];
    onTokenHover: (tokenId: string | null) => void;
    onTokenFocus: (tokenId: string) => void;
    onSurahSelect?: (suraId: number) => void;
    highlightRoot?: string | null;
    theme?: "light" | "dark";
}

interface SurahNode {
    id: number;
    name: string;
    tokenCount: number;
    ayahCount: number;
    x: number;
    y: number;
    radius: number;
    tokens: CorpusToken[];
    color: string;
    containsRoot: boolean;
}

export default function SurahDistributionGraph({
    tokens,
    onTokenHover,
    onTokenFocus,
    onSurahSelect,
    highlightRoot,
    theme = "dark",
}: SurahDistributionGraphProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoomLevel, setZoomLevel] = useState(0.8);
    const { svgRef, gRef } = useZoom<SVGSVGElement>({
        minScale: 0.1,
        maxScale: 8,
        initialScale: 0.8,
        onZoomEnd: (transform) =>
            setZoomLevel((prev) => {
                const next = Math.round(transform.k * 20) / 20;
                return prev === next ? prev : next;
            }),
    });
    const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
    const [hoveredSurah, setHoveredSurah] = useState<number | null>(null);
    const [selectedSurah, setSelectedSurah] = useState<number | null>(null);

    const themeColors = theme === "dark" ? DARK_THEME : LIGHT_THEME;

    // Build surah data from tokens
    const layout = useMemo(() => {
        const surahMap = new Map<number, { tokens: CorpusToken[]; ayahs: Set<number> }>();

        for (const token of tokens) {
            if (!surahMap.has(token.sura)) {
                surahMap.set(token.sura, { tokens: [], ayahs: new Set() });
            }
            const data = surahMap.get(token.sura)!;
            data.tokens.push(token);
            data.ayahs.add(token.ayah);
        }

        const tokenCounts = [...surahMap.values()].map(d => d.tokens.length);
        const ayahCounts = [...surahMap.values()].map(d => d.ayahs.size);
        const minTokens = Math.min(...tokenCounts, 1);
        const maxTokens = Math.max(...tokenCounts, 1);
        const minAyahs = Math.min(...ayahCounts, 1);
        const maxAyahs = Math.max(...ayahCounts, 1);

        const padding = 90;
        const xScale = d3.scaleLinear()
            .domain([1, 114])
            .range([padding, dimensions.width - padding]);
        const yScale = d3.scaleSqrt()
            .domain([minTokens, maxTokens === minTokens ? minTokens + 1 : maxTokens])
            .range([dimensions.height - padding, padding]);
        const colorScale = d3.scaleSequential(d3.interpolateTurbo)
            .domain([minAyahs, maxAyahs === minAyahs ? minAyahs + 1 : maxAyahs]);

        const nodes: SurahNode[] = [];

        for (const [suraId, data] of [...surahMap.entries()].sort((a, b) => a[0] - b[0])) {
            const containsRoot = highlightRoot
                ? data.tokens.some(t => t.root === highlightRoot)
                : false;
            const radius = 6 + Math.sqrt(data.tokens.length / maxTokens) * 22;
            nodes.push({
                id: suraId,
                name: SURAH_NAMES[suraId]?.name || `Surah ${suraId}`,
                tokenCount: data.tokens.length,
                ayahCount: data.ayahs.size,
                x: xScale(suraId),
                y: yScale(data.tokens.length),
                radius,
                tokens: data.tokens,
                color: colorScale(data.ayahs.size),
                containsRoot
            });
        }

        const xTicks = d3.ticks(1, 114, 6).map(v => Math.round(v));
        const yTicks = yScale.ticks(5);

        return {
            surahNodes: nodes,
            xScale,
            yScale,
            xTicks,
            yTicks,
            padding,
            ayahExtent: [minAyahs, maxAyahs] as [number, number],
            tokenExtent: [minTokens, maxTokens] as [number, number],
            colorScale
        };
    }, [tokens, dimensions, highlightRoot]);

    const { surahNodes, xScale, yScale, xTicks, yTicks, padding, ayahExtent, tokenExtent, colorScale } = layout;

    // Resize observer
    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setDimensions({
                    width: Math.max(entry.contentRect.width, 800),
                    height: Math.max(entry.contentRect.height, 600),
                });
            }
        });

        observer.observe(containerRef.current);
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0) {
            setDimensions({
                width: Math.max(rect.width, 800),
                height: Math.max(rect.height, 600),
            });
        }

        return () => observer.disconnect();
    }, []);

    const handleSurahHover = useCallback((node: SurahNode | null) => {
        setHoveredSurah(node?.id ?? null);
        if (node && node.tokens.length > 0) {
            onTokenHover(node.tokens[0].id);
        } else {
            onTokenHover(null);
        }
    }, [onTokenHover]);

    const handleSurahClick = useCallback((node: SurahNode) => {
        setSelectedSurah(node.id === selectedSurah ? null : node.id);
        if (onSurahSelect) {
            onSurahSelect(node.id);
        }
    }, [selectedSurah, onSurahSelect]);

    const totalTokens = tokens.length;
    const totalSurahs = surahNodes.length;

    return (
        <section className="immersive-viz" data-theme={theme} style={{ width: "100%", height: "100%", position: "relative" }}>
            <div className="viz-controls floating-controls">
                <p className="ayah-meta-glass">
                    {totalSurahs} Surahs · {totalTokens.toLocaleString()} Words
                    {highlightRoot && ` · Root: ${highlightRoot}`}
                </p>
            </div>

            <div
                ref={containerRef}
                className="viz-container"
                style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}
            >
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
                    className="surah-distribution-graph viz-canvas"
                    style={{ width: "100%", height: "100%", cursor: "grab" }}
                >
                    <g ref={gRef}>
                        <defs>
                            <radialGradient id="surahBgGlow" cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor={themeColors.glowColors.primary} stopOpacity="0.12" />
                                <stop offset="100%" stopColor="transparent" />
                            </radialGradient>

                            <filter id="surahGlow" x="-100%" y="-100%" width="300%" height="300%">
                                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                                <feMerge>
                                    <feMergeNode in="coloredBlur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>

                        {/* Background glow */}
                        <circle
                            cx={dimensions.width / 2}
                            cy={dimensions.height / 2}
                            r={Math.min(dimensions.width, dimensions.height) * 0.45}
                            fill="url(#surahBgGlow)"
                        />

                        {/* Grid lines */}
                        <g className="axis-grid">
                            {yTicks.map((tick) => (
                                <line
                                    key={`y-${tick}`}
                                    x1={padding}
                                    x2={dimensions.width - padding}
                                    y1={yScale(tick)}
                                    y2={yScale(tick)}
                                    stroke="rgba(255,255,255,0.06)"
                                />
                            ))}
                            {xTicks.map((tick) => (
                                <line
                                    key={`x-${tick}`}
                                    x1={xScale(tick)}
                                    x2={xScale(tick)}
                                    y1={padding}
                                    y2={dimensions.height - padding}
                                    stroke="rgba(255,255,255,0.04)"
                                />
                            ))}
                        </g>

                        {/* Axes */}
                        <g className="axes">
                            <line
                                x1={padding}
                                x2={dimensions.width - padding}
                                y1={dimensions.height - padding}
                                y2={dimensions.height - padding}
                                stroke={themeColors.edgeColors.default}
                                opacity={0.35}
                            />
                            <line
                                x1={padding}
                                x2={padding}
                                y1={padding}
                                y2={dimensions.height - padding}
                                stroke={themeColors.edgeColors.default}
                                opacity={0.35}
                            />
                            {xTicks.map((tick) => (
                                <text
                                    key={`xt-${tick}`}
                                    x={xScale(tick)}
                                    y={dimensions.height - padding + 22}
                                    textAnchor="middle"
                                    fontSize="10"
                                    fill={themeColors.textColors.muted}
                                >
                                    {tick}
                                </text>
                            ))}
                            {yTicks.map((tick) => (
                                <text
                                    key={`yt-${tick}`}
                                    x={padding - 10}
                                    y={yScale(tick) + 4}
                                    textAnchor="end"
                                    fontSize="10"
                                    fill={themeColors.textColors.muted}
                                >
                                    {Math.round(tick).toLocaleString()}
                                </text>
                            ))}
                            <text
                                x={(dimensions.width) / 2}
                                y={dimensions.height - padding + 44}
                                textAnchor="middle"
                                fontSize="11"
                                fill={themeColors.textColors.secondary}
                                letterSpacing="0.12em"
                            >
                                SURAH INDEX
                            </text>
                            <text
                                x={padding - 52}
                                y={dimensions.height / 2}
                                textAnchor="middle"
                                fontSize="11"
                                fill={themeColors.textColors.secondary}
                                letterSpacing="0.12em"
                                transform={`rotate(-90 ${padding - 52} ${dimensions.height / 2})`}
                            >
                                TOKEN COUNT
                            </text>
                        </g>

                        {/* Surah nodes */}
                        <g className="surah-nodes">
                            {surahNodes.map((node) => {
                                const isHovered = hoveredSurah === node.id;
                                const isSelected = selectedSurah === node.id;
                                const hasRoot = highlightRoot && node.containsRoot;
                                // Highlight if hovered, selected, or contains filtered root
                                const isHighlighted = isHovered || isSelected || hasRoot;
                                // Dim if filtering by root and this node doesn't have it
                                const isDimmed = highlightRoot && !hasRoot;
                                const showPulse = zoomLevel > 0.75;
                                const showName = zoomLevel > 0.85 && (node.radius > 18 || isHighlighted);

                                return (
                                    <motion.g
                                        key={node.id}
                                        className="surah-node-group"
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{
                                            scale: 1,
                                            opacity: isDimmed ? 0.2 : 1
                                        }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 100,
                                            damping: 15,
                                            delay: node.id * 0.01,
                                        }}
                                        style={{ cursor: "pointer" }}
                                        onMouseEnter={() => handleSurahHover(node)}
                                        onMouseLeave={() => handleSurahHover(null)}
                                        onClick={() => handleSurahClick(node)}
                                    >
                                        {/* Highlight ring */}
                                        {isHighlighted && showPulse && (
                                            <motion.circle
                                                cx={node.x}
                                                cy={node.y}
                                                r={node.radius + 8}
                                                fill="none"
                                                stroke={themeColors.accent}
                                                strokeWidth={hasRoot ? 3 : 2}
                                                initial={{ scale: 0.8, opacity: 0 }}
                                                animate={{ scale: 1.1, opacity: 0.7 }}
                                                transition={{
                                                    repeat: Infinity,
                                                    repeatType: "reverse",
                                                    duration: 0.8,
                                                }}
                                            />
                                        )}

                                        {/* Main circle */}
                                        <circle
                                            cx={node.x}
                                            cy={node.y}
                                            r={node.radius}
                                            fill={isHighlighted ? themeColors.accent : node.color}
                                            stroke="rgba(255,255,255,0.3)"
                                            strokeWidth={isHighlighted ? 2 : 1}
                                            filter={isHighlighted ? "url(#surahGlow)" : undefined}
                                        />

                                        {/* Surah number label */}
                                        <text
                                            x={node.x}
                                            y={node.y + (node.radius > 15 ? 4 : 2)}
                                            textAnchor="middle"
                                            fill={theme === "dark" ? "#fff" : "#1a1a1a"}
                                            fontSize={node.radius > 12 ? "10px" : "6px"}
                                            fontWeight="600"
                                            style={{ pointerEvents: "none" }}
                                        >
                                            {node.id}
                                        </text>

                                        {/* Surah name (only for larger nodes or when zoomed/hovered) */}
                                        {showName && (
                                            <text
                                                x={node.x}
                                                y={node.y - node.radius - 8}
                                                textAnchor="middle"
                                                fill={themeColors.textColors.primary}
                                                fontSize="12px"
                                                fontWeight="500"
                                                style={{ pointerEvents: "none", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}
                                            >
                                                {node.name}
                                            </text>
                                        )}
                                    </motion.g>
                                );
                            })}
                        </g>
                    </g>
                </svg>

                {/* Tooltip */}
                <AnimatePresence>
                    {(hoveredSurah || selectedSurah) && (
                        <motion.div
                            className="viz-tooltip"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            style={{
                                position: "absolute",
                                top: 20,
                                left: 20,
                            }}
                        >
                            {(() => {
                                const node = surahNodes.find(n => n.id === (hoveredSurah ?? selectedSurah));
                                if (!node) return null;

                                return (
                                    <>
                                        <div className="viz-tooltip-title">
                                            {node.name}
                                        </div>
                                        <div className="viz-tooltip-subtitle">
                                            Surah {node.id}
                                        </div>
                                        <div className="viz-tooltip-row">
                                            <span className="viz-tooltip-label">Words</span>
                                            <span className="viz-tooltip-value">{node.tokenCount.toLocaleString()}</span>
                                        </div>
                                        <div className="viz-tooltip-row">
                                            <span className="viz-tooltip-label">Ayahs</span>
                                            <span className="viz-tooltip-value">{node.ayahCount}</span>
                                        </div>
                                        {node.tokens[0] && (
                                            <div className="viz-tooltip-row">
                                                <span className="viz-tooltip-label">First word</span>
                                                <span className="viz-tooltip-value arabic-text">
                                                    {node.tokens[0].text}
                                                </span>
                                            </div>
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
                        className="viz-legend-dot"
                        style={{ background: colorScale(ayahExtent[0]), width: 12, height: 12 }}
                    />
                    <span>Fewer ayahs</span>
                </div>
                <div className="viz-legend-item">
                    <div
                        className="viz-legend-dot"
                        style={{ background: colorScale((ayahExtent[0] + ayahExtent[1]) / 2), width: 12, height: 12 }}
                    />
                    <span>Moderate ayahs</span>
                </div>
                <div className="viz-legend-item">
                    <div
                        className="viz-legend-dot"
                        style={{ background: colorScale(ayahExtent[1]), width: 12, height: 12 }}
                    />
                    <span>More ayahs</span>
                </div>
                <div className="viz-legend-item">
                    <div
                        className="viz-legend-dot"
                        style={{ background: themeColors.accent, width: 14, height: 14 }}
                    />
                    <span>Selected / Root match</span>
                </div>
                <div className="viz-legend-item">
                    <div
                        className="viz-legend-dot"
                        style={{ background: "rgba(255,255,255,0.4)", width: 8, height: 8 }}
                    />
                    <span>Size = token count</span>
                </div>
            </div>
        </section>
    );
}
