import type { CorpusToken, PartOfSpeech } from "@/lib/schema/types";

export interface MorphologyEntry {
  root: string;
  lemma: string;
  pos: PartOfSpeech;
  features: Record<string, string>;
  stem: string | null;
}

const MORPHOLOGY_URL = "/data/quranic-corpus-morphology-0.4.txt";

const BUCKWALTER_TO_ARABIC: Record<string, string> = {
  "'": "ء",
  "|": "آ",
  ">": "أ",
  "<": "إ",
  "&": "ؤ",
  "}": "ئ",
  "A": "ا",
  "b": "ب",
  "p": "ة",
  "t": "ت",
  "v": "ث",
  "j": "ج",
  "H": "ح",
  "x": "خ",
  "d": "د",
  "*": "ذ",
  "r": "ر",
  "z": "ز",
  "s": "س",
  "$": "ش",
  "S": "ص",
  "D": "ض",
  "T": "ط",
  "Z": "ظ",
  "E": "ع",
  "g": "غ",
  "f": "ف",
  "q": "ق",
  "k": "ك",
  "l": "ل",
  "m": "م",
  "n": "ن",
  "h": "ه",
  "w": "و",
  "Y": "ى",
  "y": "ي",
  "F": "ً",
  "N": "ٌ",
  "K": "ٍ",
  "a": "َ",
  "u": "ُ",
  "i": "ِ",
  "~": "ّ",
  "o": "ْ",
  "`": "ٰ",
  "{": "ٱ",
};

const BUCKWALTER_STRIP = new Set(["^", "@", "_", ".", ",", "2", "[", "]"]);
const ARABIC_HAMZA_ON_YA = "ئ";
const ARABIC_HAMZA_ON_WAW = "ؤ";
const ARABIC_HAMZA_ABOVE = "أ";
const ARABIC_HAMZA = "ء";
const ARABIC_YA = "ي";
const ARABIC_ALIF_MAQSURA = "ى";
const ARABIC_WAW = "و";
const LAST_HARAKA_KASRA = "i";
const LAST_HARAKA_DAMMA = "u";

function buckwalterToArabic(input: string): string {
  let output = "";
  let lastHaraka: string | null = null;
  let lastBaseArabic: string | null = null;

  for (let idx = 0; idx < input.length; idx++) {
    const ch = input[idx];
    if (BUCKWALTER_STRIP.has(ch)) continue;

    if (ch === "#") {
      const next = input[idx + 1] ?? "";
      let hamza = ARABIC_HAMZA;

      // Quranic corpus uses "_#" sequences where "#" is a contextual hamza placeholder.
      // Pick a readable seat based on nearby vocalization/base letters.
      if (lastHaraka === LAST_HARAKA_KASRA || lastBaseArabic === ARABIC_YA || lastBaseArabic === ARABIC_ALIF_MAQSURA) {
        hamza = ARABIC_HAMZA_ON_YA;
      } else if (lastHaraka === LAST_HARAKA_DAMMA || lastBaseArabic === ARABIC_WAW) {
        hamza = ARABIC_HAMZA_ON_WAW;
      } else if (next === "a" || next === "A") {
        hamza = ARABIC_HAMZA_ABOVE;
      }

      output += hamza;
      lastHaraka = null;
      lastBaseArabic = hamza;
      continue;
    }

    if (ch === "a" || ch === "u" || ch === "i" || ch === "o" || ch === "~" || ch === "F" || ch === "N" || ch === "K" || ch === "`") {
      lastHaraka = ch;
    } else {
      lastHaraka = null;
    }

    output += BUCKWALTER_TO_ARABIC[ch] ?? ch;
    if (ch !== "a" && ch !== "u" && ch !== "i" && ch !== "o" && ch !== "~" && ch !== "F" && ch !== "N" && ch !== "K" && ch !== "`") {
      lastBaseArabic = BUCKWALTER_TO_ARABIC[ch] ?? ch;
    }
  }
  return output;
}

function normalizePos(rawPos: string): PartOfSpeech {
  const pos = rawPos.toUpperCase();
  if (pos.startsWith("V")) return "V";
  if (pos === "ADJ") return "ADJ";
  if (pos === "PRON" || pos === "REL" || pos === "DEM") return "PRON";
  if (
    pos === "P" ||
    pos === "CONJ" ||
    pos === "DET" ||
    pos === "REM" ||
    pos === "INL" ||
    pos === "VOC" ||
    pos === "NEG" ||
    pos === "INTG" ||
    pos === "COND" ||
    pos === "SUB" ||
    pos === "RSLT" ||
    pos === "T"
  ) {
    return "P";
  }
  return "N";
}

function extractFeature(features: string[], key: string): string | null {
  const prefix = `${key}:`;
  const token = features.find((feature) => feature.startsWith(prefix));
  if (!token) return null;
  return token.slice(prefix.length);
}

function buildFeatureMap(features: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const token of features) {
    if (!token || token.startsWith("ROOT:") || token.startsWith("LEM:") || token.startsWith("POS:")) {
      continue;
    }
    if (token.includes(":")) {
      const [key, value] = token.split(":", 2);
      if (key && value) map[key] = value;
    } else {
      map[token] = "true";
    }
  }
  return map;
}

function parseMorphologyText(text: string): Map<string, MorphologyEntry> {
  const map = new Map<string, MorphologyEntry & { hasRoot: boolean }>();

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;

    const parts = line.split("\t");
    if (parts.length < 4) continue;

    const location = parts[0];
    const tag = parts[2]?.trim();
    const featureRaw = parts[3]?.trim() ?? "";

    const match = location.match(/\((\d+):(\d+):(\d+):(\d+)\)/);
    if (!match) continue;

    const key = `${match[1]}:${match[2]}:${match[3]}`;
    const featureTokens = featureRaw.split("|").filter(Boolean);
    const root = extractFeature(featureTokens, "ROOT");
    const lemma = extractFeature(featureTokens, "LEM");
    const posRaw = extractFeature(featureTokens, "POS") ?? tag;
    const normalizedPos = normalizePos(posRaw || "N");

    const entry = map.get(key) ?? {
      root: "",
      lemma: "",
      pos: normalizedPos,
      features: {},
      stem: null,
      hasRoot: false,
    };

    if (root) {
      entry.root = buckwalterToArabic(root);
      entry.lemma = lemma ? buckwalterToArabic(lemma) : entry.lemma;
      entry.pos = normalizedPos;
      entry.features = buildFeatureMap(featureTokens);
      entry.stem = entry.lemma || entry.stem;
      entry.hasRoot = true;
    } else if (!entry.hasRoot) {
      if (!entry.lemma) {
        entry.lemma = lemma ? buckwalterToArabic(lemma) : entry.lemma;
      }
      if (!entry.lemma && parts[1]) {
        entry.lemma = buckwalterToArabic(parts[1]);
      }
      entry.pos = entry.pos || normalizedPos;
      entry.features = entry.features && Object.keys(entry.features).length > 0
        ? entry.features
        : buildFeatureMap(featureTokens);
      entry.stem = entry.lemma || entry.stem;
    }

    map.set(key, entry);
  }

  // Strip internal flag before returning
  const result = new Map<string, MorphologyEntry>();
  for (const [key, value] of map.entries()) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { hasRoot: _hasRoot, ...entry } = value;
    result.set(key, entry);
  }
  return result;
}

let morphologyMap: Map<string, MorphologyEntry> | null = null;
let morphologyPromise: Promise<Map<string, MorphologyEntry>> | null = null;

export async function loadMorphologyMap(): Promise<Map<string, MorphologyEntry>> {
  if (morphologyMap) return morphologyMap;
  if (!morphologyPromise) {
    morphologyPromise = (async () => {
      const response = await fetch(MORPHOLOGY_URL);
      if (!response.ok) {
        throw new Error(`Failed to load morphology data: ${response.status} ${response.statusText}`);
      }
      const text = await response.text();
      morphologyMap = parseMorphologyText(text);
      return morphologyMap;
    })();
  }
  return morphologyPromise;
}

export function buildSampleMorphologyMap(tokens: CorpusToken[]): Map<string, MorphologyEntry> {
  return new Map(
    tokens.map((token) => [
      token.id,
      {
        root: token.root,
        lemma: token.lemma,
        pos: token.pos,
        features: token.morphology.features,
        stem: token.morphology.stem,
      },
    ])
  );
}
