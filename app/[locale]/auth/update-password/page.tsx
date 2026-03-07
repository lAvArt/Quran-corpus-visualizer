"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/context/AuthContext";

export default function UpdatePasswordPage() {
    const t = useTranslations("Auth");
    const router = useRouter();
    const { updatePassword, user } = useAuth();

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Must have a valid session to reach this page (middleware + callback handled it)
    if (!user) {
        return (
            <main style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: "0 1rem", background: "var(--bg-0)" }}>
                <p style={{ fontSize: "0.875rem", color: "var(--ink-muted)" }}>{t("sessionRequired")}</p>
            </main>
        );
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        if (password !== confirmPassword) {
            setError(t("passwordMismatch"));
            return;
        }
        setSubmitting(true);
        try {
            const { error } = await updatePassword(password);
            if (error) { setError(error); return; }
            router.push("/");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: "0 1rem", background: "var(--bg-0)" }}>
            <div style={{ width: "100%", maxWidth: "28rem", borderRadius: "1rem", border: "1px solid var(--line)", background: "var(--panel)", padding: "2rem", boxShadow: "0 4px 32px rgba(0,0,0,0.08)" }}>
                <h1 style={{ marginBottom: "1.5rem", fontSize: "1.25rem", fontWeight: 600, color: "var(--ink)" }}>{t("updatePassword")}</h1>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div>
                        <label htmlFor="password" style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500, color: "var(--ink-secondary)" }}>
                            {t("newPassword")}
                        </label>
                        <input
                            id="password"
                            type="password"
                            autoComplete="new-password"
                            required
                            minLength={8}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{ width: "100%", borderRadius: "0.375rem", border: "1px solid var(--line)", background: "var(--bg-1)", color: "var(--ink)", padding: "0.5rem 0.75rem", fontSize: "0.875rem", outline: "none", boxSizing: "border-box" }}
                        />
                    </div>

                    <div>
                        <label htmlFor="confirmPassword" style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500, color: "var(--ink-secondary)" }}>
                            {t("confirmPassword")}
                        </label>
                        <input
                            id="confirmPassword"
                            type="password"
                            autoComplete="new-password"
                            required
                            minLength={8}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            style={{ width: "100%", borderRadius: "0.375rem", border: "1px solid var(--line)", background: "var(--bg-1)", color: "var(--ink)", padding: "0.5rem 0.75rem", fontSize: "0.875rem", outline: "none", boxSizing: "border-box" }}
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
                        style={{ width: "100%", borderRadius: "0.375rem", background: "var(--accent)", color: "#fff", border: "none", padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 500, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.5 : 1 }}
                    >
                        {submitting ? t("loading") : t("updatePasswordButton")}
                    </button>
                </form>
            </div>
        </main>
    );
}
