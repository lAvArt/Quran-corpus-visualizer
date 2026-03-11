"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { useAuth } from "@/lib/context/AuthContext";

/**
 * Auth button shown in the app header.
 * - Anonymous: shows "Sign In" link
 * - Authenticated: shows user initials + dropdown (Profile, Sign Out)
 */
export function AuthButton() {
    const t = useTranslations("Auth");
    const { user, signOut, loading } = useAuth();
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        function onPointerDown(e: PointerEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, []);

    if (loading) return null;

    if (!user) {
        return (
            <Link
                href="/auth/login"
                style={{ borderRadius: "0.375rem", border: "1px solid var(--line)", padding: "0.375rem 0.75rem", fontSize: "0.875rem", fontWeight: 500, color: "var(--ink)", textDecoration: "none", display: "inline-block" }}
            >
                {t("signIn")}
            </Link>
        );
    }

    // Build initials from email
    const initials = (user.email ?? "?")
        .split("@")[0]
        .slice(0, 2)
        .toUpperCase();

    return (
        <div ref={menuRef} style={{ position: "relative" }}>
            <button
                type="button"
                aria-expanded={open}
                aria-haspopup="menu"
                onClick={() => setOpen((v) => !v)}
                style={{ display: "flex", height: "2rem", width: "2rem", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "var(--accent)", color: "#fff", fontSize: "0.75rem", fontWeight: 700, border: "none", cursor: "pointer" }}
            >
                {initials}
            </button>

            {open && (
                <div
                    role="menu"
                    style={{ position: "absolute", insetInlineEnd: 0, top: "2.75rem", zIndex: 50, minWidth: "10rem", borderRadius: "0.75rem", border: "1px solid var(--line)", background: "var(--panel)", boxShadow: "0 4px 24px rgba(0,0,0,0.12)" }}
                >
                    <p style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0.5rem 0.75rem", fontSize: "0.75rem", color: "var(--ink-muted)", borderBottom: "1px solid var(--line)", margin: 0 }}>
                        {user.email}
                    </p>
                    <Link
                        href="/profile"
                        role="menuitem"
                        onClick={() => setOpen(false)}
                        style={{ display: "block", padding: "0.5rem 0.75rem", fontSize: "0.875rem", color: "var(--ink)", textDecoration: "none" }}
                    >
                        {t("profile")}
                    </Link>
                    <button
                        role="menuitem"
                        onClick={() => { setOpen(false); signOut(); }}
                        style={{ display: "block", width: "100%", padding: "0.5rem 0.75rem", textAlign: "start", fontSize: "0.875rem", color: "var(--accent, #dc2626)", background: "none", border: "none", cursor: "pointer" }}
                    >
                        {t("signOut")}
                    </button>
                </div>
            )}
        </div>
    );
}
