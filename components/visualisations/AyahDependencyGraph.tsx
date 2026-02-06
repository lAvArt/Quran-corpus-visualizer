"use client";

import { useMemo, useEffect, useState } from "react";
import { SURAH_NAMES } from "@/lib/data/surahData";
import type { CorpusToken, AyahDependencyData, DependencyEdge } from "@/lib/schema/types";

interface AyahDependencyGraphProps {
  tokens: CorpusToken[];
  selectedSurahId: number;
  selectedAyah?: number | null;
  onTokenHover: (tokenId: string | null) => void;
  onTokenFocus: (tokenId: string) => void;
  theme?: "light" | "dark";
}

function relationForPos(pos: CorpusToken["pos"]): string {
  if (pos === "V") return "pred";
  if (pos === "PRON") return "arg";
  if (pos === "N") return "nom";
  if (pos === "P") return "part";
  if (pos === "ADJ") return "attr";
  return "dep";
}

function buildFallbackDependencies(ayahId: string, ayahTokens: CorpusToken[]): DependencyEdge[] {
  if (ayahTokens.length < 2) return [];

  const headToken =
    ayahTokens.find((token) => token.pos === "V") ??
    ayahTokens[Math.max(0, Math.floor(ayahTokens.length / 2))];

  return ayahTokens
    .filter((token) => token.id !== headToken.id)
    .map((token) => ({
      id: `${ayahId}:dep:${token.position}`,
      ayahId,
      dependentTokenId: token.id,
      headTokenId: headToken.id,
      relation: relationForPos(token.pos),
    }));
}

export default function AyahDependencyGraph({
  tokens,
  selectedSurahId,
  selectedAyah,
  onTokenHover,
  onTokenFocus,
  theme = "dark",
}: AyahDependencyGraphProps) {
  const surahTokens = useMemo(
    () => tokens.filter((token) => token.sura === selectedSurahId),
    [tokens, selectedSurahId]
  );

  const availableAyahs = useMemo(() => {
    const ayahs = new Set<number>();
    for (const token of surahTokens) ayahs.add(token.ayah);
    return [...ayahs].sort((a, b) => a - b);
  }, [surahTokens]);

  const [activeAyah, setActiveAyah] = useState<number | null>(null);

  useEffect(() => {
    if (availableAyahs.length === 0) {
      setActiveAyah(null);
      return;
    }

    if (selectedAyah && availableAyahs.includes(selectedAyah)) {
      setActiveAyah(selectedAyah);
      return;
    }

    setActiveAyah((prev) => (prev && availableAyahs.includes(prev) ? prev : availableAyahs[0]));
  }, [availableAyahs, selectedAyah, selectedSurahId]);

  const data = useMemo<AyahDependencyData | null>(() => {
    if (!activeAyah) return null;

    const ayahTokens = surahTokens
      .filter((token) => token.ayah === activeAyah)
      .sort((a, b) => a.position - b.position);

    if (ayahTokens.length === 0) return null;

    const ayahId = `${selectedSurahId}:${activeAyah}`;
    const textUthmani = ayahTokens.map((token) => token.text).join(" ");

    return {
      ayah: {
        id: ayahId,
        suraId: selectedSurahId,
        ayahNumber: activeAyah,
        textUthmani,
        tokenIds: ayahTokens.map((token) => token.id),
      },
      tokens: ayahTokens,
      dependencies: buildFallbackDependencies(ayahId, ayahTokens),
    };
  }, [activeAyah, selectedSurahId, surahTokens]);

  const sortedTokens = useMemo(
    () => [...(data?.tokens ?? [])].sort((a, b) => a.position - b.position),
    [data]
  );

  const tokenMap = useMemo(() => new Map(sortedTokens.map((token) => [token.id, token])), [sortedTokens]);

  const width = Math.max(980, sortedTokens.length * 170 + 90);
  const baseY = 240;
  const spacing = 165;
  const surahName = SURAH_NAMES[selectedSurahId]?.name ?? `Surah ${selectedSurahId}`;
  const surahArabic = SURAH_NAMES[selectedSurahId]?.arabic ?? "";

  if (!data || sortedTokens.length === 0) {
    return (
      <section className="panel" data-theme={theme}>
        <div className="dep-header">
          <h2 className="viz-title">Dependency Tree</h2>
        </div>
        <div className="dep-empty">
          No tokens available for Surah {selectedSurahId} in current dataset.
        </div>

        <style jsx>{`
          .dep-header {
            padding: 1rem 1.25rem;
            border-bottom: 1px dashed var(--line);
          }

          .dep-empty {
            padding: 1.25rem;
            color: var(--ink-muted);
          }
        `}</style>
      </section>
    );
  }

  return (
    <section className="panel dep-graph-wrapper" data-theme={theme}>
      <div className="dep-header">
        <div>
          <h2 className="viz-title">Dependency Tree</h2>
          <p className="dep-surah-meta">
            {surahName} <span className="arabic-font" lang="ar">{surahArabic}</span>
          </p>
        </div>
        <div className="dep-header-right">
          <label className="dep-ayah-label" htmlFor="dep-ayah-select">Ayah</label>
          <select
            id="dep-ayah-select"
            className="dep-ayah-select"
            value={activeAyah ?? undefined}
            onChange={(event) => setActiveAyah(Number(event.target.value))}
          >
            {availableAyahs.map((ayahNumber) => (
              <option key={ayahNumber} value={ayahNumber}>
                {ayahNumber}
              </option>
            ))}
          </select>
          <span className="ayah-meta-tag">
            {data.ayah.id}
          </span>
        </div>
      </div>

      <div className="dep-ayah-text arabic-font" lang="ar">
        {data.ayah.textUthmani}
      </div>

      <div className="dep-scroll-area">
        <svg viewBox={`0 0 ${width} 320`} className="dependency-graph" role="img" aria-label="Single-ayah dependency graph">
          {data.dependencies.map((edge, idx) => {
            const dependent = tokenMap.get(edge.dependentTokenId);
            const head = tokenMap.get(edge.headTokenId);

            if (!dependent || !head) {
              return null;
            }

            const startX = 70 + (dependent.position - 1) * spacing;
            const endX = 70 + (head.position - 1) * spacing;
            const arcHeight = 45 + Math.abs(endX - startX) * 0.2;
            const controlY = baseY - arcHeight;
            const midX = (startX + endX) / 2;

            return (
              <g key={edge.id}>
                <path
                  d={`M ${startX} ${baseY - 36} Q ${midX} ${controlY}, ${endX} ${baseY - 36}`}
                  className="dep-edge"
                  style={{ animationDelay: `${idx * 70}ms` }}
                />
                <text x={midX} y={controlY - 8} className="dep-relation">
                  {edge.relation}
                </text>
              </g>
            );
          })}

          {sortedTokens.map((token) => {
            const x = 70 + (token.position - 1) * spacing;
            return (
              <g key={token.id}>
                <rect x={x - 58} y={baseY - 36} width={116} height={78} rx={14} className="dep-node" />
                <text x={x} y={baseY - 8} className="dep-token">
                  {token.text}
                </text>
                <text x={x} y={baseY + 14} className="dep-pos">
                  {token.pos}
                </text>
              </g>
            );
          })}

          {sortedTokens.map((token) => {
            const x = 70 + (token.position - 1) * spacing;
            return (
              <rect
                key={`${token.id}-hitbox`}
                x={x - 60}
                y={baseY - 40}
                width={120}
                height={86}
                rx={14}
                className="dep-hitbox"
                onMouseEnter={() => onTokenHover(token.id)}
                onMouseLeave={() => onTokenHover(null)}
                onClick={() => onTokenFocus(token.id)}
              />
            );
          })}
        </svg>
      </div>

      <div className="viz-legend">
        <div className="viz-legend-item">
          <div className="viz-legend-line" style={{ background: "var(--accent)" }} />
          <span>Dependency arc</span>
        </div>
        <div className="viz-legend-item">
          <div
            className="viz-legend-dot"
            style={{ background: "var(--bg-1)", border: "1px solid var(--accent-2)" }}
          />
          <span>Token node</span>
        </div>
        <div className="viz-legend-item">
          <div className="viz-legend-dot" style={{ background: "var(--ink-muted)" }} />
          <span>POS label</span>
        </div>
      </div>

      <style jsx>{`
        .dep-graph-wrapper {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: var(--bg-1);
        }

        .dep-header {
          padding: 1rem 1.25rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px dashed var(--line);
          gap: 1rem;
          flex-wrap: wrap;
        }

        .viz-title {
          margin: 0;
          font-size: 1rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--ink-secondary);
        }

        .dep-surah-meta {
          margin: 4px 0 0;
          color: var(--ink-muted);
          font-size: 0.82rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .dep-header-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .dep-ayah-label {
          font-size: 0.76rem;
          color: var(--ink-muted);
        }

        .dep-ayah-select {
          border: 1px solid var(--line);
          border-radius: 10px;
          background: var(--bg-2);
          color: var(--ink);
          padding: 6px 10px;
          font-size: 0.85rem;
        }

        .ayah-meta-tag {
          background: rgba(0, 0, 0, 0.04);
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 0.82rem;
          color: var(--ink);
        }

        .dep-ayah-text {
          margin: 0;
          padding: 10px 1.25rem 0;
          color: var(--ink-secondary);
          font-size: 1.15rem;
          line-height: 1.8;
          text-align: right;
        }

        .arabic-font {
          font-family: "Amiri", serif;
        }

        .dep-scroll-area {
          flex: 1;
          overflow: auto;
          padding: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dependency-graph {
          height: 320px;
          min-width: 980px;
        }
      `}</style>
    </section>
  );
}
