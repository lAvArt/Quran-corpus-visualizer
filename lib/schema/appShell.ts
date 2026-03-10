import type { VisualizationMode } from "@/lib/schema/visualizationTypes";

export type AppMode = "explore" | "search" | "study";

export interface AppShellState {
  mode: AppMode;
  activeVisualization: VisualizationMode;
  selectedSurahId?: number;
  selectedAyah?: number;
  selectedRoot?: string;
  selectedLemma?: string;
}

export interface RecentExplorationState {
  lastVisualizationMode: VisualizationMode;
  lastSurahId?: number;
  lastAyah?: number;
  lastRoot?: string;
  lastLemma?: string;
  updatedAt: string;
}

export interface StudySummary {
  trackedRootCount: number;
  learningCount: number;
  learnedCount: number;
  recentRoots: string[];
  hasPendingMigration: boolean;
}
