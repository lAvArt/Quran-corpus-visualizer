"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import VizBreadcrumbs from "@/components/ui/VizBreadcrumbs";
import type { CorpusStatusPresentation } from "@/lib/corpus/statusPresentation";

type BreadcrumbLevel = "quran" | "surah" | "ayah" | "root";

interface StatusBarProps {
  // Loading state
  isLoading: boolean;
  loadingProgress: { currentSura: number; totalSuras: number } | null;
  dataStatus: string;

  // Status banners
  statusPresentation: CorpusStatusPresentation;
  searchStatus: string;
  overviewSurahCount: number;
  overviewRootCount: number;

  // Context transform
  contextTransformNotice: {
    title: string;
    description: string;
    recoveryLabel?: string;
  } | null;
  onRestoreFocusedContext: () => void;
  onDismissContextTransformNotice: () => void;

  // Breadcrumbs
  isHierarchicalMode: boolean;
  vizModeLabel: string;
  selectedSurahId: number;
  surahName: string;
  selectedAyah: number | null;
  selectedRoot: string | null;
  onBreadcrumbNavigate: (level: BreadcrumbLevel) => void;
}

export default function StatusBar({
  isLoading,
  loadingProgress,
  dataStatus,
  statusPresentation,
  searchStatus,
  overviewSurahCount,
  overviewRootCount,
  contextTransformNotice,
  onRestoreFocusedContext,
  onDismissContextTransformNotice,
  isHierarchicalMode,
  vizModeLabel,
  selectedSurahId,
  surahName,
  selectedAyah,
  selectedRoot,
  onBreadcrumbNavigate,
}: StatusBarProps) {
  const t = useTranslations("Index");
  const tSearch = useTranslations("SearchWorkspace");
  const [isExpanded, setIsExpanded] = useState(false);

  // Count how many secondary notifications exist
  const notifications = useMemo(() => {
    const items: { key: string; type: "warning" | "info" | "search"; title: string; description: string }[] = [];
    if (statusPresentation.showFallbackMessage) {
      items.push({ key: "fallback", type: "warning", title: t("overlay.fallbackTitle"), description: tSearch("fallbackMessage") });
    }
    if (statusPresentation.showLoadingMessage) {
      items.push({ key: "loading", type: "info", title: t("overlay.loadingTitle"), description: tSearch("loadingMessage") });
    }
    if (statusPresentation.showShellReadyMessage) {
      items.push({
        key: "shell-ready",
        type: "info",
        title: t("overlay.shellReadyTitle"),
        description: tSearch("shellReadyMessage", { surahCount: overviewSurahCount, rootCount: overviewRootCount.toLocaleString() }),
      });
    }
    if (searchStatus === "unavailable") {
      items.push({ key: "search", type: "search", title: t("overlay.searchUnavailableTitle"), description: t("overlay.searchUnavailableDescription") });
    }
    return items;
  }, [statusPresentation, searchStatus, overviewSurahCount, overviewRootCount, t, tSearch]);

  const hasNotifications = notifications.length > 0 || contextTransformNotice !== null;

  return (
    <div className="status-bar" data-loading={isLoading || undefined}>
      {/* Primary row: progress/status + breadcrumbs */}
      <div className="status-bar-primary">
        {/* Loading progress bar (only during load) */}
        {isLoading && (
          <div className="status-bar-progress">
            <div
              className="status-bar-progress-fill"
              style={{ width: loadingProgress ? `${(loadingProgress.currentSura / loadingProgress.totalSuras) * 100}%` : "28%" }}
            />
          </div>
        )}

        <div className="status-bar-content">
          {/* Status pill — compact during load (the progress bar + drawer carry
              the detail) so the breadcrumb stays visible the whole time. */}
          <span className="status-bar-label" data-status={dataStatus} data-testid={isLoading ? "explore-loading-indicator" : undefined}>
            <strong>{t(`dataStatus.${dataStatus}.title`)}</strong>
            {isLoading && loadingProgress && (
              <span className="status-bar-loading-text" aria-live="polite">
                {loadingProgress.currentSura}/{loadingProgress.totalSuras}
                {" · "}
                {Math.round((loadingProgress.currentSura / loadingProgress.totalSuras) * 100)}%
              </span>
            )}
          </span>

          {/* Breadcrumbs — always visible, even while the full corpus loads */}
          <span className="status-bar-breadcrumbs">
            <VizBreadcrumbs
              isHierarchical={isHierarchicalMode}
              viewLabel={vizModeLabel}
              surahId={selectedSurahId}
              surahName={surahName}
              ayah={selectedAyah}
              root={selectedRoot}
              onNavigate={onBreadcrumbNavigate}
              inline
            />
          </span>

          {/* Expand toggle (only if there are notifications) */}
          {hasNotifications && (
            <button
              type="button"
              className={`status-bar-toggle ${isExpanded ? "expanded" : ""}`}
              onClick={() => setIsExpanded(!isExpanded)}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Collapse notifications" : "Expand notifications"}
            >
              {notifications.length > 0 && (
                <span className="status-bar-badge">{notifications.length + (contextTransformNotice ? 1 : 0)}</span>
              )}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Expanded notifications drawer */}
      {isExpanded && hasNotifications && (
        <div className="status-bar-drawer">
          {notifications.map((n) => (
            <div key={n.key} className={`status-bar-notification status-bar-notification-${n.type}`} role="status" aria-live="polite">
              <strong>{n.title}</strong>
              <span>{n.description}</span>
            </div>
          ))}

          {contextTransformNotice && (
            <div className="status-bar-notification status-bar-notification-info" role="status" aria-live="polite">
              <div className="status-bar-notification-header">
                <strong>{contextTransformNotice.title}</strong>
                <span>{contextTransformNotice.description}</span>
              </div>
              <div className="status-bar-notification-actions">
                {contextTransformNotice.recoveryLabel && (
                  <button type="button" className="status-bar-action" onClick={onRestoreFocusedContext}>
                    {contextTransformNotice.recoveryLabel}
                  </button>
                )}
                <button type="button" className="status-bar-action status-bar-action-dismiss" onClick={onDismissContextTransformNotice}>
                  {t("overlay.dismissContextTransform")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .status-bar {
          --centered-shell-dock-width: min(calc(100vw - 24px), 520px, 40vw);
        }

        /* Keep in lockstep with .shell-topbar's wide-monitor override so the
           pill and the search bar stay the same width and stay aligned. */
        @media (min-width: 1800px) {
          .status-bar {
            --centered-shell-dock-width: min(680px, 32vw);
          }
        }

        .status-bar {
          position: fixed;
          top: var(--header-clearance);
          left: 50%;
          transform: translateX(-50%);
          z-index: 45;
          width: var(--centered-shell-dock-width);
          border-radius: var(--radius-md);
          border: 1px solid var(--line);
          margin-top: 6px;
          background: rgba(8, 10, 16, 0.78);
          backdrop-filter: blur(10px);
          overflow: hidden;
          animation: statusBarSlideIn 0.3s ease both;
        }

        @keyframes statusBarSlideIn {
          from { opacity: 0; transform: translate(-50%, -8px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }

        .status-bar-primary {
          position: relative;
        }

        .status-bar-progress {
          width: 100%;
          height: 3px;
          background: rgba(255, 255, 255, 0.08);
        }

        .status-bar-progress-fill {
          position: relative;
          overflow: hidden;
          height: 100%;
          background: var(--accent);
          transition: width 0.3s ease;
          border-radius: 0 2px 2px 0;
        }

        /* Moving sheen so the bar reads as live work, not a stalled fill —
           the count/percent text alongside carries the exact state. */
        .status-bar-progress-fill::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.4),
            transparent
          );
          animation: statusShimmer 1.4s ease-in-out infinite;
        }

        @keyframes statusShimmer {
          from { transform: translateX(-100%); }
          to { transform: translateX(100%); }
        }

        @media (prefers-reduced-motion: reduce) {
          .status-bar-progress-fill::after {
            animation: none;
          }
        }

        .status-bar-content {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 6px 10px;
          min-height: 32px;
        }

        .status-bar-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
          font-size: 0.72rem;
          color: var(--ink-secondary);
        }

        .status-bar-label strong {
          color: var(--ink);
          font-weight: 600;
          font-size: 0.72rem;
        }

        .status-bar-label[data-status="full"] strong {
          color: rgba(14, 165, 233, 0.9);
        }

        .status-bar-label[data-status="fallback"] strong {
          color: rgba(251, 191, 36, 0.9);
        }

        .status-bar-loading-text {
          color: var(--ink-muted);
          font-size: 0.68rem;
        }

        .status-bar-breadcrumbs {
          flex: 1;
          min-width: 0;
          overflow: hidden;
        }

        /* Override VizBreadcrumbs styles when inline in status bar */
        .status-bar-breadcrumbs :global(.viz-breadcrumbs),
        .status-bar-breadcrumbs :global(.viz-context-chip) {
          background: transparent !important;
          border: none !important;
          backdrop-filter: none !important;
          padding: 0 !important;
          font-size: 0.72rem !important;
          gap: 6px !important;
        }

        .status-bar-toggle {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border: none;
          background: transparent;
          color: var(--ink-muted);
          cursor: pointer;
          padding: 4px;
          border-radius: var(--radius-xs);
          transition: color 0.15s ease, background 0.15s ease;
        }

        .status-bar-toggle:hover {
          color: var(--ink);
          background: rgba(255, 255, 255, 0.06);
        }

        .status-bar-toggle svg {
          transition: transform 0.2s ease;
        }

        .status-bar-toggle.expanded svg {
          transform: rotate(180deg);
        }

        .status-bar-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          border-radius: var(--radius-pill);
          background: var(--accent);
          color: var(--accent-ink);
          font-size: 0.6rem;
          font-weight: 700;
          line-height: 1;
        }

        .status-bar-drawer {
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          flex-direction: column;
          gap: 1px;
          max-height: 260px;
          overflow-y: auto;
          animation: drawerExpand 0.2s ease both;
        }

        @keyframes drawerExpand {
          from { opacity: 0; max-height: 0; }
          to { opacity: 1; max-height: 260px; }
        }

        .status-bar-notification {
          display: grid;
          gap: 2px;
          padding: 8px 12px;
          font-size: 0.74rem;
          color: var(--ink-secondary);
          border-left: 3px solid transparent;
        }

        .status-bar-notification strong {
          color: var(--ink);
          font-size: 0.74rem;
          font-weight: 600;
        }

        .status-bar-notification span {
          font-size: 0.7rem;
          line-height: 1.4;
        }

        .status-bar-notification-warning {
          border-left-color: rgba(251, 191, 36, 0.6);
          background: rgba(251, 191, 36, 0.04);
        }

        .status-bar-notification-info {
          border-left-color: rgba(122, 162, 255, 0.4);
          background: rgba(122, 162, 255, 0.03);
        }

        .status-bar-notification-search {
          border-left-color: rgba(244, 114, 182, 0.5);
          background: rgba(244, 114, 182, 0.03);
        }

        .status-bar-notification-header {
          display: grid;
          gap: 2px;
        }

        .status-bar-notification-actions {
          display: flex;
          gap: 6px;
          margin-top: 4px;
        }

        .status-bar-action {
          border: 1px solid var(--line);
          background: rgba(255, 255, 255, 0.04);
          color: var(--ink-secondary);
          font-size: 0.68rem;
          padding: 3px 8px;
          border-radius: var(--radius-xs);
          cursor: pointer;
          font-family: inherit;
          transition: border-color 0.15s ease, color 0.15s ease;
        }

        .status-bar-action:hover {
          border-color: var(--accent);
          color: var(--ink);
        }

        .status-bar-action-dismiss {
          border-color: transparent;
          background: transparent;
        }

        .status-bar-action-dismiss:hover {
          border-color: var(--line);
        }

        :global([data-theme="dark"]) .status-bar {
          background: rgba(8, 10, 16, 0.88);
        }

        :global([data-theme="light"]) .status-bar {
          background: rgba(255, 255, 255, 0.88);
          border-color: rgba(0, 0, 0, 0.08);
        }

        :global([data-theme="light"]) .status-bar-progress {
          background: rgba(0, 0, 0, 0.06);
        }

        :global([data-theme="light"]) .status-bar-drawer {
          border-top-color: rgba(0, 0, 0, 0.06);
        }

        @media (max-width: 1100px) {
          .status-bar {
            --centered-shell-dock-width: min(calc(100vw - 16px), 400px);
            width: var(--centered-shell-dock-width);
            border-radius: var(--radius-sm);
          }

          .status-bar-content {
            padding: 4px 8px;
            gap: 6px;
            min-height: 28px;
          }

          .status-bar-label {
            font-size: 0.66rem;
          }

          .status-bar-label strong {
            font-size: 0.66rem;
          }
        }
      `}</style>
    </div>
  );
}
