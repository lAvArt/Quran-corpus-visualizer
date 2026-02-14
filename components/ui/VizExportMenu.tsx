"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import { useTranslations } from "next-intl";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";
import { exportVisualization, type ExportFormat, type ExportScope } from "@/lib/export/visualizationExport";

interface VizExportMenuProps {
  targetRef: RefObject<HTMLElement | null>;
  vizMode: VisualizationMode;
  selectedSurahId: number;
}

const EXPORT_FORMATS: ExportFormat[] = ["svg", "png", "jpeg", "pdf"];
const EXPORT_SCOPES: ExportScope[] = ["full-graph", "current-view"];
const SCOPE_LABEL_KEY: Record<ExportScope, "fullGraph" | "currentView"> = {
  "full-graph": "fullGraph",
  "current-view": "currentView",
};

function timestampForFileName(): string {
  return new Date().toISOString().replace(/\..+$/, "").replace(/[:T]/g, "-");
}

function fileBaseName(vizMode: VisualizationMode, selectedSurahId: number, scope: ExportScope): string {
  const mode = vizMode.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  const scopeSuffix = scope === "full-graph" ? "full" : "view";
  return `quran-corpus-${mode}-${scopeSuffix}-surah-${selectedSurahId}-${timestampForFileName()}`;
}

export default function VizExportMenu({ targetRef, vizMode, selectedSurahId }: VizExportMenuProps) {
  const t = useTranslations("VizExport");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isExporting, setIsExporting] = useState<ExportFormat | null>(null);
  const [exportScope, setExportScope] = useState<ExportScope>("full-graph");
  const [status, setStatus] = useState<string | null>(null);
  const dropdownId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const statusTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isExpanded) return;

    const closeIfOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsExpanded(false);
      }
    };

    document.addEventListener("mousedown", closeIfOutside);
    document.addEventListener("touchstart", closeIfOutside, { passive: true });
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeIfOutside);
      document.removeEventListener("touchstart", closeIfOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isExpanded]);

  useEffect(
    () => () => {
      if (statusTimerRef.current) {
        window.clearTimeout(statusTimerRef.current);
      }
    },
    []
  );

  const clearStatusLater = useCallback(() => {
    if (statusTimerRef.current) {
      window.clearTimeout(statusTimerRef.current);
    }
    statusTimerRef.current = window.setTimeout(() => {
      setStatus(null);
    }, 2800);
  }, []);

  const onExport = useCallback(
    async (format: ExportFormat) => {
      const target = targetRef.current;
      if (!target) {
        setStatus(t("status.noTarget"));
        clearStatusLater();
        setIsExpanded(false);
        return;
      }

      setIsExporting(format);
      try {
        await exportVisualization({
          container: target,
          format,
          scope: exportScope,
          fileBaseName: fileBaseName(vizMode, selectedSurahId, exportScope),
          scale: format === "pdf" ? 2.4 : 2,
        });
        setStatus(t("status.success", { format: t(`formats.${format}`) }));
      } catch {
        setStatus(t("status.failed"));
      } finally {
        setIsExpanded(false);
        setIsExporting(null);
        clearStatusLater();
      }
    },
    [targetRef, t, clearStatusLater, vizMode, selectedSurahId, exportScope]
  );

  const triggerLabel = useMemo(() => {
    if (!isExporting) return t("button");
    return t("exporting");
  }, [isExporting, t]);

  return (
    <div className="viz-export" ref={containerRef}>
      <button
        type="button"
        className={`viz-export-trigger ${isExpanded ? "expanded" : ""}`}
        aria-expanded={isExpanded}
        aria-controls={dropdownId}
        aria-label={t("menuLabel")}
        onClick={() => setIsExpanded((prev) => !prev)}
        disabled={isExporting !== null}
      >
        <span className="label">{triggerLabel}</span>
        <span className={`arrow ${isExpanded ? "expanded" : ""}`}>{"\u25BE"}</span>
      </button>

      {isExpanded && (
        <div className="viz-export-menu" id={dropdownId} role="menu" aria-label={t("menuLabel")}>
          <div className="viz-export-scope" role="group" aria-label={t("scopeLabel")}>
            {EXPORT_SCOPES.map((scope) => (
              <button
                key={scope}
                type="button"
                className={`viz-export-scope-item ${exportScope === scope ? "active" : ""}`}
                onClick={() => setExportScope(scope)}
                disabled={isExporting !== null}
              >
                {t(`scopes.${SCOPE_LABEL_KEY[scope]}`)}
              </button>
            ))}
          </div>

          {EXPORT_FORMATS.map((format) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              className="viz-export-item"
              onClick={() => onExport(format)}
              disabled={isExporting !== null}
            >
              {t(`formats.${format}`)}
            </button>
          ))}
        </div>
      )}

      <div className="viz-export-status" aria-live="polite">
        {status}
      </div>

      <style jsx>{`
        .viz-export {
          position: relative;
          min-width: 118px;
        }

        .viz-export-trigger {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-width: 100%;
          height: 40px;
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 0 12px;
          font-family: inherit;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--ink);
          background: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          transition: border-color 0.2s ease, transform 0.2s ease;
        }

        .viz-export-trigger:hover:not(:disabled) {
          border-color: var(--accent);
          transform: translateY(-1px);
        }

        .viz-export-trigger:disabled {
          opacity: 0.7;
          cursor: progress;
        }

        .viz-export-trigger:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }

        .arrow {
          font-size: 0.8rem;
          opacity: 0.55;
          transition: transform 0.2s ease;
        }

        .arrow.expanded {
          transform: rotate(180deg);
        }

        .viz-export-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          z-index: 60;
          min-width: 180px;
          padding: 8px;
          display: grid;
          gap: 4px;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(14px);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.16);
        }

        .viz-export-scope {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          margin-bottom: 2px;
        }

        .viz-export-scope-item {
          border: 1px solid var(--line);
          border-radius: 9px;
          padding: 7px 8px;
          text-align: center;
          background: transparent;
          color: var(--ink-secondary);
          font-family: inherit;
          font-size: 0.72rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
        }

        .viz-export-scope-item:hover:not(:disabled) {
          border-color: var(--accent);
          color: var(--ink);
        }

        .viz-export-scope-item.active {
          border-color: color-mix(in srgb, var(--accent), transparent 20%);
          background: color-mix(in srgb, var(--accent), transparent 86%);
          color: var(--ink);
        }

        .viz-export-item {
          border: 1px solid transparent;
          border-radius: 9px;
          padding: 8px 10px;
          text-align: left;
          background: transparent;
          color: var(--ink);
          font-family: inherit;
          font-size: 0.78rem;
          cursor: pointer;
          transition: background 0.18s ease;
        }

        .viz-export-item:hover:not(:disabled) {
          background: rgba(15, 118, 110, 0.11);
        }

        .viz-export-item:disabled {
          opacity: 0.65;
          cursor: progress;
        }

        .viz-export-status {
          position: absolute;
          top: calc(100% + 54px);
          right: 0;
          font-size: 0.7rem;
          color: var(--ink-secondary);
          min-height: 1em;
          white-space: nowrap;
        }

        :global([data-theme="dark"]) .viz-export-trigger {
          background: rgba(18, 18, 26, 0.75);
        }

        :global([data-theme="dark"]) .viz-export-menu {
          background: rgba(18, 18, 26, 0.94);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
        }

        @media (max-width: 900px) {
          .viz-export {
            min-width: 0;
          }

          .viz-export-trigger {
            height: 38px;
            min-width: 90px;
            padding: 0 10px;
          }

          .viz-export-menu {
            right: auto;
            left: 0;
          }

          .viz-export-status {
            left: 0;
            right: auto;
          }
        }
      `}</style>
    </div>
  );
}
