"use client";

import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useTranslations, useLocale } from "next-intl";
import { useState, useEffect } from "react";
import { useAccessibleDialog } from "@/lib/hooks/useAccessibleDialog";

export interface VizExplainerContent {
    title: string;
    description: string;
    sections: {
        label: string;
        text: string;
        icon?: React.ReactNode;
    }[];
}

interface VizExplainerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    content: VizExplainerContent;
    theme?: "dark" | "light";
}

export function VizExplainerDialog({ isOpen, onClose, content, theme = "dark" }: VizExplainerDialogProps) {
    const locale = useLocale();
    const isRtl = locale === 'ar';
    const [mounted, setMounted] = useState(false);
    const { dialogRef, handleOverlayClick } = useAccessibleDialog(isOpen, onClose);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || !isOpen) return null;

    const titleId = "viz-explainer-dialog-title";

    return createPortal(
        <AnimatePresence>
            <motion.div
                className="viz-dialog-overlay"
                data-theme={theme}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleOverlayClick}
                style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0, 0, 0, 0.6)",
                    zIndex: 9999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "20px",
                    backdropFilter: "blur(8px)",
                }}
            >
                <motion.div
                    className="viz-dialog-content panel"
                    ref={dialogRef as React.Ref<HTMLDivElement>}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={titleId}
                    tabIndex={-1}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        margin: 0,
                        maxWidth: "600px",
                        width: "100%",
                        maxHeight: "85vh",
                        overflowY: "auto",
                        position: "relative",
                        padding: "32px",
                        background: "var(--panel)",
                        border: "1px solid var(--panel-border)",
                        borderRadius: "18px",
                        boxShadow: "0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
                        backdropFilter: "blur(20px)",
                        direction: isRtl ? "rtl" : "ltr",
                        textAlign: isRtl ? "right" : "left",
                        outline: "none",
                    }}
                >
                    <button
                        onClick={onClose}
                        className="dialog-close-btn dialog-close-btn--round"
                        aria-label="Close"
                        style={{
                            [isRtl ? 'left' : 'right']: "20px",
                        }}
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>

                    <h2 id={titleId} style={{
                        margin: "0 0 8px 0",
                        fontSize: "1.75rem",
                        fontFamily: isRtl ? "var(--font-arabic)" : "var(--font-display, serif)",
                        color: "var(--ink)",
                        letterSpacing: isRtl ? "0" : "-0.02em"
                    }}>
                        {content.title}
                    </h2>
                    <p
                        style={{
                            fontSize: "1.05rem",
                            lineHeight: "1.6",
                            color: "var(--ink-secondary)",
                            marginBottom: "32px",
                            borderBottom: "1px solid var(--line)",
                            paddingBottom: "20px",
                        }}
                    >
                        {content.description}
                    </p>

                    <div className="viz-explainer-grid" style={{ display: "grid", gap: "24px" }}>
                        {content.sections.map((section, idx) => (
                            <div key={idx} style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                                <div
                                    style={{
                                        marginTop: "4px",
                                        flexShrink: 0,
                                        width: "8px",
                                        height: "8px",
                                        borderRadius: "50%",
                                        background: idx === 0 ? "var(--accent)" : idx === 1 ? "var(--accent-2)" : "var(--node-default, #fff)",
                                        boxShadow: idx === 0 ? "0 0 10px var(--accent)" : "none",
                                    }}
                                />
                                <div>
                                    <h4
                                        style={{
                                            margin: "0 0 6px 0",
                                            fontSize: "1rem",
                                            fontWeight: 600,
                                            color: "var(--ink)",
                                            letterSpacing: isRtl ? "0" : "0.01em",
                                            fontFamily: isRtl ? "var(--font-arabic)" : "inherit",
                                        }}
                                    >
                                        {section.label}
                                    </h4>
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: "0.95rem",
                                            lineHeight: "1.6",
                                            color: "var(--ink-secondary)",
                                        }}
                                    >
                                        {section.text}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
}

export function HelpIcon({ onClick }: { onClick: () => void }) {
    const t = useTranslations('VizExplainer');
    return (
        <button
            onClick={onClick}
            className="viz-help-btn"
            title={t('helpLabel')}
            aria-label={t('helpLabel')}
            style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--line)",
                borderRadius: "50%",
                width: "24px",
                height: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--ink-muted)",
                transition: "all 0.2s ease",
                marginLeft: "auto",
            }}
        >
            <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
        </button>
    );
}
