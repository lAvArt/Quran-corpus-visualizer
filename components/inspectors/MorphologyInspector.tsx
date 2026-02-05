"use client";

import type { CorpusToken } from "@/lib/schema/types";

interface MorphologyInspectorProps {
  token: CorpusToken | null;
  mode: "hover" | "focus" | "idle";
  onClearFocus: () => void;
}

export default function MorphologyInspector({ token, mode, onClearFocus }: MorphologyInspectorProps) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">MVP Inspector</p>
          <h2>MorphologyInspector</h2>
        </div>
        {mode === "focus" ? (
          <button type="button" className="clear-focus" onClick={onClearFocus}>
            Clear focus
          </button>
        ) : null}
      </div>

      <div className="inspector-body">
        {!token ? (
          <p className="inspector-empty">
            Hover a token to preview morphology, or click a token to pin it while comparing relations.
          </p>
        ) : (
          <>
            <p className="inspector-mode">{mode === "focus" ? "Focused token" : "Hover preview"}</p>
            <h3 className="inspector-token">{token.text}</h3>
            <p className="inspector-meta">
              {token.id} - POS {token.pos}
            </p>
            <div className="inspector-grid">
              <p>
                <span>Root</span>
                {token.root}
              </p>
              <p>
                <span>Lemma</span>
                {token.lemma}
              </p>
              <p>
                <span>Stem</span>
                {token.morphology.stem ?? "n/a"}
              </p>
              <p>
                <span>Gloss</span>
                {token.morphology.gloss ?? "n/a"}
              </p>
            </div>
            <div className="feature-list">
              {Object.entries(token.morphology.features).map(([key, value]) => (
                <p key={key}>
                  <span>{key}</span>
                  {value}
                </p>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
