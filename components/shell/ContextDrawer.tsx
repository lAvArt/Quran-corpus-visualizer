"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import MorphologyInspector from "@/components/inspectors/MorphologyInspector";
import CommandBar from "@/components/search/CommandBar";
import CorpusIndex from "@/components/ui/CorpusIndex";
import LiveScanner from "@/components/ui/LiveScanner";
import GlossaryChips from "@/components/ui/GlossaryChips";
import VizExplainer from "@/components/ui/VizExplainer";
import type { CorpusToken } from "@/lib/schema/types";
import type { SearchMatchType } from "@/lib/analytics/events";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";

export type DrawerTab = "explain" | "inspect" | "search" | "index";

interface ContextDrawerProps {
  isOpen: boolean;
  allTokens: CorpusToken[];
  vizMode: VisualizationMode;
  inspectorToken: CorpusToken | null;
  inspectorMode: "hover" | "focus" | "idle";
  selectedSurahId: number;
  clearFocus: () => void;
  onTokenHover: (id: string | null) => void;
  onTokenSelect: (tokenId: string) => void;
  onRootSelect: (root: string | null) => void;
  onSelectSurah: (surahId: number, preferredView?: "root-network" | "radial-sura") => void;
  onLemmaSelect: (lemma: string) => void;
  onSearchOpened: () => void;
  onSearchQuerySubmitted: (query: string) => void;
  onSearchResultSelected: (matchType: SearchMatchType) => void;
}

/**
 * Auto-switching contextual drawer.
 * Rules: focusedToken → Inspect, search active → Search, default → Explain.
 * Manual override clears on next auto-switch trigger.
 */
export default function ContextDrawer({
  isOpen,
  allTokens,
  vizMode,
  inspectorToken,
  inspectorMode,
  selectedSurahId,
  clearFocus,
  onTokenHover,
  onTokenSelect,
  onRootSelect,
  onSelectSurah,
  onLemmaSelect,
  onSearchOpened,
  onSearchQuerySubmitted,
  onSearchResultSelected,
}: ContextDrawerProps) {
  const t = useTranslations("ContextDrawer");
  const [activeTab, setActiveTab] = useState<DrawerTab>("explain");
  const [manualOverride, setManualOverride] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const prevTokenRef = useRef<CorpusToken | null>(null);

  // Auto-switch logic
  useEffect(() => {
    if (manualOverride) return;

    if (inspectorToken && inspectorToken !== prevTokenRef.current) {
      setActiveTab("inspect");
    } else if (!inspectorToken && activeTab === "inspect") {
      setActiveTab("explain");
    }
    prevTokenRef.current = inspectorToken;
  }, [inspectorToken, manualOverride, activeTab]);

  const handleManualTabChange = useCallback((tab: DrawerTab) => {
    setActiveTab(tab);
    setManualOverride(true);
  }, []);

  // Clear manual override when a genuinely new token arrives
  useEffect(() => {
    if (inspectorToken && inspectorToken !== prevTokenRef.current) {
      setManualOverride(false);
    }
  }, [inspectorToken]);

  const tabs: { id: DrawerTab; labelKey: string }[] = [
    { id: "explain", labelKey: "explain" },
    { id: "inspect", labelKey: "inspect" },
    { id: "search", labelKey: "search" },
    { id: "index", labelKey: "index" },
  ];

  return (
    <aside
      className={`context-drawer ${isOpen ? "open" : ""}`}
      aria-label={t("label")}
      data-tour-id="context-drawer"
    >
      <div className="drawer-tabs" role="tablist" aria-label={t("panelLabel")}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`drawer-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => handleManualTabChange(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`drawer-panel-${tab.id}`}
            id={`drawer-tab-${tab.id}`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      <div className="drawer-glossary">
        <GlossaryChips />
      </div>

      {/* Explain tab */}
      <div
        className="drawer-content"
        role="tabpanel"
        id="drawer-panel-explain"
        aria-labelledby="drawer-tab-explain"
        style={{ display: activeTab === "explain" ? undefined : "none" }}
      >
        <VizExplainer vizMode={vizMode} />
      </div>

      {/* Inspect tab */}
      <div
        className="drawer-content"
        role="tabpanel"
        id="drawer-panel-inspect"
        aria-labelledby="drawer-tab-inspect"
        style={{ display: activeTab === "inspect" ? undefined : "none" }}
      >
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
        <div className="drawer-divider" />
        <button
          type="button"
          className="drawer-scanner-toggle"
          onClick={() => setScannerOpen(!scannerOpen)}
          aria-expanded={scannerOpen}
        >
          {scannerOpen ? t("hideScan") : t("scan")}
        </button>
        {scannerOpen && (
          <LiveScanner allTokens={allTokens} onTokenSelect={onTokenSelect} />
        )}
        <div className="drawer-divider" />
        <MorphologyInspector
          token={inspectorToken}
          mode={inspectorMode}
          onClearFocus={clearFocus}
          allTokens={allTokens}
          onRootSelect={onRootSelect}
          onSelectSurah={onSelectSurah}
        />
      </div>

      {/* Search tab */}
      <div
        className="drawer-content"
        role="tabpanel"
        id="drawer-panel-search"
        aria-labelledby="drawer-tab-search"
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

      {/* Index tab */}
      <div
        className="drawer-content"
        role="tabpanel"
        id="drawer-panel-index"
        aria-labelledby="drawer-tab-index"
        style={{ display: activeTab === "index" ? undefined : "none" }}
      >
        <CorpusIndex
          tokens={allTokens}
          onSelectSurah={onSelectSurah}
          onSelectRoot={(root) => onRootSelect(root)}
          onSelectLemma={onLemmaSelect}
          selectedSurahId={selectedSurahId}
        />
      </div>

      <style jsx>{`
        .context-drawer {
          position: fixed;
          top: var(--header-clearance);
          inset-inline-end: 1rem;
          bottom: calc(var(--footer-height) + 0.5rem);
          width: min(380px, 92vw);
          z-index: 40;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 16px;
          box-shadow: -4px 0 24px rgba(0, 0, 0, 0.1);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          transform: translateX(calc(100% + 2rem));
          transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
          pointer-events: none;
        }

        :global([data-theme="dark"]) .context-drawer {
          background: rgba(22, 22, 30, 0.92);
          border-color: rgba(255, 255, 255, 0.1);
          box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
        }

        :global([dir="rtl"]) .context-drawer {
          transform: translateX(calc(-100% - 2rem));
        }

        .context-drawer.open {
          transform: translateX(0);
          pointer-events: auto;
        }

        .drawer-tabs {
          display: flex;
          border-bottom: 1px solid var(--line);
          flex-shrink: 0;
        }

        .drawer-tab {
          flex: 1;
          padding: 10px 6px;
          background: transparent;
          border: none;
          color: var(--ink-secondary);
          font-family: inherit;
          font-size: 0.78rem;
          cursor: pointer;
          transition: all 0.2s;
          border-bottom: 2px solid transparent;
        }

        .drawer-tab:hover {
          color: var(--ink);
          background: rgba(255, 255, 255, 0.05);
        }

        .drawer-tab.active {
          color: var(--accent);
          border-bottom-color: var(--accent);
          font-weight: 600;
        }

        .drawer-tab:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: -2px;
          border-radius: 4px;
        }

        .drawer-glossary {
          padding: 10px 12px 8px;
          border-bottom: 1px solid var(--line);
          background: color-mix(in srgb, var(--panel), white 4%);
          flex-shrink: 0;
        }

        .drawer-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px 16px calc(16px + var(--footer-height, 48px));
        }

        .drawer-divider {
          height: 1px;
          background: var(--line);
          margin: 16px 0;
        }

        .drawer-scanner-toggle {
          display: block;
          width: 100%;
          padding: 6px 12px;
          font-size: 0.78rem;
          color: var(--ink-muted);
          background: none;
          border: 1px dashed var(--line);
          border-radius: 6px;
          cursor: pointer;
          text-align: center;
          margin-bottom: 8px;
        }

        .drawer-scanner-toggle:hover {
          color: var(--accent);
          border-color: var(--accent);
        }

        @media (max-width: 980px) {
          .context-drawer {
            top: auto;
            bottom: 0;
            inset-inline: 0;
            width: 100%;
            max-height: 65vh;
            border-radius: 16px 16px 0 0;
            transform: translateY(100%);
          }

          :global([dir="rtl"]) .context-drawer {
            transform: translateY(100%);
          }

          .context-drawer.open {
            transform: translateY(0);
          }
        }
      `}</style>
    </aside>
  );
}
