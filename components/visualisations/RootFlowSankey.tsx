"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { VizExplainerDialog, HelpIcon } from "@/components/ui/VizExplainerDialog";

import type { ChangeEvent } from "react";
import type { CorpusToken, RootWordFlow } from "@/lib/schema/types";
import { useZoom } from "@/lib/hooks/useZoom";
import { useVizControl } from "@/lib/hooks/VizControlContext";

interface RootFlowSankeyProps {
  flows: RootWordFlow[];
  roots: string[];
  tokenById: Map<string, CorpusToken>;
  onTokenHover: (tokenId: string | null) => void;
  onTokenFocus: (tokenId: string) => void;
  selectedSurahId?: number;
}

const INITIAL_VISIBLE = 50;
const LOAD_MORE_COUNT = 50;
const SVG_WIDTH = 1080;
const ROOT_COLUMN_X = 90;
const COLUMN_WIDTH = 190;
const LEMMA_COLUMN_X = 800;
const FLOW_START_X = ROOT_COLUMN_X + COLUMN_WIDTH;
const FLOW_END_X = LEMMA_COLUMN_X;
const FLOW_MID_LEFT = 430;
const FLOW_MID_RIGHT = 650;

function pathWidth(weightRatio: number): number {
  const normalized = Math.max(0, Math.min(1, weightRatio));
  return 4 + normalized * 16;
}

export default function RootFlowSankey({
  flows,
  roots: globalRoots,
  tokenById,
  onTokenHover,
  onTokenFocus,
  selectedSurahId,
}: RootFlowSankeyProps) {
  const t = useTranslations("Visualizations.RootFlow");
  const ts = useTranslations("Visualizations.Shared");
  const [selectedRoot, setSelectedRoot] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [showHelp, setShowHelp] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { isLeftSidebarOpen, toggleLeftSidebar } = useVizControl();

  const { svgRef, gRef, resetZoom } = useZoom<SVGSVGElement>({
    minScale: 0.2,
    maxScale: 4,
    initialScale: 0.9,
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 1. Calculate flows scoped to the current Surah (if selected)
  // This ensures counts reflect the local scope, not the global corpus
  const scopedFlows = useMemo(() => {
    if (!selectedSurahId) return flows;

    const newFlows: RootWordFlow[] = [];

    for (const flow of flows) {
      // Filter tokens that belong to the selected surah
      const flowsInSurah = flow.tokenIds.filter((id) => {
        const t = tokenById.get(id);
        return t?.sura === selectedSurahId;
      });

      if (flowsInSurah.length > 0) {
        newFlows.push({
          ...flow,
          count: flowsInSurah.length,
          tokenIds: flowsInSurah,
        });
      }
    }

    return newFlows.sort((a, b) => b.count - a.count || a.root.localeCompare(b.root));
  }, [flows, selectedSurahId, tokenById]);

  // 2. Derive available roots from the scoped flows
  const availableRoots = useMemo(() => {
    if (!selectedSurahId) return globalRoots;
    const rootsSet = new Set(scopedFlows.map((f) => f.root));
    return Array.from(rootsSet).sort((a, b) => a.localeCompare(b));
  }, [scopedFlows, globalRoots, selectedSurahId]);

  // Reset selected root if it's no longer available in the new scope
  useEffect(() => {
    if (selectedRoot !== "all" && !availableRoots.includes(selectedRoot)) {
      setSelectedRoot("all");
    }
  }, [availableRoots, selectedRoot]);

  // 3. Apply root filtering
  const filteredFlows = useMemo(() => {
    let result = scopedFlows;

    if (selectedRoot !== "all") {
      result = result.filter((flow) => flow.root === selectedRoot);
    }

    return result;
  }, [scopedFlows, selectedRoot]);

  const visibleFlows = useMemo(
    () => filteredFlows.slice(0, visibleCount),
    [filteredFlows, visibleCount]
  );

  const hasMore = filteredFlows.length > visibleCount;
  const totalFlows = filteredFlows.length;
  // Calculate scope-aware ratio (visible flows vs total flows IN SCOPE)
  const visibleRatio = totalFlows > 0 ? Math.round((visibleFlows.length / totalFlows) * 100) : 0;
  const hasVisibleFlows = visibleFlows.length > 0;
  const scopeLabel = selectedSurahId ? ts("surah") + " " + selectedSurahId : ts("global");
  const selectedRootLabel = selectedRoot === "all" ? t("allRoots") + " (" + availableRoots.length + ")" : selectedRoot;
  const maxCount = Math.max(...visibleFlows.map((flow) => flow.count), 1);
  const height = Math.max(420, visibleFlows.length * 56 + 170);

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => prev + LOAD_MORE_COUNT);
  }, []);

  const handleRootChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedRoot(event.target.value);
    setVisibleCount(INITIAL_VISIBLE);
  }, []);

  const sidebarCards = (
    <div className={`viz-left-stack sankey-sidebar-stack ${!isLeftSidebarOpen ? 'collapsed' : ''}`}>

      <div className="viz-left-panel sankey-control-card">
        <div className="sankey-card-head">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: "8px" }}>
            <p className="eyebrow">{t("title")}</p>
            <HelpIcon onClick={() => setShowHelp(true)} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              type="button"
              onClick={resetZoom}
              className="clear-focus"
              style={{ fontSize: "0.75rem", padding: "2px 8px", background: "var(--line)", borderRadius: "4px", border: "none", cursor: "pointer" }}
            >
              {ts("reset")}
            </button>
          </div>
        </div>

        <label className="sankey-field">
          <span className="sankey-label">{t("filterByRoot")}</span>
          <div className="sankey-select-shell">
            <select value={selectedRoot} onChange={handleRootChange} className="sankey-select">
              <option value="all">{t("allRoots")} ({availableRoots.length})</option>
              {availableRoots.slice(0, 300).map((root) => (
                <option key={root} value={root}>
                  {root}
                </option>
              ))}
            </select>
          </div>
        </label>

        <div className="sankey-meta-row">
          <span className="sankey-meta-key">{ts("scope")}</span>
          <span className="sankey-meta-value">{scopeLabel}</span>
        </div>
        <div className="sankey-meta-row">
          <span className="sankey-meta-key">{ts("activeRoot")}</span>
          <span className="sankey-meta-value sankey-meta-arabic">{selectedRootLabel}</span>
        </div>

        <div className="sankey-stats-row">
          <div className="sankey-stat-item">
            <span className="sankey-stat-value">{visibleFlows.length}</span>
            <span className="sankey-stat-key">{ts("shown")}</span>
          </div>
          <div className="sankey-stat-item">
            <span className="sankey-stat-value">{totalFlows}</span>
            <span className="sankey-stat-key">{ts("total")}</span>
          </div>
          <div className="sankey-stat-item">
            <span className="sankey-stat-value">{visibleRatio}%</span>
            <span className="sankey-stat-key">{ts("coverage")}</span>
          </div>
        </div>
      </div>

      <VizExplainerDialog
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        content={{
          title: t("Help.title"),
          description: t("Help.description"),
          sections: [
            { label: t("Help.widthLabel"), text: t("Help.widthText") },
            { label: t("Help.leftRightLabel"), text: t("Help.leftRightText") },
            { label: t("Help.scopeLabel"), text: t("Help.scopeText") },
          ]
        }}
      />
    </div >
  );

  return (
    <section className="sankey-wrapper">
      {isMounted && typeof document !== "undefined" && document.getElementById("viz-sidebar-portal")
        ? createPortal(sidebarCards, document.getElementById("viz-sidebar-portal")!)
        : sidebarCards}

      <div className="sankey-context-bar">
        <span className="sankey-pill">{ts("scope")}: {scopeLabel}</span>
        <span className="sankey-pill">{ts("activeRoot")}: {selectedRootLabel}</span>
        <span className="sankey-pill">
          {ts("showing")} {visibleFlows.length} {ts("of")} {totalFlows} {ts("flows")}
        </span>
      </div>

      <div className="sankey-scroll-area">
        {hasVisibleFlows ? (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_WIDTH} ${height}`}
            className="sankey"
            role="img"
            aria-label="Root to lemma flow chart"
            style={{ cursor: "grab" }}
            onMouseDown={(e) => {
              (e.target as HTMLElement).style.cursor = "grabbing";
            }}
            onMouseUp={(e) => {
              (e.target as HTMLElement).style.cursor = "grab";
            }}
          >
            <defs>
              <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2dd4bf" />
                <stop offset="48%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#f472b6" />
              </linearGradient>
            </defs>

            <g ref={gRef}>
              <rect x={ROOT_COLUMN_X} y="26" width={COLUMN_WIDTH} height={height - 56} rx="20" className="column root-column" />
              <rect x={LEMMA_COLUMN_X} y="26" width={COLUMN_WIDTH} height={height - 56} rx="20" className="column lemma-column" />
              <text x={ROOT_COLUMN_X + COLUMN_WIDTH / 2} y="58" className="column-title">
                {t("rootNode")}
              </text>
              <text x={LEMMA_COLUMN_X + COLUMN_WIDTH / 2} y="58" className="column-title">
                {t("lemmaNode")}
              </text>

              {visibleFlows.map((flow, index) => {
                const y = 106 + index * 56;
                const width = pathWidth(flow.count / maxCount);
                const sampleToken = (flow.tokenIds[0] && tokenById.get(flow.tokenIds[0])?.text) ?? "";
                return (
                  <g key={`${flow.root}-${flow.lemma}`}>
                    <path
                      d={`M ${FLOW_START_X} ${y} C ${FLOW_MID_LEFT} ${y}, ${FLOW_MID_RIGHT} ${y}, ${FLOW_END_X} ${y}`}
                      stroke="url(#flowGrad)"
                      strokeWidth={width}
                      fill="none"
                      strokeLinecap="round"
                      opacity={0.8}
                      onMouseEnter={() => onTokenHover(flow.tokenIds[0] ?? null)}
                      onMouseLeave={() => onTokenHover(null)}
                      onClick={() => {
                        if (flow.tokenIds[0]) onTokenFocus(flow.tokenIds[0]);
                      }}
                      className="flow-path"
                    />
                    <text x={ROOT_COLUMN_X + COLUMN_WIDTH / 2} y={y + 5} className="node-label">
                      {flow.root}
                    </text>
                    <text x={LEMMA_COLUMN_X + 20} y={y + 5} className="node-label lemma-label">
                      {flow.lemma}
                    </text>
                    <text x={540} y={y - 10} className="count-label">
                      {flow.count}
                    </text>
                    <text x={540} y={y + 15} className="flow-token-label">
                      {sampleToken}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        ) : (
          <div className="sankey-empty">
            {selectedRoot !== "all"
              ? t('notFound', { root: selectedRoot, scope: scopeLabel })
              : t('noFlows', { scope: scopeLabel })}
          </div>
        )}
      </div>

      {hasMore && (
        <div className="load-more-container">
          <button type="button" onClick={handleLoadMore} className="load-more-btn">
            {t("showMore")} ({totalFlows - visibleCount} {ts("remaining")})
          </button>
        </div>
      )}

      <style jsx>{`
        .sankey-wrapper {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding-top: calc(var(--header-dock-height, 42px) + 20px);
          background:
            radial-gradient(circle at 12% 18%, rgba(245, 158, 11, 0.12), transparent 34%),
            radial-gradient(circle at 84% 16%, rgba(15, 118, 110, 0.1), transparent 36%),
            linear-gradient(160deg, var(--bg-0), var(--bg-1));
        }

        .sankey-context-bar {
          padding: 0 20px 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .sankey-pill {
          font-size: 0.72rem;
          color: var(--ink-secondary);
          border: 1px solid var(--line);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.65);
          padding: 4px 10px;
        }

        .sankey-scroll-area {
          flex: 1;
          overflow: hidden;
          padding: 8px 0 14px;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .sankey {
          width: 100%;
          height: 100%;
          min-width: 0;
          max-width: none;
        }

        .sankey-empty {
          margin: auto;
          color: var(--ink-muted);
          font-size: 0.95rem;
        }

        .column {
          fill: rgba(255, 255, 255, 0.18);
          stroke: var(--line);
          stroke-width: 1px;
        }

        .column-title {
          text-anchor: middle;
          font-weight: 700;
          fill: var(--ink-secondary);
          font-size: 0.82rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .node-label {
          text-anchor: middle;
          font-family: "Amiri", serif;
          font-size: 1.25rem;
          fill: var(--ink);
          pointer-events: none;
        }

        .lemma-label {
          text-anchor: start;
        }

        .flow-path {
          cursor: pointer;
          transition: opacity 0.2s ease, stroke-width 0.2s ease, filter 0.2s ease;
          filter: drop-shadow(0 0 6px rgba(56, 189, 248, 0.4));
        }

        .flow-path:hover {
          opacity: 1;
          stroke-width: 22px;
          filter: drop-shadow(0 0 9px rgba(34, 211, 238, 0.6));
        }

        .count-label {
          text-anchor: middle;
          font-size: 0.72rem;
          fill: var(--ink-secondary);
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        .flow-token-label {
          text-anchor: middle;
          font-family: "Amiri", serif;
          font-size: 0.84rem;
          fill: var(--ink-muted);
        }

        .load-more-container {
          padding: 0.75rem 1.25rem 0.95rem 320px;
          border-top: 1px solid var(--line);
        }

        .load-more-btn {
          padding: 8px 18px;
          border: 1px solid var(--accent);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.2);
          color: var(--accent);
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
        }

        .load-more-btn:hover {
          background: var(--accent);
          color: #fff;
        }

        .sankey-sidebar-stack .sankey-control-card h3 {
          margin: 4px 0 0;
          font-size: 1.02rem;
        }

        .sankey-control-card {
          display: grid;
          gap: 10px;
          background:
            linear-gradient(160deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.54)),
            radial-gradient(circle at 10% 12%, rgba(15, 118, 110, 0.11), transparent 46%);
        }

        .sankey-card-head {
          display: grid;
          gap: 4px;
        }

        .sankey-field {
          display: grid;
          gap: 6px;
        }

        .sankey-label {
          font-size: 0.72rem;
          letter-spacing: 0.06em;
          color: var(--ink-muted);
          text-transform: uppercase;
          font-weight: 600;
        }

        .sankey-select-shell {
          position: relative;
          border: 1px solid var(--line);
          border-radius: 12px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.13), rgba(255, 255, 255, 0.04));
        }

        .sankey-select-shell::after {
          content: "";
          position: absolute;
          right: 12px;
          top: 50%;
          width: 7px;
          height: 7px;
          border-left: 2px solid var(--ink-muted);
          border-bottom: 2px solid var(--ink-muted);
          transform: translateY(-70%) rotate(-45deg);
          pointer-events: none;
        }

        .sankey-select {
          width: 100%;
          height: 40px;
          border: 0;
          border-radius: 12px;
          padding: 0 34px 0 12px;
          color: var(--ink);
          background: transparent;
          outline: none;
          font-size: 0.85rem;
          font-weight: 550;
          appearance: none;
        }

        .sankey-meta-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          border-top: 1px solid var(--line);
          padding-top: 6px;
          font-size: 0.8rem;
        }

        .sankey-meta-key {
          color: var(--ink-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .sankey-meta-value {
          color: var(--ink-secondary);
          font-weight: 600;
          text-align: right;
        }

        .sankey-meta-arabic {
          font-family: "Amiri", serif;
          font-size: 0.96rem;
        }

        .sankey-stats-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .sankey-stat-item {
          display: grid;
          justify-items: center;
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 7px 6px;
          background: rgba(255, 255, 255, 0.05);
        }

        .sankey-stat-value {
          font-size: 0.92rem;
          font-weight: 700;
        }

        .sankey-stat-key {
          font-size: 0.62rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--ink-muted);
        }

        .sankey-help-card {
          display: grid;
          gap: 8px;
        }

        .sankey-help-title {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--ink-secondary);
        }

        .sankey-help-list {
          margin: 0;
          padding-left: 16px;
          display: grid;
          gap: 6px;
          color: var(--ink-secondary);
          font-size: 0.78rem;
          line-height: 1.35;
        }

        :global([data-theme="dark"]) .sankey-wrapper {
          background:
            radial-gradient(circle at 16% 14%, rgba(249, 115, 22, 0.2), transparent 36%),
            radial-gradient(circle at 82% 18%, rgba(34, 211, 238, 0.16), transparent 40%),
            linear-gradient(165deg, #09090f, #11131c 50%, #0c1018 100%);
        }

        :global([data-theme="dark"]) .sankey-pill {
          background: rgba(16, 16, 24, 0.72);
        }

        :global([data-theme="dark"]) .column {
          fill: rgba(255, 255, 255, 0.05);
          stroke: rgba(255, 255, 255, 0.16);
        }

        :global([data-theme="dark"]) .sankey-control-card {
          background:
            linear-gradient(160deg, rgba(20, 20, 30, 0.94), rgba(14, 14, 22, 0.82)),
            radial-gradient(circle at 10% 12%, rgba(249, 115, 22, 0.14), transparent 46%);
        }

        :global([data-theme="dark"]) .load-more-btn {
          background: rgba(18, 18, 26, 0.72);
        }

        @media (max-width: 1200px) {
          .sankey-context-bar {
            padding-left: 18px;
          }

          .sankey-scroll-area {
            padding-left: 18px;
          }

          .load-more-container {
            padding-left: 18px;
          }
        }
      `}</style>
    </section>
  );
}
