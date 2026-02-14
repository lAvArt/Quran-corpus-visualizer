
"use client";

import { useState } from "react";
import MorphologyInspector from "@/components/inspectors/MorphologyInspector";
import SemanticSearchPanel from "@/components/ui/SemanticSearchPanel";
import CorpusIndex from "@/components/ui/CorpusIndex";
import type { CorpusToken } from "@/lib/schema/types";

interface AppSidebarProps {
  allTokens: CorpusToken[];
  inspectorToken: CorpusToken | null;
  inspectorMode: "hover" | "focus" | "idle";
  onClearFocus: () => void;
  onTokenHover: (id: string | null) => void;
  onTokenFocus: (id: string | null) => void;
  onRootSelect?: (root: string | null) => void;
  onSelectSurah?: (surahId: number) => void;
  onLemmaSelect?: (lemma: string) => void;
  selectedSurahId?: number;
}

export default function AppSidebar({
  allTokens,
  inspectorToken,
  inspectorMode,
  onClearFocus,
  onTokenHover,
  onTokenFocus,
  onRootSelect,
  onSelectSurah,
  onLemmaSelect,
  selectedSurahId,
}: AppSidebarProps) {
  const [activeTab, setActiveTab] = useState<"inspector" | "search" | "index">("inspector");

  return (
    <aside className="app-sidebar">
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${activeTab === "inspector" ? "active" : ""}`}
          onClick={() => setActiveTab("inspector")}
        >
          Inspector
        </button>
        <button
          className={`sidebar-tab ${activeTab === "search" ? "active" : ""}`}
          onClick={() => setActiveTab("search")}
        >
          Search
        </button>
        <button
          className={`sidebar-tab ${activeTab === "index" ? "active" : ""}`}
          onClick={() => setActiveTab("index")}
        >
          Index
        </button>
      </div>

      <div className="sidebar-content">
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
            onRootSelect={onRootSelect}
            onSelectSurah={onSelectSurah}
          />
        )}
        {activeTab === "index" && (
          <CorpusIndex
            tokens={allTokens}
            onSelectSurah={onSelectSurah || (() => {})}
            onSelectRoot={(root) => onRootSelect?.(root)}
            onSelectLemma={onLemmaSelect || (() => {})}
            selectedSurahId={selectedSurahId}
          />
        )}
      </div>

      <style jsx>{`
        .app-sidebar {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: var(--panel);
            border: 1px solid var(--line);
            border-radius: 16px;
            box-shadow: -4px 0 24px rgba(0,0,0,0.1);
            backdrop-filter: blur(20px);
        }

        .sidebar-tabs {
            display: flex;
            border-bottom: 1px solid var(--line);
        }

        .sidebar-tab {
            flex: 1;
            padding: 10px 6px;
            background: transparent;
            border: none;
            color: var(--ink-secondary);
            font-family: inherit;
            font-size: 0.82rem;
            cursor: pointer;
            transition: all 0.2s;
            border-bottom: 2px solid transparent;
        }

        .sidebar-tab:hover {
            color: var(--ink);
            background: rgba(255,255,255,0.05);
        }

        .sidebar-tab.active {
            color: var(--accent);
            border-bottom-color: var(--accent);
            font-weight: 600;
        }

        .sidebar-content {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
        }
      `}</style>
    </aside>
  );
}
