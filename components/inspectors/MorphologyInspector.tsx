"use client";

import type { CorpusToken } from "@/lib/schema/types";

interface MorphologyInspectorProps {
  token: CorpusToken | null;
  mode: "hover" | "focus" | "idle";
  onClearFocus: () => void;
}

export default function MorphologyInspector({ token, mode, onClearFocus }: MorphologyInspectorProps) {
  if (!token) {
    return (
      <div className="inspector-empty-state">
        <div className="empty-icon">{"\u2191"}</div>
        <p>Hover over a node to see quick details.</p>
        <p>Click a node to lock this view.</p>
        
        <style jsx>{`
        .inspector-empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            text-align: center;
            color: var(--ink-muted);
            padding: 2rem 1rem;
        }
        .empty-icon {
            font-size: 2rem;
            margin-bottom: 1rem;
            opacity: 0.6;
        }
        `}</style>
      </div>
    );
  }

  return (
    <div className="inspector-content">
      <div className="inspector-header">
        <div className="header-top">
           <span className={`status-badge ${mode}`}>
                {mode === "focus" ? "LOCKED" : "PREVIEW"}
            </span>
            {mode === "focus" && (
                <button type="button" onClick={onClearFocus} className="close-btn" aria-label="Clear selection">{"\u00D7"}</button>
            )}
        </div>
        
        <h2 className="token-arabic" lang="ar" dir="rtl">{token.text}</h2>
        <div className="token-id">{token.id}</div>
      </div>

      <div className="inspector-section">
        <h3>Morphology</h3>
        <div className="data-grid">
            <div className="data-item">
                <span className="label">Root</span>
                <span className="value arabic-font" lang="ar">{token.root || "\u2014"}</span>
            </div>
            <div className="data-item">
                <span className="label">Lemma</span>
                <span className="value arabic-font" lang="ar">{token.lemma || "\u2014"}</span>
            </div>
            <div className="data-item">
                <span className="label">Stem</span>
                <span className="value arabic-font" lang="ar">{token.morphology.stem || "\u2014"}</span>
            </div>
            <div className="data-item">
                <span className="label">POS</span>
                <span className="value">{token.pos}</span>
            </div>
        </div>
      </div>

       <div className="inspector-section">
        <h3>Translation</h3>
        <p className="gloss-text">{token.morphology.gloss || "No gloss available"}</p>
      </div>

      {Object.keys(token.morphology.features).length > 0 && (
          <div className="inspector-section">
            <h3>Features</h3>
            <div className="features-list">
              {Object.entries(token.morphology.features).map(([key, value]) => (
                <div key={key} className="feature-tag">
                  <span className="f-key">{key}</span>
                  <span className="f-val">{value}</span>
                </div>
              ))}
            </div>
          </div>
      )}

      <style jsx>{`
        .inspector-content {
            animation: fadeIn 0.2s ease;
        }

        .inspector-header {
            border-bottom: 1px solid var(--line);
            padding-bottom: 1rem;
            margin-bottom: 1rem;
        }

        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.75rem;
        }

        .status-badge {
            font-size: 0.65rem;
            padding: 4px 10px;
            border-radius: 999px;
            font-weight: 600;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            background: rgba(15, 118, 110, 0.12);
            color: var(--accent);
        }

        .status-badge.focus {
            background: var(--accent);
            color: white;
        }

        .status-badge.hover {
            background: rgba(15, 118, 110, 0.12);
            color: var(--accent);
        }

        .close-btn {
            background: var(--bg-2);
            border: 1px solid var(--line);
            width: 28px;
            height: 28px;
            border-radius: 999px;
            font-size: 1.1rem;
            line-height: 1;
            cursor: pointer;
            color: var(--ink);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        }

        .close-btn:hover {
            color: white;
            background: var(--accent);
            border-color: var(--accent);
        }

        .token-arabic {
            font-size: 2.4rem;
            margin: 0.3rem 0 0.4rem;
            line-height: 1.2;
            color: var(--ink);
            font-family: var(--font-arabic, "Amiri"), "Amiri", "Noto Sans Arabic", serif;
        }

        .token-id {
            font-family: "SFMono-Regular", Menlo, Consolas, monospace;
            color: var(--ink-muted);
            font-size: 0.78rem;
        }

        .inspector-section {
            margin-bottom: 1rem;
            padding: 12px;
            border-radius: 12px;
            border: 1px solid var(--line);
            background: rgba(255, 255, 255, 0.6);
        }

        .inspector-section h3 {
            font-size: 0.78rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--ink-muted);
            margin: 0 0 0.8rem 0;
        }

        .data-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
        }

        .data-item {
            background: var(--bg-2);
            border-radius: 10px;
            padding: 8px 10px;
            display: flex;
            flex-direction: column;
            border: 1px solid var(--line);
        }

        .data-item .label {
            font-size: 0.7rem;
            color: var(--ink-muted);
            margin-bottom: 4px;
        }

        .data-item .value {
            font-weight: 600;
            font-size: 1rem;
        }

        .arabic-font {
            font-family: var(--font-arabic, "Amiri"), "Amiri", "Noto Sans Arabic", serif;
            direction: rtl;
        }

        .gloss-text {
            font-style: italic;
            color: var(--ink-secondary);
            margin: 0;
            line-height: 1.4;
        }

        .features-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .feature-tag {
            display: inline-flex;
            gap: 6px;
            border: 1px solid var(--line);
            border-radius: 999px;
            padding: 4px 10px;
            font-size: 0.78rem;
            background: rgba(255, 255, 255, 0.7);
        }

        .f-key {
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-size: 0.65rem;
            color: var(--ink-secondary);
        }

        .f-val {
            font-weight: 600;
        }

        @media (max-width: 520px) {
            .data-grid {
                grid-template-columns: 1fr;
            }
        }

        :global([data-theme="dark"]) .inspector-section {
            background: rgba(16, 16, 24, 0.7);
        }

        :global([data-theme="dark"]) .feature-tag {
            background: rgba(16, 16, 24, 0.7);
        }
      `}</style>
    </div>
  );
}
