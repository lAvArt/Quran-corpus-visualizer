"use client";

import { useMemo } from "react";
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
  allTokens?: CorpusToken[];
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
  allTokens = [],
}: CurrentSelectionPanelProps) {
  const surah = SURAH_NAMES[selectedSurahId];

  const ayahTokensText = useMemo(() => {
    if (!selectedAyah || !selectedSurahId) return null;

    const ayahTokens = allTokens
      .filter((token) => token.sura === selectedSurahId && token.ayah === selectedAyah)
      .sort((a, b) => a.position - b.position)
      .map((token) => token.text.trim())
      .filter(Boolean);

    if (ayahTokens.length === 0) return null;
    return ayahTokens.join(" ");
  }, [allTokens, selectedSurahId, selectedAyah]);

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
            <span className="surah-bilingual">
              <span className="surah-number">{selectedSurahId}.</span>
              <span className="surah-arabic">{surah?.arabic ?? ""}</span>
              <span className="surah-english">{surah?.name ?? ""}</span>
            </span>
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

      {/* Ayah Tokens Display */}
      {ayahTokensText && (
        <div className="ayah-display">
          <p className="eyebrow">Ayah Tokens</p>
          <div className="ayah-scroll-shell">
            <p className="ayah-text-content arabic-text">{ayahTokensText}</p>
          </div>
        </div>
      )}

      <style jsx>{`
        .surah-bilingual {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          align-items: baseline;
        }

        .surah-number {
          font-weight: 600;
          color: var(--accent);
        }

        .surah-arabic {
          font-family: "Amiri", serif;
          font-size: 0.95rem;
          direction: rtl;
        }

        .surah-english {
          font-size: 0.75rem;
          color: var(--ink-muted);
        }

        .ayah-display {
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid var(--line);
        }

        .ayah-scroll-shell {
          margin-top: 6px;
          border: 1px solid var(--line);
          border-radius: 12px;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04)),
            rgba(0, 0, 0, 0.08);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
          overflow: hidden;
        }

        .ayah-text-content {
          margin: 0;
          padding: 10px 12px 12px;
          font-family: "Amiri", serif;
          font-size: 1.4rem;
          line-height: 1.82;
          direction: rtl;
          text-align: right;
          color: var(--ink);
          max-height: 132px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: color-mix(in srgb, var(--accent), var(--line) 45%) transparent;
        }

        .ayah-text-content::-webkit-scrollbar {
          width: 8px;
        }

        .ayah-text-content::-webkit-scrollbar-track {
          background: transparent;
        }

        .ayah-text-content::-webkit-scrollbar-thumb {
          background: color-mix(in srgb, var(--accent), var(--line) 45%);
          border-radius: 999px;
          border: 2px solid transparent;
          background-clip: content-box;
        }

        .ayah-text-content::-webkit-scrollbar-thumb:hover {
          background: color-mix(in srgb, var(--accent), white 14%);
          background-clip: content-box;
        }

        :global([data-theme="dark"]) .ayah-scroll-shell {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02)),
            rgba(255, 255, 255, 0.02);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
        }

        :global([data-theme="dark"]) .ayah-text-content {
          scrollbar-color: color-mix(in srgb, var(--accent), rgba(255, 255, 255, 0.35) 20%) transparent;
        }

        :global([data-theme="dark"]) .ayah-text-content::-webkit-scrollbar-thumb {
          background: color-mix(in srgb, var(--accent), rgba(255, 255, 255, 0.3) 20%);
          background-clip: content-box;
        }
      `}</style>
    </aside>
  );
}
