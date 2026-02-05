"use client";

import { useMemo } from "react";
import type { AyahDependencyData } from "@/lib/schema/types";

interface AyahDependencyGraphProps {
  data: AyahDependencyData;
  onTokenHover: (tokenId: string | null) => void;
  onTokenFocus: (tokenId: string) => void;
}

export default function AyahDependencyGraph({ data, onTokenHover, onTokenFocus }: AyahDependencyGraphProps) {
  const sortedTokens = useMemo(
    () => [...data.tokens].sort((a, b) => a.position - b.position),
    [data.tokens]
  );

  const tokenMap = useMemo(
    () => new Map(sortedTokens.map((token) => [token.id, token])),
    [sortedTokens]
  );

  const width = Math.max(980, sortedTokens.length * 170 + 90);
  const baseY = 240;
  const spacing = 165;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">MVP Visualisation</p>
          <h2>AyahDependencyGraph</h2>
        </div>
        <p className="ayah-meta">
          Ayah {data.ayah.id} - {data.ayah.textUthmani}
        </p>
      </div>

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
    </section>
  );
}
