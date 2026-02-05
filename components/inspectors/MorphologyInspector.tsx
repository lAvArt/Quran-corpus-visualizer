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
        <div className="empty-icon">👆</div>
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
                opacity: 0.5;
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
                <button onClick={onClearFocus} className="close-btn" aria-label="Clear selection">×</button>
            )}
        </div>
        
        <h2 className="token-arabic" lang="ar">{token.text}</h2>
        <div className="token-id">{token.id}</div>
      </div>

      <div className="inspector-section">
        <h3>Morphology</h3>
        <div className="data-grid">
            <div className="data-item">
                <span className="label">Root</span>
                <span className="value arabic-font" lang="ar">{token.root || "—"}</span>
            </div>
            <div className="data-item">
                <span className="label">Lemma</span>
                <span className="value arabic-font" lang="ar">{token.lemma || "—"}</span>
            </div>
            <div className="data-item">
                <span className="label">Stem</span>
                <span className="value arabic-font" lang="ar">{token.morphology.stem || "—"}</span>
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
            margin-bottom: 0.5rem;
        }

        .status-badge {
            font-size: 0.7rem;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
            letter-spacing: 0.05em;
        }

        .status-badge.focus {
            background: var(--accent);
            color: white;
        }

        .status-badge.hover {
            background: var(--line);
            color: var(--ink-secondary);
        }

        .close-btn {
            background: none;
            border: none;
            font-size: 1.2rem;
            line-height: 1;
            cursor: pointer;
            color: var(--ink-muted);
        }

        .close-btn:hover {
            color: var(--ink);
        }

        .token-arabic {
            font-size: 2.5rem;
            margin: 0.5rem 0;
            line-height: 1.2;
            color: var(--ink);
            font-family: "Amiri", "Noto Sans Arabic", serif;
        }

        .token-id {
            font-family: monospace;
            color: var(--ink-muted);
            font-size: 0.8rem;
        }

        .inspector-section {
            margin-bottom: 1.5rem;
        }

        .inspector-section h3 {
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--ink-muted);
            margin: 0 0 0.8rem 0;
        }

        .data-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
        }

        .data-item {
            background: rgba(0,0,0,0.03);
            border-radius: 8px;
            padding: 8px 12px;
            display: flex;
            flex-direction: column;
        }

        .data-item .label {
            font-size: 0.75rem;
            color: var(--ink-muted);
            margin-bottom: 4px;
        }

        .data-item .value {
            font-weight: 500;
            font-size: 1.1rem;
        }
        
        .arabic-font {
            font-family: "Amiri", "Noto Sans Arabic", serif;
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
            display: flex;
            border: 1px solid var(--line);
            border-radius: 6px;
            overflow: hidden;
            font-size: 0.8rem;
        }

        .f-key {
            background: rgba(0,0,0,0.03);
            padding: 4px 8px;
            border-right: 1px solid var(--line);
            color: var(--ink-secondary);
        }

        .f-val {
            padding: 4px 8px;
            font-weight: 500;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
