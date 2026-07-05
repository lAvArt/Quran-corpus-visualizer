import * as d3 from "d3";

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
  opts: { padding?: number; duration?: number; minScale?: number; maxScale?: number } = {}
): void {
  const { padding = 0.88, duration = 750, minScale = 0.1, maxScale = 8 } = opts;
  if (!svg || !g || !zoom) return;

  let bbox: DOMRect;
  try {
    bbox = g.getBBox();
  } catch {
    return;
  }
  if (!bbox || bbox.width === 0 || bbox.height === 0) return;

  // Prefer the SVG's user-space viewBox; fall back to its pixel size (assume 1:1).
  const vb = svg.viewBox?.baseVal;
  const vw = vb && vb.width ? vb.width : svg.clientWidth;
  const vh = vb && vb.height ? vb.height : svg.clientHeight;
  if (!vw || !vh) return;

  const scale = Math.max(
    minScale,
    Math.min(maxScale, padding * Math.min(vw / bbox.width, vh / bbox.height))
  );
  const tx = vw / 2 - scale * (bbox.x + bbox.width / 2);
  const ty = vh / 2 - scale * (bbox.y + bbox.height / 2);
  const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);

  d3.select<SVGSVGElement, unknown>(svg)
    .transition()
    .duration(duration)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .call((zoom as any).transform, transform);
}
