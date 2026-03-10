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
import {
    clearDevPendingMigrationRoots,
    readDevAuthUser,
    readDevKnowledgeRoots,
    readDevPendingMigrationRoots,
    writeDevKnowledgeRoots,
} from "@/lib/dev/testOverrides";
import * as knowledgeService from "@/lib/supabase/knowledgeService";
import { useAuth } from "@/lib/context/AuthContext";
import { isSupabaseFetchError } from "@/lib/supabase/errors";

interface KnowledgeContextValue {
    roots: Map<string, TrackedRoot>;
    loading: boolean;
    pendingMigration: boolean;
    acceptMigration: () => Promise<void>;
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

export function KnowledgeProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [rootsMap, setRootsMap] = useState<Map<string, TrackedRoot>>(new Map());
    const [loading, setLoading] = useState(true);
    const [pendingMigration, setPendingMigration] = useState(false);
    const [localRootsForMigration, setLocalRootsForMigration] = useState<TrackedRoot[]>([]);
    const isDevKnowledgeMode = Boolean(user && readDevAuthUser());

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        async function hydrate() {
            if (user) {
                const devRoots = readDevKnowledgeRoots();
                const devPendingMigrationRoots = readDevPendingMigrationRoots();
                if (devRoots) {
                    const map = new Map<string, TrackedRoot>();
                    for (const root of devRoots) map.set(root.root, root);
                    if (!cancelled) {
                        setRootsMap(map);
                        setPendingMigration(Boolean(devPendingMigrationRoots?.length));
                        setLocalRootsForMigration(devPendingMigrationRoots ?? []);
                        setLoading(false);
                    }
                    return;
                }

                if (devPendingMigrationRoots) {
                    if (!cancelled) {
                        setRootsMap(new Map());
                        setPendingMigration(devPendingMigrationRoots.length > 0);
                        setLocalRootsForMigration(devPendingMigrationRoots);
                        setLoading(false);
                    }
                    return;
                }

                const localRoots = await knowledgeCache.getAllRoots().catch(() => []);

                try {
                    const cloudRoots = await knowledgeService.getTrackedRoots();

                    if (localRoots.length > 0 && cloudRoots.length === 0 && !cancelled) {
                        setLocalRootsForMigration(localRoots);
                        setPendingMigration(true);
                    }

                    if (!cancelled) {
                        const map = new Map<string, TrackedRoot>();
                        for (const root of cloudRoots) map.set(root.root, root);
                        setRootsMap(map);
                        setLoading(false);
                    }
                } catch (error) {
                    if (!cancelled) {
                        if (isSupabaseFetchError(error)) {
                            console.warn("[KnowledgeProvider] Supabase unavailable, falling back to local cache");
                            const map = new Map<string, TrackedRoot>();
                            for (const root of localRoots) map.set(root.root, root);
                            setRootsMap(map);
                            setPendingMigration(false);
                            setLocalRootsForMigration([]);
                            setLoading(false);
                            return;
                        }

                        throw error;
                    }
                }
                return;
            }

            setPendingMigration(false);
            setLocalRootsForMigration([]);
            const localRoots = await knowledgeCache.getAllRoots().catch(() => []);
            if (!cancelled) {
                const map = new Map<string, TrackedRoot>();
                for (const root of localRoots) map.set(root.root, root);
                setRootsMap(map);
                setLoading(false);
            }
        }

        hydrate().catch((error) => {
            if (!cancelled) {
                console.error("[KnowledgeProvider] hydrate error", error);
                setLoading(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [user]);

    const acceptMigration = useCallback(async () => {
        if (!user) return;

        const devPendingMigrationRoots = readDevPendingMigrationRoots();
        if (devPendingMigrationRoots) {
            const nextRootsMap = new Map(rootsMap);
            for (const root of devPendingMigrationRoots) {
                nextRootsMap.set(root.root, root);
            }
            const nextRoots = Array.from(nextRootsMap.values());
            writeDevKnowledgeRoots(nextRoots);
            setRootsMap(nextRootsMap);
            setPendingMigration(false);
            setLocalRootsForMigration([]);
            clearDevPendingMigrationRoots();
            return;
        }

        try {
            await knowledgeService.batchUpsertRoots(user.id, localRootsForMigration);
            for (const root of localRootsForMigration) {
                await knowledgeCache.removeRoot(root.root).catch(() => {});
            }
            const cloudRoots = await knowledgeService.getTrackedRoots();
            const map = new Map<string, TrackedRoot>();
            for (const root of cloudRoots) map.set(root.root, root);
            setRootsMap(map);
            setPendingMigration(false);
            setLocalRootsForMigration([]);
        } catch (error) {
            console.error("[KnowledgeProvider] acceptMigration failed", error);
        }
    }, [user, localRootsForMigration, rootsMap]);

    const declineMigration = useCallback(() => {
        setPendingMigration(false);
        setLocalRootsForMigration([]);
        clearDevPendingMigrationRoots();
    }, []);

    const trackRoot = useCallback(async (root: string, state: KnowledgeState = "learning") => {
        if (isDevKnowledgeMode) {
            const now = Date.now();
            const entry: TrackedRoot = {
                root,
                state,
                notes: "",
                addedAt: now,
                lastReviewedAt: now,
            };
            setRootsMap((prev) => {
                const next = new Map(prev).set(root, entry);
                writeDevKnowledgeRoots(Array.from(next.values()));
                return next;
            });
            return;
        }

        if (user) {
            const entry = await knowledgeService.upsertRoot(user.id, root, state);
            setRootsMap((prev) => new Map(prev).set(root, entry));
            return;
        }

        const entry = await knowledgeCache.trackRoot(root, state);
        setRootsMap((prev) => new Map(prev).set(root, entry));
    }, [isDevKnowledgeMode, user]);

    const updateRoot = useCallback(async (root: string, patch: Partial<Pick<TrackedRoot, "state" | "notes">>) => {
        if (isDevKnowledgeMode) {
            setRootsMap((prev) => {
                const existing = prev.get(root);
                if (!existing) return prev;
                const next = new Map(prev);
                next.set(root, {
                    ...existing,
                    ...patch,
                    lastReviewedAt: Date.now(),
                });
                writeDevKnowledgeRoots(Array.from(next.values()));
                return next;
            });
            return;
        }

        if (user) {
            const updated = await knowledgeService.updateRoot(root, patch);
            setRootsMap((prev) => new Map(prev).set(root, updated));
            return;
        }

        const updated = await knowledgeCache.updateRoot(root, patch);
        if (updated) setRootsMap((prev) => new Map(prev).set(root, updated));
    }, [isDevKnowledgeMode, user]);

    const removeRoot = useCallback(async (root: string) => {
        if (isDevKnowledgeMode) {
            setRootsMap((prev) => {
                const next = new Map(prev);
                next.delete(root);
                writeDevKnowledgeRoots(Array.from(next.values()));
                return next;
            });
            return;
        }

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
    }, [isDevKnowledgeMode, user]);

    const exportKnowledge = useCallback(async () => {
        const roots = Array.from(rootsMap.values());
        const payload = { version: 1, exportedAt: Date.now(), roots };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `quran-knowledge-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
    }, [rootsMap]);

    const importKnowledge = useCallback(async (jsonString: string, merge = true) => {
        const payload = JSON.parse(jsonString) as { version: 1; roots: TrackedRoot[] };
        if (payload.version !== 1 || !Array.isArray(payload.roots)) {
            throw new Error("Invalid knowledge export format");
        }

        if (isDevKnowledgeMode) {
            const baseRoots = merge ? Array.from(rootsMap.values()) : [];
            const next = new Map<string, TrackedRoot>();
            for (const root of baseRoots) next.set(root.root, root);
            for (const root of payload.roots) next.set(root.root, root);
            const nextRoots = Array.from(next.values());
            writeDevKnowledgeRoots(nextRoots);
            setRootsMap(new Map(nextRoots.map((root) => [root.root, root] as const)));
            return payload.roots.length;
        }

        if (user) {
            const count = await knowledgeService.batchUpsertRoots(user.id, payload.roots);
            const cloudRoots = await knowledgeService.getTrackedRoots();
            const map = new Map<string, TrackedRoot>();
            for (const root of cloudRoots) map.set(root.root, root);
            setRootsMap(map);
            return count;
        }

        const count = await knowledgeCache.importKnowledge(jsonString, merge);
        const localRoots = await knowledgeCache.getAllRoots();
        const map = new Map<string, TrackedRoot>();
        for (const root of localRoots) map.set(root.root, root);
        setRootsMap(map);
        return count;
    }, [isDevKnowledgeMode, rootsMap, user]);

    const isTracked = useCallback((root: string) => rootsMap.has(root), [rootsMap]);

    const stats = useMemo(() => {
        let learning = 0;
        let learned = 0;
        for (const root of rootsMap.values()) {
            if (root.state === "learning") learning += 1;
            if (root.state === "learned") learned += 1;
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
        [
            rootsMap,
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
        ],
    );

    return <KnowledgeContext.Provider value={value}>{children}</KnowledgeContext.Provider>;
}

export function useKnowledge(): KnowledgeContextValue {
    const ctx = useContext(KnowledgeContext);
    if (!ctx) throw new Error("useKnowledge must be used within a KnowledgeProvider");
    return ctx;
}
