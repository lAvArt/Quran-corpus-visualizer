"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import * as d3 from "d3";
import { motion } from "framer-motion";
import type { CorpusToken } from "@/lib/schema/types";
import type { ExperienceLevel } from "@/lib/schema/experience";
import { getNodeColor, resolveVisualizationTheme } from "@/lib/schema/visualizationTypes";
import { getFrequencyColor, getIdentityColor, type LexicalColorMode } from "@/lib/theme/lexicalColoring";
import { fitGraphToView } from "@/lib/viz/fitToView";
import { motionSafeDuration, prefersReducedMotion } from "@/lib/viz/motionPrefs";
import { useTranslations } from "next-intl";

interface RootNetworkGraphProps {
  tokens: CorpusToken[];
  onTokenHover: (tokenId: string | null) => void;
  onTokenFocus: (tokenId: string) => void;
  onRootSelect?: (root: string | null) => void;
  experienceLevel?: ExperienceLevel;
  highlightRoot?: string | null;
  selectedSurahId?: number;
  theme?: "light" | "dark";
  showLabels?: boolean;
  lexicalColorMode?: LexicalColorMode;
}

interface NetworkNode {
  id: string;
  label: string;
  type: "root" | "lemma" | "token";
  frequency: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  radius: number;
  color: string;
  tokens: CorpusToken[];
}

interface NetworkLink {
  source: string | NetworkNode;
  target: string | NetworkNode;
  weight: number;
}

// ---------------------------------------------------------------------------
// Root constellation tuning — a mandala/solar-system, not a free scatter:
// ROOT hubs sit on a gravitational orbit (or two, banded by frequency) around
// the center glow; each hub's (<=3) lemma satellites are its close moons,
// pulled in by a short, strong root->lemma link rather than joining any
// shared ring themselves. The previous layout pinned every root to one FIXED
// radius and every lemma to another with no regard for canvas size, which
// produced a cramped two-ring hairball once a surah had 50+ nodes (see
// docs/VIZ_ARCHITECTURE.md UX-debt ledger) — the fix scales the orbit to the
// canvas and gives roots room to space out along it (via mutual repulsion),
// not dropping the radial organization itself. Tuned against
// `scripts/ux-shots.ts` renders of the corpus-wide default (30 roots) and a
// small surah.
// ---------------------------------------------------------------------------
const LINK_HUG_DISTANCE = 16; // gap beyond radius+radius between a hub and its satellite
const LINK_STRENGTH = 0.85;
const ROOT_CHARGE = -320; // hub-hub repulsion — spaces hubs out along their orbit
const LEMMA_CHARGE = -40; // satellite-satellite repulsion — stays local to its hub
const CHARGE_DISTANCE_MAX_RATIO = 0.6; // x the canvas's longer side
const ROOT_COLLIDE_PAD = 10; // extra radius so root labels have breathing room
const LEMMA_COLLIDE_PAD = 3;
// Root orbit: a single ring when there's room, or two frequency-banded rings
// (the most frequent roots inner, the rest outer) once a single ring would be
// crowded — reuses ROOT_LABEL_ALWAYS_THRESHOLD/ROOT_LABEL_TOP_N below so
// "dense enough to need decluttering" and "which roots are most prominent"
// stay one consistent judgment instead of two separately-tuned thresholds.
const ROOT_ORBIT_SINGLE_RATIO = 0.32; // x min(canvasW, canvasH) — single-ring case
const ROOT_ORBIT_INNER_RATIO = 0.2; // x min(canvasW, canvasH) — top roots, two-ring case
const ROOT_ORBIT_OUTER_RATIO = 0.36; // x min(canvasW, canvasH) — the rest, two-ring case
const ROOT_ORBIT_STRENGTH = 0.32;
// "Layout is settled": the pre-tick loop's stop condition, the async
// fallback's edge-reveal gate, and the auto-fit trigger all share this one
// threshold (see the force-simulation effect below) rather than three
// separately-tuned numbers.
const SETTLE_ALPHA_THRESHOLD = 0.03;
const PRE_TICK_MAX_ITERATIONS = 300;
// Settle synchronously (headless, before first paint) up to this many nodes;
// above it, fall back to the old async/animated settle instead, with edges
// hidden until it's nearly done (see the effect below). Measured with
// `scripts/ux-shots.ts`'s target surahs: ~96 nodes (the default 30-root-limit
// view) pre-ticks in ~30ms; ~220 nodes already costs ~68ms — over a 50ms
// jank budget — so this stays comfortably under that crossover. Only
// power users cranking the (advanced-only) root-limit slider on a
// root-dense surah reach it; the default/beginner experience never does.
const SYNC_PRETICK_MAX_NODES = 150;
const AUTO_FIT_DURATION_MS = 600;

// Label hierarchy — with 30+ rendered roots (the corpus-wide default),
// labeling every root/lemma is collision soup. Thin the default set and let
// hover/selection/deep-link-highlight or zooming in reveal the rest.
const ROOT_LABEL_ALWAYS_THRESHOLD = 24; // <= this many rendered roots: label them all, single orbit ring
const ROOT_LABEL_TOP_N = 12; // above the threshold: only the N most frequent label by default + inner ring
const ROOT_LABEL_ZOOM_THRESHOLD = 1.4; // zoomed in this far reveals the rest of the roots
const LEMMA_LABEL_ZOOM_THRESHOLD = 1.8; // lemma labels need either focus or this much zoom

// Center "stellar core" — a small, crisp sun anchoring the orbit, not a
// diffuse blur. Fixed pixel sizes on purpose (not canvas-scaled): the point
// is for it to stay small next to the orbit rings regardless of canvas
// size. SUN_GLOW_RADIUS was 80px in an earlier pass and still read as a
// fuzzy cloud with a perceptible edge even with an eased gradient — 48px
// with the many-small-steps falloff on the <radialGradient> below (see its
// stops) is what actually reads as a compact, edgeless star. Don't retune
// either in isolation; they were tuned together against a screenshot crop.
const SUN_GLOW_RADIUS = 48; // gradient reaches full transparency here
const SUN_CORONA_RADIUS = 14; // thin accent ring echoing the orbit decoration
const SUN_CORONA_OPACITY = 0.3; // flat across both themes — only the glow's own stops scale with theme (see sunGlow below)

function zoomTierFor(scale: number): 0 | 1 | 2 {
  if (scale >= LEMMA_LABEL_ZOOM_THRESHOLD) return 2;
  if (scale >= ROOT_LABEL_ZOOM_THRESHOLD) return 1;
  return 0;
}

export default function RootNetworkGraph({
  tokens,
  onTokenHover,
  onTokenFocus,
  onRootSelect,
  experienceLevel = "advanced",
  highlightRoot,
  selectedSurahId,
  theme = "dark",
  showLabels = true,
  lexicalColorMode = "theme",
}: RootNetworkGraphProps) {
  const t = useTranslations("Visualizations.RootNetwork");
  const ts = useTranslations("Visualizations.Shared");
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<NetworkNode, NetworkLink> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const gRef = useRef<SVGGElement>(null);

  const [dimensions, setDimensions] = useState({ width: 900, height: 650 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [rootLimit, setRootLimit] = useState(30);
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [links, setLinks] = useState<NetworkLink[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  // Current zoom tier (see zoomTierFor) — drives the label LOD reveal as the
  // user zooms in. A tier (not the raw scale) so re-renders only happen on
  // threshold crossings, not on every zoom-event delta.
  const [zoomTier, setZoomTier] = useState<0 | 1 | 2>(0);
  // True only on the large-N async fallback path (see the force-simulation
  // effect / SYNC_PRETICK_MAX_NODES), from the moment the simulation starts
  // until its alpha drops under SETTLE_ALPHA_THRESHOLD — hides edges while
  // true so the "wire tangle" of a live settle never actually paints; nodes
  // are still allowed to visibly move into place. Always false on the
  // (default) synchronous pre-tick path, where positions are already final
  // before the very first render.
  const [isSettlingAsync, setIsSettlingAsync] = useState(false);
  const liveNodesRef = useRef<NetworkNode[]>([]);
  // True once the user has panned/zoomed by hand (a real wheel/drag/touch
  // gesture — see the zoom effect below) — permanently opts this session out
  // of further auto-fit-on-settle passes so the app never yanks the camera
  // away from a view the user framed themselves.
  const userInteractedRef = useRef(false);
  // Latest simulation alpha, refreshed every tick (and once after the
  // synchronous pre-tick loop) — read by the auto-fit effect below so it
  // waits for SETTLE_ALPHA_THRESHOLD on the async fallback path instead of
  // fitting to a still-unsettled bounding box.
  const simulationAlphaRef = useRef(1);
  // Has THIS layout (current topology from the force-sim effect) already
  // received its one auto-fit? Reset alongside the simulation itself.
  const autoFitDoneRef = useRef(false);
  const effectiveRootLimit = experienceLevel === "beginner" ? 30 : rootLimit;

  const themeColors = resolveVisualizationTheme(theme);
  // Framer-motion entrance/pulse animations below are JS-driven and bypass
  // the global CSS prefers-reduced-motion rule (globals.css) — gate them
  // manually. Read once per render; matchMedia-backed, SSR-safe.
  const reduceMotion = prefersReducedMotion();

  // Filter tokens by surah if selected
  const scopedTokens = useMemo(() => {
    if (!selectedSurahId) return tokens;
    return tokens.filter(t => t.sura === selectedSurahId);
  }, [tokens, selectedSurahId]);

  // Total unique roots in the scoped tokens
  const totalRoots = useMemo(() => {
    const roots = new Set<string>();
    for (const t of scopedTokens) {
      if (t.root) roots.add(t.root);
    }
    return roots.size;
  }, [scopedTokens]);

  // Clamp rootLimit when surah changes and total roots is fewer
  useEffect(() => {
    if (totalRoots > 0 && rootLimit > totalRoots) {
      setRootLimit(Math.max(5, Math.min(totalRoots, rootLimit)));
    }
  }, [totalRoots, rootLimit]); // rootLimit intentionally only triggers when totalRoots changes

  useEffect(() => {
    if (experienceLevel === "beginner") {
      setRootLimit(30);
    }
  }, [experienceLevel]);

  // Build network data from tokens
  const { initialNodes, initialLinks, topRootLabelIds, lemmaHubId, maxLinkWeight, renderedRootCount } = useMemo(() => {
    const rootMap = new Map<string, { count: number; tokens: CorpusToken[]; lemmas: Set<string> }>();
    const lemmaMap = new Map<string, { count: number; tokens: CorpusToken[]; root: string }>();

    // Aggregate by root and lemma
    for (const token of scopedTokens) {
      if (!token.root) continue;

      if (!rootMap.has(token.root)) {
        rootMap.set(token.root, { count: 0, tokens: [], lemmas: new Set() });
      }
      const rootData = rootMap.get(token.root)!;
      rootData.count++;
      rootData.tokens.push(token);
      rootData.lemmas.add(token.lemma);

      if (!lemmaMap.has(token.lemma)) {
        lemmaMap.set(token.lemma, { count: 0, tokens: [], root: token.root });
      }
      const lemmaData = lemmaMap.get(token.lemma)!;
      lemmaData.count++;
      lemmaData.tokens.push(token);
    }

    // Create nodes - limit controlled by slider
    const sortedRoots = [...rootMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, effectiveRootLimit);

    // Root label hierarchy: sortedRoots is already frequency-descending, so
    // the first ROOT_LABEL_TOP_N are exactly "the most frequent roots
    // rendered" — used below to thin default labels once there are more
    // than ROOT_LABEL_ALWAYS_THRESHOLD roots on screen.
    const topRootLabelIds = new Set(
      sortedRoots.slice(0, ROOT_LABEL_TOP_N).map(([root]) => `root-${root}`)
    );

    const maxFreq = Math.max(...sortedRoots.map(([, d]) => d.count), 1);
    const nodesResult: NetworkNode[] = [];
    const linksResult: NetworkLink[] = [];
    const includedLemmas = new Set<string>();
    // Maps a lemma satellite's node id to its hub root's node id, so the
    // label-hierarchy/hover logic can reveal a hub's satellites together
    // with it (hovering a root reveals its lemmas' labels too).
    const lemmaHubId = new Map<string, string>();

    // Add root nodes — scale radius based on how many roots are shown
    const scaleFactor = effectiveRootLimit <= 20 ? 1 : effectiveRootLimit <= 50 ? 0.7 : 0.45;
    for (const [root, data] of sortedRoots) {
      const radius = (8 + (data.count / maxFreq) * 20) * scaleFactor;
      const rootFrequencyRatio = data.count / maxFreq;
      const rootColor =
        lexicalColorMode === "frequency"
          ? getFrequencyColor(rootFrequencyRatio, theme)
          : lexicalColorMode === "identity"
            ? getIdentityColor(root, theme)
            : themeColors.nodeColors.default;
      const rootNodeId = `root-${root}`;
      nodesResult.push({
        id: rootNodeId,
        label: root,
        type: "root",
        frequency: data.count,
        radius,
        color: rootColor,
        tokens: data.tokens,
      });

      // Add lemma nodes for this root (limit to top 3 per root)
      const rootLemmas = [...data.lemmas]
        .map((l) => ({ lemma: l, data: lemmaMap.get(l)! }))
        .sort((a, b) => b.data.count - a.data.count)
        .slice(0, 3);

      for (const { lemma, data: lemmaData } of rootLemmas) {
        const lemmaNodeId = `lemma-${lemma}`;
        if (!includedLemmas.has(lemma)) {
          includedLemmas.add(lemma);
          const lemmaRadius = (4 + (lemmaData.count / maxFreq) * 10) * scaleFactor;
          const lemmaFrequencyRatio = lemmaData.count / maxFreq;
          const lemmaColor =
            lexicalColorMode === "frequency"
              ? getFrequencyColor(lemmaFrequencyRatio, theme)
              : lexicalColorMode === "identity"
                ? getIdentityColor(lemma, theme)
                : getNodeColor(lemmaData.tokens[0]?.pos ?? "N");
          nodesResult.push({
            id: lemmaNodeId,
            label: lemma,
            type: "lemma",
            frequency: lemmaData.count,
            radius: lemmaRadius,
            color: lemmaColor,
            tokens: lemmaData.tokens,
          });
        }
        lemmaHubId.set(lemmaNodeId, rootNodeId);

        // Create link from root to lemma
        linksResult.push({
          source: rootNodeId,
          target: lemmaNodeId,
          weight: lemmaData.count,
        });
      }
    }

    const maxLinkWeight = Math.max(...linksResult.map((l) => l.weight), 1);

    return {
      initialNodes: nodesResult,
      initialLinks: linksResult,
      topRootLabelIds,
      lemmaHubId,
      maxLinkWeight,
      // Roots actually rendered (post root-limit slider), distinct from the
      // totalRoots memo above (corpus-wide count, used for the slider's max)
      // — this is what "how many root labels are on screen" cares about.
      renderedRootCount: sortedRoots.length,
    };
  }, [scopedTokens, themeColors.nodeColors.default, effectiveRootLimit, lexicalColorMode, theme]);

  // Root orbit radius/radii, scaled to the canvas — shared by the force
  // simulation (below) and the decorative orbital-ring circles (in the
  // render) so the decoration always matches the actual structure. Single
  // ring below the same "dense" threshold the label hierarchy uses; two
  // frequency-banded rings above it so 30+ roots aren't crammed onto one
  // ring shoulder-to-shoulder (`inner === outer` in the single-ring case, so
  // downstream code doesn't need to branch on which mode is active).
  const rootOrbitRadii = useMemo(() => {
    const minCanvasDim = Math.min(dimensions.width, dimensions.height);
    if (renderedRootCount > ROOT_LABEL_ALWAYS_THRESHOLD) {
      return { inner: minCanvasDim * ROOT_ORBIT_INNER_RATIO, outer: minCanvasDim * ROOT_ORBIT_OUTER_RATIO };
    }
    const single = minCanvasDim * ROOT_ORBIT_SINGLE_RATIO;
    return { inner: single, outer: single };
  }, [dimensions, renderedRootCount]);

  // Update dimensions on resize
  useEffect(() => {
    setIsMounted(true);
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Use the full viewport size for the "web" feel
        setDimensions({
          width: Math.max(entry.contentRect.width, 900),
          height: Math.max(entry.contentRect.height, 800),
        });
      }
    });

    observer.observe(containerRef.current);

    // Initial size
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setDimensions({
        width: Math.max(rect.width, 600),
        height: Math.max(rect.height, 500),
      });
    }

    return () => observer.disconnect();
  }, []);

  // Initialize D3 force simulation — a mandala/solar-system: ROOT hubs are
  // pulled onto a canvas-scaled orbit (one ring, or two frequency bands —
  // see rootOrbitRadii above) around the center glow, then repel each other
  // (charge) to spread out along it instead of clumping; each hub's lemma
  // satellites are its close moons, pulled in by a short, strong link
  // instead of joining any ring themselves (see the tuning block above).
  useEffect(() => {
    if (!svgRef.current || initialNodes.length === 0) return;

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const chargeDistanceMax = Math.max(dimensions.width, dimensions.height) * CHARGE_DISTANCE_MAX_RATIO;

    // Clone nodes to avoid mutating original
    const nodesCopy = initialNodes.map((n) => ({ ...n }));
    const linksCopy = initialLinks.map((l) => ({ ...l }));

    // New layout key (topology or canvas size changed) — arm one fresh
    // auto-fit opportunity.
    autoFitDoneRef.current = false;

    // Create force simulation
    const simulation = d3
      .forceSimulation<NetworkNode>(nodesCopy)
      .force(
        "link",
        d3
          .forceLink<NetworkNode, NetworkLink>(linksCopy)
          .id((d) => d.id)
          .distance((d) => {
            // Resolved to NetworkNode objects by the time this runs — forceLink
            // resolves source/target ids against the simulation's own nodes
            // synchronously on initialize, before distance/strength accessors
            // are evaluated. Same cast the render code below already relies on.
            const source = d.source as NetworkNode;
            const target = d.target as NetworkNode;
            return source.radius + target.radius + LINK_HUG_DISTANCE;
          })
          .strength(LINK_STRENGTH)
      )
      .force(
        "charge",
        d3
          .forceManyBody<NetworkNode>()
          .strength((d) => (d.type === "root" ? ROOT_CHARGE : LEMMA_CHARGE))
          .distanceMax(chargeDistanceMax)
      )
      .force("center", d3.forceCenter(centerX, centerY))
      .force(
        "collision",
        d3.forceCollide<NetworkNode>().radius((d) => d.radius + (d.type === "root" ? ROOT_COLLIDE_PAD : LEMMA_COLLIDE_PAD))
      )
      // The gravitational structure: pulls ROOT hubs onto their orbit ring(s)
      // — the most frequent (also the always-labeled top-N) on the inner
      // ring, the rest on the outer one once there are enough to need the
      // split (rootOrbitRadii — inner === outer when a single ring suffices).
      // Lemmas get zero radial pull; they already track their own hub tightly
      // via the link force above and must NOT join a ring of their own.
      .force(
        "radial",
        d3
          .forceRadial<NetworkNode>(
            (d) => (topRootLabelIds.has(d.id) ? rootOrbitRadii.inner : rootOrbitRadii.outer),
            centerX,
            centerY
          )
          .strength((d) => (d.type === "root" ? ROOT_ORBIT_STRENGTH : 0))
      );

    simulationRef.current = simulation;
    liveNodesRef.current = nodesCopy;

    if (nodesCopy.length <= SYNC_PRETICK_MAX_NODES) {
      // Fast path (the default/beginner experience always takes this):
      // settle synchronously, headless, BEFORE anything is ever painted,
      // instead of animating the settle asynchronously across ~150 real
      // frames. Rendering those mid-flight positions (the old behavior) is
      // what produced a "wire tangle": edges stretched between nodes that
      // were still being flung outward by the charge/radial forces. A
      // brand-new forceSimulation auto-starts its own async (rAF-driven)
      // ticking on construction — stop that immediately so it can't race
      // this loop, then step the simulation manually. simulation.tick()
      // (unlike the internal timer's step()) does not dispatch "tick"/"end"
      // events, so this doesn't touch the render-triggering handler below.
      // Measured single-digit-to-tens-of-ms at this node-count ceiling —
      // see SYNC_PRETICK_MAX_NODES.
      simulation.stop();
      let preTickIterations = 0;
      while (simulation.alpha() > SETTLE_ALPHA_THRESHOLD && preTickIterations < PRE_TICK_MAX_ITERATIONS) {
        simulation.tick();
        preTickIterations++;
      }
      simulationAlphaRef.current = simulation.alpha();
      setIsSettlingAsync(false);

      // Only FUTURE ticks reach here — i.e. a drag reheating the simulation
      // (see the drag effect below), never the manual pre-tick loop above.
      simulation.on("tick", () => {
        simulationAlphaRef.current = simulation.alpha();
        setNodes([...nodesCopy]);
        setLinks([...linksCopy]);
      });

      // Render the now-settled layout immediately. Deliberately no
      // `alpha(1).restart()` here — that would resume continuous async
      // ticking and reintroduce the mid-flight motion this pre-tick exists
      // to avoid. The simulation stays frozen (already `.stop()`ped above)
      // until a drag interaction reheats it locally.
      setNodes([...nodesCopy]);
      setLinks([...linksCopy]);
    } else {
      // Large-N fallback (only reachable by manually pushing the
      // advanced-only root-limit slider well past its default on a
      // root-dense surah): pre-ticking this many nodes synchronously
      // measured well past a 50ms jank budget (SYNC_PRETICK_MAX_NODES), so
      // let it settle the old animated way instead — but keep edges hidden
      // (isSettlingAsync, consumed by the edge render below) until it's
      // nearly done, so the "wire tangle" itself never actually paints.
      // Nodes still animate into place live; that's cheap and reads as
      // intentional motion rather than chaos.
      setIsSettlingAsync(true);
      simulation.on("tick", () => {
        const alpha = simulation.alpha();
        simulationAlphaRef.current = alpha;
        if (alpha < SETTLE_ALPHA_THRESHOLD) setIsSettlingAsync(false);
        setNodes([...nodesCopy]);
        setLinks([...linksCopy]);
      });
      simulation.alpha(1).restart();
    }

    return () => {
      simulation.stop();
    };
  }, [initialNodes, initialLinks, dimensions, topRootLabelIds, rootOrbitRadii]);

  // Auto-fit once the layout above settles, mirroring the "Focus" button but
  // automatic. On the (default) synchronous pre-tick path, positions are
  // already final the moment `nodes` first updates; on the large-N async
  // fallback, `nodes` updates every tick, so the alpha check below waits for
  // it to actually be settled instead of fitting to a still-moving bounding
  // box. Runs as a separate effect (rather than being called inline from the
  // force-simulation effect) so it only ever reads the DOM AFTER React has
  // committed the corresponding positions — fitGraphToView's getBBox() needs
  // the rendered circles. Fires at most once per layout (autoFitDoneRef,
  // reset alongside the simulation above) and never once the user has taken
  // manual control of the camera (userInteractedRef, set by the zoom effect
  // below).
  useEffect(() => {
    if (autoFitDoneRef.current || userInteractedRef.current) return;
    if (nodes.length === 0 || simulationAlphaRef.current >= SETTLE_ALPHA_THRESHOLD) return;

    autoFitDoneRef.current = true;
    fitGraphToView(svgRef.current, gRef.current, zoomBehaviorRef.current, {
      padding: 0.9,
      duration: motionSafeDuration(AUTO_FIT_DURATION_MS),
    });
  }, [nodes]);

  // Set up zoom/pan behavior
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
        const tier = zoomTierFor(event.transform.k);
        setZoomTier((prev) => (prev === tier ? prev : tier));
        // A real user gesture (wheel/drag/touch) carries a sourceEvent; our
        // own programmatic fits (auto-fit-on-settle above, the Focus button)
        // call `.transform` directly and don't — only an actual user pan/zoom
        // should permanently opt this session out of further auto-fits.
        if (event.sourceEvent) {
          userInteractedRef.current = true;
        }
      });

    zoomBehaviorRef.current = zoomBehavior;
    svg.call(zoomBehavior);

    return () => {
      svg.on(".zoom", null);
    };
  }, [isMounted, dimensions]);

  // D3 Drag behavior for nodes. Keyed off the *set* of rendered node ids
  // (a string, not the `nodes` array) so this only rebinds when the
  // topology actually changes (mount, surah/root-limit/experience-level
  // changes) — not on every simulation tick. `nodes` gets a brand-new array
  // identity every tick (see the force-simulation effect above: d3 mutates
  // .x/.y in place, but setNodes([...nodesCopy]) is a fresh array each
  // time, deliberately, so edge/node geometry actually recomputes every
  // render — see the edges' render comment below), so depending on `nodes`
  // directly reran this effect ~60x/second during any drag: tearing down
  // and reconstructing an entire fresh d3.drag() behavior + rebinding
  // listeners across the whole .rn-node selection on the single hottest,
  // most latency-sensitive path in this component. This was chased down
  // while investigating a reported "wire lags behind the dragged node"
  // defect — an instrumented per-frame probe (recording node position vs.
  // connected-edge endpoint every rendered frame across a real continuous
  // drag) found zero desync between a node and its own edges at any frame
  // (framer-motion never takes over the node's plain `transform` attribute
  // here, since no x/y/scale motion values are ever assigned to it — only
  // `opacity` is animated — so both it and the edges' plain `d` are written
  // by React's ordinary synchronous reconciliation in the same commit).
  // This rebind churn was still real waste on the drag path, though, so it's
  // fixed here regardless: a string dependency compares by value, so a
  // same-topology tick (new array, same ids) is a no-op, while an actual
  // topology swap (different ids, even at an unchanged count) still
  // rebinds correctly.
  const nodeIdsKey = nodes.map((n) => n.id).join("|");
  useEffect(() => {
    if (!gRef.current || !simulationRef.current) return;

    const simulation = simulationRef.current;
    const g = d3.select(gRef.current);

    const dragBehavior = d3.drag<SVGGElement, unknown>()
      .subject((event) => {
        const el = (event.sourceEvent?.target as Element)?.closest?.(".rn-node");
        const id = el?.getAttribute("data-node-id");
        return { id };
      })
      .on("start", (event) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        const nodeId = event.subject?.id;
        const node = liveNodesRef.current.find((n) => n.id === nodeId);
        if (node) { node.fx = node.x; node.fy = node.y; }
      })
      .on("drag", (event) => {
        const nodeId = event.subject?.id;
        const node = liveNodesRef.current.find((n) => n.id === nodeId);
        if (node) { node.fx = event.x; node.fy = event.y; }
      })
      .on("end", (event) => {
        if (!event.active) simulation.alphaTarget(0);
        const nodeId = event.subject?.id;
        const node = liveNodesRef.current.find((n) => n.id === nodeId);
        if (node) { node.fx = null; node.fy = null; }
      });

    g.selectAll<SVGGElement, unknown>(".rn-node").call(dragBehavior);

    return () => {
      g.selectAll<SVGGElement, unknown>(".rn-node").on(".drag", null);
    };
  }, [nodeIdsKey]);

  const handleNodeHover = useCallback(
    (node: NetworkNode | null) => {
      setHoveredNode(node?.id ?? null);
      if (node && node.tokens.length > 0) {
        onTokenHover(node.tokens[0].id);
      } else {
        onTokenHover(null);
      }
    },
    [onTokenHover]
  );

  const handleNodeClick = useCallback(
    (node: NetworkNode) => {
      setSelectedNode(node.id === selectedNode ? null : node.id);
      if (node.tokens.length > 0) {
        onTokenFocus(node.tokens[0].id);
      }
    },
    [selectedNode, onTokenFocus]
  );

  // Derive the highlight node id from the highlightRoot prop
  const highlightRootNodeId = highlightRoot ? `root-${highlightRoot}` : null;

  // The single "focused" node id, however it got that way (hover beats a
  // sticky selection beats a deep-link highlight) — shared by link
  // highlighting below and by the label-hierarchy hub-reveal in the node loop.
  const highlightId = hoveredNode ?? selectedNode ?? highlightRootNodeId;

  // Check if a link is connected to hovered/selected/highlighted node
  const isLinkHighlighted = useCallback(
    (link: NetworkLink) => {
      if (!highlightId) return false;

      const sourceId = typeof link.source === "string" ? link.source : link.source.id;
      const targetId = typeof link.target === "string" ? link.target : link.target.id;

      return sourceId === highlightId || targetId === highlightId;
    },
    [highlightId]
  );

  const sidebarNode = useMemo(
    () => nodes.find((n) => n.id === (hoveredNode ?? selectedNode)) ?? null,
    [nodes, hoveredNode, selectedNode]
  );

  // Center "stellar core" colors — see SUN_* constants above. Which CSS
  // custom property actually resolves to amber flips with theme (dark
  // theme's --accent IS amber; light theme's amber lives on --accent-2
  // instead, since --accent there is teal — app/[locale]/globals.css vs.
  // styles/dark-theme.css), so pick whichever token is amber for the active
  // theme. Used for the corona ring (an "accent token" per the design spec,
  // not a hardcoded literal) below.
  const sunAmberToken = theme === "dark" ? "var(--accent)" : "var(--accent-2)";
  const sunAmberColor =
    theme === "dark" ? sunAmberToken : `color-mix(in srgb, ${sunAmberToken} 78%, black 22%)`;
  // Three-tone glow family (core -> near -> outer) feeding the eased
  // multi-stop <radialGradient> in defs below, plus the opacity at each of
  // its five non-zero stops (0/8/18/32/55%; 100% is always fully
  // transparent — see the stops themselves). Dark theme's hexes are pinned
  // exactly per the design spec (tuned against the reported "blurry orange
  // cloud" screenshot) rather than derived from a token, so a future accent
  // change can't silently drift the fix back toward a blob. Light theme has
  // no such screenshot anchor, so instead of a second hardcoded palette it
  // derives the same three-tone shape from the theme's own amber token via
  // color-mix (matching the sunAmberColor pattern above), at 70% of dark
  // theme's stop opacities so it stays tasteful on a cream canvas.
  const sunGlow =
    theme === "dark"
      ? {
          core: "#fff4e0",
          near: "#f5c98a",
          outer: "#e8924a",
          opacity: [0.95, 0.6, 0.26, 0.1, 0.03],
        }
      : {
          core: `color-mix(in srgb, ${sunAmberToken} 25%, white 75%)`,
          near: `color-mix(in srgb, ${sunAmberToken} 55%, white 45%)`,
          outer: sunAmberColor,
          opacity: [0.95, 0.6, 0.26, 0.1, 0.03].map((o) => o * 0.7),
        };

  return (
    <section className="immersive-viz" data-theme={theme}>
      {/* 
      <div className="panel-head">
          Removed for immersive mode 
      </div>
      */}

      <div ref={containerRef} className="viz-container" style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0 }}>
        {!isMounted ? null : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            className="network-graph viz-canvas"
            style={{ width: '100%', height: '100%', cursor: 'grab' }}
          >
            <g ref={gRef}>
              <defs>
                {/* Stellar core anchoring the orbit — small and crisp, not a
                    diffuse blur: near-white-warm hot core fading through
                    amber to fully transparent well inside the innermost
                    orbit ring (SUN_* constants above). Many small opacity
                    steps (not one linear stop-to-transparent) so the edge is
                    imperceptible instead of reading as a ring/blob
                    boundary — don't collapse these back to 2-3 stops. */}
                <radialGradient id="sunCoreGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={sunGlow.core} stopOpacity={sunGlow.opacity[0]} />
                  <stop offset="8%" stopColor={sunGlow.near} stopOpacity={sunGlow.opacity[1]} />
                  <stop offset="18%" stopColor={sunGlow.outer} stopOpacity={sunGlow.opacity[2]} />
                  <stop offset="32%" stopColor={sunGlow.outer} stopOpacity={sunGlow.opacity[3]} />
                  <stop offset="55%" stopColor={sunGlow.outer} stopOpacity={sunGlow.opacity[4]} />
                  <stop offset="100%" stopColor={sunGlow.outer} stopOpacity={0} />
                </radialGradient>

                {/* Glow filter for nodes */}
                <filter id="nodeGlow" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                <filter id="subtleGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Background orbital ring(s) — decoration aligned to the actual
                  root orbit(s) driving the force simulation (rootOrbitRadii
                  above), so the ring the eye sees matches the ring the hubs
                  actually sit on. One ring, or two when roots are banded by
                  frequency (inner === outer in the single-ring case, so this
                  naturally collapses to one visible circle). */}
              <g className="orbital-rings">
                {Array.from(new Set([rootOrbitRadii.inner, rootOrbitRadii.outer])).map((r) => (
                  <circle
                    key={r}
                    cx={dimensions.width / 2}
                    cy={dimensions.height / 2}
                    r={r}
                    className="orbital-ring"
                  />
                ))}
              </g>

              {/* Center glow — the gravitational "sun" the root orbit(s)
                  circle. Wrapped in its own translated <g> (rather than
                  setting cx/cy on the circle itself) so the breathing scale
                  below animates from the sun's own center, not the SVG's
                  origin — same pattern the per-node highlight pulse uses. */}
              <g transform={`translate(${dimensions.width / 2}, ${dimensions.height / 2})`}>
                {/* Thin corona ring echoing the orbit decoration */}
                <circle r={SUN_CORONA_RADIUS} fill="none" stroke={sunAmberColor} strokeWidth={1} opacity={SUN_CORONA_OPACITY} />
                <motion.circle
                  r={SUN_GLOW_RADIUS}
                  fill="url(#sunCoreGlow)"
                  initial={{ scale: 1, opacity: 1 }}
                  animate={reduceMotion ? { scale: 1, opacity: 1 } : { scale: [1, 1.04, 1], opacity: [1, 0.95, 1] }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { repeat: Infinity, duration: 6, ease: "easeInOut" }
                  }
                />
              </g>

              {/* Links — ONE layer-level fade (this <motion.g>) instead of a
                  framer-motion wrapper per edge. Previously every edge below
                  was its own <motion.g>: framer-motion reconciles every
                  motion element on every simulation tick, and with up to
                  ~90 edges that per-element overhead contributed to a
                  reported "wire lags behind the dragged node" defect — a
                  per-frame DOM probe had already proven the geometry itself
                  stays glued every frame (0px gap, see the drag-effect
                  comment below), so the remaining issue was frame PACING,
                  not position: updates arrived in bursts rather than every
                  frame, which reads as the wire "waiting". Masked on an
                  idle dev machine but clearly measurable under modest load
                  (2x CPU throttling — a proxy for a busier real machine):
                  the fraction of animation frames where an undragged,
                  force-pushed node's rendered position actually advanced
                  during a held drag averaged ~79% (5 runs) with the old
                  per-element motion wrappers vs. ~94% (5 runs) with the
                  plain elements below. CollocationNetworkGraph's per-tick
                  geometry is plain SVG for exactly this reason and feels
                  smooth. Each edge is now a plain <path>: `d` and `style`
                  are written by React's ordinary reconciliation every
                  render, in lockstep with each node's own plain `transform`
                  string below. Keyed
                  by nodeIdsKey (the same topology key the drag-rebind
                  effect above uses) so this fade replays on a real topology
                  change (new simulation) but never on a positional tick or
                  a drag. */}
              <motion.g
                key={`links-${nodeIdsKey}`}
                className="links"
                initial={{ opacity: 0 }}
                animate={{ opacity: isSettlingAsync ? 0 : 1 }}
                transition={{ duration: motionSafeDuration(250) / 1000 }}
              >
                {links.map((link, idx) => {
                  const source = link.source as NetworkNode;
                  const target = link.target as NetworkNode;

                  if (!source.x || !source.y || !target.x || !target.y) return null;

                  const isHighlighted = isLinkHighlighted(link);

                  // Calculate control point for curved line
                  const midX = (source.x + target.x) / 2;
                  const midY = (source.y + target.y) / 2;
                  const dx = target.x - source.x;
                  const dy = target.y - source.y;
                  const normalX = -dy * 0.15;
                  const normalY = dx * 0.15;

                  // Default stroke takes the hub (root) node's own fill color
                  // — every link is always root->lemma, so `source` is always
                  // the hub — instead of a single near-invisible neutral wash:
                  // spokes now read as belonging to their hub, and heavier
                  // root-lemma links stay visibly thicker via the weight ratio.
                  const defaultStrokeWidth = 1 + (link.weight / maxLinkWeight) * 1.4;
                  // The settling-hidden state now lives entirely on the
                  // layer wrapper above (isSettlingAsync) — this is just the
                  // highlighted/default split, a plain per-render value, not
                  // an animated one. `.edge`'s own CSS `transition: all 0.3s
                  // ease` (styles/dark-theme.css, unscoped so it applies in
                  // both themes) is what makes this opacity change — and the
                  // stroke/width change below — animate smoothly on hover,
                  // for free, off the main thread.
                  const edgeOpacity = isHighlighted ? 0.9 : 0.38;

                  return (
                    <path
                      key={idx}
                      d={`M ${source.x} ${source.y} Q ${midX + normalX} ${midY + normalY} ${target.x} ${target.y}`}
                      className={`edge ${isHighlighted ? "highlighted" : ""}`}
                      style={{
                        stroke: isHighlighted ? themeColors.accent : source.color,
                        strokeWidth: isHighlighted ? 2 : defaultStrokeWidth,
                        opacity: edgeOpacity,
                        fill: "none",
                      }}
                      filter={isHighlighted ? "url(#subtleGlow)" : undefined}
                    />
                  );
                })}
              </motion.g>

              {/* Nodes — ONE layer-level mount fade (this <motion.g>)
                  instead of a framer-motion wrapper per node (see the links
                  layer comment above for the measured pacing cost this
                  removes). Each node's own <g> below is now plain: its
                  `transform` is written by React's ordinary reconciliation
                  every render, exactly like CollocationNetworkGraph's node
                  groups. Framer-motion survives only on the highlighted-
                  root pulse ring inside (never more than a handful of nodes
                  at once, and its own geometry doesn't change per tick) —
                  the same pattern CollocationNetworkGraph uses for its
                  target-node ring. Keyed by nodeIdsKey so this fade replays
                  on a real topology change, not on positional ticks. */}
              <motion.g
                key={`nodes-${nodeIdsKey}`}
                className="nodes"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: motionSafeDuration(250) / 1000 }}
              >
                {nodes.map((node) => {
                  if (!node.x || !node.y) return null;

                  const isHovered = hoveredNode === node.id;
                  const isSelected = selectedNode === node.id;
                  const isSearchHighlighted = highlightRootNodeId === node.id;
                  const isHighlighted = isHovered || isSelected || isSearchHighlighted;
                  const isRoot = node.type === "root";

                  // Label hierarchy: with 24+ rendered roots, labeling every
                  // root/lemma is collision soup — thin the default set and
                  // let hover/selection/deep-link or zooming in reveal the
                  // rest. A lemma's hub root counts as "highlighted" too, so
                  // hovering a hub reveals its satellites' labels together.
                  const hubId = isRoot ? node.id : lemmaHubId.get(node.id);
                  const isHubHighlighted = !isRoot && highlightId !== null && hubId === highlightId;
                  const hierarchyAllowsLabel = isRoot
                    ? renderedRootCount <= ROOT_LABEL_ALWAYS_THRESHOLD ||
                      topRootLabelIds.has(node.id) ||
                      zoomTier >= 1
                    : zoomTier >= 2;
                  const labelVisible = isHighlighted || isHubHighlighted || (showLabels && hierarchyAllowsLabel);

                  return (
                    <g
                      key={node.id}
                      className="node-group rn-node"
                      data-node-id={node.id}
                      transform={`translate(${node.x},${node.y})`}
                      style={{ cursor: "grab" }}
                      onMouseEnter={() => handleNodeHover(node)}
                      onMouseLeave={() => handleNodeHover(null)}
                      onClick={() => {
                        handleNodeClick(node);
                        if (node.type === "root" && onRootSelect) {
                          onRootSelect(node.label);
                        }
                      }}
                    >
                      {/* Outer glow ring for highlighted root nodes — kept on
                          framer-motion on purpose: at most a handful exist
                          at once (only isRoot && isHighlighted nodes), and
                          its own r/fill/stroke never change per tick. */}
                      {isRoot && isHighlighted && (
                        <motion.circle
                          r={node.radius + 12}
                          fill="none"
                          stroke={themeColors.accent}
                          strokeWidth={2}
                          opacity={0.5}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1.1, opacity: 0.5 }}
                          transition={
                            reduceMotion
                              ? { duration: 0 }
                              : { repeat: Infinity, repeatType: "reverse", duration: 1 }
                          }
                        />
                      )}

                      {/* Node circle */}
                      <circle
                        r={node.radius}
                        className={`node-circle ${isHighlighted ? "highlighted" : ""} ${isRoot ? "hub" : ""}`}
                        style={{
                          fill: isHighlighted ? themeColors.accent : node.color,
                          stroke: "var(--line)",
                          strokeWidth: isRoot ? 2 : 1,
                        }}
                        filter={isHighlighted ? "url(#nodeGlow)" : undefined}
                      />

                      {/* Inner highlight for root nodes */}
                      {isRoot && (
                        <circle
                          r={node.radius * 0.3}
                          fill="var(--line)"
                          fillOpacity={0.2}
                        />
                      )}

                      {/* Label */}
                      {labelVisible && (
                        <text
                          className="node-label arabic-text"
                          y={node.radius + 16}
                          textAnchor="middle"
                          paintOrder="stroke"
                          stroke="var(--bg-0)"
                          strokeWidth={3}
                          strokeLinejoin="round"
                          style={{
                            opacity: isHighlighted ? 1 : 0.7,
                            fontSize: isRoot ? "14px" : "11px",
                            fontWeight: isRoot ? 600 : 400,
                            fill: "var(--ink)",
                          }}
                        >
                          {node.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </motion.g>
            </g>
          </svg>
        )}
      </div>

      {isMounted && typeof document !== 'undefined' && document.getElementById('viz-sidebar-portal') && createPortal(
        <div className="viz-left-stack">
          <div className="viz-left-panel viz-zoom-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="eyebrow" style={{ fontSize: "0.7em" }}>{ts("zoom")}</span>
            </div>
            <div className="viz-zoom-row">
              <button
                type="button"
                className="viz-zoom-reset-btn"
                onClick={() => {
                  fitGraphToView(svgRef.current, gRef.current, zoomBehaviorRef.current, {
                    duration: motionSafeDuration(750),
                  });
                }}
              >
                {ts("focus")}
              </button>
            </div>
          </div>

          {experienceLevel === "advanced" ? (
            <div
              className="viz-left-panel root-limit-control"
              data-testid="root-network-root-limit-control"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>Visible roots</label>
                <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', minWidth: 44, textAlign: 'right' }}>{Math.min(rootLimit, totalRoots)}/{totalRoots}</span>
              </div>
              <input
                type="range"
                min={5}
                max={Math.max(5, totalRoots)}
                step={5}
                value={Math.min(rootLimit, totalRoots || 100)}
                onChange={(e) => setRootLimit(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
            </div>
          ) : null}

          {sidebarNode && (
            <div className="viz-left-panel">
              <div className="viz-tooltip-title arabic-text">{sidebarNode.label}</div>
              <div className="viz-tooltip-subtitle">
                {sidebarNode.type === "root" ? ts("root") : ts("lemma")}
              </div>
              <div className="viz-tooltip-row">
                <span className="viz-tooltip-label">{ts("occurrences")}</span>
                <span className="viz-tooltip-value">{sidebarNode.frequency}</span>
              </div>
              {sidebarNode.tokens[0] && (
                <>
                  <div className="viz-tooltip-row">
                    <span className="viz-tooltip-label">{ts("example")}</span>
                    <span className="viz-tooltip-value arabic-text">
                      {sidebarNode.tokens[0].text}
                    </span>
                  </div>
                  <div className="viz-tooltip-row">
                    <span className="viz-tooltip-label">{ts("gloss")}</span>
                    <span className="viz-tooltip-value">
                      {sidebarNode.tokens[0].morphology?.gloss ?? "-"}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="viz-legend" data-tour-id="viz-legend">
            <div className="viz-legend-item">
              <div
                className="viz-legend-dot"
                style={{
                  background: themeColors.nodeColors.default,
                  width: 16,
                  height: 16,
                }}
              />
              <span>{lexicalColorMode === "theme" ? t("rootTrilateral") : t("rootNodes")}</span>
            </div>
            {lexicalColorMode === "theme" ? (
              <>
                <div className="viz-legend-item">
                  <div
                    className="viz-legend-dot"
                    style={{ background: getNodeColor("N"), width: 10, height: 10 }}
                  />
                  <span>{t("nounLemma")}</span>
                </div>
                <div className="viz-legend-item">
                  <div
                    className="viz-legend-dot"
                    style={{ background: getNodeColor("V"), width: 10, height: 10 }}
                  />
                  <span>{t("verbLemma")}</span>
                </div>
              </>
            ) : lexicalColorMode === "frequency" ? (
              <>
                <div className="viz-legend-item">
                  <div
                    className="viz-legend-dot"
                    style={{ background: getFrequencyColor(0.2, theme), width: 10, height: 10 }}
                  />
                  <span>{ts("lowerFrequency")}</span>
                </div>
                <div className="viz-legend-item">
                  <div
                    className="viz-legend-dot"
                    style={{ background: getFrequencyColor(0.9, theme), width: 10, height: 10 }}
                  />
                  <span>{ts("higherFrequency")}</span>
                </div>
              </>
            ) : (
              <div className="viz-legend-item">
                <div
                  className="viz-legend-dot"
                  style={{ background: getIdentityColor("root-color-seed", theme), width: 10, height: 10 }}
                />
                <span>{ts("uniqueLexicalIdentity")}</span>
              </div>
            )}
            <div className="viz-legend-item">
              <div
                className="viz-legend-dot"
                style={{ background: themeColors.accent, width: 12, height: 12 }}
              />
              <span>{ts("highlighted")}</span>
            </div>
          </div>
        </div>,
        document.getElementById('viz-sidebar-portal')!
      )}
    </section>
  );
}

