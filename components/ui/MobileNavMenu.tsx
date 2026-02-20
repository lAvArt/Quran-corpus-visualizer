"use client";

import { useVizControl } from "@/lib/hooks/VizControlContext";
import { motion, AnimatePresence } from "framer-motion";
import ThemeSwitcher from "./ThemeSwitcher";
import LanguageSwitcher from "./LanguageSwitcher";
import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";

export default function MobileNavMenu({ theme, onThemeChange }: { theme: "light" | "dark", onThemeChange: (t: "light" | "dark") => void }) {
    const { isMobileNavOpen, setMobileNavOpen } = useVizControl();
    const btnRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const t = useTranslations('MobileNavMenu');
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
                    onClick={() => setMobileNavOpen(!isMobileNavOpen)}
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
                            <div className="mobile-menu-item">
                                <span>{t('theme')}</span>
                                <ThemeSwitcher theme={theme} onThemeChange={onThemeChange} />
                            </div>
                            <div className="mobile-menu-item">
                                <span>{t('language')}</span>
                                <LanguageSwitcher />
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

        [data-theme="dark"] .mobile-menu-dropdown {
             background: #0b1220;
             border-color: #2a3347;
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
            border-color: #2f3b56;
            background: #151e31;
        }
      `}</style>
        </>
    );
}
