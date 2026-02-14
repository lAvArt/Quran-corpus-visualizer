"use client";

import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState, useRef } from "react";
import { useAccessibleDialog } from "@/lib/hooks/useAccessibleDialog";

interface FeedbackDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function FeedbackDialog({ isOpen, onClose }: FeedbackDialogProps) {
    const t = useTranslations("Feedback");
    const locale = useLocale();
    const isRtl = locale === 'ar';
    const [mounted, setMounted] = useState(false);
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const { dialogRef, handleOverlayClick } = useAccessibleDialog(isOpen, onClose);
    const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Reset status when dialog closes
    useEffect(() => {
        if (!isOpen) {
            setStatus("idle");
            if (autoCloseTimer.current) {
                clearTimeout(autoCloseTimer.current);
                autoCloseTimer.current = null;
            }
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setStatus("loading");

        const formData = new FormData(e.currentTarget);
        const data = {
            name: formData.get("name"),
            email: formData.get("email"),
            message: formData.get("message"),
        };

        try {
            const response = await fetch("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                setStatus("success");
                autoCloseTimer.current = setTimeout(() => {
                    onClose();
                }, 2000);
            } else {
                setStatus("error");
            }
        } catch {
            setStatus("error");
        }
    };

    if (!mounted || !isOpen) return null;

    const titleId = "feedback-dialog-title";

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
                            margin: "0 0 24px 0",
                            fontSize: "1.5rem",
                            fontFamily: isRtl ? "var(--font-arabic)" : "var(--font-display, serif)",
                            color: "var(--ink)",
                        }}>
                            {t("title")}
                        </h2>

                        {status === "success" ? (
                            <div role="status" style={{ textAlign: "center", padding: "40px 0", color: "var(--accent)" }}>
                                <svg
                                    width="48"
                                    height="48"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{ margin: "0 auto 16px" }}
                                    aria-hidden="true"
                                >
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                                <p>{t("success")}</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                <div>
                                    <label htmlFor="feedback-name" style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "var(--ink-secondary)" }}>
                                        {t("nameLabel")}
                                    </label>
                                    <input
                                        type="text"
                                        id="feedback-name"
                                        name="name"
                                        className="dialog-input"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="feedback-email" style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "var(--ink-secondary)" }}>
                                        {t("emailLabel")}
                                    </label>
                                    <input
                                        type="email"
                                        id="feedback-email"
                                        name="email"
                                        className="dialog-input"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="feedback-message" style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "var(--ink-secondary)" }}>
                                        {t("messageLabel")}
                                    </label>
                                    <textarea
                                        id="feedback-message"
                                        name="message"
                                        required
                                        rows={4}
                                        className="dialog-input"
                                        style={{ resize: "vertical" }}
                                    />
                                </div>

                                {status === "error" && (
                                    <p role="alert" style={{ 
                                        color: "#ef4444", 
                                        fontSize: "0.9rem", 
                                        margin: 0,
                                        padding: "8px 12px",
                                        background: "rgba(239, 68, 68, 0.1)",
                                        borderRadius: "6px",
                                        border: "1px solid rgba(239, 68, 68, 0.3)"
                                    }}>{t("error")}</p>
                                )}

                                <button
                                    type="submit"
                                    disabled={status === "loading"}
                                    className="dialog-submit-btn"
                                    style={{
                                        marginTop: "8px",
                                        padding: "14px",
                                        borderRadius: "8px",
                                        border: "none",
                                        background: "var(--accent)",
                                        color: "white",
                                        fontWeight: 600,
                                        fontSize: "1rem",
                                        cursor: status === "loading" ? "wait" : "pointer",
                                        opacity: status === "loading" ? 0.7 : 1,
                                        transition: "transform 0.2s ease, box-shadow 0.2s ease",
                                        boxShadow: "0 2px 8px var(--accent-glow)",
                                    }}
                                >
                                    {status === "loading" ? t("sending") : t("send")}
                                </button>
                            </form>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}
