"use client";

import { useMemo, useState } from "react";
import type { CorpusToken, PartOfSpeech } from "@/lib/schema/types";
import { buildPhaseOneIndexes, queryPhaseOne } from "@/lib/search/indexes";

interface SemanticSearchPanelProps {
  tokens: CorpusToken[];
  onTokenHover: (tokenId: string | null) => void;
  onTokenFocus: (tokenId: string) => void;
}

export default function SemanticSearchPanel({ tokens, onTokenHover, onTokenFocus }: SemanticSearchPanelProps) {
  const [root, setRoot] = useState("");
  const [lemma, setLemma] = useState("");
  const [pos, setPos] = useState<PartOfSpeech | "">("");
  const [ayah, setAyah] = useState("");

  const tokenById = useMemo(() => new Map(tokens.map((t) => [t.id, t])), [tokens]);
  const index = useMemo(() => buildPhaseOneIndexes(tokens), [tokens]);

  const results = useMemo(() => {
    const ids = queryPhaseOne(index, {
      root: root || undefined,
      lemma: lemma || undefined,
      pos: pos || undefined,
      ayah: ayah || undefined
    });
    return [...ids].map((id) => tokenById.get(id)).filter((token): token is CorpusToken => !!token);
  }, [ayah, index, lemma, pos, root, tokenById]);

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
        <input value={root} onChange={(e) => setRoot(e.target.value)} placeholder="Root (e.g., هدي)" className="search-input"/>
        <input value={lemma} onChange={(e) => setLemma(e.target.value)} placeholder="Lemma (e.g., هُدًى)" className="search-input"/>
        <select value={pos} onChange={(e) => setPos(e.target.value as PartOfSpeech | "")} className="search-select">
          <option value="">All POS</option>
          <option value="N">Noun (N)</option>
          <option value="V">Verb (V)</option>
          <option value="P">Particle (P)</option>
          <option value="ADJ">Adjective</option>
          <option value="PRON">Pronoun</option>
        </select>
        <input value={ayah} onChange={(e) => setAyah(e.target.value)} placeholder="Ayah (e.g., 1:5)" className="search-input"/>
      </div>

      <div className="results-header">
        Found {results.length} tokens
      </div>

      <div className="search-results-list">
        {results.length === 0 ? (
          <div className="empty-search">
            <p>Enter criteria to find tokens.</p>
          </div>
        ) : (
          results.slice(0, 50).map((token) => (
            <button
              type="button"
              key={token.id}
              className="result-item"
              onMouseEnter={() => onTokenHover(token.id)}
              onMouseLeave={() => onTokenHover(null)}
              onClick={() => onTokenFocus(token.id)}
            >
              <span className="res-arabic" lang="ar">{token.text}</span>
              <span className="res-meta">
                 {token.sura}:{token.ayah} • {token.pos}
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
        }
        .search-input, .search-select {
            padding: 8px 12px;
            border: 1px solid var(--line);
            border-radius: 8px;
            background: rgba(255,255,255,0.5);
            width: 100%;
            font-size: 0.9rem;
        }
        .search-input:focus, .search-select:focus {
            outline: none;
            border-color: var(--accent);
            background: white;
        }
        .results-header {
            font-size: 0.8rem;
            color: var(--ink-muted);
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
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
            border: 1px solid transparent;
            border-radius: 6px;
            background: rgba(0,0,0,0.02);
            cursor: pointer;
            text-align: left;
            transition: all 0.2s;
        }
        .result-item:hover {
            background: white;
            border-color: var(--line);
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .res-arabic {
            font-family: "Amiri", serif;
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
      `}</style>
    </div>
  );
}
