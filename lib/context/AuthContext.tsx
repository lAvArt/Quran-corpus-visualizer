"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import type { ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { clearDevAuthUser, readDevAuthUser, readDevSession } from "@/lib/dev/testOverrides";
import { formatSupabaseError } from "@/lib/supabase/errors";

// ── Context shape ──────────────────────────────────────────────────

interface AuthContextValue {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signUp: (email: string, password: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<{ error: string | null }>;
    updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
    const supabase = useMemo(() => createClient(), []);
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const devUser = readDevAuthUser();
        if (devUser) {
            setUser(devUser);
            setSession(readDevSession());
            setLoading(false);
            return;
        }

        // Hydrate session on mount
        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                setSession(session);
                setUser(session?.user ?? null);
            })
            .catch((error) => {
                console.warn("[AuthProvider] getSession failed", error);
                setSession(null);
                setUser(null);
            })
            .finally(() => {
                setLoading(false);
            });

        // Listen for auth state changes (sign-in, sign-out, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, [supabase]);

    const signIn = useCallback(
        async (email: string, password: string) => {
            try {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                return { error: error?.message ?? null };
            } catch (error) {
                return { error: formatSupabaseError(error, "Unable to reach Supabase right now. Check your connection and try again.") };
            }
        },
        [supabase]
    );

    const signUp = useCallback(
        async (email: string, password: string) => {
            try {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        // Supabase will send a confirmation email automatically
                        emailRedirectTo: `${location.origin}/auth/callback`,
                    },
                });
                return { error: error?.message ?? null };
            } catch (error) {
                return { error: formatSupabaseError(error, "Unable to reach Supabase right now. Check your connection and try again.") };
            }
        },
        [supabase]
    );

    const signOut = useCallback(async () => {
        if (readDevAuthUser()) {
            clearDevAuthUser();
            setSession(null);
            setUser(null);
            return;
        }

        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.warn("[AuthProvider] signOut failed", error);
        }
    }, [supabase]);

    const resetPassword = useCallback(
        async (email: string) => {
            try {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${location.origin}/auth/callback?next=update-password`,
                });
                return { error: error?.message ?? null };
            } catch (error) {
                return { error: formatSupabaseError(error, "Unable to reach Supabase right now. Check your connection and try again.") };
            }
        },
        [supabase]
    );

    const updatePassword = useCallback(
        async (newPassword: string) => {
            try {
                const { error } = await supabase.auth.updateUser({ password: newPassword });
                return { error: error?.message ?? null };
            } catch (error) {
                return { error: formatSupabaseError(error, "Unable to reach Supabase right now. Check your connection and try again.") };
            }
        },
        [supabase]
    );

    const value = useMemo<AuthContextValue>(
        () => ({ user, session, loading, signIn, signUp, signOut, resetPassword, updatePassword }),
        [user, session, loading, signIn, signUp, signOut, resetPassword, updatePassword]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ───────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
