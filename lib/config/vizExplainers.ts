import { CATEGORY_COLORS } from "@/lib/schema/visualizationTypes";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";

export interface LegendItem {
  color: string;
  shape: "circle" | "line" | "rect" | "arc";
  label: string;
}

export interface VizExplainer {
  /** One-sentence summary of what the user is seeing */
  summaryKey: string;
  /** Color/shape legend items (static, no i18n — colors speak) */
  legend: LegendItem[];
  /** Interaction hints (i18n keys) */
  hintKeys: string[];
  /** Why this view is useful (i18n key) */
  purposeKey: string;
  /**
   * One-line "claim" — what this view lets you discover. Powers the
   * first-open intro card (`VizIntroCard`), distinct from the persistent
   * "What am I seeing?" panel above.
   */
  claimKey: string;
  /** Exactly 3 short "how to read it" steps for the intro card (i18n keys). */
  howToReadKeys: readonly [string, string, string];
}

/**
 * Static explainer content for each visualization mode.
 * All text fields (except legend labels) are i18n keys under `VizExplainer.<mode>`.
 *
 * Legend colors are sourced to match what each canvas ACTUALLY renders so the
 * legend can never disagree with the graph:
 *   - Part-of-speech nodes derive from `CATEGORY_COLORS` (same as `getNodeColor`).
 *   - Theme-driven elements (edges, arcs, structural nodes) use the live CSS
 *     accent variables (`var(--accent)` / `var(--accent-2)`) the canvases read,
 *     so the swatch follows the user's chosen accent.
 *   - Neutral structure stays slate (`CATEGORY_COLORS.other`).
 */
const NEUTRAL = CATEGORY_COLORS.other; // slate #94a3b8

export const VIZ_EXPLAINERS: Record<VisualizationMode, VizExplainer> = {
  "surah-distribution": {
    summaryKey: "surah-distribution.summary",
    legend: [
      { color: "var(--accent-2)", shape: "arc", label: "Makki surah" },
      { color: "var(--accent)", shape: "arc", label: "Madani surah" },
      { color: CATEGORY_COLORS.pronoun, shape: "circle", label: "Root frequency" },
    ],
    hintKeys: [
      "surah-distribution.hint.hover",
      "surah-distribution.hint.click",
      "surah-distribution.hint.zoom",
    ],
    purposeKey: "surah-distribution.purpose",
    claimKey: "surah-distribution.claim",
    howToReadKeys: [
      "surah-distribution.hint.hover",
      "surah-distribution.hint.click",
      "surah-distribution.hint.zoom",
    ],
  },

  "corpus-architecture": {
    summaryKey: "corpus-architecture.summary",
    legend: [
      { color: "var(--accent-2)", shape: "rect", label: "Juz" },
      { color: "var(--accent)", shape: "rect", label: "Surah" },
      { color: CATEGORY_COLORS.preposition, shape: "circle", label: "Ayah group" },
    ],
    hintKeys: [
      "corpus-architecture.hint.expand",
      "corpus-architecture.hint.click",
    ],
    purposeKey: "corpus-architecture.purpose",
    claimKey: "corpus-architecture.claim",
    howToReadKeys: [
      "corpus-architecture.hint.expand",
      "corpus-architecture.hint.click",
      "corpus-architecture.hint.zoom",
    ],
  },

  // Canvas colours POS dots via getNodeColor() — matches the on-canvas legend exactly.
  "radial-sura": {
    summaryKey: "radial-sura.summary",
    legend: [
      { color: CATEGORY_COLORS.noun, shape: "circle", label: "Noun" },
      { color: CATEGORY_COLORS.verb, shape: "circle", label: "Verb" },
      { color: CATEGORY_COLORS.adjective, shape: "circle", label: "Adjective" },
      { color: CATEGORY_COLORS.preposition, shape: "circle", label: "Preposition" },
      { color: NEUTRAL, shape: "line", label: "Ayah boundary" },
    ],
    hintKeys: [
      "radial-sura.hint.hover",
      "radial-sura.hint.click",
      "radial-sura.hint.drag",
      "radial-sura.hint.zoom",
    ],
    purposeKey: "radial-sura.purpose",
    claimKey: "radial-sura.claim",
    howToReadKeys: [
      "radial-sura.hint.hover",
      "radial-sura.hint.click",
      "radial-sura.hint.zoom",
    ],
  },

  // Tokens coloured by getNodeColor(pos); edges use var(--accent).
  "dependency-tree": {
    summaryKey: "dependency-tree.summary",
    legend: [
      { color: CATEGORY_COLORS.noun, shape: "circle", label: "Token (by part of speech)" },
      { color: "var(--accent)", shape: "line", label: "Dependency edge" },
    ],
    hintKeys: [
      "dependency-tree.hint.hover",
      "dependency-tree.hint.click",
    ],
    purposeKey: "dependency-tree.purpose",
    claimKey: "dependency-tree.claim",
    howToReadKeys: [
      "dependency-tree.hint.hover",
      "dependency-tree.hint.click",
      "dependency-tree.hint.zoom",
    ],
  },

  // Tokens coloured by getNodeColor(pos); arcs use the theme accent gradient.
  "arc-flow": {
    summaryKey: "arc-flow.summary",
    legend: [
      { color: CATEGORY_COLORS.noun, shape: "circle", label: "Token (by part of speech)" },
      { color: "var(--accent)", shape: "arc", label: "Syntactic arc" },
    ],
    hintKeys: [
      "arc-flow.hint.hover",
      "arc-flow.hint.click",
    ],
    purposeKey: "arc-flow.purpose",
    claimKey: "arc-flow.claim",
    howToReadKeys: [
      "arc-flow.hint.hover",
      "arc-flow.hint.click",
      "arc-flow.hint.pan",
    ],
  },

  // Root nodes use the theme accent; lemma nodes use getNodeColor(pos).
  "root-network": {
    summaryKey: "root-network.summary",
    legend: [
      { color: "var(--accent)", shape: "circle", label: "Root node" },
      { color: CATEGORY_COLORS.noun, shape: "circle", label: "Lemma node" },
      { color: NEUTRAL, shape: "line", label: "Derivation link" },
    ],
    hintKeys: [
      "root-network.hint.hover",
      "root-network.hint.click",
      "root-network.hint.drag",
    ],
    purposeKey: "root-network.purpose",
    claimKey: "root-network.claim",
    howToReadKeys: [
      "root-network.hint.hover",
      "root-network.hint.click",
      "root-network.hint.drag",
    ],
  },

  "sankey-flow": {
    summaryKey: "sankey-flow.summary",
    legend: [
      { color: "var(--accent)", shape: "rect", label: "Root" },
      { color: "var(--accent-2)", shape: "rect", label: "Lemma" },
      { color: NEUTRAL, shape: "line", label: "Derivation flow" },
    ],
    hintKeys: [
      "sankey-flow.hint.hover",
      "sankey-flow.hint.click",
    ],
    purposeKey: "sankey-flow.purpose",
    claimKey: "sankey-flow.claim",
    howToReadKeys: [
      "sankey-flow.hint.hover",
      "sankey-flow.hint.click",
      "sankey-flow.hint.path",
    ],
  },

  "collocation-network": {
    summaryKey: "collocation-network.summary",
    legend: [
      { color: "var(--accent)", shape: "circle", label: "Root" },
      { color: "var(--accent-2)", shape: "circle", label: "Collocate" },
      { color: CATEGORY_COLORS.preposition, shape: "line", label: "PMI strength" },
    ],
    hintKeys: [
      "collocation-network.hint.hover",
      "collocation-network.hint.click",
      "collocation-network.hint.drag",
    ],
    purposeKey: "collocation-network.purpose",
    claimKey: "collocation-network.claim",
    howToReadKeys: [
      "collocation-network.hint.hover",
      "collocation-network.hint.click",
      "collocation-network.hint.drag",
    ],
  },

  // Canvas tints tracked roots with the accent, ghosts stay neutral.
  "knowledge-graph": {
    summaryKey: "knowledge-graph.summary",
    legend: [
      { color: "var(--accent-2)", shape: "circle", label: "Tracked root" },
      { color: NEUTRAL, shape: "circle", label: "Untracked root" },
      { color: "var(--accent)", shape: "line", label: "Semantic link" },
    ],
    hintKeys: [
      "knowledge-graph.hint.hover",
      "knowledge-graph.hint.click",
    ],
    purposeKey: "knowledge-graph.purpose",
    claimKey: "knowledge-graph.claim",
    howToReadKeys: [
      "knowledge-graph.hint.hover",
      "knowledge-graph.hint.click",
      "knowledge-graph.hint.legend",
    ],
  },

  // Frequency ramp in the warm V2 spectrum (yellow → amber → coral).
  heatmap: {
    summaryKey: "heatmap.summary",
    legend: [
      { color: CATEGORY_COLORS.preposition, shape: "rect", label: "Low frequency" },
      { color: CATEGORY_COLORS.noun, shape: "rect", label: "Medium frequency" },
      { color: CATEGORY_COLORS.particle, shape: "rect", label: "High frequency" },
    ],
    hintKeys: [
      "heatmap.hint.hover",
      "heatmap.hint.click",
    ],
    purposeKey: "heatmap.purpose",
    claimKey: "heatmap.claim",
    howToReadKeys: [
      "heatmap.hint.hover",
      "heatmap.hint.click",
      "heatmap.hint.legend",
    ],
  },
};
