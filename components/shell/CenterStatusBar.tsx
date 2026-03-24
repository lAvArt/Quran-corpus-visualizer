"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";

type BreadcrumbLevel = "quran" | "surah" | "ayah" | "root";

interface CenterStatusBarProps {
  /* Corpus loading state */
  dataStatus: string;
  isLoadingCorpus: boolean;
  loadingProgress: { currentSura: number; totalSuras: number } | null;
  /* Breadcrumb state */
  isHierarchical: boolean;
  vizModeLabel: string;
  surahId: number;
  surahName: string;
  ayah: number | null;
  root: string | null;
  onNavigate: (level: BreadcrumbLevel) => void;
}

export default function CenterStatusBar({
  dataStatus,
  isLoadingCorpus,
  loadingProgress,
  isHierarchical,
  vizModeLabel,
  surahId,
  surahName,
  ayah,
  root,
  onNavigate,
}: CenterStatusBarProps) {
  const t = useTranslations("Index");
  const tNav = useTranslations("Index.navigation");
  const [isExpanded, setIsExpanded] = useState(false);

  const toggle = useCallback(() => setIsExpanded((p) => !p), []);

  const progressPct = loadingProgress
    ? Math.round((loadingProgress.currentSura / loadingProgress.totalSuras) * 100)
    : 28;

  /* ── Breadcrumb segments ── */
  const breadcrumbSegments = isHierarchical
    ? [
        { label: tNav("quran"), level: "quran" as BreadcrumbLevel },
        { label: tNav("surahWithName", { id: surahId, name: surahName }), level: "surah" as BreadcrumbLevel },
        ...(ayah ? [{ label: tNav("ayahValue", { ayah }), level: "ayah" as BreadcrumbLevel }] : []),
        ...(root ? [{ label: tNav("rootValue", { root }), level: "root" as BreadcrumbLevel }] : []),
      ]
    : [
        { label: vizModeLabel, level: "quran" as BreadcrumbLevel },
        { label: tNav("surahValue", { id: surahId }), level: "surah" as BreadcrumbLevel },
        ...(root ? [{ label: tNav("rootValue", { root }), level: "root" as BreadcrumbLevel }] : []),
      ];

  return (
    <div className="center-status-bar" data-loading={isLoadingCorpus || undefined}>
      {/* ── Primary row: clickable to toggle drawer ── */}
      <button type="button" className="csb-primary" onClick={toggle} aria-expanded={isExpanded}>
        {isLoadingCorpus ? (
          <>
            <span className="csb-loading-label">
              <strong>{t(`dataStatus.${dataStatus}.title`)}</strong>
              <span>{t("overlay.loadingText")}</span>
            </span>
            <div className="csb-progress-track">
              <div className="csb-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </>
        ) : (
          <nav className="csb-breadcrumbs" aria-label={tNav("breadcrumbsLabel")}>
            {breadcrumbSegments.map((seg, i) => (
              <span key={seg.level}>
                {i > 0 && <span className="csb-sep">/</span>}
                <span
                  className="csb-crumb"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); onNavigate(seg.level); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onNavigate(seg.level); } }}
                >
                  {seg.label}
                </span>
              </span>
            ))}
          </nav>
        )}
        <svg className={`csb-chevron ${isExpanded ? "open" : ""}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* ── Expandable drawer ── */}
      {isExpanded && (
        <div className="csb-drawer">
          {/* Always show status when expanded */}
          <div className="csb-drawer-status" data-status={dataStatus}>
            <strong>{t(`dataStatus.${dataStatus}.title`)}</strong>
            <span>{t(`dataStatus.${dataStatus}.description`)}</span>
            {isLoadingCorpus && (
              <div className="csb-drawer-progress">
                <div className="csb-drawer-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            )}
          </div>
          {/* Always show breadcrumbs when expanded */}
          {isLoadingCorpus && (
            <nav className="csb-drawer-breadcrumbs" aria-label={tNav("breadcrumbsLabel")}>
              {breadcrumbSegments.map((seg, i) => (
                <span key={seg.level}>
                  {i > 0 && <span className="csb-sep">/</span>}
                  <span
                    className="csb-crumb"
                    role="button"
                    tabIndex={0}
                    onClick={() => onNavigate(seg.level)}
                    onKeyDown={(e) => { if (e.key === "Enter") onNavigate(seg.level); }}
                  >
                    {seg.label}
                  </span>
                </span>
              ))}
            </nav>
          )}
        </div>
      )}

      <style jsx>{`
        .center-status-bar {
          flex: 1 1 0;
          min-width: 0;
          max-width: 520px;
          position: relative;
        }

        .csb-primary {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 5px 12px;
          border: 1px solid var(--line);
          border-radius: 999px;
          background: rgba(8, 10, 16, 0.55);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          color: var(--ink-secondary);
          font-size: 0.73rem;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          text-align: start;
          white-space: nowrap;
          overflow: hidden;
        }

        .csb-primary:hover {
          border-color: rgba(255, 255, 255, 0.18);
          background: rgba(8, 10, 16, 0.7);
        }

        :global([data-theme="light"]) .csb-primary {
          background: rgba(255, 255, 255, 0.75);
        }
        :global([data-theme="light"]) .csb-primary:hover {
          background: rgba(255, 255, 255, 0.9);
        }

        /* ── Loading state in primary row ── */
        .csb-loading-label {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
          overflow: hidden;
        }
        .csb-loading-label strong {
          color: var(--ink);
          font-weight: 700;
          flex: 0 0 auto;
        }
        .csb-loading-label span {
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .csb-progress-track {
          flex: 1 1 60px;
          height: 3px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.1);
          overflow: hidden;
        }
        :global([data-theme="light"]) .csb-progress-track {
          background: rgba(0, 0, 0, 0.08);
        }
        .csb-progress-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 2px;
          transition: width 0.3s ease;
        }

        /* ── Breadcrumbs in primary row ── */
        .csb-breadcrumbs {
          display: flex;
          align-items: center;
          gap: 4px;
          min-width: 0;
          overflow: hidden;
          flex: 1;
        }

        .csb-sep {
          color: var(--ink-muted);
          flex: 0 0 auto;
          padding: 0 2px;
        }

        .csb-crumb {
          color: var(--ink-secondary);
          cursor: pointer;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          padding: 0;
        }

        .csb-crumb:hover,
        .csb-crumb:focus-visible {
          color: var(--ink);
          outline: none;
        }

        /* ── Chevron ── */
        .csb-chevron {
          flex: 0 0 auto;
          color: var(--ink-muted);
          transition: transform 0.2s;
        }
        .csb-chevron.open {
          transform: rotate(180deg);
        }

        /* ── Expandable drawer ── */
        .csb-drawer {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          z-index: 120;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: rgba(8, 10, 16, 0.88);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          animation: csbDrawerIn 0.2s ease;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
        }

        :global([data-theme="light"]) .csb-drawer {
          background: rgba(255, 255, 255, 0.95);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }

        @keyframes csbDrawerIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .csb-drawer-status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.72rem;
          color: var(--ink-secondary);
          flex-wrap: wrap;
        }

        .csb-drawer-status strong {
          color: var(--ink);
          font-weight: 700;
        }

        .csb-drawer-status[data-status="full"] {
          border-left: 3px solid rgba(14, 165, 233, 0.6);
          padding-left: 8px;
        }

        .csb-drawer-status[data-status="fallback"] {
          border-left: 3px solid rgba(251, 191, 36, 0.6);
          padding-left: 8px;
        }

        .csb-drawer-progress {
          width: 100%;
          height: 3px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.1);
          overflow: hidden;
          margin-top: 4px;
        }
        .csb-drawer-progress-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 2px;
          transition: width 0.3s ease;
        }

        .csb-drawer-breadcrumbs {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.72rem;
          padding-top: 6px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        :global([data-theme="light"]) .csb-drawer-breadcrumbs {
          border-top-color: rgba(0, 0, 0, 0.06);
        }

        @media (max-width: 980px) {
          .center-status-bar {
            max-width: none;
          }
        }

        @media (max-width: 600px) {
          .csb-primary {
            font-size: 0.65rem;
            padding: 4px 8px;
          }
          .csb-loading-label span {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
