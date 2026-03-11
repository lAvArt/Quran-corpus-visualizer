"use client";

import { useEffect, useState } from "react";
import type { RecentExplorationState } from "@/lib/schema/appShell";

export const RECENT_EXPLORATION_KEY = "quran-corpus-recent-exploration";

export function readRecentExplorationState(): RecentExplorationState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(RECENT_EXPLORATION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RecentExplorationState;
  } catch {
    return null;
  }
}

export function writeRecentExplorationState(state: RecentExplorationState) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(RECENT_EXPLORATION_KEY, JSON.stringify(state));
  } catch {
    // Ignore localStorage errors.
  }
}

export function useRecentExplorationState() {
  const [recentExploration, setRecentExploration] = useState<RecentExplorationState | null>(null);

  useEffect(() => {
    setRecentExploration(readRecentExplorationState());

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== RECENT_EXPLORATION_KEY) return;
      setRecentExploration(readRecentExplorationState());
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return recentExploration;
}
