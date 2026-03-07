"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/context/AuthContext";
import { Link } from "@/i18n/routing";

type Tab = "signin" | "signup";

export default function LoginPage() {
    const t = useTranslations("Auth");
    const router = useRouter();
    const { signIn, signUp } = useAuth();

    const [tab, setTab] = useState<Tab>("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);

        if (tab === "signup" && password !== confirmPassword) {
            setError(t("passwordMismatch"));
            return;
        }

        setSubmitting(true);
        try {
            if (tab === "signin") {
                const { error } = await signIn(email, password);
                if (error) { setError(error); return; }
                router.push("/");
            } else {
                const { error } = await signUp(email, password);
                if (error) { setError(error); return; }
                setSuccessMessage(t("signUpSuccess"));
            }
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

    const labelStyle: React.CSSProperties = {
        display: "block",
        marginBottom: "0.25rem",
        fontSize: "0.875rem",
        fontWeight: 500,
        color: "var(--ink-secondary)",
    };

    return (
        <main style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: "0 1rem", background: "var(--bg-0)" }}>
            <div style={{ width: "100%", maxWidth: "28rem", borderRadius: "1rem", border: "1px solid var(--line)", background: "var(--panel)", padding: "2rem", boxShadow: "0 4px 32px rgba(0,0,0,0.08)" }}>
                {/* Tab headers */}
                <div style={{ marginBottom: "1.5rem", display: "flex", borderRadius: "0.5rem", border: "1px solid var(--line)", overflow: "hidden" }}>
                    {(["signin", "signup"] as Tab[]).map((t2) => (
                        <button
                            key={t2}
                            type="button"
                            onClick={() => { setTab(t2); setError(null); setSuccessMessage(null); }}
                            style={{
                                flex: 1,
                                padding: "0.5rem",
                                fontSize: "0.875rem",
                                fontWeight: 500,
                                border: "none",
                                cursor: "pointer",
                                background: tab === t2 ? "var(--accent)" : "transparent",
                                color: tab === t2 ? "#fff" : "var(--ink-secondary)",
                                transition: "background 0.15s",
                            }}
                        >
                            {t2 === "signin" ? t("signIn") : t("signUp")}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div>
                        <label htmlFor="email" style={labelStyle}>{t("email")}</label>
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

                    <div>
                        <label htmlFor="password" style={labelStyle}>{t("password")}</label>
                        <input
                            id="password"
                            type="password"
                            autoComplete={tab === "signin" ? "current-password" : "new-password"}
                            required
                            minLength={8}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={inputStyle}
                        />
                    </div>

                    {tab === "signup" && (
                        <div>
                            <label htmlFor="confirmPassword" style={labelStyle}>{t("confirmPassword")}</label>
                            <input
                                id="confirmPassword"
                                type="password"
                                autoComplete="new-password"
                                required
                                minLength={8}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                style={inputStyle}
                            />
                        </div>
                    )}

                    {error && (
                        <p role="alert" style={{ borderRadius: "0.375rem", background: "rgba(239,68,68,0.1)", padding: "0.5rem 0.75rem", fontSize: "0.875rem", color: "var(--accent, #dc2626)", margin: 0 }}>
                            {error}
                        </p>
                    )}
                    {successMessage && (
                        <p role="status" style={{ borderRadius: "0.375rem", background: "rgba(34,197,94,0.1)", padding: "0.5rem 0.75rem", fontSize: "0.875rem", color: "#16a34a", margin: 0 }}>
                            {successMessage}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        style={{ width: "100%", borderRadius: "0.375rem", background: "var(--accent)", color: "#fff", border: "none", padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 500, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.5 : 1, transition: "opacity 0.15s" }}
                    >
                        {submitting ? t("loading") : tab === "signin" ? t("signIn") : t("signUp")}
                    </button>
                </form>

                {tab === "signin" && (
                    <p style={{ marginTop: "1rem", textAlign: "center", fontSize: "0.875rem", color: "var(--ink-muted)" }}>
                        <Link href="/auth/reset-password" style={{ textDecoration: "underline", color: "inherit" }}>
                            {t("forgotPassword")}
                        </Link>
                    </p>
                )}
            </div>
        </main>
    );
}
