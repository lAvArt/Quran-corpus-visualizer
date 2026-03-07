"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/context/AuthContext";
import { useKnowledge } from "@/lib/context/KnowledgeContext";

export default function ProfilePage() {
    const t = useTranslations("Profile");
    const tAuth = useTranslations("Auth");
    const router = useRouter();
    const { user, signOut, loading: authLoading } = useAuth();
    const { roots, stats, exportKnowledge, importKnowledge, loading: knowledgeLoading } = useKnowledge();
    const importRef = useRef<HTMLInputElement>(null);

    // Redirect unauthenticated users to login
    useEffect(() => {
        if (!authLoading && !user) {
            router.replace("/auth/login");
        }
    }, [authLoading, user, router]);

    if (authLoading || knowledgeLoading || !user) {
        return (
            <main style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
                <p style={{ fontSize: "0.875rem", color: "var(--ink-muted)" }}>{t("loading")}</p>
            </main>
        );
    }

    async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        try {
            const count = await importKnowledge(text, true);
            alert(t("importSuccess", { count }));
        } catch {
            alert(t("importError"));
        }
        // Reset input so the same file can be picked again
        e.target.value = "";
    }

    return (
        <main style={{ maxWidth: "42rem", margin: "0 auto", padding: "3rem 1rem" }}>
            <button
                onClick={() => router.back()}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", marginBottom: "1.5rem", fontSize: "0.875rem", color: "var(--ink-secondary)", background: "none", border: "none", padding: 0, cursor: "pointer" }}
            >
                {t("backToApp")}
            </button>
            <h1 style={{ marginBottom: "0.5rem", fontSize: "1.5rem", fontWeight: 600, color: "var(--ink)" }}>{t("title")}</h1>
            <p style={{ marginBottom: "2rem", fontSize: "0.875rem", color: "var(--ink-muted)" }}>{user.email}</p>

            {/* Stats */}
            <section style={{ marginBottom: "2rem", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                {[
                    { label: t("statsTotal"), value: stats.total },
                    { label: t("statsLearning"), value: stats.learning },
                    { label: t("statsLearned"), value: stats.learned },
                ].map(({ label, value }) => (
                    <div key={label} style={{ borderRadius: "0.75rem", border: "1px solid var(--line)", background: "var(--panel)", padding: "1rem", textAlign: "center" }}>
                        <p style={{ fontSize: "1.875rem", fontWeight: 700, color: "var(--ink)", margin: 0 }}>{value}</p>
                        <p style={{ marginTop: "0.25rem", fontSize: "0.75rem", color: "var(--ink-muted)", margin: "0.25rem 0 0" }}>{label}</p>
                    </div>
                ))}
            </section>

            {/* Tracked roots list */}
            <section style={{ marginBottom: "2rem" }}>
                <h2 style={{ marginBottom: "0.75rem", fontSize: "1rem", fontWeight: 500, color: "var(--ink)" }}>{t("trackedRoots")}</h2>
                {roots.size === 0 ? (
                    <p style={{ fontSize: "0.875rem", color: "var(--ink-muted)" }}>{t("noRoots")}</p>
                ) : (
                    <ul style={{ borderRadius: "0.75rem", border: "1px solid var(--line)", background: "var(--panel)", listStyle: "none", margin: 0, padding: 0 }}>
                        {Array.from(roots.values()).map((r) => (
                            <li key={r.root} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", borderBottom: "1px solid var(--line)" }}>
                                <span dir="rtl" style={{ fontFamily: "var(--font-arabic, serif)", fontSize: "1.125rem", color: "var(--ink)" }}>{r.root}</span>
                                <span style={{
                                    borderRadius: "9999px",
                                    padding: "0.125rem 0.5rem",
                                    fontSize: "0.75rem",
                                    fontWeight: 500,
                                    background: r.state === "learned" ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)",
                                    color: r.state === "learned" ? "#15803d" : "#b45309",
                                }}>
                                    {r.state === "learned" ? t("learned") : t("learning")}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* Data management */}
            <section style={{ marginBottom: "2rem", display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                <button
                    onClick={exportKnowledge}
                    style={{ borderRadius: "0.375rem", border: "1px solid var(--line)", background: "var(--panel)", color: "var(--ink)", padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer" }}
                >
                    {t("exportData")}
                </button>
                <button
                    onClick={() => importRef.current?.click()}
                    style={{ borderRadius: "0.375rem", border: "1px solid var(--line)", background: "var(--panel)", color: "var(--ink)", padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer" }}
                >
                    {t("importData")}
                </button>
                <input
                    ref={importRef}
                    type="file"
                    accept=".json"
                    style={{ display: "none" }}
                    onChange={handleImport}
                />
            </section>

            {/* Sign out */}
            <button
                onClick={() => signOut().then(() => router.push("/"))}
                style={{ borderRadius: "0.375rem", background: "rgba(239,68,68,0.85)", color: "#fff", border: "none", padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer" }}
            >
                {tAuth("signOut")}
            </button>
        </main>
    );
}
