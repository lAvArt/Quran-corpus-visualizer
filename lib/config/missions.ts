import type { VisualizationMode } from "@/lib/schema/visualizationTypes";

export type MissionIntent =
  | "discover-structure"
  | "trace-root"
  | "inspect-verse"
  | "test-knowledge";

export type MissionTaskId =
  | "search"
  | "select-token"
  | "switch-viz";

export interface MissionTask {
  id: MissionTaskId;
  /** i18n key under `FirstRunMission.tasks` */
  titleKey: string;
}

export interface MissionConfig {
  intent: MissionIntent;
  /** i18n key under `FirstRunMission.intents` */
  titleKey: string;
  descriptionKey: string;
  /** Visualization to open when user picks this intent */
  vizMode: VisualizationMode;
  /** Optional preset state to inject */
  preset?: {
    surahId?: number;
    rootValue?: string;
  };
  /** Ordered list of micro-tasks the user should complete */
  tasks: MissionTask[];
}

export const MISSIONS: MissionConfig[] = [
  {
    intent: "discover-structure",
    titleKey: "intents.discoverStructure.title",
    descriptionKey: "intents.discoverStructure.description",
    vizMode: "surah-distribution",
    tasks: [
      { id: "search", titleKey: "tasks.searchSurah" },
      { id: "select-token", titleKey: "tasks.selectToken" },
      { id: "switch-viz", titleKey: "tasks.switchViz" },
    ],
  },
  {
    intent: "trace-root",
    titleKey: "intents.traceRoot.title",
    descriptionKey: "intents.traceRoot.description",
    vizMode: "root-network",
    preset: { rootValue: "رحم" },
    tasks: [
      { id: "search", titleKey: "tasks.searchRoot" },
      { id: "select-token", titleKey: "tasks.selectOccurrence" },
      { id: "switch-viz", titleKey: "tasks.switchViz" },
    ],
  },
  {
    intent: "inspect-verse",
    titleKey: "intents.inspectVerse.title",
    descriptionKey: "intents.inspectVerse.description",
    vizMode: "radial-sura",
    preset: { surahId: 1 },
    tasks: [
      { id: "select-token", titleKey: "tasks.selectWord" },
      { id: "search", titleKey: "tasks.searchGrammar" },
      { id: "switch-viz", titleKey: "tasks.switchViz" },
    ],
  },
  {
    intent: "test-knowledge",
    titleKey: "intents.testKnowledge.title",
    descriptionKey: "intents.testKnowledge.description",
    vizMode: "knowledge-graph",
    tasks: [
      { id: "search", titleKey: "tasks.searchAny" },
      { id: "select-token", titleKey: "tasks.selectToken" },
      { id: "switch-viz", titleKey: "tasks.switchViz" },
    ],
  },
];

export function getMissionByIntent(intent: MissionIntent): MissionConfig {
  return MISSIONS.find((m) => m.intent === intent)!;
}
