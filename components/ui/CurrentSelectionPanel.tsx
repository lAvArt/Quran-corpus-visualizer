"use client";

import { useMemo, useCallback } from "react";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";
import type { CorpusToken } from "@/lib/schema/types";
import { SURAH_NAMES } from "@/lib/data/surahData";
import { useKnowledge } from "@/lib/context/KnowledgeContext";

interface CurrentSelectionPanelProps {
  vizMode: VisualizationMode;
  selectedSurahId: number;
  selectedAyah?: number | null;
  selectedRoot?: string | null;
  selectedLemma?: string | null;
  activeToken?: CorpusToken | null;
  allTokens?: CorpusToken[];
}

// Note: modeLabel was removed as translations are now handled by useTranslations
// Note: modeLabel was removed as translations are now handled by useTranslations

import { useTranslations } from "next-intl";
import { useState } from "react"; // Added useState

export default function CurrentSelectionPanel({
  vizMode,
  selectedSurahId,
  selectedAyah,
  selectedRoot,
  selectedLemma,
  activeToken,
  allTokens = [],
}: CurrentSelectionPanelProps) {
  const t = useTranslations('CurrentSelectionPanel');
  const surah = SURAH_NAMES[selectedSurahId];
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [notesInput, setNotesInput] = useState('');
  const [showNotesInput, setShowNotesInput] = useState(false);
  const { roots, trackRoot, updateRoot, removeRoot, isTracked } = useKnowledge();

  const trackedEntry = selectedRoot ? roots.get(selectedRoot) ?? null : null;

  const handleToggleTrack = useCallback(async () => {
    if (!selectedRoot) return;
    if (trackedEntry) {
      const nextState = trackedEntry.state === 'learning' ? 'learned' : 'learning';
      await updateRoot(selectedRoot, { state: nextState });
    } else {
      await trackRoot(selectedRoot);
    }
  }, [selectedRoot, trackedEntry, trackRoot, updateRoot]);

  const handleRemoveTrack = useCallback(async () => {
    if (!selectedRoot) return;
    await removeRoot(selectedRoot);
    setShowNotesInput(false);
    setNotesInput('');
  }, [selectedRoot, removeRoot]);

  const handleSaveNotes = useCallback(async () => {
    if (!selectedRoot) return;
    await updateRoot(selectedRoot, { notes: notesInput });
    setShowNotesInput(false);
  }, [selectedRoot, notesInput, updateRoot]);

  // Map modes to translation keys, or just use the raw key if we added them to messages
  // We added keys to messages/en.json under "VisualizationSwitcher.modes" but also need generic labels here?
  // Let's reuse VisualizationSwitcher.modes keys for the mode name if possible, or add simple mapping.
  // Actually, let's keep it simple and just translate the static labels for now, 
  // and maybe dynamically translate the mode name using the existing VisSwitcher keys.
  const tViz = useTranslations('VisualizationSwitcher.modes');

  const ayahTokensText = useMemo(() => {
    if (!selectedAyah || !selectedSurahId) return null;

    const ayahTokens = allTokens
      .filter((token) => token.sura === selectedSurahId && token.ayah === selectedAyah)
      .sort((a, b) => a.position - b.position)
      .map((token) => token.text.trim())
      .filter(Boolean);

    if (ayahTokens.length === 0) return null;
    return ayahTokens.join(" ");
  }, [allTokens, selectedSurahId, selectedAyah]);

  return (
    <aside className={`current-selection-panel ${isCollapsed ? "collapsed" : ""}`} aria-label={t('title')} data-tour-id="current-selection-panel">
      <button
        className="panel-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-expanded={!isCollapsed}
        aria-controls="current-selection-content"
        type="button"
      >
        <p className="eyebrow panel-title" style={{ margin: 0 }}>{t('title')}</p>
        <div className="panel-toggle-icon" style={{ transition: 'opacity 0.2s', opacity: 0.6 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points={isCollapsed ? "9 18 15 12 9 6" : "15 18 9 12 15 6"}></polyline>
          </svg>
        </div>
      </button>

      {!isCollapsed && (
        <div className="panel-content" id="current-selection-content">
          <div className="selection-grid">
            <div className="selection-row">
              <span className="selection-label">{t('labels.view')}</span>
              <span className="selection-value">{tViz(`${vizMode}.label`)}</span>
            </div>
            <div className="selection-row">
              <span className="selection-label">{t('labels.surah')}</span>
              <span className="selection-value">
                <span className="surah-bilingual">
                  <span className="surah-number">{selectedSurahId}.</span>
                  <span className="surah-arabic">{surah?.arabic ?? ""}</span>
                  <span className="surah-english">{surah?.name ?? ""}</span>
                </span>
              </span>
            </div>
            <div className="selection-row">
              <span className="selection-label">{t('labels.ayah')}</span>
              <span className="selection-value">{selectedAyah ?? "-"}</span>
            </div>
            <div className="selection-row">
              <span className="selection-label">{t('labels.root')}</span>
              <span className="selection-value arabic-text">
                {selectedRoot ? (
                  <span className="dict-word-group">
                    {selectedRoot}
                    <span className="dict-links">
                      <a
                        href={`https://www.almaany.com/ar/dict/ar-ar/${selectedRoot}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="dictionary-link dict-badge"
                        title="Al-Ma'ani Dictionary"
                      >
                        المعاني
                        <svg className="external-link-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                          <polyline points="15 3 21 3 21 9"></polyline>
                          <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                      </a>
                      <a
                        href={`https://www.lesanarab.com/kalima/${encodeURIComponent(selectedRoot)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="dictionary-link dict-badge"
                        title="Lisan al-Arab &amp; Classical Dictionaries (Hawramani)"
                      >
                        لسان العرب
                        <svg className="external-link-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                          <polyline points="15 3 21 3 21 9"></polyline>
                          <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                      </a>
                    </span>
                  </span>
                ) : "-"}
              </span>
            </div>
            <div className="selection-row">
              <span className="selection-label">{t('labels.lemma')}</span>
              <span className="selection-value arabic-text">
                {selectedLemma ? (
                  <span className="dict-word-group">
                    {selectedLemma}
                    <span className="dict-links">
                      <a
                        href={`https://www.almaany.com/ar/dict/ar-ar/${selectedLemma}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="dictionary-link dict-badge"
                        title="Al-Ma'ani Dictionary"
                      >
                        المعاني
                        <svg className="external-link-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                          <polyline points="15 3 21 3 21 9"></polyline>
                          <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                      </a>
                      <a
                        href={`https://www.lesanarab.com/kalima/${encodeURIComponent(selectedLemma)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="dictionary-link dict-badge"
                        title="Lisan al-Arab &amp; Classical Dictionaries (Hawramani)"
                      >
                        لسان العرب
                        <svg className="external-link-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                          <polyline points="15 3 21 3 21 9"></polyline>
                          <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                      </a>
                    </span>
                  </span>
                ) : "-"}
              </span>
            </div>
            <div className="selection-row">
              <span className="selection-label">{t('labels.token')}</span>
              <span className="selection-value arabic-text">{activeToken?.text ?? "-"}</span>
            </div>
          </div>

          {/* Knowledge Tracking */}
          {selectedRoot && (
            <div className="knowledge-section">
              <p className="eyebrow">{t('knowledge.title')}</p>
              <div className="knowledge-actions">
                <button
                  type="button"
                  className={`knowledge-btn ${trackedEntry?.state === 'learning' ? 'active learning' : trackedEntry?.state === 'learned' ? 'active learned' : ''}`}
                  onClick={handleToggleTrack}
                >
                  {!trackedEntry
                    ? t('knowledge.markLearning')
                    : trackedEntry.state === 'learning'
                      ? t('knowledge.markLearned')
                      : t('knowledge.learning')}
                </button>
                {trackedEntry && (
                  <>
                    <button
                      type="button"
                      className="knowledge-btn notes-btn"
                      onClick={() => {
                        setNotesInput(trackedEntry.notes || '');
                        setShowNotesInput(!showNotesInput);
                      }}
                    >
                      {t('knowledge.notes')}
                    </button>
                    <button
                      type="button"
                      className="knowledge-btn remove-btn"
                      onClick={handleRemoveTrack}
                      title={t('knowledge.remove')}
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
              {showNotesInput && trackedEntry && (
                <div className="knowledge-notes">
                  <textarea
                    className="knowledge-notes-input"
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    placeholder={t('knowledge.notesPlaceholder')}
                    rows={3}
                  />
                  <button
                    type="button"
                    className="knowledge-btn save-btn"
                    onClick={handleSaveNotes}
                  >
                    {t('knowledge.save')}
                  </button>
                </div>
              )}
              {trackedEntry?.notes && !showNotesInput && (
                <p className="knowledge-saved-notes">{trackedEntry.notes}</p>
              )}
            </div>
          )}

          {/* Ayah Tokens Display */}
          {ayahTokensText && (
            <div className="ayah-display">
              <p className="eyebrow">{t('ayahTokens')}</p>
              <div className="ayah-scroll-shell">
                <p className="ayah-text-content arabic-text">{ayahTokensText}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .current-selection-panel {
          transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
          will-change: transform;
        }

        .current-selection-panel.collapsed {
          transform: translateX(calc(-100% + 42px));
          overflow: hidden;
        }

        :global(html[dir="rtl"]) .current-selection-panel.collapsed,
        :global(body[dir="rtl"]) .current-selection-panel.collapsed,
        :global([dir="rtl"]) .current-selection-panel.collapsed {
          transform: translateX(calc(100% - 42px)) !important;
        }

        .panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 8px;
            margin-bottom: 4px;
            border: none;
            border-bottom: 1px solid transparent;
            background: transparent;
            width: 100%;
            cursor: pointer;
            font: inherit;
            color: inherit;
            text-align: inherit;
            transition: border-bottom-color 0.2s;
        }

        .panel-header:focus-visible {
            outline: 2px solid var(--accent);
            outline-offset: 2px;
            border-radius: 4px;
        }

        :global(:root[dir="rtl"]) .panel-header {
            flex-direction: row-reverse;
        }

        .current-selection-panel.collapsed .panel-title {
            display: none;
        }

        .current-selection-panel.collapsed .panel-header {
            justify-content: flex-end;
            margin-bottom: 0;
            padding-bottom: 0;
        }

        :global(html[dir="rtl"]) .current-selection-panel.collapsed .panel-header,
        :global(body[dir="rtl"]) .current-selection-panel.collapsed .panel-header,
        :global([dir="rtl"]) .current-selection-panel.collapsed .panel-header {
            justify-content: flex-start;
        }
        
        .panel-header:hover {
            opacity: 0.8;
        }

        .panel-content {
            animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        .surah-bilingual {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          align-items: baseline;
        }

        .surah-number {
          font-weight: 600;
          color: var(--accent);
        }

        .surah-arabic {
          font-family: "Amiri", serif;
          font-size: 0.95rem;
          direction: rtl;
        }

        .surah-english {
          font-size: 0.75rem;
          color: var(--ink-muted);
        }

        .ayah-display {
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid var(--line);
        }

        .ayah-scroll-shell {
          margin-top: 6px;
          border: 1px solid var(--line);
          border-radius: 12px;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04)),
            rgba(0, 0, 0, 0.08);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
          overflow: hidden;
        }

        .ayah-text-content {
          margin: 0;
          padding: 10px 12px 12px;
          font-family: "Amiri", serif;
          font-size: 1.4rem;
          line-height: 1.82;
          direction: rtl;
          text-align: right;
          color: var(--ink);
          max-height: 132px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: color-mix(in srgb, var(--accent), var(--line) 45%) transparent;
        }

        .ayah-text-content::-webkit-scrollbar {
          width: 8px;
        }

        .ayah-text-content::-webkit-scrollbar-track {
          background: transparent;
        }

        .ayah-text-content::-webkit-scrollbar-thumb {
          background: color-mix(in srgb, var(--accent), var(--line) 45%);
          border-radius: 999px;
          border: 2px solid transparent;
          background-clip: content-box;
        }

        .ayah-text-content::-webkit-scrollbar-thumb:hover {
          background: color-mix(in srgb, var(--accent), white 14%);
          background-clip: content-box;
        }

        :global([data-theme="dark"]) .ayah-scroll-shell {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02)),
            rgba(255, 255, 255, 0.02);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
        }

        :global([data-theme="dark"]) .ayah-text-content {
          scrollbar-color: color-mix(in srgb, var(--accent), rgba(255, 255, 255, 0.35) 20%) transparent;
        }

        :global([data-theme="dark"]) .ayah-text-content::-webkit-scrollbar-thumb {
          background: color-mix(in srgb, var(--accent), rgba(255, 255, 255, 0.3) 20%);
          background-clip: content-box;
        }

        .dictionary-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: var(--accent);
          text-decoration: none;
          transition: opacity 0.2s;
        }

        .dictionary-link:hover {
          opacity: 0.8;
          text-decoration: underline;
        }

        .external-link-icon {
          opacity: 0.6;
        }

        .knowledge-section {
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid var(--line);
        }

        .knowledge-actions {
          display: flex;
          gap: 6px;
          margin-top: 6px;
          flex-wrap: wrap;
        }

        .knowledge-btn {
          padding: 5px 10px;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: transparent;
          color: var(--ink-secondary);
          font-size: 0.76rem;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s;
        }

        .knowledge-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
        }

        .knowledge-btn.active.learning {
          border-color: #f59e0b;
          color: #f59e0b;
          background: rgba(245, 158, 11, 0.1);
        }

        .knowledge-btn.active.learned {
          border-color: #22c55e;
          color: #22c55e;
          background: rgba(34, 197, 94, 0.1);
        }

        .knowledge-btn.save-btn {
          border-color: var(--accent);
          color: var(--accent);
        }

        .knowledge-btn.remove-btn {
          border-color: transparent;
          color: var(--ink-muted);
          padding: 5px 7px;
        }

        .knowledge-btn.remove-btn:hover {
          color: #ef4444;
          border-color: #ef4444;
        }

        .knowledge-notes {
          margin-top: 6px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .knowledge-notes-input {
          width: 100%;
          padding: 8px;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: transparent;
          color: var(--ink);
          font-family: inherit;
          font-size: 0.8rem;
          resize: vertical;
          min-height: 48px;
        }

        .knowledge-notes-input:focus {
          outline: 2px solid var(--accent);
          outline-offset: -1px;
        }

        .knowledge-saved-notes {
          margin: 6px 0 0;
          padding: 6px 8px;
          border-radius: 6px;
          background: rgba(0, 0, 0, 0.04);
          font-size: 0.78rem;
          color: var(--ink-secondary);
          line-height: 1.5;
        }

        :global([data-theme="dark"]) .knowledge-saved-notes {
          background: rgba(255, 255, 255, 0.04);
        }
      `}</style>
    </aside>
  );
}
