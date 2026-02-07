"use client";

import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState } from "react";

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

    useEffect(() => {
        setMounted(true);
    }, []);

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
                setTimeout(() => {
                    onClose();
                    setStatus("idle");
                }, 2000);
            } else {
                setStatus("error");
            }
        } catch (error) {
            setStatus("error");
        }
    };

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
                                transition: "color 0.2s ease",
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
                            margin: "0 0 24px 0",
                            fontSize: "1.5rem",
                            fontFamily: isRtl ? "var(--font-arabic)" : "var(--font-display, serif)",
                            color: "var(--ink)",
                        }}>
                            {t("title")}
                        </h2>

                        {status === "success" ? (
                            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--accent)" }}>
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
                                >
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                                <p>{t("success")}</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                <div>
                                    <label htmlFor="name" style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "var(--ink-secondary)" }}>
                                        {t("nameLabel")}
                                    </label>
                                    <input
                                        type="text"
                                        id="name"
                                        name="name"
                                        className="dialog-input"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="email" style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "var(--ink-secondary)" }}>
                                        {t("emailLabel")}
                                    </label>
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        className="dialog-input"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="message" style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "var(--ink-secondary)" }}>
                                        {t("messageLabel")}
                                    </label>
                                    <textarea
                                        id="message"
                                        name="message"
                                        required
                                        rows={4}
                                        className="dialog-input"
                                        style={{ resize: "vertical" }}
                                    />
                                </div>

                                {status === "error" && (
                                    <p style={{ 
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
                                    onMouseEnter={(e) => {
                                        if (status !== "loading") {
                                            e.currentTarget.style.transform = "translateY(-1px)";
                                            e.currentTarget.style.boxShadow = "0 4px 12px var(--accent-glow)";
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = "translateY(0)";
                                        e.currentTarget.style.boxShadow = "0 2px 8px var(--accent-glow)";
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
