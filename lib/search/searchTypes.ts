import type { VisualizationMode } from "@/lib/schema/visualizationTypes";

export type SearchSurface = "quick" | "workspace" | "mobile";

export type SearchResultKind =
  | "ayah"
  | "root"
  | "lemma"
  | "token"
  | "gloss"
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
  };
}
