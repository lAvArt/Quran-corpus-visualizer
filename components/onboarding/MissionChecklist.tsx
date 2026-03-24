"use client";

import { useTranslations, useLocale } from "next-intl";
import { getMissionByIntent, type MissionIntent, type MissionTaskId } from "@/lib/config/missions";

export interface MissionProgress {
  search: boolean;
  "select-token": boolean;
  "switch-viz": boolean;
}

interface MissionChecklistProps {
  isOpen: boolean;
  missionIntent: MissionIntent;
  /** task ID → completed mapping */
  progress: MissionProgress;
  onDismiss: () => void;
  onComplete?: () => void;
}

/**
 * Floating bottom-right checklist during an active mission.
 * Tracks 3 sub-tasks, updates reactively, auto-dismisses on completion.
 */
export default function MissionChecklist({
  isOpen,
  missionIntent,
  progress,
  onDismiss,
  onComplete,
}: MissionChecklistProps) {
  const t = useTranslations("FirstRunMission");
  const locale = useLocale();
  const isRtl = locale === "ar";

  const mission = getMissionByIntent(missionIntent);
  const taskIds = mission ? mission.tasks.map((tk) => tk.id) : [] as MissionTaskId[];
  const taskTitleKeys = mission ? mission.tasks.map((tk) => tk.titleKey) : [];
  const completedCount = taskIds.filter((id) => progress[id]).length;
  const allDone = completedCount === taskIds.length && taskIds.length > 0;

  if (!isOpen) return null;

  return (
    <div
      className="mission-checklist"
      role="status"
      aria-live="polite"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="mission-checklist-header">
        <span className="mission-checklist-title">{t("checklist.title")}</span>
        <span className="mission-checklist-count">
          {completedCount}/{taskIds.length}
        </span>
      </div>

      <ul className="mission-checklist-tasks">
        {taskIds.map((id, i) => (
          <li
            key={id}
            className="mission-checklist-task"
            data-done={progress[id]}
          >
            <span className="mission-check-icon" aria-hidden="true">
              {progress[id] ? "✓" : (i + 1)}
            </span>
            <span>{t(taskTitleKeys[i])}</span>
          </li>
        ))}
      </ul>

      {allDone && (
        <div className="mission-complete-flash">
          <p>{t("checklist.complete")}</p>
          <button type="button" onClick={() => { onComplete?.(); onDismiss(); }} className="mission-done-btn">
            {t("checklist.dismiss")}
          </button>
        </div>
      )}

      {!allDone && (
        <button
          type="button"
          className="mission-skip-btn"
          onClick={onDismiss}
        >
          {t("checklist.skipMission")}
        </button>
      )}

      <style jsx>{`
        .mission-checklist {
          position: fixed;
          bottom: calc(var(--footer-height, 42px) + 24px);
          ${isRtl ? "left" : "right"}: 24px;
          z-index: 110;
          width: min(300px, calc(100vw - 48px));
          border-radius: 14px;
          border: 1px solid var(--line);
          background: color-mix(in srgb, var(--bg-0), white 10%);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
          padding: 16px;
          display: grid;
          gap: 12px;
          backdrop-filter: blur(12px);
        }

        .mission-checklist-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .mission-checklist-title {
          font-size: 0.82rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--ink-muted);
        }

        .mission-checklist-count {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--accent);
        }

        .mission-checklist-tasks {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 8px;
        }

        .mission-checklist-task {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.86rem;
          color: var(--ink-secondary);
          transition: color 0.2s, opacity 0.2s;
        }

        .mission-checklist-task[data-done="true"] {
          color: var(--accent);
          text-decoration: line-through;
          opacity: 0.7;
        }

        .mission-check-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 1px solid var(--line);
          font-size: 0.7rem;
          font-weight: 700;
          flex-shrink: 0;
        }

        .mission-checklist-task[data-done="true"] .mission-check-icon {
          background: var(--accent);
          border-color: var(--accent);
          color: #fff;
        }

        .mission-complete-flash {
          text-align: center;
          animation: fadeIn 0.3s ease;
        }

        .mission-complete-flash p {
          margin: 0 0 8px;
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--accent);
        }

        .mission-done-btn,
        .mission-skip-btn {
          width: 100%;
          border-radius: 10px;
          border: 1px solid var(--line);
          padding: 8px;
          background: transparent;
          color: var(--ink-secondary);
          font-family: inherit;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
        }

        .mission-done-btn {
          background: var(--accent);
          border-color: var(--accent);
          color: #fff;
        }

        .mission-done-btn:hover,
        .mission-skip-btn:hover {
          border-color: var(--accent);
          color: var(--ink);
        }

        :global([data-theme="dark"]) .mission-checklist {
          background: rgba(12, 14, 22, 0.92);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
