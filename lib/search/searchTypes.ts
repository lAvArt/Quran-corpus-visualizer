import type { VisualizationMode } from "@/lib/schema/visualizationTypes";

export type SearchSurface = "quick" | "workspace" | "mobile";

export type SearchResultKind =
  | "ayah"
  | "surah"
  | "root"
  | "lemma"
  | "token"
  | "gloss"
  | "translation"
  | "semantic";

export interface SearchResultItem {
  id: string;
  kind: SearchResultKind;
  title: string;
  subtitle?: string;
  arabicText?: string;
  location?: {
    surah: number;
    ayah?: number;
    tokenId?: string;
  };
  relevanceLabel?: string;
  explanation?: string;
  matchedRoot?: string;
  matchedLemma?: string;
  matchedText?: string;
  actionTarget: {
    routeMode: "explore" | "search" | "study";
    visualizationMode?: VisualizationMode;
    selection?: {
      surahId?: number;
      ayah?: number;
      root?: string;
      lemma?: string;
      tokenId?: string;
    };
    /** Calm first contact (home → graph): land with the left dock collapsed
     *  and the inspector drawer closed so the focused canvas is the only
     *  thing on screen; chrome reveals as the user reaches for it. */
    calmEntry?: boolean;
  };
}
