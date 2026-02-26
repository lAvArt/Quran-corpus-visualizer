"use client";

import { useVizControl } from "@/lib/hooks/VizControlContext";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";
import GlobalSearch from "@/components/ui/GlobalSearch";
import type { CorpusToken } from "@/lib/schema/types";
import { createPortal } from "react-dom";
import type { SearchMatchType } from "@/lib/analytics/events";

interface MobileSearchOverlayProps {
    tokens: CorpusToken[];
    onTokenSelect: (tokenId: string) => void;
    onTokenHover: (tokenId: string | null) => void;
    onRootSelect?: (root: string | null) => void;
    onSearchOpened?: () => void;
    onSearchQuerySubmitted?: (query: string) => void;
    onSearchResultSelected?: (matchType: SearchMatchType) => void;
}

export default function MobileSearchOverlay({
    tokens,
    onTokenSelect,
    onTokenHover,
    onRootSelect,
    onSearchOpened,
    onSearchQuerySubmitted,
    onSearchResultSelected,
}: MobileSearchOverlayProps) {
    const { isMobileSearchOpen, setMobileSearchOpen } = useVizControl();
    const overlayRef = useRef<HTMLDivElement>(null);

    // Close on escape key
    useEffect(() => {
        if (!isMobileSearchOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMobileSearchOpen(false);
        };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [isMobileSearchOpen, setMobileSearchOpen]);

    if (typeof document === "undefined") return null;

    return createPortal(
        <AnimatePresence>
            {isMobileSearchOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="mobile-search-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => setMobileSearchOpen(false)}
                    />
                    {/* Search panel */}
                    <motion.div
                        ref={overlayRef}
                        className="mobile-search-overlay"
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div className="mobile-search-header">
                            <button
                                className="mobile-search-close"
                                onClick={() => setMobileSearchOpen(false)}
                                aria-label="Close search"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <div className="mobile-search-content">
                            <GlobalSearch
                                tokens={tokens}
                                onTokenSelect={(tokenId) => {
                                    onTokenSelect(tokenId);
                                    setMobileSearchOpen(false);
                                }}
                                onTokenHover={onTokenHover}
                                onRootSelect={onRootSelect}
                                onSearchOpened={onSearchOpened}
                                onSearchQuerySubmitted={onSearchQuerySubmitted}
                                onSearchResultSelected={onSearchResultSelected}
                            />
                        </div>

                        <style jsx global>{`
                            .mobile-search-backdrop {
                                position: fixed;
                                inset: 0;
                                background: rgba(0, 0, 0, 0.4);
                                z-index: 1100;
                                backdrop-filter: blur(4px);
                                -webkit-backdrop-filter: blur(4px);
                            }

                            .mobile-search-overlay {
                                position: fixed;
                                top: calc(var(--header-clearance, 70px) + 12px + env(safe-area-inset-top, 0px));
                                left: 12px;
                                right: 12px;
                                z-index: 1101;
                                background: rgba(255, 255, 255, 0.95);
                                border: 1px solid var(--line);
                                border-radius: 20px;
                                box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2), 0 4px 12px rgba(0, 0, 0, 0.1);
                                backdrop-filter: blur(20px);
                                -webkit-backdrop-filter: blur(20px);
                                padding: 16px;
                                max-height: 60vh;
                                overflow: hidden;
                                display: flex;
                                flex-direction: column;
                            }

                            [data-theme="dark"] .mobile-search-overlay {
                                background: rgba(15, 20, 35, 0.95);
                                border-color: rgba(255, 255, 255, 0.1);
                                box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
                            }

                            .mobile-search-header {
                                display: flex;
                                justify-content: flex-end;
                                margin-bottom: 8px;
                            }

                            .mobile-search-close {
                                background: transparent;
                                border: 1px solid var(--line);
                                border-radius: 10px;
                                padding: 6px;
                                color: var(--ink-secondary);
                                cursor: pointer;
                                transition: all 0.15s;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            }

                            .mobile-search-close:hover {
                                color: var(--ink);
                                border-color: var(--accent);
                            }

                            .mobile-search-content {
                                flex: 1;
                                overflow-y: auto;
                            }

                            .mobile-search-content .global-search {
                                max-width: 100%;
                            }

                            .mobile-search-content .search-input-wrapper {
                                width: auto !important;
                                height: auto !important;
                                padding: 10px 14px !important;
                                background: var(--bg-2) !important;
                                border-color: var(--line) !important;
                            }

                            .mobile-search-content .search-input {
                                display: block !important;
                                width: 100% !important;
                                opacity: 1 !important;
                                pointer-events: auto !important;
                                font-size: 1rem !important;
                            }

                            /* Override the GlobalSearch mobile :focus-within absolute positioning */
                            .mobile-search-content .search-input-wrapper:focus-within {
                                position: relative !important;
                                top: auto !important;
                                left: auto !important;
                                right: auto !important;
                                z-index: auto !important;
                            }

                            .mobile-search-content .search-clear {
                                display: block !important;
                            }

                            .mobile-search-content .search-results-dropdown {
                                position: static !important;
                                max-height: 40vh;
                                margin-top: 8px;
                                border-radius: 12px;
                            }
                        `}</style>
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body
    );
}
