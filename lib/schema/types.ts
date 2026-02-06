export type PartOfSpeech = "N" | "V" | "P" | "ADJ" | "PRON";

export interface Morphology {
  features: Record<string, string>;
  gloss: string | null;
  stem: string | null;
}

export interface CorpusToken {
  id: string;
  sura: number;
  ayah: number;
  position: number;
  text: string;
  root: string;
  lemma: string;
  pos: PartOfSpeech;
  morphology: Morphology;
}

export interface RootWordFlow {
  root: string;
  lemma: string;
  count: number;
  tokenIds: string[];
}

export interface AyahRecord {
  id: string;
  suraId: number;
  ayahNumber: number;
  textUthmani: string;
  textSimple?: string;
  tokenIds: string[];
}

export interface DependencyEdge {
  id: string;
  ayahId: string;
  dependentTokenId: string;
  headTokenId: string;
  relation: string;
}

export interface AyahDependencyData {
  ayah: AyahRecord;
  tokens: CorpusToken[];
  dependencies: DependencyEdge[];
}
