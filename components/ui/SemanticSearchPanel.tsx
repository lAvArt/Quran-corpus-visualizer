"use client";

import { useMemo, useState } from "react";
import type { CorpusToken, PartOfSpeech } from "@/lib/schema/types";
import { buildPhaseOneIndexes, queryPhaseOne } from "@/lib/search/indexes";
import { SURAH_NAMES } from "@/lib/data/surahData";
import { useTranslations } from "next-intl";

interface SemanticSearchPanelProps {
  tokens: CorpusToken[];
  onTokenHover: (tokenId: string | null) => void;
  onTokenFocus: (tokenId: string) => void;
  onRootSelect?: (root: string | null) => void;
  onSelectSurah?: (surahId: number) => void;
  scope?: { type: "global" } | { type: "surah"; surahId: number };
}

export default function SemanticSearchPanel({
  tokens,
  onTokenHover,
  onTokenFocus,
  onRootSelect,
  onSelectSurah,
  scope = { type: "global" },
}: SemanticSearchPanelProps) {
  const [root, setRoot] = useState("");
  const [lemma, setLemma] = useState("");
  const [pos, setPos] = useState<PartOfSpeech | "">("");
  const [ayah, setAyah] = useState("");
  const t = useTranslations('SemanticSearchPanel');

  const scopedTokens = useMemo(() => {
    if (scope.type === "surah") {
      return tokens.filter((token) => token.sura === scope.surahId);
    }
    return tokens;
  }, [tokens, scope]);

  const tokenById = useMemo(
    () => new Map(scopedTokens.map((t) => [t.id, t])),
    [scopedTokens]
  );
  const index = useMemo(() => buildPhaseOneIndexes(scopedTokens), [scopedTokens]);

  const normalizedAyahQuery = useMemo(() => {
    if (!ayah) return "";
    if (scope.type === "surah" && !ayah.includes(":")) {
      return `${scope.surahId}:${ayah}`;
    }
    return ayah;
  }, [ayah, scope]);

  const results = useMemo(() => {
    const ids = queryPhaseOne(index, {
      root: root || undefined,
      lemma: lemma || undefined,
      pos: pos || undefined,
      ayah: normalizedAyahQuery || undefined
    });
    return [...ids].map((id) => tokenById.get(id)).filter((token): token is CorpusToken => !!token);
  }, [index, lemma, pos, root, tokenById, normalizedAyahQuery]);

  const scopeLabel = useMemo(() => {
    if (scope.type === "surah") {
      // const info = SURAH_NAMES[scope.surahId];
      // const name = info?.name ? ` · ${info.name}` : "";
      return t('surah', { id: scope.surahId });
    }
    return t('global');
  }, [scope, t]);

  return (
    <div className="search-panel">
      {/* 
      <div className="panel-head">
        <div>
          <p className="eyebrow">Phase-1 Search</p>
          <h2>SemanticSearchPanel</h2>
        </div>
      </div> 
      Removed since Sidebar has tabs
      */}

      <div className="search-controls">
        <input
          value={root}
          onChange={(e) => setRoot(e.target.value)}
          placeholder={t('placeholders.root')}
          className="search-input"
        />
        <input
          value={lemma}
          onChange={(e) => setLemma(e.target.value)}
          placeholder={t('placeholders.lemma')}
          className="search-input"
        />
        <select
          value={pos}
          onChange={(e) => setPos(e.target.value as PartOfSpeech | "")}
          className="search-select"
        >
          <option value="">{t('pos.all')}</option>
          <option value="N">{t('pos.noun')}</option>
          <option value="V">{t('pos.verb')}</option>
          <option value="P">{t('pos.particle')}</option>
          <option value="ADJ">{t('pos.adjective')}</option>
          <option value="PRON">{t('pos.pronoun')}</option>
        </select>
        <input
          value={ayah}
          onChange={(e) => setAyah(e.target.value)}
          placeholder={t('placeholders.ayah')}
          className="search-input"
        />
      </div>

      <div className="results-scope">
        <span>{t('scope')}</span>
        <span className="scope-pill">{scopeLabel}</span>
      </div>

      <div className="results-header">
        <span>{t('found', { count: results.length })}</span>
        <span className="results-sub">{t('clickToFocus')}</span>
      </div>

      <div className="search-results-list">
        {results.length === 0 ? (
          <div className="empty-search">
            <p>{t('empty')}</p>
          </div>
        ) : (
          results.slice(0, 50).map((token) => (
            <button
              type="button"
              key={token.id}
              className="result-item"
              onMouseEnter={() => onTokenHover(token.id)}
              onMouseLeave={() => onTokenHover(null)}
              onClick={() => {
                if (scope.type === "global" && onSelectSurah) {
                  onSelectSurah(token.sura);
                }
                if (root && token.root && onRootSelect) {
                  onRootSelect(token.root);
                }
                onTokenFocus(token.id);
              }}
            >
              <span className="res-arabic" lang="ar" dir="rtl">{token.text}</span>
              <span className="res-meta">
                {token.sura}:{token.ayah} - {token.pos}
              </span>
            </button>
          ))
        )}
      </div>

      <style jsx>{`
        .search-panel {
            display: flex;
            flex-direction: column;
            height: 100%;
        }
        .search-controls {
            display: grid;
            gap: 8px;
            margin-bottom: 16px;
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .search-input, .search-select {
            padding: 9px 12px;
            border: 1px solid var(--line);
            border-radius: 8px;
            background: var(--bg-2);
            color: var(--ink);
            width: 100%;
            font-size: 0.9rem;
        }
        .search-input:focus, .search-select:focus {
            outline: none;
            border-color: var(--accent);
            background: rgba(255, 255, 255, 0.9);
        }
        .results-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.78rem;
            color: var(--ink-muted);
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }
        .results-scope {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 0.72rem;
            color: var(--ink-muted);
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }
        .scope-pill {
            padding: 4px 8px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.65);
            border: 1px solid var(--line);
            color: var(--ink-secondary);
            font-size: 0.7rem;
            text-transform: none;
            letter-spacing: 0.02em;
        }
        .results-sub {
            font-size: 0.72rem;
            color: var(--ink-secondary);
            letter-spacing: 0.04em;
            text-transform: none;
        }
        .search-results-list {
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding-right: 4px; /* Space for scrollbar */
        }
        .result-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            border: 1px solid var(--line);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.65);
            cursor: pointer;
            text-align: left;
            transition: all 0.2s;
        }
        .result-item:hover {
            background: rgba(255, 255, 255, 0.95);
            border-color: var(--accent);
            box-shadow: 0 8px 16px rgba(15, 23, 42, 0.12);
            transform: translateY(-1px);
        }
        .res-arabic {
            font-family: var(--font-arabic, "Amiri"), "Amiri", serif;
            font-size: 1.1rem;
        }
        .res-meta {
            font-size: 0.75rem;
            color: var(--ink-muted);
        }
        .empty-search {
            padding: 2rem;
            text-align: center;
            color: var(--ink-muted);
            font-size: 0.9rem;
            border: 2px dashed var(--line);
            border-radius: 8px;
        }

        @media (max-width: 640px) {
            .search-controls {
                grid-template-columns: 1fr;
            }
        }

        :global([data-theme="dark"]) .search-input,
        :global([data-theme="dark"]) .search-select {
            background: rgba(18, 18, 26, 0.75);
        }

        :global([data-theme="dark"]) .result-item {
            background: rgba(16, 16, 24, 0.65);
        }

        :global([data-theme="dark"]) .result-item:hover {
            background: rgba(20, 20, 28, 0.95);
        }
        :global([data-theme="dark"]) .scope-pill {
            background: rgba(16, 16, 24, 0.8);
        }
      `}</style>
    </div>
  );
}
