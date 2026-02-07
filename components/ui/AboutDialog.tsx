"use client";

import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState } from "react";

interface AboutDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AboutDialog({ isOpen, onClose }: AboutDialogProps) {
    const t = useTranslations("About");
    const locale = useLocale();
    const isRtl = locale === 'ar';
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || !isOpen) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="dialog-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        className="dialog-panel"
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            direction: isRtl ? "rtl" : "ltr",
                            textAlign: isRtl ? "right" : "left",
                        }}
                    >
                        <button
                            onClick={onClose}
                            style={{
                                position: "absolute",
                                top: "20px",
                                [isRtl ? 'left' : 'right']: "20px",
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                padding: "8px",
                                color: "var(--ink-muted)",
                                transition: "color 0.2s ease, background 0.2s ease",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: "6px",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.color = "var(--ink)";
                                e.currentTarget.style.background = "var(--bg-2)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.color = "var(--ink-muted)";
                                e.currentTarget.style.background = "transparent";
                            }}
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>

                        <h2 style={{
                            margin: "0 0 16px 0",
                            fontSize: "1.5rem",
                            fontFamily: isRtl ? "var(--font-arabic)" : "var(--font-display, serif)",
                            color: "var(--ink)",
                        }}>
                            {t("title")}
                        </h2>

                        <div style={{ color: "var(--ink-secondary)", lineHeight: "1.6" }}>
                            <p>{t("description")}</p>

                            <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid var(--line)" }}>
                                <p style={{ fontSize: "0.9rem", color: "var(--ink-muted)" }}>
                                    {t("version")} 0.2.0
                                </p>
                                <p style={{ fontSize: "0.9rem", color: "var(--ink-muted)" }}>
                                    {t("copyright")}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}
