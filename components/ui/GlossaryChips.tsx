"use client";

import { useTranslations } from "next-intl";
import { trackHelpOpened } from "@/lib/analytics/events";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";

const GLOSSARY_TERMS = ["root", "lemma", "pos", "collocation"] as const;

interface GlossaryChipsProps {
  vizMode?: VisualizationMode;
}

export default function GlossaryChips({ vizMode }: GlossaryChipsProps) {
  const t = useTranslations("Glossary");

  return (
    <div className="glossary-chips" aria-label={t("label")}>
      {GLOSSARY_TERMS.map((term) => {
        const tooltipId = `glossary-tip-${term}`;
        return (
          <span className="glossary-chip-wrap" key={term}>
            <button
              type="button"
              className="glossary-chip"
              aria-describedby={tooltipId}
              onClick={() => trackHelpOpened(vizMode ?? "unknown")}
              onFocus={() => trackHelpOpened(vizMode ?? "unknown")}
            >
              {t(`terms.${term}.label`)}
            </button>
            <span id={tooltipId} role="tooltip" className="glossary-tooltip">
              {t(`terms.${term}.description`)}
            </span>
          </span>
        );
      })}

      <style jsx>{`
        .glossary-chips {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
        }

        .glossary-chip-wrap {
          position: relative;
          display: inline-flex;
        }

        .glossary-chip {
          border: 1px solid var(--line);
          border-radius: 999px;
          background: transparent;
          color: var(--ink-secondary);
          font-size: 0.72rem;
          padding: 4px 8px;
          cursor: help;
        }

        .glossary-chip:hover,
        .glossary-chip:focus-visible {
          color: var(--ink);
          border-color: var(--accent);
          outline: none;
        }

        .glossary-tooltip {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          min-width: 180px;
          max-width: 250px;
          padding: 7px 9px;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: color-mix(in srgb, var(--bg-0), white 8%);
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
          color: var(--ink-secondary);
          font-size: 0.72rem;
          line-height: 1.4;
          opacity: 0;
          transform: translateY(-2px);
          pointer-events: none;
          transition: opacity 0.15s ease, transform 0.15s ease;
          z-index: 120;
        }

        .glossary-chip-wrap:hover .glossary-tooltip,
        .glossary-chip:focus-visible + .glossary-tooltip {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}
