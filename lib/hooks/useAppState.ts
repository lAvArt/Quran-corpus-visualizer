"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";

interface AppState {
    vizMode: VisualizationMode;
    selectedSurahId: number;
    selectedRoot: string | null;
    selectedLemma: string | null;
    selectedAyah: number | null;
    theme: "light" | "dark";
}

const DEFAULT_STATE: AppState = {
    vizMode: "corpus-architecture",
    selectedSurahId: 1,
    selectedRoot: null,
    selectedLemma: null,
    selectedAyah: null,
    theme: "dark",
};

const STORAGE_KEY = "quran-corpus-viz-prefs";

function parseIntOrNull(value: string | null): number | null {
    if (!value) return null;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
}

function isValidVizMode(mode: string | null): mode is VisualizationMode {
    const validModes: VisualizationMode[] = [
        "radial-sura",
        "root-network",
        "arc-flow",
        "dependency-tree",
        "sankey-flow",
        "surah-distribution",
        "corpus-architecture",
        "heatmap",
    ];
    return !!mode && validModes.includes(mode as VisualizationMode);
}

export function useAppState() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // Initialize state from URL params and localStorage
    const [state, setState] = useState<AppState>(() => {
        // Server-side rendering safety
        if (typeof window === "undefined") {
            return DEFAULT_STATE;
        }

        // Try to get theme from localStorage
        let savedTheme: "light" | "dark" = DEFAULT_STATE.theme;
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.theme === "light" || parsed.theme === "dark") {
                    savedTheme = parsed.theme;
                }
            }
        } catch {
            // Ignore localStorage errors
        }

        // Get values from URL params
        const vizModeParam = searchParams.get("viz");
        const surahParam = searchParams.get("surah");
        const rootParam = searchParams.get("root");
        const lemmaParam = searchParams.get("lemma");
        const ayahParam = searchParams.get("ayah");

        return {
            vizMode: isValidVizMode(vizModeParam) ? vizModeParam : DEFAULT_STATE.vizMode,
            selectedSurahId: parseIntOrNull(surahParam) ?? DEFAULT_STATE.selectedSurahId,
            selectedRoot: rootParam || DEFAULT_STATE.selectedRoot,
            selectedLemma: lemmaParam || DEFAULT_STATE.selectedLemma,
            selectedAyah: parseIntOrNull(ayahParam),
            theme: savedTheme,
        };
    });

    // Sync state changes to URL
    const updateUrl = useCallback(
        (newState: Partial<AppState>) => {
            const params = new URLSearchParams(searchParams.toString());

            if (newState.vizMode !== undefined) {
                params.set("viz", newState.vizMode);
            }
            if (newState.selectedSurahId !== undefined) {
                params.set("surah", String(newState.selectedSurahId));
            }
            if (newState.selectedRoot !== undefined) {
                if (newState.selectedRoot) {
                    params.set("root", newState.selectedRoot);
                } else {
                    params.delete("root");
                }
            }
            if (newState.selectedLemma !== undefined) {
                if (newState.selectedLemma) {
                    params.set("lemma", newState.selectedLemma);
                } else {
                    params.delete("lemma");
                }
            }
            if (newState.selectedAyah !== undefined) {
                if (newState.selectedAyah) {
                    params.set("ayah", String(newState.selectedAyah));
                } else {
                    params.delete("ayah");
                }
            }

            const newUrl = `${pathname}?${params.toString()}`;
            router.replace(newUrl, { scroll: false });
        },
        [pathname, router, searchParams]
    );

    // Save theme to localStorage whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: state.theme }));
        } catch {
            // Ignore localStorage errors
        }
    }, [state.theme]);

    // Individual setters that update both state and URL
    const setVizMode = useCallback(
        (vizMode: VisualizationMode) => {
            setState((prev) => ({ ...prev, vizMode }));
            updateUrl({ vizMode });
        },
        [updateUrl]
    );

    const setSelectedSurahId = useCallback(
        (selectedSurahId: number) => {
            setState((prev) => ({ ...prev, selectedSurahId, selectedAyah: null }));
            updateUrl({ selectedSurahId, selectedAyah: null });
        },
        [updateUrl]
    );

    const setSelectedRoot = useCallback(
        (selectedRoot: string | null) => {
            setState((prev) => ({ ...prev, selectedRoot }));
            updateUrl({ selectedRoot });
        },
        [updateUrl]
    );

    const setSelectedLemma = useCallback(
        (selectedLemma: string | null) => {
            setState((prev) => ({ ...prev, selectedLemma }));
            updateUrl({ selectedLemma });
        },
        [updateUrl]
    );

    const setSelectedAyah = useCallback(
        (selectedAyah: number | null) => {
            setState((prev) => ({ ...prev, selectedAyah }));
            updateUrl({ selectedAyah });
        },
        [updateUrl]
    );

    const setTheme = useCallback((theme: "light" | "dark") => {
        setState((prev) => ({ ...prev, theme }));
        // Theme is persisted to localStorage in the useEffect above
    }, []);

    return {
        ...state,
        setVizMode,
        setSelectedSurahId,
        setSelectedRoot,
        setSelectedLemma,
        setSelectedAyah,
        setTheme,
    };
}
