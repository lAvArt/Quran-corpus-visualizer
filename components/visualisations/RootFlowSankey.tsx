"use client";

import { useMemo, useState } from "react";
import type { CorpusToken, RootWordFlow } from "@/lib/schema/types";

interface RootFlowSankeyProps {
  flows: RootWordFlow[];
  roots: string[];
  tokenById: Map<string, CorpusToken>;
  onTokenHover: (tokenId: string | null) => void;
  onTokenFocus: (tokenId: string) => void;
}

function pathWidth(count: number): number {
  return 6 + count * 8;
}

export default function RootFlowSankey({
  flows,
  roots,
  tokenById,
  onTokenHover,
  onTokenFocus
}: RootFlowSankeyProps) {
  const [selectedRoot, setSelectedRoot] = useState<string>("all");

  const visibleFlows = useMemo(
    () => flows.filter((f) => selectedRoot === "all" || f.root === selectedRoot),
    [flows, selectedRoot]
  );

  const maxCount = Math.max(...visibleFlows.map((f) => f.count), 1);
  const height = Math.max(360, visibleFlows.length * 58 + 90);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">MVP Visualisation</p>
          <h2>RootFlowSankey</h2>
        </div>
        <label className="filter">
          <span>Root</span>
          <select value={selectedRoot} onChange={(e) => setSelectedRoot(e.target.value)}>
            <option value="all">All roots</option>
            {roots.map((root) => (
              <option key={root} value={root}>
                {root}
              </option>
            ))}
          </select>
        </label>
      </div>

      <svg viewBox={`0 0 960 ${height}`} className="sankey" role="img" aria-label="Root-to-lemma flow chart">
        <defs>
          <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>
        </defs>

        <rect x="40" y="22" width="170" height={height - 44} rx="20" className="column root-column" />
        <rect x="760" y="22" width="170" height={height - 44} rx="20" className="column lemma-column" />
        <text x="126" y="54" className="column-title">
          Roots
        </text>
        <text x="846" y="54" className="column-title">
          Lemmas
        </text>

        {visibleFlows.map((flow, index) => {
          const y = 88 + index * 54;
          const width = pathWidth(Math.round((flow.count / maxCount) * 4));
          return (
            <g key={`${flow.root}-${flow.lemma}`}>
              <path
                d={`M 210 ${y} C 380 ${y}, 600 ${y}, 760 ${y}`}
                stroke="url(#flowGrad)"
                strokeWidth={width}
                fill="none"
                strokeLinecap="round"
                opacity={0.75}
                onMouseEnter={() => onTokenHover(flow.tokenIds[0] ?? null)}
                onMouseLeave={() => onTokenHover(null)}
                onClick={() => {
                  if (flow.tokenIds[0]) onTokenFocus(flow.tokenIds[0]);
                }}
                className="flow-path"
              />
              <text x="60" y={y + 5} className="node-label">
                {flow.root}
              </text>
              <text x="780" y={y + 5} className="node-label lemma-label">
                {flow.lemma}
              </text>
              <text x="474" y={y - 10} className="count-label">
                {flow.count}
              </text>
              <text x="474" y={y + 14} className="flow-token-label">
                {(flow.tokenIds[0] && tokenById.get(flow.tokenIds[0])?.text) ?? ""}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="footnote">
        Data is sample-only for MVP scaffolding. Next step: swap to Quranic Arabic Corpus ingest pipeline.
      </p>
    </section>
  );
}
