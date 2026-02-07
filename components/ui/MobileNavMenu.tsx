"use client";

import { useVizControl } from "@/lib/hooks/VizControlContext";
import { motion, AnimatePresence } from "framer-motion";
import ThemeSwitcher from "./ThemeSwitcher";
import LanguageSwitcher from "./LanguageSwitcher";
import { useEffect, useRef } from "react";

export default function MobileNavMenu({ theme, onThemeChange }: { theme: "light" | "dark", onThemeChange: (t: "light" | "dark") => void }) {
    const { isMobileNavOpen, setMobileNavOpen } = useVizControl();
    const menuRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMobileNavOpen(false);
            }
        };

        if (isMobileNavOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isMobileNavOpen, setMobileNavOpen]);

    return (
        <div
            className="mobile-nav-menu mobile-only"
            ref={menuRef}
            style={{ position: "relative", flexShrink: 0 }}
        >
            <button
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

            <AnimatePresence>
                {isMobileNavOpen && (
                    <motion.div
                        className="mobile-menu-dropdown"
                        style={{
                            position: "absolute",
                            top: "calc(100% + 12px)",
                            right: 0,
                            width: 240,
                            zIndex: 100,
                            transformOrigin: "top right",
                        }}
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                    >
                        <div className="mobile-menu-item">
                            <span>Theme</span>
                            <ThemeSwitcher theme={theme} onThemeChange={onThemeChange} />
                        </div>
                        <div className="mobile-menu-item">
                            <span>Language</span>
                            <LanguageSwitcher />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            <style jsx>{`
        .mobile-nav-menu {
          position: relative;
        }

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
            position: absolute;
            top: calc(100% + 12px);
            right: 0;
            width: 240px;
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

        :global([data-theme="dark"]) .mobile-menu-dropdown {
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

        :global([data-theme="dark"]) .mobile-menu-item {
            border-color: #2f3b56;
            background: #151e31;
        }
      `}</style>
        </div>
    );
}
