import * as d3 from "d3";
import { motionSafeDuration } from "@/lib/viz/motionPrefs";

export interface ViewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FitOptions {
  padding?: number;
  duration?: number;
  minScale?: number;
  maxScale?: number;
}

/** Class name of the fixed left dock — spine (journey rail) + body
 *  (`#viz-sidebar-portal`'s legend/zoom/selection stack) fused into one
 *  glass container (see components/shell/AppShell.tsx, `.viz-dock`). Its
 *  rect is exactly the occluded band whether the body is expanded or
 *  collapsed: a collapsed body contributes zero width inside the dock, so
 *  the dock's own rect simply measures narrower. Preferred over
 *  `FLOATING_PANEL_SELECTOR` below when present with a real box. */
const DOCK_SELECTOR = ".viz-dock";

/** Class name of the legend/zoom/selection stack itself (see
 *  components/shell/AppShell.tsx, `.viz-sidebar-stack`) — the fallback
 *  occlusion target for contexts with no dock: mobile (`.viz-dock` is
 *  `display: contents` there, so it has no box of its own to measure) and
 *  embeds that render the panel without the rest of the app shell. Single
 *  constant so a future rename only needs updating here. */
const FLOATING_PANEL_SELECTOR = ".viz-sidebar-stack";

/** First element matching `selector` that actually occupies space on
 *  screen. Elements that are absent, `display: none`/zero-size, or
 *  `display: contents` (no box of its own — e.g. the mobile `.viz-dock`)
 *  all report a zero-size `getBoundingClientRect()` and none of them should
 *  count as an occluding panel. */
function getOccludingElement(selector: string): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? el : null;
}

/**
 * How much of the SVG's own on-screen width is covered by the floating panel,
 * expressed in the SVG's user-space units (the same space `bounds` is in) —
 * split into a `start` (screen-left) and `end` (screen-right) inset so a
 * caller can shrink the "visible" width from whichever side is occluded.
 *
 * Side-agnostic on purpose: the panel docks via `inset-inline-start`, so it
 * sits on the visual left in LTR and the visual right in RTL. Which side is
 * decided here from the panel's on-screen position relative to the viewport
 * centre, not from `dir`/locale, so both cases fall out of the same check.
 *
 * Returns zero on both sides when neither panel is present/on-screen — the
 * dock and the standalone panel are both absent, hidden (zero-size),
 * collapsed off-screen (the standalone panel slides out via a CSS transform
 * — see `.viz-sidebar-stack.collapsed`) — or simply doesn't overlap this
 * particular SVG (e.g. an embed rendered without the app shell).
 */
function getPanelOcclusionInset(svg: SVGSVGElement, vw: number): { start: number; end: number } {
  const panel = getOccludingElement(DOCK_SELECTOR) ?? getOccludingElement(FLOATING_PANEL_SELECTOR);
  if (!panel) return { start: 0, end: 0 };

  // getOccludingElement already guarantees a non-zero-size box.
  const panelRect = panel.getBoundingClientRect();

  const svgRect = svg.getBoundingClientRect();
  if (svgRect.width <= 0 || svgRect.height <= 0) return { start: 0, end: 0 };

  // Overlap between the panel's rect and the SVG's own on-screen rect, in CSS
  // pixels. A collapsed (translated fully off-screen) or otherwise
  // non-overlapping panel contributes no occlusion.
  const overlapX = Math.min(panelRect.right, svgRect.right) - Math.max(panelRect.left, svgRect.left);
  const overlapY = Math.min(panelRect.bottom, svgRect.bottom) - Math.max(panelRect.top, svgRect.top);
  if (overlapX <= 0 || overlapY <= 0) return { start: 0, end: 0 };

  // Convert the CSS-pixel overlap into the SVG's own user-space units, via
  // the same viewBox-to-rendered-size ratio the vw/vh fallback above relies on.
  const pxToUser = vw / svgRect.width;
  const overlapUser = overlapX * pxToUser;

  const viewportCenter = window.innerWidth / 2;
  const panelCenter = panelRect.left + panelRect.width / 2;
  return panelCenter < viewportCenter
    ? { start: overlapUser, end: 0 } // panel docked on the screen-left edge
    : { start: 0, end: overlapUser }; // panel docked on the screen-right edge (RTL)
}

/**
 * Raw panel occlusion inset (see `getPanelOcclusionInset`), clamped so the
 * free band can never collapse below 40% of `vw` — on a narrow viewport with
 * the panel pinned open, that keeps whatever consults this landing a legible
 * (if tighter) result instead of an extreme, unusable squeeze.
 *
 * Exported separately from `fitBoundsToView` so call sites that position
 * content WITHOUT going through a zoom-to-fit — e.g. a fixed-scale initial
 * centering that only translates, never scales, like
 * AyahDependencyGraph's default tree layout — can still steer clear of the
 * floating panel using the exact same measurement + clamp `fitBoundsToView`
 * itself relies on.
 */
export function getPanelAdjustedWidth(
  svg: SVGSVGElement | null,
  vw: number
): { insetStart: number; insetEnd: number; availableWidth: number } {
  if (!svg || !vw) return { insetStart: 0, insetEnd: 0, availableWidth: vw };
  const panelInset = getPanelOcclusionInset(svg, vw);
  const maxInset = vw * 0.6;
  const insetStart = Math.min(panelInset.start, maxInset);
  const insetEnd = Math.min(panelInset.end, maxInset);
  return { insetStart, insetEnd, availableWidth: vw - insetStart - insetEnd };
}

/**
 * Frame an explicit region (in the graph's own user-space coordinates) within
 * an SVG's viewport, centring it with a little breathing room instead of
 * resetting to the identity transform.
 *
 * This is the primitive `fitGraphToView` builds on: that function always
 * measures the *entire* rendered graph via `getBBox()`, while this one lets a
 * caller pass a specific region to frame instead — e.g. just the content
 * relevant to an initial deep-linked focus, so some unrelated far-flung part
 * of the graph can't drag the shot wide and leave the interesting bit cropped.
 */
export function fitBoundsToView(
  svg: SVGSVGElement | null,
  bounds: ViewBounds | null | undefined,
  // d3's ZoomBehavior is generic over the element type; callers pass their own.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  zoom: d3.ZoomBehavior<any, unknown> | null | undefined,
  opts: FitOptions = {}
): void {
  const { padding = 0.88, minScale = 0.1, maxScale = 8 } = opts;
  // Reduced motion wins even over an explicit caller duration — callers pass
  // *intent* ("animated glide"), but the user preference decides whether that
  // intent renders as a glide or an instant jump. Non-reduced behavior is
  // unchanged (motionSafeDuration is the identity there).
  const duration = motionSafeDuration(opts.duration ?? 750);
  if (!svg || !zoom || !bounds || bounds.width === 0 || bounds.height === 0) return;

  // Prefer the SVG's user-space viewBox; fall back to its pixel size (assume 1:1).
  const vb = svg.viewBox?.baseVal;
  const vw = vb && vb.width ? vb.width : svg.clientWidth;
  const vh = vb && vb.height ? vb.height : svg.clientHeight;
  if (!vw || !vh) return;

  // The floating legend/inspector panel sits ON TOP of the canvas (fixed,
  // docked to one inline edge), not beside it — a fit centred on the FULL
  // canvas width can seat content half-hidden underneath it. Frame within
  // whatever band is actually free of it instead; zero on both sides when
  // the panel is absent, hidden, or collapsed off-screen (mobile, embeds).
  const { insetStart, availableWidth } = getPanelAdjustedWidth(svg, vw);

  const scale = Math.max(
    minScale,
    Math.min(maxScale, padding * Math.min(availableWidth / bounds.width, vh / bounds.height))
  );
  const visibleCenterX = insetStart + availableWidth / 2;
  const tx = visibleCenterX - scale * (bounds.x + bounds.width / 2);
  const ty = vh / 2 - scale * (bounds.y + bounds.height / 2);
  const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);

  d3.select<SVGSVGElement, unknown>(svg)
    .transition()
    .duration(duration)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .call((zoom as any).transform, transform);
}

/**
 * Frame an ENTIRE D3 graph within its SVG viewport — a true zoom-to-fit.
 *
 * Works for any visualization that drives pan/zoom through a `d3.zoom` behavior
 * applied to `svg`, transforming the inner `g`. It measures the rendered
 * content's bounding box and centres it with a little breathing room, instead of
 * resetting to the identity transform (which can crop the graph or zoom into its
 * middle when the drawing is larger than the viewport).
 *
 * Shared by the `useZoom` hook and the force-directed graphs that manage their
 * own zoom behavior, so every "Focus" control behaves identically.
 */
export function fitGraphToView(
  svg: SVGSVGElement | null,
  g: SVGGElement | null,
  // d3's ZoomBehavior is generic over the element type; callers pass their own.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  zoom: d3.ZoomBehavior<any, unknown> | null | undefined,
  opts: FitOptions = {}
): void {
  if (!svg || !g || !zoom) return;

  let bbox: DOMRect;
  try {
    bbox = g.getBBox();
  } catch {
    return;
  }
  if (!bbox || bbox.width === 0 || bbox.height === 0) return;

  fitBoundsToView(svg, bbox, zoom, opts);
}
