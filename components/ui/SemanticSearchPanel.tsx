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
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Phase-1 Search</p>
          <h2>SemanticSearchPanel</h2>
        </div>
      </div>

      <div className="search-controls">
        <input value={root} onChange={(e) => setRoot(e.target.value)} placeholder="Root (e.g., هدي)" />
        <input value={lemma} onChange={(e) => setLemma(e.target.value)} placeholder="Lemma (e.g., هُدًى)" />
        <select value={pos} onChange={(e) => setPos(e.target.value as PartOfSpeech | "")}>
          <option value="">All POS</option>
          <option value="N">N</option>
          <option value="V">V</option>
          <option value="P">P</option>
          <option value="ADJ">ADJ</option>
          <option value="PRON">PRON</option>
        </select>
        <input value={ayah} onChange={(e) => setAyah(e.target.value)} placeholder="Ayah (e.g., 1:5)" />
      </div>

      <div className="search-results">
        {results.length === 0 ? (
          <p className="inspector-empty">Set at least one filter to see matching tokens.</p>
        ) : (
          results.slice(0, 24).map((token) => (
            <button
              type="button"
              key={token.id}
              className="result-chip"
              onMouseEnter={() => onTokenHover(token.id)}
              onMouseLeave={() => onTokenHover(null)}
              onClick={() => onTokenFocus(token.id)}
            >
              <span>{token.text}</span>
              <small>
                {token.id} - {token.root}/{token.lemma}
              </small>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
