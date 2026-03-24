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
}

/**
 * Static explainer content for each visualization mode.
 * All text fields are i18n keys under `VizExplainer.<mode>`.
 */
export const VIZ_EXPLAINERS: Record<VisualizationMode, VizExplainer> = {
  "surah-distribution": {
    summaryKey: "surah-distribution.summary",
    legend: [
      { color: "#60a5fa", shape: "arc", label: "Makki surah" },
      { color: "#f59e0b", shape: "arc", label: "Madani surah" },
      { color: "#a78bfa", shape: "circle", label: "Root frequency" },
    ],
    hintKeys: [
      "surah-distribution.hint.hover",
      "surah-distribution.hint.click",
      "surah-distribution.hint.zoom",
    ],
    purposeKey: "surah-distribution.purpose",
  },

  "corpus-architecture": {
    summaryKey: "corpus-architecture.summary",
    legend: [
      { color: "#818cf8", shape: "rect", label: "Juz" },
      { color: "#34d399", shape: "rect", label: "Surah" },
      { color: "#fbbf24", shape: "circle", label: "Ayah group" },
    ],
    hintKeys: [
      "corpus-architecture.hint.expand",
      "corpus-architecture.hint.click",
    ],
    purposeKey: "corpus-architecture.purpose",
  },

  "radial-sura": {
    summaryKey: "radial-sura.summary",
    legend: [
      { color: "#60a5fa", shape: "circle", label: "Noun" },
      { color: "#f472b6", shape: "circle", label: "Verb" },
      { color: "#a3e635", shape: "circle", label: "Particle" },
      { color: "#94a3b8", shape: "line", label: "Ayah boundary" },
    ],
    hintKeys: [
      "radial-sura.hint.hover",
      "radial-sura.hint.click",
      "radial-sura.hint.drag",
      "radial-sura.hint.zoom",
    ],
    purposeKey: "radial-sura.purpose",
  },

  "dependency-tree": {
    summaryKey: "dependency-tree.summary",
    legend: [
      { color: "#60a5fa", shape: "circle", label: "Token" },
      { color: "#f97316", shape: "line", label: "Dependency edge" },
    ],
    hintKeys: [
      "dependency-tree.hint.hover",
      "dependency-tree.hint.click",
    ],
    purposeKey: "dependency-tree.purpose",
  },

  "arc-flow": {
    summaryKey: "arc-flow.summary",
    legend: [
      { color: "#60a5fa", shape: "circle", label: "Token" },
      { color: "#a78bfa", shape: "arc", label: "Syntactic arc" },
    ],
    hintKeys: [
      "arc-flow.hint.hover",
      "arc-flow.hint.click",
    ],
    purposeKey: "arc-flow.purpose",
  },

  "root-network": {
    summaryKey: "root-network.summary",
    legend: [
      { color: "#f472b6", shape: "circle", label: "Root node" },
      { color: "#60a5fa", shape: "circle", label: "Lemma node" },
      { color: "#94a3b8", shape: "line", label: "Derivation link" },
    ],
    hintKeys: [
      "root-network.hint.hover",
      "root-network.hint.click",
      "root-network.hint.drag",
    ],
    purposeKey: "root-network.purpose",
  },

  "sankey-flow": {
    summaryKey: "sankey-flow.summary",
    legend: [
      { color: "#f472b6", shape: "rect", label: "Root" },
      { color: "#60a5fa", shape: "rect", label: "Lemma" },
      { color: "#d1d5db", shape: "line", label: "Derivation flow" },
    ],
    hintKeys: [
      "sankey-flow.hint.hover",
      "sankey-flow.hint.click",
    ],
    purposeKey: "sankey-flow.purpose",
  },

  "collocation-network": {
    summaryKey: "collocation-network.summary",
    legend: [
      { color: "#f472b6", shape: "circle", label: "Root" },
      { color: "#60a5fa", shape: "circle", label: "Collocate" },
      { color: "#fbbf24", shape: "line", label: "PMI strength" },
    ],
    hintKeys: [
      "collocation-network.hint.hover",
      "collocation-network.hint.click",
      "collocation-network.hint.drag",
    ],
    purposeKey: "collocation-network.purpose",
  },

  "knowledge-graph": {
    summaryKey: "knowledge-graph.summary",
    legend: [
      { color: "#34d399", shape: "circle", label: "Tracked root" },
      { color: "#94a3b8", shape: "circle", label: "Untracked root" },
      { color: "#818cf8", shape: "line", label: "Semantic link" },
    ],
    hintKeys: [
      "knowledge-graph.hint.hover",
      "knowledge-graph.hint.click",
    ],
    purposeKey: "knowledge-graph.purpose",
  },

  heatmap: {
    summaryKey: "heatmap.summary",
    legend: [
      { color: "#fde68a", shape: "rect", label: "Low frequency" },
      { color: "#f97316", shape: "rect", label: "Medium frequency" },
      { color: "#dc2626", shape: "rect", label: "High frequency" },
    ],
    hintKeys: [
      "heatmap.hint.hover",
      "heatmap.hint.click",
    ],
    purposeKey: "heatmap.purpose",
  },
};
