"use client";

import type { VisualizationMode } from "@/lib/schema/visualizationTypes";
import type { CorpusToken } from "@/lib/schema/types";
import { SURAH_NAMES } from "@/lib/data/surahData";

interface CurrentSelectionPanelProps {
  vizMode: VisualizationMode;
  selectedSurahId: number;
  selectedAyah?: number | null;
  selectedRoot?: string | null;
  selectedLemma?: string | null;
  activeToken?: CorpusToken | null;
}

const modeLabel: Record<VisualizationMode, string> = {
  "radial-sura": "Radial Sura",
  "root-network": "Root Network",
  "arc-flow": "Arc Flow",
  "dependency-tree": "Dependency Tree",
  "sankey-flow": "Sankey Flow",
  "surah-distribution": "Surah Distribution",
  "corpus-architecture": "Corpus Architecture",
  heatmap: "Heatmap",
};

export default function CurrentSelectionPanel({
  vizMode,
  selectedSurahId,
  selectedAyah,
  selectedRoot,
  selectedLemma,
  activeToken,
}: CurrentSelectionPanelProps) {
  const surah = SURAH_NAMES[selectedSurahId];

  return (
    <aside className="current-selection-panel">
      <p className="eyebrow">Current Selection</p>
      <div className="selection-grid">
        <div className="selection-row">
          <span className="selection-label">View</span>
          <span className="selection-value">{modeLabel[vizMode]}</span>
        </div>
        <div className="selection-row">
          <span className="selection-label">Surah</span>
          <span className="selection-value">
            {selectedSurahId}
            {surah?.name ? ` · ${surah.name}` : ""}
          </span>
        </div>
        <div className="selection-row">
          <span className="selection-label">Ayah</span>
          <span className="selection-value">{selectedAyah ?? "-"}</span>
        </div>
        <div className="selection-row">
          <span className="selection-label">Root</span>
          <span className="selection-value arabic-text">{selectedRoot ?? "-"}</span>
        </div>
        <div className="selection-row">
          <span className="selection-label">Lemma</span>
          <span className="selection-value arabic-text">{selectedLemma ?? "-"}</span>
        </div>
        <div className="selection-row">
          <span className="selection-label">Token</span>
          <span className="selection-value arabic-text">{activeToken?.text ?? "-"}</span>
        </div>
      </div>
    </aside>
  );
}
