
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import MorphologyInspector from "@/components/inspectors/MorphologyInspector";
import CommandBar from "@/components/search/CommandBar";
import CorpusIndex from "@/components/ui/CorpusIndex";
import LiveScanner from "@/components/ui/LiveScanner";
import GlossaryChips from "@/components/ui/GlossaryChips";
import type { CorpusToken } from "@/lib/schema/types";
import type { SearchMatchType } from "@/lib/analytics/events";

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
  onSearchOpened?: () => void;
  onSearchQuerySubmitted?: (query: string) => void;
  onSearchResultSelected?: (matchType: SearchMatchType) => void;
}

export default function AppSidebar({
  allTokens,
  inspectorToken,
  inspectorMode,
  onClearFocus,
  onTokenHover,
  onTokenFocus: _onTokenFocus,
  onTokenSelect,
  onRootSelect,
  onSearchRootSelect: _onSearchRootSelect,
  onSelectSurah,
  onLemmaSelect,
  selectedSurahId,
  onSearchOpened,
  onSearchQuerySubmitted,
  onSearchResultSelected,
}: AppSidebarProps) {
  const [activeTab, setActiveTab] = useState<"inspector" | "search" | "index">("inspector");
  const [scannerOpen, setScannerOpen] = useState(false);
  const t = useTranslations('AppSidebar');

  return (
    <aside className="ui-sidebar-shell" aria-label={t('label')} data-tour-id="app-sidebar">
      <div className="ui-sidebar-tabs" role="tablist" aria-label={t('panelLabel')}>
        <button
          className={`ui-sidebar-tab ${activeTab === "inspector" ? "active" : ""}`}
          onClick={() => setActiveTab("inspector")}
          role="tab"
          aria-selected={activeTab === "inspector"}
          aria-controls="sidebar-tabpanel-inspector"
          id="sidebar-tab-inspector"
        >
          {t('inspector')}
        </button>
        <button
          className={`ui-sidebar-tab ${activeTab === "search" ? "active" : ""}`}
          data-testid="sidebar-tab-advanced-search"
          onClick={() => setActiveTab("search")}
          role="tab"
          aria-selected={activeTab === "search"}
          aria-controls="sidebar-tabpanel-search"
          id="sidebar-tab-search"
        >
          {t('search')}
        </button>
        <button
          className={`ui-sidebar-tab ${activeTab === "index" ? "active" : ""}`}
          data-testid="sidebar-tab-index"
          onClick={() => setActiveTab("index")}
          role="tab"
          aria-selected={activeTab === "index"}
          aria-controls="sidebar-tabpanel-index"
          id="sidebar-tab-index"
        >
          {t('index')}
        </button>
      </div>

      <div className="ui-sidebar-glossary">
        <GlossaryChips />
      </div>

      {/* Inspector tab — includes quick search, morphology inspector, and optional scanner toggle */}
      <div className="ui-sidebar-content" role="tabpanel" id="sidebar-tabpanel-inspector" aria-labelledby="sidebar-tab-inspector" style={{ display: activeTab === "inspector" ? undefined : "none" }}>
        <CommandBar
          tokens={allTokens}
          variant="bar"
          analyticsSurface="sidebar"
          onTokenSelect={onTokenSelect}
          onTokenHover={onTokenHover}
          onRootSelect={onRootSelect}
          onSearchOpened={onSearchOpened}
          onSearchQuerySubmitted={onSearchQuerySubmitted}
          onSearchResultSelected={onSearchResultSelected}
        />
        <div className="ui-sidebar-divider" />
        <MorphologyInspector
          token={inspectorToken}
          mode={inspectorMode}
          onClearFocus={onClearFocus}
          allTokens={allTokens}
          onRootSelect={onRootSelect}
          onSelectSurah={onSelectSurah}
        />
        <div className="ui-sidebar-divider" />
        <button
          type="button"
          className="ui-sidebar-scanner-toggle"
          onClick={() => setScannerOpen(!scannerOpen)}
          aria-expanded={scannerOpen}
        >
          {scannerOpen ? t('hideScan') : t('scan')}
        </button>
        {scannerOpen && (
          <LiveScanner
            allTokens={allTokens}
            onTokenSelect={onTokenSelect}
          />
        )}
      </div>

      {/* Search tab — unified GlobalSearch with advanced filters pre-expanded */}
      <div
        className="ui-sidebar-content"
        role="tabpanel"
        id="sidebar-tabpanel-search"
        data-testid="sidebar-panel-advanced-search"
        aria-labelledby="sidebar-tab-search"
        style={{ display: activeTab === "search" ? undefined : "none" }}
      >
        <CommandBar
          tokens={allTokens}
          variant="panel"
          analyticsSurface="sidebar"
          onTokenSelect={onTokenSelect}
          onTokenHover={onTokenHover}
          onRootSelect={onRootSelect}
          onSearchOpened={onSearchOpened}
          onSearchQuerySubmitted={onSearchQuerySubmitted}
          onSearchResultSelected={onSearchResultSelected}
        />
      </div>

      {/* Index tab — browse corpus structure */}
      <div
        className="ui-sidebar-content"
        role="tabpanel"
        id="sidebar-tabpanel-index"
        data-testid="sidebar-panel-index"
        aria-labelledby="sidebar-tab-index"
        style={{ display: activeTab === "index" ? undefined : "none" }}
      >
        <CorpusIndex
          tokens={allTokens}
          onSelectSurah={onSelectSurah || (() => { })}
          onSelectRoot={(root) => onRootSelect?.(root)}
          onSelectLemma={onLemmaSelect || (() => { })}
          selectedSurahId={selectedSurahId}
        />
      </div>

      {/* On mobile the GlobalSearch mobile media-query collapses into a compact icon and uses
          position:absolute overrides that escape the sidebar panel, putting results at the bottom
          of the screen. The overrides below restore full-width, inline behaviour inside the
          sidebar, mirroring what MobileSearchOverlay does for its own context. */}
      <style jsx global>{`
        @media (max-width: 640px) {
          .ui-sidebar-content .global-search {
            position: relative !important;
          }
          .ui-sidebar-content .search-input-wrapper {
            width: auto !important;
            height: auto !important;
            padding: 8px 12px !important;
            background: var(--bg-2) !important;
            border-color: var(--line) !important;
          }
          .ui-sidebar-content .search-input-wrapper:focus-within {
            position: relative !important;
            top: auto !important;
            left: auto !important;
            right: auto !important;
            z-index: auto !important;
          }
          .ui-sidebar-content .search-input {
            display: block !important;
            width: 100% !important;
            opacity: 1 !important;
            pointer-events: auto !important;
          }
          .ui-sidebar-content .search-clear {
            display: block !important;
          }
          .ui-sidebar-content .search-results-dropdown {
            position: static !important;
            margin-top: 6px;
          }
        }
      `}</style>
    </aside>
  );
}
