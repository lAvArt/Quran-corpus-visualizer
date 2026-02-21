"use client";

import { useVizControl } from "@/lib/hooks/VizControlContext";
import { useTranslations } from "next-intl";

export default function MobileBottomBar() {
    const { isLeftSidebarOpen, toggleLeftSidebar, isRightSidebarOpen, toggleRightSidebar, isMobileSearchOpen, toggleMobileSearch } = useVizControl();
    const t = useTranslations("MobileBottomBar");

    return (
        <div className="mobile-bottom-bar mobile-only">
            <button
                className={`bottom-bar-btn ${isLeftSidebarOpen ? "active" : ""}`}
                onClick={toggleLeftSidebar}
            >
                <span>{isLeftSidebarOpen ? t("hideLegend") : t("showLegend")}</span>
            </button>

            <div className="bottom-bar-divider" />

            <button
                className={`bottom-bar-btn bottom-bar-search-btn ${isMobileSearchOpen ? "active" : ""}`}
                onClick={toggleMobileSearch}
                aria-label={t("search")}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                </svg>
            </button>

            <div className="bottom-bar-divider" />

            <button
                className={`bottom-bar-btn ${isRightSidebarOpen ? "active" : ""}`}
                onClick={toggleRightSidebar}
            >
                <span>{isRightSidebarOpen ? t("hideTools") : t("showTools")}</span>
            </button>

            <style jsx>{`
        .mobile-bottom-bar {
            position: fixed;
            bottom: calc(var(--footer-height) + 16px + env(safe-area-inset-bottom));
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            align-items: center;
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid var(--line);
            border-radius: 999px;
            padding: 6px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.12);
            z-index: 1000;
            width: auto;
            max-width: 90vw;
        }

        :global([data-theme="dark"]) .mobile-bottom-bar {
            background: rgba(30, 30, 40, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }

        .bottom-bar-btn {
            background: transparent;
            border: none;
            padding: 10px 20px;
            font-size: 0.9rem;
            font-weight: 600;
            color: var(--ink-secondary);
            cursor: pointer;
            border-radius: 999px;
            transition: all 0.2s;
            white-space: nowrap;
        }

        .bottom-bar-btn.active {
            background: var(--accent);
            color: white;
        }

        .bottom-bar-search-btn {
            padding: 10px 14px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .bottom-bar-divider {
            width: 1px;
            height: 24px;
            background: var(--line);
            margin: 0 4px;
        }
      `}</style>
        </div>
    );
}
