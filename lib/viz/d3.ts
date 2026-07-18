/**
 * Curated d3 barrel: re-exports only the submodules the app actually uses so
 * webpack can tree-shake the rest of the d3 metapackage out of every viz
 * chunk. Import as `import * as d3 from "@/lib/viz/d3"` — call sites keep the
 * familiar `d3.select(...)` shape. All submodules are hard dependencies of the
 * `d3` package itself, so no extra install is required.
 *
 * If tsc reports a missing `d3.x` member after adding new viz code, add the
 * owning submodule here rather than reverting to `from "d3"`.
 */
export * from "d3-array";
export * from "d3-color";
export * from "d3-drag";
export * from "d3-force";
export * from "d3-hierarchy";
export * from "d3-interpolate";
export * from "d3-scale";
export * from "d3-scale-chromatic";
export * from "d3-selection";
export * from "d3-shape";
export * from "d3-zoom";
// Side-effect: patches selection.prototype.transition (used via chaining).
export * from "d3-transition";
