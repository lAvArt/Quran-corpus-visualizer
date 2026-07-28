"use client";

import { useVizControl } from "@/lib/hooks/VizControlContext";
import { motion, AnimatePresence } from "framer-motion";
import ThemeSwitcher from "./ThemeSwitcher";
import LanguageSwitcher from "./LanguageSwitcher";
import { AuthButton } from "./AuthButton";
import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import { Link } from "@/i18n/routing";

/* Nav-link rows shown above the theme/language controls — same three
   destinations as JourneyRail's route items, reusing its label/hint keys
   from the "JourneyRail" namespace so the copy stays in one place. */
const NAV_LINKS = [
    {
        href: "/search" as const,
        labelKey: "searchRoute",
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="16.5" y1="16.5" x2="21" y2="21" />
            </svg>
        ),
    },
    {
        href: "/study" as const,
        labelKey: "studyRoute",
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
        ),
    },
    {
        href: "/quiz" as const,
        labelKey: "quizRoute",
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9 9a3 3 0 1 1 3.6 2.9c-.6.2-1.1.7-1.1 1.4V15" />
                <circle cx="12" cy="18" r="0.5" fill="currentColor" />
            </svg>
        ),
    },
];

export default function MobileNavMenu({ theme, onThemeChange }: { theme: "light" | "dark", onThemeChange: (t: "light" | "dark") => void }) {
    const { isMobileNavOpen, setMobileNavOpen, toggleMobileNav, setMobileSettingsOpen } = useVizControl();
    const btnRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const t = useTranslations('MobileNavMenu');
    const tRoutes = useTranslations('JourneyRail');
    const tSettings = useTranslations('DisplaySettings');
    const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);

    const updatePosition = useCallback(() => {
        if (btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom + 8,
                right: window.innerWidth - rect.right,
            });
        }
    }, []);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                btnRef.current && !btnRef.current.contains(target) &&
                dropdownRef.current && !dropdownRef.current.contains(target)
            ) {
                setMobileNavOpen(false);
            }
        };

        if (isMobileNavOpen) {
            updatePosition();
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isMobileNavOpen, setMobileNavOpen, updatePosition]);

    return (
        <>
            <div
                className="mobile-nav-menu mobile-only"
                style={{ flexShrink: 0 }}
            >
                <button
                    ref={btnRef}
                    className={`mobile-menu-btn ${isMobileNavOpen ? "active" : ""}`}
                    data-testid="mobile-nav-menu-trigger"
                    onClick={toggleMobileNav}
                    aria-label="Menu"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </button>
            </div>

            {typeof document !== "undefined" && createPortal(
                <AnimatePresence>
                    {isMobileNavOpen && dropdownPos && (
                        <motion.div
                            ref={dropdownRef}
                            className="mobile-menu-dropdown"
                            data-testid="mobile-nav-menu-dropdown"
                            style={{
                                position: "fixed",
                                top: dropdownPos.top,
                                right: dropdownPos.right,
                            }}
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                        >
                            {NAV_LINKS.map(({ href, labelKey, icon }) => (
                                <Link
                                    key={href}
                                    href={href}
                                    className="mobile-menu-item mobile-menu-link"
                                    onClick={() => setMobileNavOpen(false)}
                                >
                                    <span className="mobile-menu-link-label">
                                        {icon}
                                        {tRoutes(labelKey)}
                                    </span>
                                </Link>
                            ))}
                            <div className="mobile-menu-item">
                                <span>{t('theme')}</span>
                                <ThemeSwitcher theme={theme} onThemeChange={onThemeChange} />
                            </div>
                            <div className="mobile-menu-item">
                                <span>{t('language')}</span>
                                <LanguageSwitcher />
                            </div>
                            <button
                                type="button"
                                className="mobile-menu-item mobile-menu-link"
                                onClick={() => {
                                    setMobileNavOpen(false);
                                    setMobileSettingsOpen(true);
                                }}
                            >
                                <span className="mobile-menu-link-label">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="3" />
                                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                    </svg>
                                    {tSettings('button')}
                                </span>
                            </button>
                            <div className="mobile-menu-item mobile-menu-auth">
                                <AuthButton />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            <style jsx global>{`
        .mobile-menu-btn {
          background: transparent;
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 8px;
          color: var(--ink);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .mobile-menu-btn:hover,
        .mobile-menu-btn.active {
          background: var(--bg-2);
          color: var(--accent);
          border-color: var(--accent);
        }

        .mobile-menu-dropdown {
            width: max-content;
            min-width: 240px;
            max-width: calc(100vw - 16px);
            max-height: min(80vh, 560px);
            overflow-y: auto;
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid var(--line);
            border-radius: 16px;
            padding: 16px;
            box-shadow: 0 12px 32px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            display: flex;
            flex-direction: column;
            gap: 16px;
            z-index: 100;
            transform-origin: top right;
        }

        /* Dark chrome matches the rest of the mobile shell's glass surfaces
           (MobileBottomBar's dark panel + .viz-dock's dark border) instead of
           the old hardcoded navy — see MobileBottomBar.tsx and .viz-dock in
           globals.css. */
        [data-theme="dark"] .mobile-menu-dropdown {
             background: rgba(20, 30, 36, 0.92);
             border-color: rgba(198, 222, 230, 0.1);
             box-shadow: 0 16px 40px rgba(0,0,0,0.55), 0 6px 18px rgba(0,0,0,0.35);
             backdrop-filter: none;
             -webkit-backdrop-filter: none;
        }

        .mobile-menu-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.95rem;
            font-weight: 500;
            color: var(--ink);
            padding: 10px 12px;
            border-radius: 12px;
            border: 1px solid rgba(31, 28, 25, 0.1);
            background: rgba(255, 255, 255, 0.74);
            gap: 10px;
        }

        [data-theme="dark"] .mobile-menu-item {
            border-color: rgba(198, 222, 230, 0.14);
            background: rgba(198, 222, 230, 0.06);
        }

        .mobile-menu-auth {
            justify-content: center;
        }

        /* Nav-link rows (Search/Study/Quiz) + the Settings row share the same
           card as the existing items, but render as a single left-aligned
           icon+label row instead of a label/control pair. */
        .mobile-menu-link {
            justify-content: flex-start;
            text-decoration: none;
            width: 100%;
            margin: 0;
            border: 1px solid rgba(31, 28, 25, 0.1);
            background: rgba(255, 255, 255, 0.74);
            font: inherit;
            cursor: pointer;
        }

        [data-theme="dark"] .mobile-menu-link {
            border-color: rgba(198, 222, 230, 0.14);
            background: rgba(198, 222, 230, 0.06);
        }

        .mobile-menu-link:hover,
        .mobile-menu-link:focus-visible {
            color: var(--accent);
            border-color: var(--accent);
        }

        .mobile-menu-link:focus-visible {
            outline: 2px solid var(--accent);
            outline-offset: 2px;
        }

        .mobile-menu-link-label {
            display: inline-flex;
            align-items: center;
            gap: 10px;
        }
      `}</style>
        </>
    );
}
