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

// ── Context shape ──────────────────────────────────────────────────

interface KnowledgeContextValue {
    /** All tracked roots keyed by root string */
    roots: Map<string, TrackedRoot>;
    /** Whether the cache is still loading from IndexedDB */
    loading: boolean;
    /** Track a new root (or update existing) */
    trackRoot: (root: string, state?: KnowledgeState) => Promise<void>;
    /** Update notes or state for an already-tracked root */
    updateRoot: (root: string, patch: Partial<Pick<TrackedRoot, "state" | "notes">>) => Promise<void>;
    /** Remove a tracked root */
    removeRoot: (root: string) => Promise<void>;
    /** Export all knowledge as downloadable JSON */
    exportKnowledge: () => Promise<void>;
    /** Import knowledge from a JSON string, optionally merging */
    importKnowledge: (jsonString: string, merge?: boolean) => Promise<number>;
    /** Quick lookup helper */
    isTracked: (root: string) => boolean;
    /** Counts */
    stats: { total: number; learning: number; learned: number };
}

const KnowledgeContext = createContext<KnowledgeContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────

export function KnowledgeProvider({ children }: { children: ReactNode }) {
    const [rootsMap, setRootsMap] = useState<Map<string, TrackedRoot>>(new Map());
    const [loading, setLoading] = useState(true);

    // Hydrate from IndexedDB on mount
    useEffect(() => {
        let cancelled = false;
        knowledgeCache
            .getAllRoots()
            .then((all) => {
                if (cancelled) return;
                const map = new Map<string, TrackedRoot>();
                for (const r of all) map.set(r.root, r);
                setRootsMap(map);
            })
            .catch((err) => console.error("[KnowledgeProvider] init error", err))
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    const trackRoot = useCallback(async (root: string, state: KnowledgeState = "learning") => {
        const entry = await knowledgeCache.trackRoot(root, state);
        setRootsMap((prev) => new Map(prev).set(root, entry));
    }, []);

    const updateRoot = useCallback(async (root: string, patch: Partial<Pick<TrackedRoot, "state" | "notes">>) => {
        const updated = await knowledgeCache.updateRoot(root, patch);
        if (updated) {
            setRootsMap((prev) => new Map(prev).set(root, updated));
        }
    }, []);

    const removeRoot = useCallback(async (root: string) => {
        await knowledgeCache.removeRoot(root);
        setRootsMap((prev) => {
            const next = new Map(prev);
            next.delete(root);
            return next;
        });
    }, []);

    const exportKnowledge = useCallback(async () => {
        const json = await knowledgeCache.exportKnowledge();
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `quran-knowledge-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, []);

    const importKnowledge = useCallback(async (jsonString: string, merge = true) => {
        const count = await knowledgeCache.importKnowledge(jsonString, merge);
        // Re-hydrate from DB after import
        const all = await knowledgeCache.getAllRoots();
        const map = new Map<string, TrackedRoot>();
        for (const r of all) map.set(r.root, r);
        setRootsMap(map);
        return count;
    }, []);

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
            trackRoot,
            updateRoot,
            removeRoot,
            exportKnowledge,
            importKnowledge,
            isTracked,
            stats,
        }),
        [rootsMap, loading, trackRoot, updateRoot, removeRoot, exportKnowledge, importKnowledge, isTracked, stats],
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
