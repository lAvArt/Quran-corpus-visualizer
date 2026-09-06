"use client";

import { useEffect, useRef, useState, useMemo, useCallback, useDeferredValue, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";

import * as d3 from "@/lib/viz/d3";
import { motion, AnimatePresence } from "framer-motion";
import type { CorpusToken } from "@/lib/schema/types";
import { resolveVisualizationTheme } from "@/lib/schema/visualizationTypes";
import { useZoom } from "@/lib/hooks/useZoom";
import { SURAH_NAMES } from "@/lib/data/surahData";
import { getAyah } from "@/lib/corpus/corpusLoader";
import { VizExplainerDialog, HelpIcon } from "@/components/ui/VizExplainerDialog";
import { useVizControl } from "@/lib/hooks/VizControlContext";
import { getFrequencyColor, getIdentityColor, type LexicalColorMode } from "@/lib/theme/lexicalColoring";
import { motionSafeStagger, prefersReducedMotion } from "@/lib/viz/motionPrefs";

interface CorpusArchitectureMapProps {
    tokens: CorpusToken[];
    onNodeSelect?: (type: "surah" | "root" | "lemma", id: string | number) => void;
    highlightRoot?: string | null;
    selectedSurahId?: number;
    theme?: "light" | "dark";
    lexicalColorMode?: LexicalColorMode;
    /** Occurrence mode: focusing a word writes the selection back so the
     *  inspector shows that ayah — the graph's own selected wire follows
     *  from `focusedSura`/`focusedAyah` coming back down. */
    onTokenFocus?: (tokenId: string) => void;
    onTokenHover?: (tokenId: string | null) => void;
    /** The globally focused token's position, so an ayah picked ANYWHERE
     *  (the inspector's occurrence list, another view) lights its wire here. */
    focusedSura?: number | null;
    focusedAyah?: number | null;
}

interface HierarchyNode {
    id: string;
    name: string;
    type: "root" | "surah" | "corpus" | "word_root";
    value: number;
    children?: HierarchyNode[];
    originalId?: number | string; // For syncing with global state
    /**
     * Occurrence mode only (see `occurrenceMode` below): the ayah this leaf
     * stands for. The leaf keeps `type: "word_root"` and `originalId` = the
     * root deliberately — every geometry/color/label memo in this file keys
     * off those two, so an occurrence fans out, colors and declutters exactly
     * like a root node without a parallel code path.
     */
    ayah?: number;
}

// Text is the expensive element in this graph (glyph shaping/layout + a
// rotate transform + tspans), unlike a plain circle — `visibleNodes` culls
// nodes against a generously padded box (800-1400px, see isInView below) so
// circles get a pre-render head start and don't pop in while panning;
// labels don't need that same buffer, so isLabelInView culls them against
// the TRUE view bounds (the viewBox extent, viewRadius, plus this small
// margin) instead. Nothing currently on-screen loses its label — this only
// skips <text> for nodes already outside the visible area.
const LABEL_VIEW_PADDING = 120;

// Opacity for a surah whose corpus batch hasn't landed yet (see
// `surahSkeleton` below) — dim enough to read as inert/pending against the
// default 0.8, distinct from the 0.1-0.2 "dimmed by an active filter" range
// used elsewhere in getOpacity.
const PENDING_SURAH_OPACITY = 0.15;
// Per-surah stagger for the batch-arrival reveal (corpus-arch-reveal /
// corpus-arch-fade in globals.css) — ~40ms between surahs within one
// batch, capped so even a large batch settles well under a second.
// Zeroed under prefers-reduced-motion by motionSafeStagger itself.
const REVEAL_STAGGER_MS = 40;
const REVEAL_STAGGER_CAP_MS = 400;

// How far (in raw zoom-scale units) the transform has to drift from the
// last-committed value before a MID-GESTURE zoom/drag tick is allowed to
// push a new zoomLevel/zoomTransform to React — see the zoom-commit comment
// below. d3 already writes the visual transform straight to `gRef` on every
// tick regardless of this; this constant only throttles how often the
// zoom-dependent LOD/label memos (visibleNodes, visibleLinks,
// admittedRootLabelIds) are allowed to recompute while a gesture is still
// live, so a continuous 3s wheel/drag settles into a handful of recomputes
// instead of one per tick.
const ZOOM_LOD_QUANTUM = 0.25;

// Floor (ms) between mid-gesture LOD commits, even when the scale keeps
// crossing ZOOM_LOD_QUANTUM boundaries faster than this — a sustained zoom
// can straddle one 0.25 bucket boundary every single tick (the bucket step
// and a single wheel tick's scale delta are close in size), so without this
// floor the quantization above degenerates back to a near-per-tick commit
// rate under fast/continuous input. Deliberately a bit under the 150ms
// "end" debounce (see useZoom's wheelDelay) so mid-gesture LOD still feels
// more responsive than the settle latency.
const MIN_ZOOM_COMMIT_INTERVAL_MS = 120;

// Occurrence-mode fan geometry (see `occurrenceMode`). One surah's slot on
// the 114-surah ring is only ~3.2 degrees wide, while the general root fan
// spreads up to 120 degrees — fine when a surah shows 10 roots and the fans
// are faint, ruinous when every wire on screen belongs to one root: each
// surah's wires swept across ~38 of its neighbours and crossed all of them.
// Occurrences therefore separate on the RADIAL axis (stacked in ayah order,
// so the spike reads as a walk through the surah) and keep only a hairline
// angular fan, which is what stops adjacent surahs from interleaving at all.
const OCCURRENCE_BASE_OFFSET = 26;
const OCCURRENCE_STEP_PX = 11;
const OCCURRENCE_MIN_BAND = 40;
// Cap: `viewRadius` grows with the longest offset, so an unbounded band would
// zoom the whole ring out to fit one heavy surah's spike.
const OCCURRENCE_MAX_BAND = 420;
const OCCURRENCE_MAX_SPREAD_DEG = 2.2;
const OCCURRENCE_SPREAD_PER_NODE_DEG = 0.14;

// Minimum on-screen distance (px) two root labels within the same surah's
// fan must keep from each other — see admittedRootLabelIds below, the fix
// for a focused surah's root fan drawing every label at once and
// overlapping into an illegible column.
const LABEL_MIN_SEPARATION_PX = 15;

export default function CorpusArchitectureMap({
    tokens,
    onNodeSelect,
    highlightRoot,
    selectedSurahId,
    theme = "dark",
    lexicalColorMode = "theme",
    onTokenFocus,
    onTokenHover,
    focusedSura,
    focusedAyah,
}: CorpusArchitectureMapProps) {
    const locale = useLocale();
    const isArabicLocale = locale.startsWith("ar");
    const t = useTranslations("Visualizations.CorpusArchitecture");
    const ts = useTranslations("Visualizations.Shared");
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoomLevel, setZoomLevel] = useState(1.4);
    const [zoomTransform, setZoomTransform] = useState(d3.zoomIdentity);

    // useZoom already applies the visual transform IMPERATIVELY to `gRef` on
    // every d3 zoom tick (a DOM attribute write — see lib/hooks/useZoom.ts —
    // no React involved). What used to still cost a full re-render + repaint
    // of thousands of nodes on every wheel/drag tick was THIS component's own
    // zoomLevel/zoomTransform state, which visibleNodes/visibleLinks/label
    // admission all key off. Fix: only commit that state (a) once a gesture
    // ends (full precision, unchanged 0.05 rounding), or (b) when the scale
    // has drifted by ~ZOOM_LOD_QUANTUM while the gesture is still live AND at
    // least MIN_ZOOM_COMMIT_INTERVAL_MS has passed since the last commit —
    // the time floor matters because a bucket boundary can sit inside a
    // single wheel tick's step size (a sustained zoom crosses it back and
    // forth every tick, not just once), so scale-quantizing alone doesn't
    // reliably throttle frequency on its own; both together cap mid-gesture
    // commits to a handful per gesture instead of once per tick.
    // `lastZoomBucketRef`/`lastZoomCommitMsRef` track the last COMMITTED
    // bucket/time; both are updated on every commit (including "end") so the
    // next gesture's first crossing is measured from the settled state, not
    // a stale one.
    const lastZoomBucketRef = useRef(Math.round(1.4 / ZOOM_LOD_QUANTUM));
    const lastZoomCommitMsRef = useRef(0);
    const commitZoomState = useCallback((transform: d3.ZoomTransform) => {
        setZoomTransform(transform);
        setZoomLevel((prev) => {
            const next = Math.round(transform.k * 20) / 20;
            return prev === next ? prev : next;
        });
    }, []);

    const { svgRef, gRef, fitToView, fitBounds } = useZoom<SVGSVGElement>({
        minScale: 0.1,
        maxScale: 12,
        initialScale: 1.4,
        // Fires on every tick (wheel, drag, AND the Focus button's animated
        // transition — fitToView calls d3 zoom.transform on this same zoom
        // instance, so this one handler keeps both entry points in sync).
        // Only actually commits when the scale has crossed into a new
        // bucket since the last commit AND the commit-interval floor has
        // elapsed.
        onZoom: (transform) => {
            const bucket = Math.round(transform.k / ZOOM_LOD_QUANTUM);
            if (bucket === lastZoomBucketRef.current) return;
            const now = performance.now();
            if (now - lastZoomCommitMsRef.current < MIN_ZOOM_COMMIT_INTERVAL_MS) return;
            lastZoomBucketRef.current = bucket;
            lastZoomCommitMsRef.current = now;
            commitZoomState(transform);
        },
        onZoomEnd: (transform) => {
            lastZoomBucketRef.current = Math.round(transform.k / ZOOM_LOD_QUANTUM);
            lastZoomCommitMsRef.current = performance.now();
            commitZoomState(transform);
        },
    });

    const [dimensions] = useState({ width: 1600, height: 1600 });
    // Shared by the dynamic hierarchy layout below AND surahSkeleton (the
    // fixed 114-surah ring) so both cluster computations always agree on
    // the surah ring's radius — see surahSkeleton for why that agreement
    // matters. `dimensions` never actually changes after mount (no resize
    // observer wires the setter here), so this is effectively a constant.
    const layoutRadius = useMemo(
        () => Math.max(180, Math.min(dimensions.width, dimensions.height) / 2 - 200),
        [dimensions]
    );
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
    // Occurrence spikes are as long as the surah is dense (Al-Baqarah's 37
    // occurrences of a root reach ~370px past the ring), so the content extent
    // changes with the root and the fixed entry zoom left the longest spikes
    // off-screen. Frame the burst once per root, after its geometry exists.
    const fittedRootRef = useRef<string | null>(null);

    const [isMounted, setIsMounted] = useState(false);
    const { isLeftSidebarOpen } = useVizControl();
    // JS-driven motion (framer-motion) bypasses the global CSS
    // `prefers-reduced-motion` rule in globals.css — this component's only
    // framer usage (the selected-root info panel below) must collapse to
    // instant manually. Read once per render; matchMedia-backed, SSR-safe.
    const reduceMotion = prefersReducedMotion();
    useEffect(() => { setIsMounted(true); }, []);

    // Adopting the shared surah as a DRILL target is right when this map is
    // the thing being navigated, and wrong the moment a root is selected: the
    // whole point of arriving here with a root is the cross-corpus view, and
    // drilling into one surah is exactly what hid it (every other surah
    // dimmed to 0.05). So the adoption is skipped while a root is active, and
    // a NEW root clears any existing drill — the standard adopt-the-prop /
    // never-write-back pattern (docs/VIZ_ARCHITECTURE.md, "Selection is
    // global"). Clicking a surah dot still drills; that is an explicit pick.
    const prevHighlightRootRef = useRef<string | null | undefined>(highlightRoot);
    useEffect(() => {
        const prev = prevHighlightRootRef.current;
        prevHighlightRootRef.current = highlightRoot;
        if (highlightRoot && highlightRoot !== prev) {
            setFocusedSurahId(null);
            return;
        }
        if (highlightRoot) return;
        if (selectedSurahId) {
            setFocusedSurahId(selectedSurahId);
        }
    }, [selectedSurahId, highlightRoot]);

    useEffect(() => {
        // cleanup not needed anymore
    }, []);

    // `tokens` gets a new array reference on every parent re-render even when
    // the corpus content is unchanged — useCorpusData rebuilds `allTokens`
    // whenever contextTokens churns on surah navigation, even once the real
    // (deepTokens) source is already stable (see docs/VIZ_ARCHITECTURE.md,
    // "Corpus data streams in"). Depending on `tokens` directly would redo
    // the whole layout chain below (cluster layout + every root offset/
    // angle/color memo) on each such churn. Key on a cheap content signature
    // (count + first/last token id) instead, so those memos only re-run when
    // the corpus content actually changed. This follows React's own
    // "adjust state while rendering" pattern for derived state.
    const tokensSignature = `${tokens.length}:${tokens[0]?.id ?? ""}:${tokens[tokens.length - 1]?.id ?? ""}`;
    const [stableTokens, setStableTokens] = useState(tokens);
    const [tokensSignatureSeen, setTokensSignatureSeen] = useState(tokensSignature);
    if (tokensSignature !== tokensSignatureSeen) {
        setTokensSignatureSeen(tokensSignature);
        setStableTokens(tokens);
    }

    // Pre-compute surah root counts (stable across focus changes)
    const surahRootData = useMemo(() => {
        const surahMap = new Map<number, {
            id: number,
            tokenCount: number,
            rootCounts: Map<string, number>
        }>();

        stableTokens.forEach(t => {
            if (!surahMap.has(t.sura)) {
                surahMap.set(t.sura, { id: t.sura, tokenCount: 0, rootCounts: new Map() });
            }
            const entry = surahMap.get(t.sura)!;
            entry.tokenCount++;
            if (t.root) {
                entry.rootCounts.set(t.root, (entry.rootCounts.get(t.root) || 0) + 1);
            }
        });
        return surahMap;
    }, [stableTokens]);

    // The root under examination: the shared selection (search, another
    // view's pick, a collocation target) or this map's own root search.
    const activeRootKey = highlightRoot || internalSelectedRoot;

    // Every ayah in the corpus where that root occurs, grouped by surah, with
    // a representative token so clicking an occurrence can focus a real word.
    const occurrencesBySurah = useMemo(() => {
        if (!activeRootKey) return new Map<number, { ayah: number; count: number; tokenId: string }[]>();
        const bySurah = new Map<number, Map<number, { ayah: number; count: number; tokenId: string }>>();
        for (const tk of stableTokens) {
            if (tk.root !== activeRootKey) continue;
            let ayahs = bySurah.get(tk.sura);
            if (!ayahs) {
                ayahs = new Map();
                bySurah.set(tk.sura, ayahs);
            }
            const existing = ayahs.get(tk.ayah);
            if (existing) existing.count++;
            else ayahs.set(tk.ayah, { ayah: tk.ayah, count: 1, tokenId: tk.id });
        }
        const out = new Map<number, { ayah: number; count: number; tokenId: string }[]>();
        bySurah.forEach((ayahs, suraId) => {
            out.set(suraId, Array.from(ayahs.values()).sort((a, b) => a.ayah - b.ayah));
        });
        return out;
    }, [activeRootKey, stableTokens]);

    // Occurrence mode: a root is selected and no surah is drilled into, so the
    // map answers "where does this word live across the whole Quran" — one
    // wire per occurrence, everything else hidden. This is the mode the
    // structure map exists for; the unfiltered root fan is the resting state.
    const occurrenceMode = Boolean(activeRootKey) && !focusedSurahId && occurrencesBySurah.size > 0;

    const occurrenceStats = useMemo(() => {
        let total = 0;
        let ayahs = 0;
        occurrencesBySurah.forEach((list) => {
            ayahs += list.length;
            list.forEach((entry) => { total += entry.count; });
        });
        return { total, ayahs, surahs: occurrencesBySurah.size };
    }, [occurrencesBySurah]);

    const occurrenceNodeId = useCallback(
        (suraId: number, ayah: number) => `s${suraId}-r${activeRootKey}-a${ayah}`,
        [activeRootKey]
    );

    // Batch-arrival reveal bookkeeping (mirrors SurahDistributionGraph's
    // hasCommittedInitialNodesRef pattern, per-surah instead of once-
    // overall): `revealedSurahIdsRef` marks every surah that has ALREADY
    // had its one-time reveal, so a later re-render (hover, focus click,
    // zoom — anything that doesn't add new data) never re-triggers it or
    // saddles an ordinary opacity change (e.g. hover dimming) with a stale
    // stagger delay. Root nodes/links need no equivalent tracking: they
    // don't exist in the DOM until their surah is loaded, so their CSS
    // `animation` (`.corpus-arch-reveal` in globals.css) only ever plays
    // once, at that one mount, for free.
    const revealedSurahIdsRef = useRef<Set<number>>(new Set());
    useEffect(() => {
        surahRootData.forEach((_data, suraId) => {
            revealedSurahIdsRef.current.add(suraId);
        });
    }, [surahRootData]);

    // Stagger delay (ms) for surahs loaded as of THIS render, keyed by surah
    // id — 0 once a surah has already been revealed in a past render. Root
    // nodes/links inherit their parent surah's delay so a surah's dot
    // brightening and its roots fanning out read as one arrival rather than
    // root-by-root noise. Deliberately NOT a useMemo: it reads a ref that's
    // mutated from an effect (so it can't be a dependency), and a memo keyed
    // only on `surahRootData` would keep returning a past batch's non-zero
    // delays on a later re-render that changes an already-revealed surah's
    // opacity for an unrelated reason (e.g. hover) — recomputing this every
    // render (at most 114 entries) is cheap enough that memoizing isn't
    // worth that staleness risk.
    const revealDelayMsBySurah = (() => {
        const delays = new Map<number, number>();
        let newlyRevealedIndex = 0;
        for (const suraId of Array.from(surahRootData.keys()).sort((a, b) => a - b)) {
            if (revealedSurahIdsRef.current.has(suraId)) {
                delays.set(suraId, 0);
            } else {
                delays.set(suraId, motionSafeStagger(newlyRevealedIndex, REVEAL_STAGGER_MS, REVEAL_STAGGER_CAP_MS));
                newlyRevealedIndex++;
            }
        }
        return delays;
    })();

    const focusedSurahStats = useMemo(() => {
        if (!focusedSurahId) return null;
        const data = surahRootData.get(focusedSurahId);
        return {
            rootsCount: data?.rootCounts.size ?? 0,
            ayahsCount: SURAH_NAMES[focusedSurahId]?.verses || 0
        };
    }, [focusedSurahId, surahRootData]);

    // Build Hierarchy Data
    // Level 0: Corpus
    // Level 1: Surahs — ALL 114, from static SURAH_NAMES, not just the ones
    //   with token data yet. A surah with no `surahRootData` entry (its
    //   corpus batch hasn't landed) gets zero root children and renders as
    //   a dim "pending" node (see getOpacity) — see surahSkeleton below for
    //   why this is also what keeps every surah's ANGLE fixed from first
    //   paint regardless of load progress.
    // Level 2: Roots — ALL roots for focused surah, top N for others
    const hierarchyData = useMemo(() => {
        const root: HierarchyNode = {
            id: "corpus",
            name: "The Noble Quran",
            type: "corpus",
            value: 1,
            children: []
        };

        const UNFOCUSED_LIMIT = 10; // compact summary for unfocused surahs
        const activeHighlight = activeRootKey;

        Object.keys(SURAH_NAMES)
            .map(Number)
            .sort((a, b) => a - b)
            .forEach((suraId) => {
                const surahName = SURAH_NAMES[suraId]?.name || `Surah ${suraId}`;
                const data = surahRootData.get(suraId);

                if (!data) {
                    // Pending: no token data has streamed in for this surah yet.
                    root.children!.push({
                        id: `s-${suraId}`,
                        name: surahName,
                        type: "surah",
                        value: 0,
                        originalId: suraId,
                        children: []
                    });
                    return;
                }

                // Occurrence mode: this surah's leaves are the selected
                // root's AYAHS, not its top roots. A surah without the root
                // keeps its dot (the 114-surah ring is the map's frame) but
                // grows no children, so no wire is drawn to it at all.
                if (occurrenceMode) {
                    const occurrences = occurrencesBySurah.get(suraId) ?? [];
                    root.children!.push({
                        id: `s-${suraId}`,
                        name: surahName,
                        type: "surah",
                        value: data.tokenCount,
                        originalId: suraId,
                        children: occurrences.map((entry) => ({
                            id: `s${suraId}-r${activeHighlight}-a${entry.ayah}`,
                            name: String(entry.ayah),
                            type: "word_root" as const,
                            value: entry.count,
                            originalId: activeHighlight as string,
                            ayah: entry.ayah,
                        })),
                    });
                    return;
                }

                const isFocused = suraId === focusedSurahId;

                // Sort roots by frequency (descending)
                const sortedRoots = Array.from(data.rootCounts.entries())
                    .sort((a, b) => b[1] - a[1]);

                // Focused surah: include ALL roots; unfocused: top N only
                let rootsToShow = isFocused ? sortedRoots : sortedRoots.slice(0, UNFOCUSED_LIMIT);

                // Always include highlighted root if it exists in this surah
                if (activeHighlight && !isFocused) {
                    const alreadyIncluded = rootsToShow.some(([r]) => r === activeHighlight);
                    if (!alreadyIncluded) {
                        const highlightEntry = sortedRoots.find(([r]) => r === activeHighlight);
                        if (highlightEntry) {
                            rootsToShow = [...rootsToShow, highlightEntry];
                        }
                    }
                }

                const rootNodes = rootsToShow.map(([rootTxt, count]) => ({
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
                    value: data.tokenCount,
                    originalId: suraId,
                    children: rootNodes
                });
            });

        return root;
    }, [surahRootData, focusedSurahId, activeRootKey, occurrenceMode, occurrencesBySurah]);

    // Layout Calculation. NOTE: as of the static skeleton below, this
    // dynamic cluster's own per-node `x`/`y` are only used for the CORPUS
    // node (always r=0) and as a defensive fallback — SURAH and ROOT
    // render position comes from surahSkeleton/getNodeAngle/getNodeRadius
    // instead, precisely so it stays fixed while `hierarchyData` grows.
    // This computation still matters for everything else: which nodes/
    // links exist, ranks, counts, ancestor/descendant relationships.
    const { nodes, links } = useMemo(() => {
        const hierarchy = d3.hierarchy(hierarchyData);

        // Cluster layout places leaf nodes at the same depth
        // Tree layout puts them at depth based on parent
        // For radial dendrogram, cluster is usually better for alignment
        // Keep radius smaller to reserve space for root offsets
        const layout = d3.cluster<HierarchyNode>()
            .size([360, layoutRadius])
            .separation((a, b) => (a.parent === b.parent ? 2 : 3) / a.depth);

        const root = layout(hierarchy);

        return {
            nodes: root.descendants(),
            links: root.links()
        };
    }, [hierarchyData, layoutRadius]);

    // Helpers
    // Hover highlight set: descendants (hover a surah -> light up its roots)
    // UNION ancestors (hover a root -> light up its surah + the corpus root),
    // memoized once per hoveredNode change. getOpacity() used to re-walk the
    // ancestor chain with `===` comparisons for EVERY node/link on EVERY
    // render (~9-12k calls at focus/overview); this turns that into a single
    // O(1) Set lookup.
    const hoveredRelationIds = useMemo(() => {
        if (!hoveredNode) return null;
        const ids = new Set<string>();
        hoveredNode.descendants().forEach((node) => ids.add(node.data.id));
        let current: d3.HierarchyPointNode<HierarchyNode> | null = hoveredNode;
        while (current) {
            ids.add(current.data.id);
            current = current.parent;
        }
        return ids;
    }, [hoveredNode]);

    // The selected occurrence is read from the SHARED focused token, not kept
    // locally: clicking a wire focuses that word, and the selection comes back
    // down as focusedSura/focusedAyah — so an ayah picked in the inspector's
    // occurrence list lights the same wire, with one source of truth.
    const selectedOccurrence = useMemo(() => {
        if (!occurrenceMode || focusedSura == null || focusedAyah == null) return null;
        const list = occurrencesBySurah.get(focusedSura);
        if (!list?.some((entry) => entry.ayah === focusedAyah)) return null;
        return { sura: focusedSura, ayah: focusedAyah };
    }, [occurrenceMode, focusedSura, focusedAyah, occurrencesBySurah]);

    // Hovering a wire OR its end dot previews that ayah — both set
    // `hoveredNode`, so this one derivation serves the two.
    const hoveredOccurrence = useMemo(() => {
        if (!occurrenceMode || hoveredNode?.data.ayah == null) return null;
        const suraId = hoveredNode.parent?.data.originalId as number | undefined;
        if (suraId == null) return null;
        return { sura: suraId, ayah: hoveredNode.data.ayah };
    }, [occurrenceMode, hoveredNode]);

    const selectedOccurrenceNodeId = selectedOccurrence
        ? occurrenceNodeId(selectedOccurrence.sura, selectedOccurrence.ayah)
        : null;

    // The occurrence card previews what is under the pointer and falls back to
    // the pinned one — same contract as the radial map's ayah card.
    const previewOccurrence = hoveredOccurrence ?? selectedOccurrence;
    const isPreviewPinned = !hoveredOccurrence && !!selectedOccurrence;
    const previewSura = previewOccurrence?.sura ?? null;
    const previewAyah = previewOccurrence?.ayah ?? null;
    const [previewAyahText, setPreviewAyahText] = useState<string | null>(null);
    useEffect(() => {
        if (previewSura == null || previewAyah == null) {
            setPreviewAyahText(null);
            return;
        }
        let cancelled = false;
        // Debounced: sweeping the pointer across a fan of wires must not fire
        // a verse fetch per wire.
        const timer = window.setTimeout(() => {
            getAyah(previewSura, previewAyah).then((record) => {
                if (!cancelled) setPreviewAyahText(record?.textUthmani ?? null);
            });
        }, 90);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [previewSura, previewAyah]);

    const previewOccurrenceCount = useMemo(() => {
        if (previewSura == null || previewAyah == null) return 0;
        return occurrencesBySurah.get(previewSura)?.find((entry) => entry.ayah === previewAyah)?.count ?? 0;
    }, [previewSura, previewAyah, occurrencesBySurah]);

    const handleOccurrenceSelect = useCallback(
        (suraId: number, ayah: number) => {
            const tokenId = occurrencesBySurah.get(suraId)?.find((entry) => entry.ayah === ayah)?.tokenId;
            if (tokenId) onTokenFocus?.(tokenId);
        },
        [occurrencesBySurah, onTokenFocus]
    );

    const getOpacity = useCallback(
        (d: d3.HierarchyPointNode<HierarchyNode>) => {
            // Pending surah (its corpus batch hasn't landed yet): always
            // dim, regardless of hover/focus/root-filter — there are no
            // roots to highlight yet, and this must win over every other
            // branch below so a still-loading surah never reads as active.
            if (d.data.type === "surah" && !surahRootData.has(d.data.originalId as number)) {
                return PENDING_SURAH_OPACITY;
            }

            if (focusedSurahId) {
                const focusId = `s-${focusedSurahId}`;
                if (d.data.id === "corpus") return 0.6;
                if (d.data.id === focusId) return 1;
                if (d.parent?.data.id === focusId) return 1;
                if (d.data.type === "surah") return 0.2;
                return 0.05;
            }

            // Occurrence mode: the selected root's ayahs are the only leaves
            // that exist, so they are all fully lit; a surah is lit when it
            // carries the root and stays a dim ring marker when it doesn't.
            if (occurrenceMode) {
                if (d.data.id === "corpus") return 0.6;
                if (d.data.type === "word_root") return 1;
                if (d.data.type === "surah") {
                    return occurrencesBySurah.has(d.data.originalId as number) ? 1 : 0.12;
                }
                return 0.1;
            }

            // If we are filtering by root (either from parent or internal selection):
            const activeRoot = activeRootKey;
            if (activeRoot) {
                const isMatch = d.data.type === 'word_root' && d.data.originalId === activeRoot;
                const isParentSurah = d.children?.some(child => child.data.originalId === activeRoot);

                if (isMatch || isParentSurah) return 1;
                return 0.1; // Dim others more
            }

            if (!hoveredNode) return 0.8; // Default opacity high
            return hoveredRelationIds?.has(d.data.id) ? 1 : 0.1;
        },
        [focusedSurahId, activeRootKey, occurrenceMode, occurrencesBySurah, hoveredNode, hoveredRelationIds, surahRootData]
    );

    const themeColors = resolveVisualizationTheme(theme);

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
            // Occurrences order by AYAH (their radial rank is their position in
            // the surah); roots keep frequency order, which is what their fan
            // spacing and label priority are built on.
            list.sort((a, b) =>
                a.data.ayah != null && b.data.ayah != null
                    ? a.data.ayah - b.data.ayah
                    : b.data.value - a.data.value
            );
            countBySurah.set(parentId, list.length);
            list.forEach((node, idx) => {
                rankById.set(node.data.id, idx + 1);
                indexById.set(node.data.id, idx);
            });
        });
        return { rankById, indexById, countBySurah };
    }, [nodes]);
    const { rankById: rootRankById, indexById: rootIndexById, countBySurah: rootCountBySurah } = rootMeta;

    const rootGlobalStats = useMemo(() => {
        const stats = new Map<string, { total: number; gloss: string }>();
        stableTokens.forEach((t) => {
            if (!t.root) return;
            if (!stats.has(t.root)) {
                stats.set(t.root, { total: 0, gloss: t.morphology?.gloss ?? "" });
            }
            const entry = stats.get(t.root)!;
            entry.total++;
        });
        return stats;
    }, [stableTokens]);
    const maxRootGlobalCount = useMemo(
        () => Math.max(1, ...Array.from(rootGlobalStats.values()).map((entry) => entry.total)),
        [rootGlobalStats]
    );

    const selectedRootGlobalStats = internalSelectedRoot
        ? rootGlobalStats.get(internalSelectedRoot) ?? null
        : null;
    const selectedRootOccurrencesLabel = selectedRootInfo?.count
        ? t("occurrences", { count: selectedRootInfo.count })
        : "";
    const selectedRootTotalLabel = selectedRootGlobalStats
        ? isArabicLocale
            ? `${ts("totalInQuran")} ${selectedRootGlobalStats.total.toLocaleString(locale)}`
            : `${selectedRootGlobalStats.total.toLocaleString(locale)} ${ts("totalInQuran")}`
        : "";
    const selectedRootGlossLabel = selectedRootGlobalStats?.gloss?.trim() ?? "";

    // Root search state
    const [rootSearchQuery, setRootSearchQuery] = useState("");
    const deferredRootSearch = useDeferredValue(rootSearchQuery);

    // Build sorted list of all roots with their global counts
    const allRootsSorted = useMemo(() => {
        return Array.from(rootGlobalStats.entries())
            .map(([root, stats]) => ({ root, total: stats.total, gloss: stats.gloss }))
            .sort((a, b) => b.total - a.total);
    }, [rootGlobalStats]);

    // Filter roots by search query
    const filteredRoots = useMemo(() => {
        if (!deferredRootSearch.trim()) return [];
        const q = deferredRootSearch.trim();
        return allRootsSorted
            .filter(r => r.root.includes(q) || r.gloss.toLowerCase().includes(q.toLowerCase()))
            .slice(0, 20);
    }, [deferredRootSearch, allRootsSorted]);

    const handleRootSearchSelect = useCallback((root: string) => {
        setInternalSelectedRoot(prev => prev === root ? null : root);
        // Populate root info
        const globalStats = rootGlobalStats.get(root);
        if (globalStats) {
            setSelectedRootInfo({
                root,
                count: globalStats.total,
                surahId: null,
                surahName: null,
                surahArabic: null,
            });
        }
        onNodeSelect?.("root", root);
        setRootSearchQuery("");
    }, [rootGlobalStats, onNodeSelect]);

    // Corpus coverage stats: how much of the data is shown in the visualization.
    // totalTokens/totalSurahs used to re-walk the raw `tokens` array (an O(n)
    // scan, and a dependency that fired this memo on every reference-only
    // `tokens` churn); both are exactly reconstructable from `surahRootData`
    // (per-surah tokenCount sums to the total; its keys are the unique
    // surahs), which is itself signature-gated above — so this memo no
    // longer needs `tokens` at all.
    const corpusCoverage = useMemo(() => {
        const totalUniqueRoots = rootGlobalStats.size;
        const displayedRootIds = new Set<string>();
        nodes.forEach(n => {
            if (n.data.type === "word_root" && n.data.originalId) {
                displayedRootIds.add(n.data.originalId as string);
            }
        });
        const displayedUniqueRoots = displayedRootIds.size;
        let totalTokens = 0;
        surahRootData.forEach((entry) => { totalTokens += entry.tokenCount; });
        const totalSurahs = surahRootData.size;

        // Count roots for focused surah specifically
        const focusedSurahRootCount = focusedSurahId
            ? surahRootData.get(focusedSurahId)?.rootCounts.size ?? 0
            : 0;

        return { totalUniqueRoots, displayedUniqueRoots, totalTokens, totalSurahs, focusedSurahRootCount };
    }, [rootGlobalStats, nodes, focusedSurahId, surahRootData]);

    const rootVisibilityLimit = useMemo(() => {
        if (focusSurahNodeId) {
            // When a surah is focused, show all roots progressively as user zooms in
            if (zoomLevel < 0.6) return 30;
            if (zoomLevel < 0.9) return 80;
            if (zoomLevel < 1.3) return 200;
            return Infinity; // Show all roots at high zoom
        }
        // Overview mode: keep it compact
        if (zoomLevel < 0.5) return 3;
        if (zoomLevel < 0.75) return 5;
        if (zoomLevel < 1.1) return 8;
        return 10;
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

            if (occurrenceMode) {
                // Even spacing along the spike, in ayah order — the value-based
                // ratio below is meaningless here (nearly every ayah holds the
                // root once) and the rank nudge packed 37 occurrences into
                // ~3px of radius each.
                const index = rootIndexById.get(node.data.id) ?? 0;
                const total = rootCountBySurah.get(parentId ?? "") ?? 1;
                const band = Math.min(
                    OCCURRENCE_MAX_BAND,
                    Math.max(OCCURRENCE_MIN_BAND, (total - 1) * OCCURRENCE_STEP_PX)
                );
                const step = total > 1 ? band / (total - 1) : 0;
                offsets.set(node.data.id, OCCURRENCE_BASE_OFFSET + index * step);
                return;
            }

            const max = maxBySurah.get(parentId ?? "") ?? 1;
            const ratio = Math.log1p(node.data.value) / Math.log1p(max);
            const rank = rootRankById.get(node.data.id) ?? 1;
            const total = rootCountBySurah.get(parentId ?? "") ?? 1;

            // Adaptive spacing: use logarithmic compression when a surah has many roots
            // so hundreds of roots spread out without flying off-screen
            let rankNudge: number;
            if (total > 50) {
                // Large root set (focused surah): logarithmic spiral-like spacing
                rankNudge = 20 + Math.log(rank + 1) * 40 + Math.sqrt(rank) * 3;
            } else {
                // Small root set (unfocused overview): linear spacing
                rankNudge = Math.min(120, rank * 8 + Math.sqrt(rank) * 4);
            }
            const offset = 25 + ratio * 40 + rankNudge;
            offsets.set(node.data.id, offset);
        });
        return offsets;
    }, [nodes, rootRankById, rootIndexById, rootCountBySurah, occurrenceMode]);

    const rootAngleOffsetById = useMemo(() => {
        const offsets = new Map<string, number>();
        nodes.forEach((node) => {
            if (node.data.type !== "word_root") return;
            const parentId = node.parent?.data.id;
            if (!parentId) return;
            const total = rootCountBySurah.get(parentId) ?? 1;
            const index = rootIndexById.get(node.data.id) ?? 0;
            const centered = index - (total - 1) / 2;

            if (occurrenceMode) {
                // Hairline fan only — a surah's occurrences must stay inside its
                // own wedge of the ring (see the constants above).
                const occurrenceSpread = Math.min(
                    OCCURRENCE_MAX_SPREAD_DEG,
                    (total - 1) * OCCURRENCE_SPREAD_PER_NODE_DEG
                );
                offsets.set(
                    node.data.id,
                    total > 1 ? centered * (occurrenceSpread / (total - 1)) : 0
                );
                return;
            }

            // Adaptive angle spread:
            // - For large root sets (focused surah with 100+ roots), use wider arc
            // - Keep individual spread per-root smaller to avoid global overlap
            let spread: number;
            if (total > 100) {
                // Very large: cover up to 160° of arc, with sub-linear growth
                spread = Math.min(160, 60 + Math.sqrt(total) * 8);
            } else if (total > 30) {
                spread = Math.min(120, total * 2.5);
            } else {
                const step = focusSurahNodeId ? 4.0 : 2.5;
                spread = Math.min(80, total * step);
            }
            const baseOffset = total > 1 ? centered * (spread / (total - 1)) : 0;
            const forkNudge = (index % 2 === 0 ? 1 : -1) * Math.min(2, 0.3 * Math.max(1, index));
            offsets.set(node.data.id, baseOffset + forkNudge);
        });
        return offsets;
    }, [nodes, rootIndexById, rootCountBySurah, focusSurahNodeId, occurrenceMode]);

    const rootNodeColorById = useMemo(() => {
        const colors = new Map<string, string>();
        nodes.forEach((node) => {
            if (node.data.type !== "word_root") return;
            const rootKey = (node.data.originalId as string | undefined) ?? node.data.name;
            const globalCount = rootGlobalStats.get(rootKey)?.total ?? node.data.value;
            const ratio = Math.log1p(globalCount) / Math.log1p(maxRootGlobalCount);

            const color =
                lexicalColorMode === "frequency"
                    ? getFrequencyColor(ratio, theme)
                    : lexicalColorMode === "identity"
                        ? getIdentityColor(rootKey, theme)
                        : themeColors.nodeColors.default;
            colors.set(node.data.id, color);
        });
        return colors;
    }, [nodes, rootGlobalStats, maxRootGlobalCount, lexicalColorMode, theme, themeColors.nodeColors.default]);

    const legendRootColor =
        lexicalColorMode === "frequency"
            ? getFrequencyColor(0.7, theme)
            : lexicalColorMode === "identity"
                ? getIdentityColor("root-legend", theme)
                : themeColors.nodeColors.default;

    // Stable 114-surah ring: a SEPARATE cluster layout over static
    // SURAH_NAMES metadata only (corpus -> 114 surah leaves, each with one
    // synthetic, never-rendered placeholder child purely so its computed
    // HEIGHT — and therefore its normalized radius — matches the real
    // corpus->surah->root depth of 2 regardless of whether real root data
    // has arrived). Because this never depends on `tokens`/`hierarchyData`,
    // every surah's angle AND radius are fixed from first paint and never
    // reshuffle as batches land — the fix for the dynamic hierarchy above
    // reflowing the WHOLE ring every time any surah's root count changes
    // (d3.cluster spaces leaves by cumulative separation across the entire
    // tree, so one surah gaining roots used to nudge every other surah's
    // angle too). Root nodes still fan out from their surah via the
    // existing rootOffsetById/rootAngleOffsetById additive offsets below.
    const surahSkeleton = useMemo(() => {
        const skeletonRoot: HierarchyNode = {
            id: "corpus",
            name: "corpus",
            type: "corpus",
            value: 1,
            children: Object.keys(SURAH_NAMES)
                .map(Number)
                .sort((a, b) => a - b)
                .map((suraId) => ({
                    id: `s-${suraId}`,
                    name: SURAH_NAMES[suraId]?.name ?? `Surah ${suraId}`,
                    type: "surah" as const,
                    value: 1,
                    originalId: suraId,
                    children: [{
                        id: `s-${suraId}-placeholder`,
                        name: "",
                        type: "word_root" as const,
                        value: 1,
                    }],
                })),
        };

        const layout = d3.cluster<HierarchyNode>()
            .size([360, layoutRadius])
            .separation((a, b) => (a.parent === b.parent ? 2 : 3) / a.depth);
        const laidOut = layout(d3.hierarchy(skeletonRoot));

        const angleDegById = new Map<number, number>();
        const radiusById = new Map<number, number>();
        laidOut.children?.forEach((surahNode) => {
            const suraId = surahNode.data.originalId as number;
            angleDegById.set(suraId, surahNode.x);
            radiusById.set(suraId, surahNode.y);
        });
        return { angleDegById, radiusById };
    }, [layoutRadius]);

    // Both callbacks below resolve SURAH/ROOT position from surahSkeleton
    // (fixed) rather than the dynamic hierarchy's own per-render x/y — see
    // surahSkeleton's comment. `null` (corpus, or the unused legacy "root"
    // type) means "center", where angle is irrelevant at radius 0.
    const surahIdForNode = useCallback((node: d3.HierarchyPointNode<HierarchyNode>): number | null => {
        if (node.data.type === "surah") return node.data.originalId as number;
        if (node.data.type === "word_root") return (node.parent?.data.originalId as number | undefined) ?? null;
        return null;
    }, []);

    const getNodeRadius = useCallback(
        (node: d3.HierarchyPointNode<HierarchyNode>) => {
            const suraId = surahIdForNode(node);
            if (suraId === null) return 0;
            const base = surahSkeleton.radiusById.get(suraId) ?? node.y;
            const offset = node.data.type === "word_root" ? (rootOffsetById.get(node.data.id) ?? 0) : 0;
            return base + offset;
        },
        [surahIdForNode, surahSkeleton, rootOffsetById]
    );

    const getNodeAngle = useCallback(
        (node: d3.HierarchyPointNode<HierarchyNode>) => {
            const suraId = surahIdForNode(node);
            if (suraId === null) return 0;
            const base = surahSkeleton.angleDegById.get(suraId) ?? node.x;
            const offset = node.data.type === "word_root" ? (rootAngleOffsetById.get(node.data.id) ?? 0) : 0;
            return (base + offset) * Math.PI / 180;
        },
        [surahIdForNode, surahSkeleton, rootAngleOffsetById]
    );

    const radialLink = useMemo(
        () =>
            d3
                .linkRadial<d3.HierarchyPointLink<HierarchyNode>, d3.HierarchyPointNode<HierarchyNode>>()
                .angle((d) => getNodeAngle(d))
                .radius((d) => getNodeRadius(d)),
        [getNodeAngle, getNodeRadius]
    );

    // A centre spoke is drawn as a straight radial line, NOT through
    // `radialLink`. d3.linkRadial builds its control points from the SOURCE's
    // own angle, and the corpus node has none — it sits at radius 0, where
    // `getNodeAngle` falls back to 0, which points straight up. So all 114
    // spokes left the centre heading north and only then curved back to their
    // surah, piling every one of them into the same knot above the middle of
    // the ring (the tangle this replaces). Straight spokes share nothing but
    // the origin, so they cannot cross each other at all.
    const buildLinkPath = useCallback(
        (link: d3.HierarchyPointLink<HierarchyNode>) => {
            if (link.source.data.id === "corpus") {
                const [x, y] = d3.pointRadial(getNodeAngle(link.target), getNodeRadius(link.target));
                return `M0,0L${x},${y}`;
            }
            return radialLink(link) || "";
        },
        [radialLink, getNodeAngle, getNodeRadius]
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

    // Frame the whole occurrence burst once per root. Spikes are as long as
    // the surah is dense, so the content extent changes with the root and the
    // fixed entry zoom left the longest ones off-screen. `nodePositionById`
    // already holds every node's final local position, so these bounds are
    // exact rather than an estimate from viewRadius (which pads for the worst
    // case).
    //
    // Gated on the corpus being COMPLETE, not merely non-empty. This is the
    // streaming trap from docs/VIZ_ARCHITECTURE.md ("any effect that measures
    // geometry and then locks itself must gate on complete data"): fitting
    // after the first batch framed the handful of surahs that had landed and
    // then locked, leaving two thirds of the finished burst outside the
    // viewport (measured: 106 of 300 wires in view).
    const isCorpusComplete = surahRootData.size >= Object.keys(SURAH_NAMES).length;
    useEffect(() => {
        if (!occurrenceMode || !activeRootKey || !isMounted) {
            if (!occurrenceMode) fittedRootRef.current = null;
            return;
        }
        if (!isCorpusComplete) return;
        if (fittedRootRef.current === activeRootKey) return;
        const occurrenceNodes = nodes.filter((node) => node.data.ayah != null);
        if (occurrenceNodes.length === 0) return;
        fittedRootRef.current = activeRootKey;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const node of occurrenceNodes) {
            const position = nodePositionById.get(node.data.id);
            if (!position) continue;
            if (position.x < minX) minX = position.x;
            if (position.x > maxX) maxX = position.x;
            if (position.y < minY) minY = position.y;
            if (position.y > maxY) maxY = position.y;
        }
        if (!Number.isFinite(minX) || !Number.isFinite(minY)) return;
        const pad = 90;
        fitBounds(
            { x: minX - pad, y: minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 },
            { padding: 0.9 }
        );
    }, [occurrenceMode, activeRootKey, isMounted, isCorpusComplete, nodes, nodePositionById, fitBounds]);

    // Where each leaf sits along the axis its fan actually spreads on, in
    // local/unscaled SVG units — precomputed once rather than per zoom tick,
    // and multiplied by the current (quantized) zoom scale in
    // admittedRootLabelIds to approximate on-screen label distance.
    //
    // A root fan spreads sideways, so that axis is arc length (angle × radius).
    // An occurrence fan is a radial STACK at a near-constant angle, where arc
    // length barely changes between neighbours — and collapses to zero near the
    // top of the ring, where the angle itself is ~0, admitting exactly one
    // label per surah. Radius is the honest axis there.
    const rootLabelAxisById = useMemo(() => {
        const map = new Map<string, number>();
        nodes.forEach((node) => {
            if (node.data.type !== "word_root") return;
            map.set(
                node.data.id,
                occurrenceMode ? getNodeRadius(node) : getNodeAngle(node) * getNodeRadius(node)
            );
        });
        return map;
    }, [nodes, occurrenceMode, getNodeAngle, getNodeRadius]);

    // zoomTransform/zoomLevel now only ever change at gesture end or a
    // quantized mid-gesture crossing (see the zoom-commit comment above), so
    // reading them directly here already gives every zoom-dependent memo
    // below the "recompute a handful of times per gesture, not every tick"
    // behavior for free.
    const deferredZoom = zoomTransform;

    const visibleNodes = useMemo(() => {
        // Use very generous bounds when a surah is focused to avoid culling roots
        const padding = focusSurahNodeId ? 1400 : 800;
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
            // Occurrence mode draws every occurrence at EVERY zoom: the
            // rank/LOD gating below exists to thin a 585-root fan, and there
            // is no fan here — one root's wires are the entire content, and
            // hiding them until the user zooms is what made the view read as
            // broken (same call as the radial map's always-on mesh).
            if (occurrenceMode) return true;
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
    }, [nodes, lodMode, highlightRoot, hoveredNode, focusSurahNodeId, occurrenceMode, deferredZoom, rootRankById, rootVisibilityLimit, nodePositionById, viewRadius]);

    // Count how many focused-surah roots are currently in the viewport
    const focusedSurahRootsInView = useMemo(() => {
        if (!focusedSurahId) return 0;
        return visibleNodes.filter(n => n.data.type === "word_root" && n.parent?.data.id === `s-${focusedSurahId}`).length;
    }, [visibleNodes, focusedSurahId]);

    const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.data.id)), [visibleNodes]);
    const visibleLinks = useMemo(() => {
        if (occurrenceMode) {
            return links.filter((link) => {
                if (!visibleNodeIds.has(link.source.data.id) || !visibleNodeIds.has(link.target.data.id)) return false;
                // Centre spokes only to surahs that actually carry the root —
                // the rest of the 114-spoke fan IS the noise being filtered.
                if (link.source.data.id === "corpus") {
                    return occurrencesBySurah.has(link.target.data.originalId as number);
                }
                return true;
            });
        }
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
    }, [links, visibleNodeIds, focusSurahNodeId, occurrenceMode, occurrencesBySurah]);

    const labelOffsetForNode = useCallback(
        (node: d3.HierarchyPointNode<HierarchyNode>) => {
            if (node.data.type !== "word_root") return 6;
            const offset = rootOffsetById.get(node.data.id) ?? 0;
            return 9 + Math.min(10, offset * 0.18);
        },
        [rootOffsetById]
    );

    // See LABEL_VIEW_PADDING above for why this is a tighter box than
    // visibleNodes' own isInView.
    const isLabelInView = useCallback(
        (x: number, y: number) => {
            const screenX = x * deferredZoom.k + deferredZoom.x;
            const screenY = y * deferredZoom.k + deferredZoom.y;
            return (
                screenX >= -viewRadius - LABEL_VIEW_PADDING &&
                screenX <= viewRadius + LABEL_VIEW_PADDING &&
                screenY >= -viewRadius - LABEL_VIEW_PADDING &&
                screenY <= viewRadius + LABEL_VIEW_PADDING
            );
        },
        [deferredZoom, viewRadius]
    );

    // zoomLevel is the d3 ZOOM transform's own scale factor — it does NOT
    // include the SVG's OWN viewBox-to-CSS-pixel scale. `viewRadius` (the
    // viewBox half-extent, in local SVG units) is frequently far larger
    // than the element's actual rendered width once a large surah's roots
    // push it out (e.g. Al-Baqarah's ~600 roots roughly double it), so
    // `arcLength * zoomLevel` alone understates true on-screen density by
    // that same factor and under-declutters — confirmed visually (labels
    // still overlapping at a "585/585 roots shown" fan even after the
    // separation test below was in place). Reading the live client width
    // here (rather than tracking it in state) matches this file's existing
    // tolerance for treating the container as effectively constant after
    // mount (see the `dimensions` comment above); the fallback keeps the
    // very first render, before the ref is attached, sane.
    const svgPixelWidth = svgRef.current?.clientWidth || 1100;

    // Screen-space label admission per surah root-fan — the fix for a
    // focused surah's root fan rendering every label at once and
    // overlapping into an illegible column. Greedily accepts labels in
    // FREQUENCY-RANK order (highest `.data.value` first) within each surah's
    // fan, admitting a candidate only if it lands >= LABEL_MIN_SEPARATION_PX
    // (true screen px, via labelScreenScale below) from every label already
    // admitted in that same fan — a cheap 1D separation test along the
    // fan's own spread axis (rootLabelAxisById above), not a full 2D
    // collision check. Hovered/selected/highlightRoot-matching roots are
    // exempt (always admitted) and are placed FIRST so they act as blockers
    // for the rest, matching this file's existing "explicit picks are
    // authoritative" convention. The candidate gate itself (which roots are
    // even in the running) mirrors the original unconditional showLabel
    // OR-chain it replaces — lodMode "full", the active-highlight/opacity
    // set, or membership in a focused surah — so the only behavior change
    // is WHICH of those candidates actually get a label. Depends only on
    // the quantized zoomLevel (never the raw per-tick transform — see the
    // zoom-commit comment above), so this recomputes a handful of times per
    // gesture, not every frame.
    const admittedRootLabelIds = useMemo(() => {
        const admitted = new Set<string>();
        const labelScreenScale = zoomLevel * (svgPixelWidth / (viewRadius * 2));

        const bySurah = new Map<string, d3.HierarchyPointNode<HierarchyNode>[]>();
        nodes.forEach((node) => {
            if (node.data.type !== "word_root") return;
            const isCandidate =
                lodMode === "full" ||
                getOpacity(node) === 1 ||
                (highlightRoot && node.data.originalId === highlightRoot) ||
                (focusSurahNodeId ? node.parent?.data.id === focusSurahNodeId : false);
            if (!isCandidate) return;
            const parentId = node.parent?.data.id;
            if (!parentId) return;
            const list = bySurah.get(parentId);
            if (list) list.push(node);
            else bySurah.set(parentId, [node]);
        });

        // Exemption = "this is the thing the user is pointing at", so it must
        // be per NODE in occurrence mode: every leaf there shares the active
        // root, and the root-identity test below would exempt all of them,
        // admitting every ayah label at once — the overlap this whole
        // separation pass exists to prevent.
        const isExemptRoot = (node: d3.HierarchyPointNode<HierarchyNode>) =>
            occurrenceMode
                ? node.data.id === selectedOccurrenceNodeId || hoveredNode?.data.id === node.data.id
                : (!!internalSelectedRoot && node.data.originalId === internalSelectedRoot) ||
                  (!!highlightRoot && node.data.originalId === highlightRoot) ||
                  hoveredNode?.data.id === node.data.id;

        bySurah.forEach((candidates) => {
            const exempt = candidates.filter(isExemptRoot);
            // Roots compete by frequency; occurrences by ayah order, so the
            // labels that survive read left-to-right through the surah instead
            // of clustering wherever the heaviest ayahs happen to fall.
            const rest = candidates
                .filter((node) => !isExemptRoot(node))
                .sort((a, b) =>
                    occurrenceMode && a.data.ayah != null && b.data.ayah != null
                        ? a.data.ayah - b.data.ayah
                        : b.data.value - a.data.value
                );

            const acceptedPositions: number[] = [];
            exempt.forEach((node) => {
                admitted.add(node.data.id);
                acceptedPositions.push((rootLabelAxisById.get(node.data.id) ?? 0) * labelScreenScale);
            });
            rest.forEach((node) => {
                const pos = (rootLabelAxisById.get(node.data.id) ?? 0) * labelScreenScale;
                const tooClose = acceptedPositions.some(
                    (accepted) => Math.abs(accepted - pos) < LABEL_MIN_SEPARATION_PX
                );
                if (!tooClose) {
                    admitted.add(node.data.id);
                    acceptedPositions.push(pos);
                }
            });
        });

        return admitted;
    }, [nodes, lodMode, highlightRoot, focusSurahNodeId, internalSelectedRoot, occurrenceMode, selectedOccurrenceNodeId, hoveredNode, rootLabelAxisById, zoomLevel, getOpacity, svgPixelWidth, viewRadius]);

    return (
        <section
            className="immersive-viz viz-fullwidth"
            data-theme={theme}
            style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                background: "radial-gradient(circle at center, var(--bg-1) 0%, var(--bg-0) 100%)"
            }}
        >

            {/* Portal controls to sidebar stack */
                isMounted && (typeof document !== 'undefined') && document.getElementById('viz-sidebar-portal') && createPortal(
                    <>


                        <div className={`viz-left-stack ${!isLeftSidebarOpen ? 'collapsed' : ''}`}>
                            <div className="viz-left-panel viz-zoom-panel">
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span className="eyebrow" style={{ fontSize: "0.7em" }}>{ts("zoom")}</span>
                                </div>
                                <div className="viz-zoom-row">
                                    <button type="button" className="viz-zoom-reset-btn" onClick={() => fitToView()}>
                                        {ts("focus")}
                                    </button>
                                </div>
                            </div>
                            <div className="viz-left-panel">
                                <strong style={{ fontSize: '0.95em' }}>{t("title")}</strong>
                                <div style={{ marginTop: 8, fontSize: '0.7em', opacity: 0.5, lineHeight: 1.6 }}>
                                    {occurrenceMode ? (
                                        <>
                                            {t("occurrenceSummary", {
                                                root: activeRootKey ?? "",
                                                count: occurrenceStats.total,
                                                ayahCount: occurrenceStats.ayahs,
                                                surahCount: occurrenceStats.surahs,
                                            })}
                                        </>
                                    ) : focusedSurahId ? (
                                        <>
                                            {focusedSurahRootsInView}/{corpusCoverage.focusedSurahRootCount} {ts("root")}s {t("visibleLabel")}
                                            {focusedSurahRootsInView < corpusCoverage.focusedSurahRootCount && (
                                                <span style={{ display: 'block', marginTop: 2, color: 'var(--accent)', opacity: 0.85 }}>
                                                    {t("zoomToSeeMore")}
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {corpusCoverage.displayedUniqueRoots}/{corpusCoverage.totalUniqueRoots} {ts("root")}s {t("visibleLabel")}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Occurrence card — hover previews the ayah in full,
                                a click pins it. Same contract as the radial
                                map's ayah card so the two views read alike. */}
                            <AnimatePresence>
                                {occurrenceMode && previewOccurrence && (
                                    <motion.div
                                        className="viz-left-panel"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        transition={reduceMotion ? { duration: 0 } : undefined}
                                    >
                                        <div className="viz-tooltip-title">{ts("ayahCaps")} {previewOccurrence.ayah}</div>
                                        <div className="viz-tooltip-subtitle">
                                            {previewOccurrence.sura}. {SURAH_NAMES[previewOccurrence.sura]?.name ?? ""}
                                            {" · "}
                                            {previewOccurrence.sura}:{previewOccurrence.ayah}
                                        </div>
                                        <div className="viz-tooltip-subtitle" style={{ opacity: 0.7, fontSize: "0.72rem" }}>
                                            {isPreviewPinned ? t("ayahPinned") : t("ayahHoverHint")}
                                        </div>
                                        {previewAyahText && (
                                            <div
                                                className="viz-tooltip-subtitle arabic-text"
                                                style={{
                                                    marginTop: "0.5rem",
                                                    fontSize: "1.3rem",
                                                    lineHeight: 1.6,
                                                    textAlign: "right",
                                                    direction: "rtl",
                                                    width: "100%",
                                                    color: "var(--ink)",
                                                    paddingBottom: "0.5rem",
                                                    borderBottom: "1px solid var(--line)",
                                                }}
                                            >
                                                {previewAyahText}
                                            </div>
                                        )}
                                        <div className="viz-tooltip-row" style={{ marginTop: 8 }}>
                                            <span className="viz-tooltip-label arabic-text">{activeRootKey}</span>
                                            <span className="viz-tooltip-value">{previewOccurrenceCount}</span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <AnimatePresence>
                                {!occurrenceMode && selectedRootInfo && (
                                    <motion.div
                                        className="viz-left-panel"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={reduceMotion ? { duration: 0 } : undefined}
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
                                            {/* Same figure as tokens.filter(t => t.root === root).length,
                                                read from the already-aggregated map instead of re-scanning
                                                every token on each render. */}
                                            <span className="viz-tooltip-value">
                                                {rootGlobalStats.get(selectedRootInfo.root)?.total ?? 0}
                                            </span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Root Search */}
                            <div className="viz-left-panel">
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
                                                    onClick={() => handleRootSearchSelect(r.root)}
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
                                            onClick={() => {
                                                setInternalSelectedRoot(null);
                                                setSelectedRootInfo(null);
                                            }}
                                        >
                                            <span className="root-name">{internalSelectedRoot}</span>
                                            <span className="root-count">{ts("clear")}</span>
                                        </button>
                                    )}
                                </div>
                            </div>

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
                                        style={{ background: legendRootColor, width: 8, height: 8 }}
                                    />
                                    <span style={{ fontSize: '0.75em' }}>
                                        {occurrenceMode ? t("occurrenceLegend") : ts("root")}
                                    </span>
                                </div>
                                {occurrenceMode && (
                                    <div className="viz-legend-item" style={{ marginBottom: '6px' }}>
                                        <div
                                            className="viz-legend-dot"
                                            style={{ background: themeColors.accentSecondary, width: 8, height: 8 }}
                                        />
                                        <span style={{ fontSize: '0.75em' }}>{t("selectedOccurrenceLegend")}</span>
                                    </div>
                                )}
                                <div className="viz-legend-item">
                                    <div
                                        className="viz-legend-line"
                                        style={{ background: themeColors.edgeColors.default }}
                                    />
                                    <span style={{ fontSize: '0.75em' }}>{ts("link")}</span>
                                </div>
                            </div>
                        </div>
                    </>,
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
                        { label: t("Help.tipsLabel"), text: t("Help.tipsText") },
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
                        {/* Links */}
                        <g className="links" fill="none" strokeWidth={1}>
                            {visibleLinks.map((link) => {
                                const isSourceRoot = link.source.data.id === 'corpus';
                                const stroke = isSourceRoot
                                    ? "var(--line)"
                                    : themeColors.edgeColors.default;
                                const isFocusLink = focusSurahNodeId
                                    ? link.source.data.id === focusSurahNodeId ||
                                    link.target.data.id === focusSurahNodeId ||
                                    link.source.parent?.data.id === focusSurahNodeId ||
                                    link.target.parent?.data.id === focusSurahNodeId
                                    : false;
                                const pathD = buildLinkPath(link);
                                // Occurrence wires carry their own emphasis:
                                // the picked one in a distinct hue, the hovered
                                // one in the accent, the rest in the root's
                                // colour so the burst still reads as one word.
                                const occurrenceAyah = occurrenceMode ? link.target.data.ayah ?? null : null;
                                const occurrenceSura = occurrenceAyah != null
                                    ? (link.target.parent?.data.originalId as number | undefined) ?? null
                                    : null;
                                const isSelectedOccurrence =
                                    occurrenceAyah != null && link.target.data.id === selectedOccurrenceNodeId;
                                const isHoveredOccurrence =
                                    occurrenceAyah != null && hoveredNode?.data.id === link.target.data.id;
                                const occurrenceStroke = isSelectedOccurrence
                                    ? themeColors.accentSecondary
                                    : isHoveredOccurrence
                                        ? themeColors.accent
                                        : rootNodeColorById.get(link.target.data.id) ?? stroke;
                                // Surah->root links don't exist in the DOM until their surah's
                                // batch lands (see hierarchyData) — corpus->surah links exist
                                // for all 114 surahs from first paint, so only surah->root
                                // links get the mount-time entrance; both get the plain
                                // value-change fade (e.g. a spoke brightening once its surah
                                // loads). Delay is inherited from the parent surah so a
                                // surah's dot and its roots read as one arrival.
                                const isSurahToRootLink = !isSourceRoot;
                                const revealDelayMs = isSurahToRootLink
                                    ? revealDelayMsBySurah.get(link.source.data.originalId as number) ?? 0
                                    : 0;
                                return (
                                    // Keyed by pair identity, not array index: `visibleLinks`
                                    // grows/reorders as batches stream in, and an index key
                                    // would let React silently reuse an unrelated link's DOM
                                    // node (and its still-pending reveal-animation mount) for
                                    // a completely different pair (see docs/VIZ_ARCHITECTURE.md,
                                    // "Key edges by pair identity, never array index").
                                    <g key={`${link.source.data.id}->${link.target.data.id}`}>
                                        <path
                                            d={pathD}
                                            stroke={occurrenceAyah != null ? occurrenceStroke : stroke}
                                            opacity={
                                                isSelectedOccurrence || isHoveredOccurrence
                                                    ? 1
                                                    : isFocusLink
                                                        ? 0.9
                                                        : occurrenceAyah != null
                                                            ? 0.55
                                                            // A centre spoke used to read as part of the
                                                            // knot; drawn straight and alone it needs its
                                                            // own weight to still say "this surah carries
                                                            // the root".
                                                            : occurrenceMode && isSourceRoot
                                                                ? 0.5
                                                                : Math.min(getOpacity(link.source), getOpacity(link.target)) * 0.5
                                            }
                                            strokeWidth={
                                                isSelectedOccurrence ? 2.6 : isHoveredOccurrence ? 2 : isFocusLink ? 1.6 : 1
                                            }
                                            // `d` is recomputed on every zoom/layout change — never `transition-all`
                                            // here or the browser eases the rendered path toward each new `d` while
                                            // React writes the attribute instantly (the wire-lag defect fixed on
                                            // RootNetworkGraph's .edge/.node-circle; see docs/VIZ_ARCHITECTURE.md,
                                            // "Never transition: all on SVG geometry"). Opacity-only — see
                                            // .corpus-arch-fade / .corpus-arch-reveal in globals.css.
                                            className={`corpus-arch-fade${isSurahToRootLink ? " corpus-arch-reveal" : ""}`}
                                            style={isSurahToRootLink ? { animationDelay: `${revealDelayMs}ms` } : undefined}
                                            pointerEvents="none"
                                        />
                                        <path
                                            d={pathD}
                                            stroke="transparent"
                                            strokeWidth={10}
                                            vectorEffect="non-scaling-stroke"
                                            fill="none"
                                            style={{ cursor: "pointer" }}
                                            onMouseEnter={() => {
                                                if (occurrenceAyah == null) return;
                                                setHoveredNode(link.target);
                                                const tokenId = occurrenceSura != null
                                                    ? occurrencesBySurah.get(occurrenceSura)?.find((e) => e.ayah === occurrenceAyah)?.tokenId
                                                    : undefined;
                                                if (tokenId) onTokenHover?.(tokenId);
                                            }}
                                            onMouseLeave={() => {
                                                if (occurrenceAyah == null) return;
                                                setHoveredNode((prev) => (prev?.data.id === link.target.data.id ? null : prev));
                                                onTokenHover?.(null);
                                            }}
                                            onClick={() => {
                                                if (occurrenceAyah != null && occurrenceSura != null) {
                                                    handleOccurrenceSelect(occurrenceSura, occurrenceAyah);
                                                    return;
                                                }
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
                                // Word-root candidacy used to be this same OR-chain shown
                                // UNCONDITIONALLY (every candidate got a label) — that's the
                                // "competing/overlapping root text" bug. admittedRootLabelIds
                                // reruns that exact candidacy test but additionally requires
                                // the root to have WON the per-fan separation check (see its
                                // definition above); surah labels are unchanged.
                                const showLabel =
                                    (node.data.type === "surah" ||
                                        (node.data.type === "word_root" && admittedRootLabelIds.has(node.data.id))) &&
                                    isLabelInView(x, y);

                                // Surah nodes exist (as dim "pending" placeholders) from the
                                // very first paint and only ever CHANGE opacity value once
                                // loaded — that's a plain value-change transition
                                // (.corpus-arch-fade). Root nodes don't exist until their
                                // surah's batch lands, so they get the mount-time entrance
                                // too (.corpus-arch-reveal) — see the links block above for
                                // why corpus/surah-level geometry never needs that class.
                                // Either way the delay is the parent surah's reveal slot, so
                                // a surah's dot and its roots read as one arrival.
                                const suraIdForReveal =
                                    node.data.type === "surah"
                                        ? (node.data.originalId as number)
                                        : node.data.type === "word_root"
                                            ? (node.parent?.data.originalId as number | undefined)
                                            : undefined;
                                const revealDelayMs = suraIdForReveal !== undefined ? (revealDelayMsBySurah.get(suraIdForReveal) ?? 0) : 0;
                                const isMountReveal = node.data.type === "word_root";

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
                                            } else if (occurrenceMode && node.data.ayah != null) {
                                                // Occurrence dot: pick the AYAH. Re-selecting the
                                                // root here would be a no-op at best and, on the
                                                // deselect branch below, would clear the very
                                                // filter this mode is built on.
                                                const suraId = node.parent?.data.originalId as number | undefined;
                                                if (suraId != null) handleOccurrenceSelect(suraId, node.data.ayah);
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
                                        style={{
                                            cursor: 'pointer',
                                            ...(isMountReveal
                                                ? { animationDelay: `${revealDelayMs}ms` }
                                                : { transitionDelay: `${revealDelayMs}ms` }),
                                        }}
                                        opacity={getOpacity(node)}
                                        className={`corpus-arch-fade${isMountReveal ? " corpus-arch-reveal" : ""}`}
                                    >
                                        {node.data.id === selectedOccurrenceNodeId && (
                                            <circle
                                                r={7}
                                                fill="none"
                                                stroke={themeColors.accentSecondary}
                                                strokeWidth={1.6}
                                                pointerEvents="none"
                                            />
                                        )}
                                        {isHighlighted && node.data.type !== "corpus" && (
                                            <circle
                                                r={node.data.type === "surah" ? 7.5 : 4.8}
                                                fill="none"
                                                stroke={node.data.type === "surah" ? themeColors.accent : (rootNodeColorById.get(node.data.id) ?? themeColors.nodeColors.default)}
                                                strokeOpacity={theme === "dark" ? 0.55 : 0.45}
                                                strokeWidth={1.2}
                                                pointerEvents="none"
                                            />
                                        )}
                                        <circle
                                            r={node.data.type === "surah" ? 5 : (node.data.type === "corpus" ? 0 : 3)}
                                            fill={
                                                node.data.id === selectedOccurrenceNodeId
                                                    ? themeColors.accentSecondary
                                                    : node.data.type === "surah"
                                                        ? themeColors.accent
                                                        : (rootNodeColorById.get(node.data.id) ?? themeColors.nodeColors.default)
                                            }
                                            stroke="var(--bg-0)"
                                            strokeWidth={node.data.type === "corpus" ? 0 : 0.65}
                                            pointerEvents="none"
                                        />
                                        {node.data.type !== "corpus" && (
                                            <circle
                                                // Occurrences sit ~9px apart along their spike, so
                                                // the 10px root-fan target would blanket two
                                                // neighbours on each side and hand the pointer
                                                // whichever happened to paint last. Halve it there.
                                                r={node.data.type === "surah" ? 14 : (node.data.ayah != null ? 5 : 10)}
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
                                                    textShadow: "0 1px 3px var(--bg-0)",
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
                                fill="var(--bg-0)"
                                opacity={0.4}
                                filter="blur(20px)"
                            />
                            <text
                                y={-24}
                                textAnchor="middle"
                                style={{
                                    fontSize: '18px',
                                    fontWeight: '400',
                                    fill: "var(--ink-muted)",
                                    letterSpacing: '0.05em',
                                    textTransform: 'uppercase'
                                }}
                            >
                                {focusedSurahId
                                    ? `${ts("surahCaps")} ${focusedSurahId}`
                                    : occurrenceMode
                                        ? ts("selectedRoot")
                                        : (internalSelectedRoot ? "" : t("corpus"))}
                            </text>
                            <text
                                y={10}
                                textAnchor="middle"
                                style={{
                                    fontSize: '28px',
                                    fontWeight: '600',
                                    fill: themeColors.textColors.primary,
                                    textShadow: "0 2px 10px var(--bg-0)"
                                }}
                            >
                                {focusedSurahId
                                    ? SURAH_NAMES[focusedSurahId]?.name
                                    : occurrenceMode
                                        ? activeRootKey
                                        : (internalSelectedRoot ?? t("architecture"))}
                            </text>
                            {occurrenceMode && !focusedSurahId && (
                                <text
                                    y={44}
                                    textAnchor="middle"
                                    style={{
                                        fontSize: '13px',
                                        fill: themeColors.textColors.muted,
                                        letterSpacing: '0.06em',
                                        textTransform: 'uppercase',
                                    }}
                                >
                                    {t("occurrenceCentre", {
                                        count: occurrenceStats.total,
                                        surahCount: occurrenceStats.surahs,
                                    })}
                                </text>
                            )}
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
                                    direction={isArabicLocale ? "rtl" : "ltr"}
                                >
                                    {t("stats", {
                                        rootCount: focusedSurahStats.rootsCount,
                                        ayahCount: focusedSurahStats.ayahsCount
                                    })}
                                </text>
                            )}
                            {focusedSurahId && focusedSurahRootsInView < corpusCoverage.focusedSurahRootCount && (
                                <text
                                    y={105}
                                    textAnchor="middle"
                                    style={{
                                        fontSize: '11px',
                                        fill: themeColors.accent,
                                        opacity: 0.75
                                    }}
                                >
                                    {t("zoomToSeeMore")} ({focusedSurahRootsInView}/{corpusCoverage.focusedSurahRootCount})
                                </text>
                            )}
                            {internalSelectedRoot && !focusedSurahId && (
                                <text
                                    y={40}
                                    textAnchor="middle"
                                    direction={isArabicLocale ? "rtl" : "ltr"}
                                    style={{
                                        fontSize: '14px',
                                        fill: themeColors.textColors.secondary,
                                        unicodeBidi: "plaintext"
                                    }}
                                >
                                    {selectedRootOccurrencesLabel && (
                                        <tspan direction={isArabicLocale ? "rtl" : "ltr"} style={{ unicodeBidi: "isolate" }}>
                                            {selectedRootOccurrencesLabel}
                                        </tspan>
                                    )}
                                    {selectedRootOccurrencesLabel && selectedRootTotalLabel && (
                                        <tspan direction="ltr" style={{ unicodeBidi: "isolate" }}>{" | "}</tspan>
                                    )}
                                    {selectedRootTotalLabel && (
                                        <tspan direction={isArabicLocale ? "rtl" : "ltr"} style={{ unicodeBidi: "isolate" }}>
                                            {selectedRootTotalLabel}
                                        </tspan>
                                    )}
                                    {(selectedRootOccurrencesLabel || selectedRootTotalLabel) && selectedRootGlossLabel && (
                                        <tspan direction="ltr" style={{ unicodeBidi: "isolate" }}>{" | "}</tspan>
                                    )}
                                    {selectedRootGlossLabel && (
                                        <tspan direction="ltr" style={{ unicodeBidi: "isolate" }}>
                                            {selectedRootGlossLabel}
                                        </tspan>
                                    )}
                                </text>
                            )}
                        </g>
                    </g>
                </svg>
            </div>
        </section >
    );
}
