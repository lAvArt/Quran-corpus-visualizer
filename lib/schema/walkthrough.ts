import type { VisualizationMode } from "@/lib/schema/visualizationTypes";

export type WalkthroughStepId =
  | "welcome"
  | "header-controls"
  | "global-search"
  | "visualization-switcher"
  | "main-canvas"
  | "corpus-architecture"
  | "root-network"
  | "current-selection"
  | "legend"
  | "dependency-tree"
  | "mobile-welcome"
  | "mobile-search"
  | "mobile-tools";

export type WalkthroughAction = "none" | "set-viz-mode";

export type WalkthroughPlacement = "center" | "top" | "bottom" | "left" | "right";

export interface WalkthroughStepConfig {
  id: WalkthroughStepId;
  titleKey: string;
  bodyKey: string;
  targetSelector?: string;
  placement: WalkthroughPlacement;
  action?: WalkthroughAction;
  actionMode?: VisualizationMode;
  openToolsSidebar?: boolean;
}
