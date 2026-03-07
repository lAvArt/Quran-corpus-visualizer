"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/context/AuthContext";
import { Link } from "@/i18n/routing";

export default function ResetPasswordPage() {
    const t = useTranslations("Auth");
    const { resetPassword } = useAuth();

    const [email, setEmail] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            const { error } = await resetPassword(email);
            if (error) { setError(error); return; }
            setSent(true);
        } finally {
            setSubmitting(false);
        }
    }

    const inputStyle: React.CSSProperties = {
        width: "100%",
        borderRadius: "0.375rem",
        border: "1px solid var(--line)",
        background: "var(--bg-1)",
        color: "var(--ink)",
        padding: "0.5rem 0.75rem",
        fontSize: "0.875rem",
        outline: "none",
    };

    return (
        <main style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: "0 1rem", background: "var(--bg-0)" }}>
            <div style={{ width: "100%", maxWidth: "28rem", borderRadius: "1rem", border: "1px solid var(--line)", background: "var(--panel)", padding: "2rem", boxShadow: "0 4px 32px rgba(0,0,0,0.08)" }}>
                <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem", fontWeight: 600, color: "var(--ink)" }}>{t("resetPassword")}</h1>
                <p style={{ margin: "0 0 1.5rem", fontSize: "0.875rem", color: "var(--ink-muted)" }}>{t("resetPasswordHint")}</p>

                {sent ? (
                    <p role="status" style={{ borderRadius: "0.375rem", background: "rgba(34,197,94,0.1)", padding: "0.5rem 0.75rem", fontSize: "0.875rem", color: "#16a34a", margin: 0 }}>
                        {t("resetEmailSent")}
                    </p>
                ) : (
                    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <div>
                            <label htmlFor="email" style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500, color: "var(--ink-secondary)" }}>{t("email")}</label>
                            <input
                                id="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={inputStyle}
                            />
                        </div>

                        {error && (
                            <p role="alert" style={{ borderRadius: "0.375rem", background: "rgba(239,68,68,0.1)", padding: "0.5rem 0.75rem", fontSize: "0.875rem", color: "var(--accent, #dc2626)", margin: 0 }}>
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={submitting}
                            style={{ width: "100%", borderRadius: "0.375rem", background: "var(--accent)", color: "#fff", border: "none", padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 500, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.5 : 1, transition: "opacity 0.15s" }}
                        >
                            {submitting ? t("loading") : t("sendResetLink")}
                        </button>
                    </form>
                )}

                <p style={{ marginTop: "1rem", textAlign: "center", fontSize: "0.875rem", color: "var(--ink-muted)" }}>
                    <Link href="/auth/login" style={{ textDecoration: "underline", color: "inherit" }}>
                        {t("backToSignIn")}
                    </Link>
                </p>
            </div>
        </main>
    );
}
