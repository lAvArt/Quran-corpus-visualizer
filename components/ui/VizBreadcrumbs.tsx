"use client";

import { useTranslations } from "next-intl";

type BreadcrumbLevel = "quran" | "surah" | "ayah" | "root";

interface VizBreadcrumbsProps {
  isHierarchical: boolean;
  viewLabel: string;
  surahId: number;
  surahName: string;
  ayah: number | null;
  root: string | null;
  onNavigate: (level: BreadcrumbLevel) => void;
}

export default function VizBreadcrumbs({
  isHierarchical,
  viewLabel,
  surahId,
  surahName,
  ayah,
  root,
  onNavigate,
}: VizBreadcrumbsProps) {
  const t = useTranslations("Index.navigation");

  if (!isHierarchical) {
    return (
      <div className="viz-context-chip" aria-label={t("contextLabel")}>
        <span>{viewLabel}</span>
        <span>{t("surahValue", { id: surahId })}</span>
        {root ? <span>{t("rootValue", { root })}</span> : null}
        <style jsx>{`
        .viz-context-chip {
          position: fixed;
          top: calc(var(--header-clearance) + 80px);
          left: 50%;
          transform: translateX(-50%);
          z-index: 40;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          max-width: min(calc(100vw - 24px), 760px);
          padding: 7px 12px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: rgba(8, 10, 16, 0.72);
          backdrop-filter: blur(8px);
          color: var(--ink-secondary);
          font-size: 0.72rem;
          white-space: nowrap;
          overflow: hidden;
        }

        .viz-context-chip span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        @media (max-width: 1100px) {
          .viz-context-chip {
            top: calc(var(--header-clearance) + 34px);
            max-width: calc(100vw - 20px);
            gap: 5px;
            padding: 4px 8px;
            font-size: 0.62rem;
          }
        }
        `}</style>
      </div>
    );
  }

  return (
    <nav className="viz-breadcrumbs" aria-label={t("breadcrumbsLabel")}>
      <button type="button" onClick={() => onNavigate("quran")}>
        {t("quran")}
      </button>
      <span>/</span>
      <button type="button" onClick={() => onNavigate("surah")}>
        {t("surahWithName", { id: surahId, name: surahName })}
      </button>
      {ayah ? (
        <>
          <span>/</span>
          <button type="button" onClick={() => onNavigate("ayah")}>
            {t("ayahValue", { ayah })}
          </button>
        </>
      ) : null}
      {root ? (
        <>
          <span>/</span>
          <button type="button" onClick={() => onNavigate("root")}>
            {t("rootValue", { root })}
          </button>
        </>
      ) : null}

      <style jsx>{`
        .viz-breadcrumbs {
          position: fixed;
          top: calc(var(--header-clearance) + 80px);
          left: 50%;
          transform: translateX(-50%);
          z-index: 40;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          max-width: min(calc(100vw - 24px), 760px);
          border-radius: 999px;
          border: 1px solid var(--line);
          background: rgba(8, 10, 16, 0.72);
          backdrop-filter: blur(8px);
          padding: 7px 12px;
          font-size: 0.72rem;
          white-space: nowrap;
          overflow: hidden;
        }

        .viz-breadcrumbs button {
          border: none;
          background: transparent;
          color: var(--ink-secondary);
          cursor: pointer;
          padding: 0;
          font: inherit;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .viz-breadcrumbs button:hover,
        .viz-breadcrumbs button:focus-visible {
          color: var(--ink);
          outline: none;
        }

        .viz-breadcrumbs span {
          flex: 0 0 auto;
          color: var(--ink-muted);
        }

        @media (max-width: 1100px) {
          .viz-breadcrumbs {
            top: calc(var(--header-clearance) + 34px);
            max-width: calc(100vw - 20px);
            gap: 5px;
            padding: 4px 8px;
            font-size: 0.62rem;
          }

          .viz-breadcrumbs button {
            max-width: 32vw;
          }
        }
      `}</style>
    </nav>
  );
}
