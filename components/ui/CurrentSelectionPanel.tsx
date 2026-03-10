"use client";

import { useMemo, useCallback, useState } from "react";
import { useTranslations } from "next-intl";
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
  const { roots, trackRoot, updateRoot, removeRoot } = useKnowledge();

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
    <aside className={`current-selection-panel ${isCollapsed ? "collapsed" : ""}`} aria-label={t('title')} data-tour-id="current-selection-panel" data-testid="current-selection-panel">
      <button
        className="ui-context-panel-header"
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
          <div className="ui-context-grid">
            <div className="ui-context-row" data-testid="selection-row-view">
              <span className="ui-context-label">{t('labels.view')}</span>
              <span className="ui-context-value">{tViz(`${vizMode}.label`)}</span>
            </div>
            <div className="ui-context-row" data-testid="selection-row-surah">
              <span className="ui-context-label">{t('labels.surah')}</span>
              <span className="ui-context-value">
                <span className="surah-bilingual">
                  <span className="surah-number">{selectedSurahId}.</span>
                  <span className="surah-arabic">{surah?.arabic ?? ""}</span>
                  <span className="surah-english">{surah?.name ?? ""}</span>
                </span>
              </span>
            </div>
            <div className="ui-context-row" data-testid="selection-row-ayah">
              <span className="ui-context-label">{t('labels.ayah')}</span>
              <span className="ui-context-value">{selectedAyah ?? "-"}</span>
            </div>
            <div className="ui-context-row" data-testid="selection-row-root">
              <span className="ui-context-label">{t('labels.root')}</span>
              <span className="ui-context-value arabic-text">
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
                        href={`https://www.dohadictionary.org/dictionary/${encodeURIComponent(selectedRoot)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="dictionary-link dict-badge"
                        title="Doha Historical Dictionary"
                      >
                        معجم الدوحة
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
            <div className="ui-context-row" data-testid="selection-row-lemma">
              <span className="ui-context-label">{t('labels.lemma')}</span>
              <span className="ui-context-value arabic-text">
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
                        href={`https://www.dohadictionary.org/dictionary/${encodeURIComponent(selectedLemma)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="dictionary-link dict-badge"
                        title="Doha Historical Dictionary"
                      >
                        معجم الدوحة
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
            <div className="ui-context-row" data-testid="selection-row-token">
              <span className="ui-context-label">{t('labels.token')}</span>
              <span className="ui-context-value arabic-text">{activeToken?.text ?? "-"}</span>
            </div>
          </div>

          {/* Knowledge Tracking */}
          {selectedRoot && (
            <div className="ui-context-section">
              <p className="eyebrow">{t('knowledge.title')}</p>
              <div className="knowledge-actions">
                <button
                  type="button"
                  className={`knowledge-btn ${trackedEntry?.state === 'learning' ? 'active learning' : trackedEntry?.state === 'learned' ? 'active learned' : ''}`}
                  data-testid="selection-track-toggle"
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
                      data-testid="selection-notes-toggle"
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
                    data-testid="selection-notes-input"
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    placeholder={t('knowledge.notesPlaceholder')}
                    rows={3}
                  />
                  <button
                    type="button"
                    className="knowledge-btn save-btn"
                    data-testid="selection-notes-save"
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
            <div className="ui-context-section ayah-display">
              <p className="eyebrow">{t('ayahTokens')}</p>
              <div className="ayah-scroll-shell">
                <p className="ayah-text-content arabic-text">{ayahTokensText}</p>
              </div>
            </div>
          )}
        </div>
      )}

    </aside>
  );
}
