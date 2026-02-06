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
    <div className="sankey-wrapper">
      <div className="sankey-header-inline">
        <h3>Root Flow Analysis</h3>
        <label className="filter-label">
          <span>Filter Root: </span>
          <select value={selectedRoot} onChange={(e) => setSelectedRoot(e.target.value)} className="root-select">
            <option value="all">All roots</option>
            {roots.map((root) => (
              <option key={root} value={root}>
                {root}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="sankey-scroll-area">
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
      </div>

      <div className="viz-legend">
        <div className="viz-legend-item">
          <div
            className="viz-legend-line"
            style={{ background: "linear-gradient(90deg, #2dd4bf, #38bdf8, #f472b6)" }}
          />
          <span>Root → Lemma flow</span>
        </div>
        <div className="viz-legend-item">
          <div className="viz-legend-line" style={{ background: "var(--accent)", height: 6 }} />
          <span>Thickness = frequency</span>
        </div>
        <div className="viz-legend-item">
          <div className="viz-legend-dot" style={{ background: "var(--bg-1)", border: "1px solid var(--line)" }} />
          <span>Columns</span>
        </div>
      </div>

      <style jsx>{`
        .sankey-wrapper {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .sankey-header-inline {
            padding: 1rem 2rem;
            display: flex;
            gap: 2rem;
            align-items: center;
            border-bottom: 1px dashed var(--line);
        }

        .sankey-header-inline h3 {
            margin: 0;
            font-size: 1rem;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--ink-secondary);
        }

        .filter-label {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.9rem;
        }

        .root-select {
            padding: 4px 8px;
            border-radius: 4px;
            border: 1px solid var(--line);
        }

        .sankey-scroll-area {
            flex: 1;
            overflow: auto;
            padding: 1rem;
            display: flex;
            justify-content: center;
        }

        .sankey {
            min-width: 960px;
            max-width: 1200px;
        }

        .column {
            fill: rgba(0,0,0,0.03);
            stroke: var(--line);
            stroke-width: 1px;
        }

        .column-title {
            text-anchor: middle;
            font-weight: bold;
            fill: var(--ink-secondary);
            font-size: 0.9rem;
            text-transform: uppercase;
        }

        .node-label {
            text-anchor: middle;
            font-family: "Amiri", serif;
            font-size: 1.2rem;
            fill: var(--ink);
            pointer-events: none;
        }

        .flow-path {
            cursor: pointer;
            transition: opacity 0.2s;
        }
        .flow-path:hover {
            opacity: 1;
            stroke-width: 20px;
        }

        .count-label {
            text-anchor: middle;
            font-size: 0.7rem;
            fill: var(--ink-secondary);
            font-weight: bold;
        }
        
        .flow-token-label {
            text-anchor: middle;
            font-family: "Amiri", serif;
            font-size: 0.8rem;
            fill: var(--ink-muted);
        }
      `}</style>
    </div>
  );
}
