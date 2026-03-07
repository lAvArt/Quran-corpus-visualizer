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
import {
    knowledgeCache,
    type KnowledgeState,
    type TrackedRoot,
} from "@/lib/cache/knowledgeCache";
import * as knowledgeService from "@/lib/supabase/knowledgeService";
import { useAuth } from "@/lib/context/AuthContext";

// ── Context shape ──────────────────────────────────────────────────

interface KnowledgeContextValue {
    roots: Map<string, TrackedRoot>;
    loading: boolean;
    /** True when local IndexedDB roots are detected after sign-in, awaiting user choice */
    pendingMigration: boolean;
    /** Migrate IndexedDB roots to Supabase and clear local copy */
    acceptMigration: () => Promise<void>;
    /** Dismiss migration offer (local roots are left in IndexedDB but not synced) */
    declineMigration: () => void;
    trackRoot: (root: string, state?: KnowledgeState) => Promise<void>;
    updateRoot: (root: string, patch: Partial<Pick<TrackedRoot, "state" | "notes">>) => Promise<void>;
    removeRoot: (root: string) => Promise<void>;
    exportKnowledge: () => Promise<void>;
    importKnowledge: (jsonString: string, merge?: boolean) => Promise<number>;
    isTracked: (root: string) => boolean;
    stats: { total: number; learning: number; learned: number };
}

const KnowledgeContext = createContext<KnowledgeContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────

export function KnowledgeProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [rootsMap, setRootsMap] = useState<Map<string, TrackedRoot>>(new Map());
    const [loading, setLoading] = useState(true);
    const [pendingMigration, setPendingMigration] = useState(false);
    const [localRootsForMigration, setLocalRootsForMigration] = useState<TrackedRoot[]>([]);

    // ── Load roots whenever auth state changes ─────────────────────
    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        async function hydrate() {
            if (user) {
                // Authenticated path → Supabase
                const cloudRoots = await knowledgeService.getTrackedRoots();

                // Detect unsynced local roots (offer migration if cloud is empty)
                const localRoots = await knowledgeCache.getAllRoots().catch(() => []);
                if (localRoots.length > 0 && cloudRoots.length === 0 && !cancelled) {
                    setLocalRootsForMigration(localRoots);
                    setPendingMigration(true);
                }

                if (!cancelled) {
                    const map = new Map<string, TrackedRoot>();
                    for (const r of cloudRoots) map.set(r.root, r);
                    setRootsMap(map);
                    setLoading(false);
                }
            } else {
                // Anonymous path → IndexedDB
                setPendingMigration(false);
                setLocalRootsForMigration([]);
                const localRoots = await knowledgeCache.getAllRoots().catch(() => []);
                if (!cancelled) {
                    const map = new Map<string, TrackedRoot>();
                    for (const r of localRoots) map.set(r.root, r);
                    setRootsMap(map);
                    setLoading(false);
                }
            }
        }

        hydrate().catch((err) => {
            if (!cancelled) {
                console.error("[KnowledgeProvider] hydrate error", err);
                setLoading(false);
            }
        });

        return () => { cancelled = true; };
    }, [user]);

    // ── Migration ──────────────────────────────────────────────────

    const acceptMigration = useCallback(async () => {
        if (!user) return;
        await knowledgeService.batchUpsertRoots(user.id, localRootsForMigration);
        for (const r of localRootsForMigration) {
            await knowledgeCache.removeRoot(r.root).catch(() => {});
        }
        const cloudRoots = await knowledgeService.getTrackedRoots();
        const map = new Map<string, TrackedRoot>();
        for (const r of cloudRoots) map.set(r.root, r);
        setRootsMap(map);
        setPendingMigration(false);
        setLocalRootsForMigration([]);
    }, [user, localRootsForMigration]);

    const declineMigration = useCallback(() => {
        setPendingMigration(false);
        setLocalRootsForMigration([]);
    }, []);

    // ── CRUD ───────────────────────────────────────────────────────

    const trackRoot = useCallback(async (root: string, state: KnowledgeState = "learning") => {
        if (user) {
            const entry = await knowledgeService.upsertRoot(user.id, root, state);
            setRootsMap((prev) => new Map(prev).set(root, entry));
        } else {
            const entry = await knowledgeCache.trackRoot(root, state);
            setRootsMap((prev) => new Map(prev).set(root, entry));
        }
    }, [user]);

    const updateRoot = useCallback(async (root: string, patch: Partial<Pick<TrackedRoot, "state" | "notes">>) => {
        if (user) {
            const updated = await knowledgeService.updateRoot(root, patch);
            setRootsMap((prev) => new Map(prev).set(root, updated));
        } else {
            const updated = await knowledgeCache.updateRoot(root, patch);
            if (updated) setRootsMap((prev) => new Map(prev).set(root, updated));
        }
    }, [user]);

    const removeRoot = useCallback(async (root: string) => {
        if (user) {
            await knowledgeService.removeRoot(root);
        } else {
            await knowledgeCache.removeRoot(root);
        }
        setRootsMap((prev) => {
            const next = new Map(prev);
            next.delete(root);
            return next;
        });
    }, [user]);

    const exportKnowledge = useCallback(async () => {
        const roots = Array.from(rootsMap.values());
        const payload = { version: 1, exportedAt: Date.now(), roots };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `quran-knowledge-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [rootsMap]);

    const importKnowledge = useCallback(async (jsonString: string, merge = true) => {
        const payload = JSON.parse(jsonString) as { version: 1; roots: TrackedRoot[] };
        if (payload.version !== 1 || !Array.isArray(payload.roots)) {
            throw new Error("Invalid knowledge export format");
        }
        if (user) {
            const count = await knowledgeService.batchUpsertRoots(user.id, payload.roots);
            const cloudRoots = await knowledgeService.getTrackedRoots();
            const map = new Map<string, TrackedRoot>();
            for (const r of cloudRoots) map.set(r.root, r);
            setRootsMap(map);
            return count;
        } else {
            const count = await knowledgeCache.importKnowledge(jsonString, merge);
            const localRoots = await knowledgeCache.getAllRoots();
            const map = new Map<string, TrackedRoot>();
            for (const r of localRoots) map.set(r.root, r);
            setRootsMap(map);
            return count;
        }
    }, [user]);

    const isTracked = useCallback((root: string) => rootsMap.has(root), [rootsMap]);

    const stats = useMemo(() => {
        let learning = 0;
        let learned = 0;
        for (const r of rootsMap.values()) {
            if (r.state === "learning") learning++;
            else if (r.state === "learned") learned++;
        }
        return { total: rootsMap.size, learning, learned };
    }, [rootsMap]);

    const value = useMemo<KnowledgeContextValue>(
        () => ({
            roots: rootsMap,
            loading,
            pendingMigration,
            acceptMigration,
            declineMigration,
            trackRoot,
            updateRoot,
            removeRoot,
            exportKnowledge,
            importKnowledge,
            isTracked,
            stats,
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [rootsMap, loading, pendingMigration, acceptMigration, declineMigration,
            trackRoot, updateRoot, removeRoot, exportKnowledge, importKnowledge, isTracked, stats],
    );

    return (
        <KnowledgeContext.Provider value={value}>
            {children}
        </KnowledgeContext.Provider>
    );
}

// ── Hook ───────────────────────────────────────────────────────────

export function useKnowledge(): KnowledgeContextValue {
    const ctx = useContext(KnowledgeContext);
    if (!ctx) throw new Error("useKnowledge must be used within a KnowledgeProvider");
    return ctx;
}
