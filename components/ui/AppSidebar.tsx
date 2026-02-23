
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import MorphologyInspector from "@/components/inspectors/MorphologyInspector";
import SemanticSearchPanel from "@/components/ui/SemanticSearchPanel";
import GlobalSearch from "@/components/ui/GlobalSearch";
import CorpusIndex from "@/components/ui/CorpusIndex";
import LiveScanner from "@/components/ui/LiveScanner";
import type { CorpusToken } from "@/lib/schema/types";

interface AppSidebarProps {
  allTokens: CorpusToken[];
  inspectorToken: CorpusToken | null;
  inspectorMode: "hover" | "focus" | "idle";
  onClearFocus: () => void;
  onTokenHover: (id: string | null) => void;
  onTokenFocus: (id: string | null) => void;
  onTokenSelect: (tokenId: string) => void;
  onRootSelect?: (root: string | null) => void;
  onSearchRootSelect?: (root: string | null) => void;
  onSelectSurah?: (surahId: number, preferredView?: "root-network" | "radial-sura") => void;
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
  onTokenSelect,
  onRootSelect,
  onSearchRootSelect,
  onSelectSurah,
  onLemmaSelect,
  selectedSurahId,
}: AppSidebarProps) {
  const [activeTab, setActiveTab] = useState<"inspector" | "scan" | "advanced-search" | "index">("inspector");
  const t = useTranslations('AppSidebar');

  return (
    <aside className="app-sidebar" aria-label={t('label')} data-tour-id="app-sidebar">
      <div className="sidebar-tabs" role="tablist" aria-label={t('panelLabel')}>
        <button
          className={`sidebar-tab ${activeTab === "inspector" ? "active" : ""}`}
          onClick={() => setActiveTab("inspector")}
          role="tab"
          aria-selected={activeTab === "inspector"}
          aria-controls="sidebar-tabpanel-inspector"
          id="sidebar-tab-inspector"
        >
          {t('inspector')}
        </button>
        <button
          className={`sidebar-tab ${activeTab === "scan" ? "active" : ""}`}
          onClick={() => setActiveTab("scan")}
          role="tab"
          aria-selected={activeTab === "scan"}
          aria-controls="sidebar-tabpanel-scan"
          id="sidebar-tab-scan"
        >
          {t('scan')}
        </button>
        <button
          className={`sidebar-tab ${activeTab === "advanced-search" ? "active" : ""}`}
          onClick={() => setActiveTab("advanced-search")}
          role="tab"
          aria-selected={activeTab === "advanced-search"}
          aria-controls="sidebar-tabpanel-advanced-search"
          id="sidebar-tab-advanced-search"
        >
          {t('advancedSearch')}
        </button>
        <button
          className={`sidebar-tab ${activeTab === "index" ? "active" : ""}`}
          onClick={() => setActiveTab("index")}
          role="tab"
          aria-selected={activeTab === "index"}
          aria-controls="sidebar-tabpanel-index"
          id="sidebar-tab-index"
        >
          {t('index')}
        </button>
      </div>

      <div className="sidebar-content" role="tabpanel" id="sidebar-tabpanel-inspector" aria-labelledby="sidebar-tab-inspector" style={{ display: activeTab === "inspector" ? undefined : "none" }}>
        <GlobalSearch
          tokens={allTokens}
          onTokenSelect={onTokenSelect}
          onTokenHover={onTokenHover}
          onRootSelect={onRootSelect}
        />
        <div className="inspector-search-divider" />
        <MorphologyInspector
          token={inspectorToken}
          mode={inspectorMode}
          onClearFocus={onClearFocus}
          allTokens={allTokens}
          onRootSelect={onRootSelect}
          onSelectSurah={onSelectSurah}
        />
      </div>

      <div className="sidebar-content" role="tabpanel" id="sidebar-tabpanel-scan" aria-labelledby="sidebar-tab-scan" style={{ display: activeTab === "scan" ? undefined : "none" }}>
        {activeTab === "scan" && (
          <LiveScanner
            allTokens={allTokens}
            onTokenSelect={onTokenSelect}
          />
        )}
      </div>

      <div className="sidebar-content" role="tabpanel" id="sidebar-tabpanel-advanced-search" aria-labelledby="sidebar-tab-advanced-search" style={{ display: activeTab === "advanced-search" ? undefined : "none" }}>
        <SemanticSearchPanel
          tokens={allTokens}
          onTokenHover={onTokenHover}
          onTokenFocus={onTokenFocus}
          onRootSelect={onSearchRootSelect || onRootSelect}
          onSelectSurah={onSelectSurah}
        />
      </div>

      <div className="sidebar-content" role="tabpanel" id="sidebar-tabpanel-index" aria-labelledby="sidebar-tab-index" style={{ display: activeTab === "index" ? undefined : "none" }}>
        <CorpusIndex
          tokens={allTokens}
          onSelectSurah={onSelectSurah || (() => { })}
          onSelectRoot={(root) => onRootSelect?.(root)}
          onSelectLemma={onLemmaSelect || (() => { })}
          selectedSurahId={selectedSurahId}
        />
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

        .sidebar-tab:focus-visible {
            outline: 2px solid var(--accent);
            outline-offset: -2px;
            border-radius: 4px;
        }

        .sidebar-content {
            flex: 1;
            overflow-y: auto;
            padding: 16px 16px calc(16px + var(--footer-height, 48px));
        }

        .inspector-search-divider {
            height: 1px;
            background: var(--line);
            margin: 16px 0;
        }
      `}</style>
    </aside>
  );
}
