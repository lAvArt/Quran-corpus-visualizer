"use client";

import { useTranslations } from "next-intl";
import { usePathname, Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/navigation";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";
import type { ReactNode } from "react";

interface JourneyRailProps {
  /** Present only on the explore route, where viz items switch mode in place. */
  vizMode?: VisualizationMode;
  onVizModeChange?: (mode: VisualizationMode) => void;
}

interface RailItem {
  id: string;
  icon: ReactNode;
  labelKey: string;
  testId?: string;
  action:
    | { type: "viz"; mode: VisualizationMode }
    | { type: "route"; href: string };
}

/* Minimal SVG icons — 22×22, stroke-based, no fill */
const icons = {
  discover: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
    </svg>
  ),
  root: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="18" r="3" />
      <line x1="12" y1="9" x2="6" y2="15" />
      <line x1="12" y1="9" x2="18" y2="15" />
    </svg>
  ),
  ayah: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h10" />
      <circle cx="19" cy="17" r="2" />
    </svg>
  ),
  search: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  ),
  study: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  quiz: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9 9a3 3 0 1 1 3.6 2.9c-.6.2-1.1.7-1.1 1.4V15" />
      <circle cx="12" cy="18" r="0.5" fill="currentColor" />
    </svg>
  ),
};

const RAIL_ITEMS: RailItem[] = [
  { id: "discover", icon: icons.discover, labelKey: "discover", testId: "app-mode-link-explore", action: { type: "viz", mode: "surah-distribution" } },
  { id: "root", icon: icons.root, labelKey: "root", action: { type: "viz", mode: "root-network" } },
  { id: "ayah", icon: icons.ayah, labelKey: "ayah", action: { type: "viz", mode: "radial-sura" } },
  { id: "search", icon: icons.search, labelKey: "searchRoute", testId: "app-mode-link-search", action: { type: "route", href: "/search" } },
  { id: "study", icon: icons.study, labelKey: "studyRoute", testId: "app-mode-link-study", action: { type: "route", href: "/study" } },
  { id: "quiz", icon: icons.quiz, labelKey: "quizRoute", testId: "app-mode-link-quiz", action: { type: "route", href: "/quiz" } },
];

/** Left vertical icon rail — journey shortcuts for the 5 user intents + routes */
export default function JourneyRail({ vizMode, onVizModeChange }: JourneyRailProps) {
  const t = useTranslations("JourneyRail");
  const pathname = usePathname();
  const router = useRouter();
  const onExplore = pathname === "/";

  return (
    <nav className="journey-rail" aria-label={t("label")} data-testid="app-mode-nav">
      <div className="rail-group">
        {RAIL_ITEMS.filter((i) => i.action.type === "viz").map((item) => {
          const vizAction = item.action as { type: "viz"; mode: VisualizationMode };
          const isActive = onExplore && vizMode === vizAction.mode;
          return (
            <button
              key={item.id}
              type="button"
              className={`rail-btn ${isActive ? "active" : ""}`}
              data-testid={item.testId ?? `journey-${item.id}`}
              data-active={isActive ? "true" : "false"}
              title={t(item.labelKey)}
              aria-label={t(item.labelKey)}
              onClick={() => {
                // On explore, switch the viz in place; elsewhere, deep-link to it.
                if (onExplore && onVizModeChange) onVizModeChange(vizAction.mode);
                else router.push(`/?viz=${vizAction.mode}`);
              }}
            >
              <span className="rail-icon">{item.icon}</span>
              <span className="rail-label">{t(item.labelKey)}</span>
            </button>
          );
        })}
      </div>

      <div className="rail-divider" />

      <div className="rail-group rail-group--routes">
        {RAIL_ITEMS.filter((i) => i.action.type === "route").map((item) => {
          const routeAction = item.action as { type: "route"; href: string };
          const isActive = pathname === routeAction.href || pathname.startsWith(routeAction.href + "/");
          return (
            <Link
              key={item.id}
              href={routeAction.href}
              className={`rail-btn ${isActive ? "active" : ""}`}
              data-testid={item.testId ?? `journey-${item.id}`}
              data-active={isActive ? "true" : "false"}
              title={t(item.labelKey)}
              aria-label={t(item.labelKey)}
            >
              <span className="rail-icon">{item.icon}</span>
              <span className="rail-label">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>

      <style jsx>{`
        .journey-rail {
          position: fixed;
          top: var(--header-clearance);
          inset-inline-start: 8px;
          z-index: 40;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 8px;
          width: 68px;
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 16px;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
        }

        :global([data-theme="dark"]) .journey-rail {
          background: rgba(22, 33, 39, 0.88);
          border-color: rgba(255, 255, 255, 0.1);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        }

        .rail-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          width: 100%;
        }

        .rail-group--routes {
          gap: 19px;
        }

        .rail-divider {
          width: 32px;
          height: 1px;
          background: var(--line);
          margin: 10px 0;
          opacity: 0.6;
        }

        .rail-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          width: 52px;
          height: 52px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 12px;
          color: var(--ink-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
          text-decoration: none;
          font-family: inherit;
        }

        .rail-btn:hover {
          background: rgba(0, 0, 0, 0.05);
          color: var(--ink);
        }

        :global([data-theme="dark"]) .rail-btn:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        /* Quiet, V2-style active state: reserved selection tint + hairline,
           never a saturated accent fill (amber stays for data). */
        .rail-btn.active {
          background: color-mix(in srgb, var(--selection) 8%, transparent);
          border-color: color-mix(in srgb, var(--selection) 22%, transparent);
          color: var(--selection);
        }

        .rail-btn:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }

        .rail-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }

        .rail-label {
          font-size: 0.6rem;
          font-weight: 600;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          white-space: nowrap;
          line-height: 1;
        }

        /* Mobile: a compact single icon-row (no labels, no wrap) so the rail
           stays short and never blankets the page content below it. */
        @media (max-width: 980px) {
          .journey-rail {
            top: calc(var(--header-clearance) + 8px);
            inset-inline-start: 50%;
            transform: translateX(-50%);
            flex-direction: row;
            justify-content: center;
            gap: 6px;
            width: max-content;
            max-width: calc(100vw - 16px);
            padding: 6px 8px;
            border-radius: var(--radius-pill);
          }

          .rail-group {
            flex-direction: row;
            justify-content: center;
            flex-wrap: nowrap;
            gap: 4px;
            width: auto;
          }

          .rail-group--routes {
            gap: 4px;
          }

          .rail-divider {
            width: 1px;
            height: 26px;
            margin: 0 2px;
          }

          .rail-btn {
            width: 42px;
            height: 42px;
            padding: 0;
            flex-direction: column;
            gap: 0;
          }

          .rail-label {
            display: none;
          }
        }
      `}</style>
    </nav>
  );
}
