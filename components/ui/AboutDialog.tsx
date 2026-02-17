"use client";

import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { useAccessibleDialog } from "@/lib/hooks/useAccessibleDialog";
import { APP_VERSION } from "@/lib/config/version";
import { usePwaInstall } from "@/components/providers/PwaProvider";

interface AboutDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AboutDialog({ isOpen, onClose }: AboutDialogProps) {
    const t = useTranslations("About");
    const locale = useLocale();
    const isRtl = locale === 'ar';
    const [mounted, setMounted] = useState(false);
    const [isInstalling, setIsInstalling] = useState(false);
    const { canInstall, isInstalled, isInstallSupported, promptInstall } = usePwaInstall();
    const { dialogRef, handleOverlayClick } = useAccessibleDialog(isOpen, onClose);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || !isOpen) return null;

    const titleId = "about-dialog-title";

    const handleInstallApp = async () => {
        if (!canInstall || isInstalling) return;
        setIsInstalling(true);
        try {
            await promptInstall();
        } finally {
            setIsInstalling(false);
        }
    };

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="dialog-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={handleOverlayClick}
                >
                    <motion.div
                        className="dialog-panel"
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
                            direction: isRtl ? "rtl" : "ltr",
                            textAlign: isRtl ? "right" : "left",
                        }}
                    >
                        <button
                            onClick={onClose}
                            className="dialog-close-btn"
                            aria-label={t("title") + " — close"}
                            style={{
                                [isRtl ? 'left' : 'right']: "20px",
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
                                aria-hidden="true"
                            >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>

                        <h2 id={titleId} style={{
                            margin: "0 0 16px 0",
                            fontSize: "1.5rem",
                            fontFamily: isRtl ? "var(--font-arabic)" : "var(--font-display, serif)",
                            color: "var(--ink)",
                        }}>
                            {t("title")}
                        </h2>

                        <div style={{ color: "var(--ink-secondary)", lineHeight: "1.6" }}>
                            <p>{t("description")}</p>
                            <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid var(--line)" }}>
                                <p style={{ margin: 0, fontWeight: 700, color: "var(--ink)" }}>{t("dataSourcesTitle")}</p>
                                <p style={{ margin: "8px 0 0 0", fontSize: "0.92rem" }}>
                                    {t("quranicCorpus")}{" "}
                                    <a href="https://corpus.quran.com/" target="_blank" rel="noopener noreferrer">
                                        corpus.quran.com
                                    </a>
                                </p>
                                <p style={{ margin: "8px 0 0 0", fontSize: "0.92rem" }}>
                                    {t("quranComApi")}{" "}
                                    <a href="https://api-docs.quran.com/" target="_blank" rel="noopener noreferrer">
                                        api-docs.quran.com
                                    </a>
                                </p>
                                <p style={{ margin: "10px 0 0 0", fontSize: "0.86rem", color: "var(--ink-muted)" }}>
                                    {t("licenseNotice")}
                                </p>
                                {(canInstall || isInstalled || isInstallSupported) && (
                                    <button
                                        type="button"
                                        onClick={handleInstallApp}
                                        disabled={!canInstall || isInstalled || isInstalling}
                                        style={{
                                            marginTop: "14px",
                                            border: "1px solid var(--line)",
                                            borderRadius: "10px",
                                            padding: "8px 12px",
                                            background: "transparent",
                                            color: "var(--ink-secondary)",
                                            cursor: !canInstall || isInstalled || isInstalling ? "not-allowed" : "pointer",
                                            opacity: !canInstall || isInstalled || isInstalling ? 0.65 : 1,
                                            fontFamily: "inherit",
                                            fontSize: "0.82rem",
                                            fontWeight: 600,
                                        }}
                                    >
                                        {isInstalled
                                            ? t("installed")
                                            : isInstalling
                                                ? t("installing")
                                                : t("installApp")}
                                    </button>
                                )}
                            </div>

                            <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid var(--line)" }}>
                                <p style={{ fontSize: "0.9rem", color: "var(--ink-muted)" }}>
                                    {t("version")} {APP_VERSION}
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
