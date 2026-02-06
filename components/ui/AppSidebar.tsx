"use client";

import { useState, useMemo } from "react";
import CorpusIndex from "@/components/ui/CorpusIndex";
import MorphologyInspector from "@/components/inspectors/MorphologyInspector";
import SemanticSearchPanel from "@/components/ui/SemanticSearchPanel";
import type { CorpusToken } from "@/lib/schema/types";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";

interface AppSidebarProps {
  allTokens: CorpusToken[];
  inspectorToken: CorpusToken | null;
  inspectorMode: "hover" | "focus" | "idle";
  onClearFocus: () => void;
  onTokenHover: (id: string | null) => void;
  onTokenFocus: (id: string | null) => void;
  onSelectSurah: (id: number) => void;
  onSelectRoot: (root: string) => void;
  onSelectLemma: (lemma: string) => void;
  selectedSurahId?: number; // Optional since it might not always be relevant
  vizMode: VisualizationMode;
}

export default function AppSidebar({
  allTokens,
  inspectorToken,
  inspectorMode,
  onClearFocus,
  onTokenHover,
  onTokenFocus,
  onSelectSurah,
  onSelectRoot,
  onSelectLemma,
  selectedSurahId,
  vizMode,
}: AppSidebarProps) {
  const [activeTab, setActiveTab] = useState<"inspector" | "search" | "index">("index");
  const searchScope = useMemo(() => {
    const surahScoped = vizMode === "radial-sura" || vizMode === "root-network";
    return surahScoped && selectedSurahId
      ? { type: "surah" as const, surahId: selectedSurahId }
      : { type: "global" as const };
  }, [selectedSurahId, vizMode]);

  return (
    <aside className="app-sidebar">
      <div className="sidebar-tabs">
        <button
          type="button"
          className={`sidebar-tab ${activeTab === "index" ? "active" : ""}`}
          onClick={() => setActiveTab("index")}
        >
          Index
        </button>
        <button
          type="button"
          className={`sidebar-tab ${activeTab === "search" ? "active" : ""}`}
          onClick={() => setActiveTab("search")}
        >
          Search
        </button>
        <button
          type="button"
          className={`sidebar-tab ${activeTab === "inspector" ? "active" : ""}`}
          onClick={() => setActiveTab("inspector")}
        >
          Inspector
        </button>
      </div>

      <div className="sidebar-content">
        {activeTab === "index" && (
          <CorpusIndex
            tokens={allTokens}
            selectedSurahId={selectedSurahId} // Pass prop
            onSelectSurah={onSelectSurah}
            onSelectRoot={onSelectRoot}
            onSelectLemma={onSelectLemma}
          />
        )}
        {activeTab === "inspector" && (
          <MorphologyInspector
            token={inspectorToken}
            mode={inspectorMode}
            onClearFocus={onClearFocus}
          />
        )}
        {activeTab === "search" && (
          <SemanticSearchPanel
            tokens={allTokens}
            onTokenHover={onTokenHover}
            onTokenFocus={onTokenFocus}
            onSelectSurah={onSelectSurah}
            scope={searchScope}
          />
        )}
      </div>

      <div className="sidebar-footer">
        <span className="data-attribution">
          Morphology source:{" "}
          <a href="https://corpus.quran.com" target="_blank" rel="noreferrer">
            Quranic Arabic Corpus
          </a>
        </span>
      </div>

      <style jsx>{`
        .app-sidebar {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: linear-gradient(160deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.6));
            border: 1px solid var(--line);
            border-radius: 20px;
            box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
            backdrop-filter: blur(18px);
        }

        .sidebar-tabs {
            display: flex;
            gap: 6px;
            margin: 12px;
            padding: 6px;
            border-radius: 14px;
            border: 1px solid var(--line);
            background: rgba(255, 255, 255, 0.65);
        }

        .sidebar-tab {
            flex: 1;
            padding: 10px 12px;
            background: transparent;
            border: none;
            color: var(--ink-secondary);
            font-family: inherit;
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            border-radius: 10px;
        }

        .sidebar-tab:hover {
            color: var(--ink);
            background: rgba(255, 255, 255, 0.7);
        }

        .sidebar-tab.active {
            color: white;
            background: var(--accent);
            box-shadow: 0 10px 18px var(--accent-glow);
        }

        .sidebar-content {
            flex: 1;
            overflow-y: auto;
            padding: 4px 16px 16px;
        }

        .sidebar-footer {
            padding: 10px 16px 14px;
            border-top: 1px solid var(--line);
            font-size: 0.72rem;
            color: var(--ink-muted);
        }

        .data-attribution a {
            color: var(--accent);
            text-decoration: none;
        }

        .data-attribution a:hover {
            text-decoration: underline;
        }

        :global([data-theme="dark"]) .app-sidebar {
            background: linear-gradient(160deg, rgba(17, 17, 24, 0.88), rgba(12, 12, 18, 0.75));
            box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
        }

        :global([data-theme="dark"]) .sidebar-tabs {
            background: rgba(16, 16, 24, 0.7);
        }
      `}</style>
    </aside>
  );
}
