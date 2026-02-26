import type { CorpusToken, PartOfSpeech } from "@/lib/schema/types";

export type CollocationTermKind = "root" | "lemma";

export interface CollocationTerm {
  kind: CollocationTermKind;
  value: string;
}

export interface CollocateFilter {
  pos?: PartOfSpeech[];
  lemma?: string;
  root?: string;
}

export interface CollocationOptions {
  windowType: "ayah" | "distance" | "surah";
  distance?: number; // e.g., 3 means +/- 3 tokens
  minFrequency?: number; // Minimum number of times the collocate must appear with the target
  groupBy?: CollocationTermKind;
  filter?: CollocateFilter;
  pairTerm?: CollocationTerm | null;
}

export interface CollocationResult {
  // For backward compatibility with existing consumers; equals `label`.
  root: string;
  label: string;
  groupBy: CollocationTermKind;
  count: number; // Co-occurrence count
  pmi: number; // Pointwise Mutual Information
  // Include lemma data for display purposes
  sampleLemmas: string[];
  // Sample windows where the collocation appears (e.g. "2:255" or "2:255:7")
  sampleWindows: string[];
}

export interface RootFrequencyData {
  totalTokens: number;
  totalAyahs: number;
  totalSurahs: number;
  rootFrequencies: Map<string, number>;
  rootAyahFrequencies: Map<string, number>; // Number of ayahs each root appears in
  rootSurahFrequencies: Map<string, number>; // Number of surahs each root appears in
  lemmaFrequencies: Map<string, number>;
  lemmaAyahFrequencies: Map<string, number>; // Number of ayahs each lemma appears in
  lemmaSurahFrequencies: Map<string, number>; // Number of surahs each lemma appears in
}

export interface PairCooccurrenceResult {
  termA: CollocationTerm;
  termB: CollocationTerm;
  windowsA: string[];
  windowsB: string[];
  sharedWindows: string[];
  countA: number;
  countB: number;
  cooccurrenceCount: number;
}

const ARABIC_DIACRITICS_REGEX = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const TATWEEL_REGEX = /\u0640/g;
const WEAK_FINAL_ROOT_CHARS = new Set(["ا", "ى", "ي", "و"]);
const COMMON_SUFFIXES = [
  "كما",
  "كم",
  "كن",
  "هما",
  "هم",
  "هن",
  "نا",
  "ها",
  "ه",
  "ك",
  "ي",
];

function normalizeArabicForMatch(value: string): string {
  if (!value) return "";
  return value
    .normalize("NFKC")
    .replace(TATWEEL_REGEX, "")
    .replace(ARABIC_DIACRITICS_REGEX, "")
    .trim();
}

function normalizeRootFamily(value: string): string {
  const normalized = normalizeArabicForMatch(value);
  if (!normalized) return normalized;
  const chars = [...normalized];
  const last = chars[chars.length - 1];
  if (last && WEAK_FINAL_ROOT_CHARS.has(last)) {
    chars[chars.length - 1] = "ى";
  }
  return chars.join("");
}

function lemmaCandidates(value: string): Set<string> {
  const base = normalizeArabicForMatch(value);
  const candidates = new Set<string>();
  if (!base) return candidates;
  candidates.add(base);
  for (const suffix of COMMON_SUFFIXES) {
    if (base.length > suffix.length + 1 && base.endsWith(suffix)) {
      candidates.add(base.slice(0, -suffix.length));
    }
  }
  return candidates;
}

/**
 * Pre-calculate frequencies for the entire corpus to speed up PMI calculations.
 */
export function calculateRootFrequencies(tokens: CorpusToken[]): RootFrequencyData {
  const rootFrequencies = new Map<string, number>();
  const rootAyahFrequencies = new Map<string, number>();
  const rootSurahFrequencies = new Map<string, number>();
  const lemmaFrequencies = new Map<string, number>();
  const lemmaAyahFrequencies = new Map<string, number>();
  const lemmaSurahFrequencies = new Map<string, number>();
  
  const ayahIds = new Set<string>();
  const surahIds = new Set<number>();
  const rootAyahTracker = new Map<string, Set<string>>();
  const rootSurahTracker = new Map<string, Set<number>>();
  const lemmaAyahTracker = new Map<string, Set<string>>();
  const lemmaSurahTracker = new Map<string, Set<number>>();

  for (const token of tokens) {
    const ayahId = `${token.sura}:${token.ayah}`;
    ayahIds.add(ayahId);
    surahIds.add(token.sura);

    if (token.root) {
      // Total raw root count
      rootFrequencies.set(token.root, (rootFrequencies.get(token.root) || 0) + 1);

      // Root ayah document frequency
      let ayahSet = rootAyahTracker.get(token.root);
      if (!ayahSet) {
        ayahSet = new Set<string>();
        rootAyahTracker.set(token.root, ayahSet);
      }
      if (!ayahSet.has(ayahId)) {
        ayahSet.add(ayahId);
        rootAyahFrequencies.set(token.root, (rootAyahFrequencies.get(token.root) || 0) + 1);
      }

      let surahSet = rootSurahTracker.get(token.root);
      if (!surahSet) {
        surahSet = new Set<number>();
        rootSurahTracker.set(token.root, surahSet);
      }
      if (!surahSet.has(token.sura)) {
        surahSet.add(token.sura);
        rootSurahFrequencies.set(token.root, (rootSurahFrequencies.get(token.root) || 0) + 1);
      }
    }

    if (token.lemma) {
      // Total raw lemma count
      lemmaFrequencies.set(token.lemma, (lemmaFrequencies.get(token.lemma) || 0) + 1);

      // Lemma ayah document frequency
      let ayahSet = lemmaAyahTracker.get(token.lemma);
      if (!ayahSet) {
        ayahSet = new Set<string>();
        lemmaAyahTracker.set(token.lemma, ayahSet);
      }
      if (!ayahSet.has(ayahId)) {
        ayahSet.add(ayahId);
        lemmaAyahFrequencies.set(token.lemma, (lemmaAyahFrequencies.get(token.lemma) || 0) + 1);
      }

      let surahSet = lemmaSurahTracker.get(token.lemma);
      if (!surahSet) {
        surahSet = new Set<number>();
        lemmaSurahTracker.set(token.lemma, surahSet);
      }
      if (!surahSet.has(token.sura)) {
        surahSet.add(token.sura);
        lemmaSurahFrequencies.set(token.lemma, (lemmaSurahFrequencies.get(token.lemma) || 0) + 1);
      }
    }
  }

  return {
    totalTokens: tokens.length,
    totalAyahs: ayahIds.size,
    totalSurahs: surahIds.size,
    rootFrequencies,
    rootAyahFrequencies,
    rootSurahFrequencies,
    lemmaFrequencies,
    lemmaAyahFrequencies,
    lemmaSurahFrequencies,
  };
}

function normalizeTerm(term: string | CollocationTerm): CollocationTerm {
  if (typeof term === "string") {
    return { kind: "root", value: term };
  }
  return term;
}

function getTokenValueByKind(token: CorpusToken, kind: CollocationTermKind): string {
  return kind === "root" ? token.root : token.lemma;
}

function tokenMatchesTerm(token: CorpusToken, term: CollocationTerm): boolean {
  if (term.kind === "root") {
    if (!token.root) return false;
    const tokenRoot = normalizeArabicForMatch(token.root);
    const termRoot = normalizeArabicForMatch(term.value);
    if (tokenRoot === termRoot) return true;
    return normalizeRootFamily(tokenRoot) === normalizeRootFamily(termRoot);
  }

  const tokenLemma = normalizeArabicForMatch(token.lemma);
  const tokenText = normalizeArabicForMatch(token.text);
  const candidates = lemmaCandidates(term.value);
  if (candidates.size === 0) return false;
  for (const candidate of candidates) {
    if (candidate === tokenLemma || candidate === tokenText) return true;
  }
  return false;
}

function tokenMatchesFilter(token: CorpusToken, filter?: CollocateFilter): boolean {
  if (!filter) return true;
  if (filter.pos && filter.pos.length > 0 && !filter.pos.includes(token.pos)) return false;
  if (filter.lemma) {
    const candidates = lemmaCandidates(filter.lemma);
    const tokenLemma = normalizeArabicForMatch(token.lemma);
    const tokenText = normalizeArabicForMatch(token.text);
    let ok = false;
    for (const candidate of candidates) {
      if (candidate === tokenLemma || candidate === tokenText) {
        ok = true;
        break;
      }
    }
    if (!ok) return false;
  }
  if (filter.root) {
    const tokenRoot = normalizeArabicForMatch(token.root);
    const rootValue = normalizeArabicForMatch(filter.root);
    if (tokenRoot !== rootValue && normalizeRootFamily(tokenRoot) !== normalizeRootFamily(rootValue)) {
      return false;
    }
  }
  return true;
}

function getFrequencyFlexible(map: Map<string, number>, value: string): number {
  const exact = map.get(value);
  if (typeof exact === "number") return exact;

  const normalized = normalizeArabicForMatch(value);
  if (!normalized) return 0;

  let total = 0;
  for (const [key, count] of map.entries()) {
    if (normalizeArabicForMatch(key) === normalized) {
      total += count;
    }
  }
  return total;
}

function getFrequencyForTerm(
  freqData: RootFrequencyData,
  term: CollocationTerm,
  windowType: CollocationOptions["windowType"]
): number {
  if (term.kind === "lemma") {
    const source = windowType === "ayah"
      ? freqData.lemmaAyahFrequencies
      : windowType === "surah"
        ? freqData.lemmaSurahFrequencies
        : freqData.lemmaFrequencies;
    const candidates = lemmaCandidates(term.value);
    if (candidates.size === 0) return 0;
    let total = 0;
    for (const [key, count] of source.entries()) {
      if (candidates.has(normalizeArabicForMatch(key))) {
        total += count;
      }
    }
    return total;
  }

  const source = windowType === "ayah"
    ? freqData.rootAyahFrequencies
    : windowType === "surah"
      ? freqData.rootSurahFrequencies
      : freqData.rootFrequencies;
  const targetFamily = normalizeRootFamily(term.value);
  if (!targetFamily) return 0;
  let total = 0;
  for (const [key, count] of source.entries()) {
    if (normalizeRootFamily(key) === targetFamily) {
      total += count;
    }
  }
  return total;
}

function getFrequencyForGroupedValue(
  freqData: RootFrequencyData,
  groupBy: CollocationTermKind,
  value: string,
  windowType: CollocationOptions["windowType"]
): number {
  if (groupBy === "lemma") {
    return windowType === "ayah"
      ? getFrequencyFlexible(freqData.lemmaAyahFrequencies, value)
      : windowType === "surah"
        ? getFrequencyFlexible(freqData.lemmaSurahFrequencies, value)
        : getFrequencyFlexible(freqData.lemmaFrequencies, value);
  }

  return windowType === "ayah"
    ? getFrequencyFlexible(freqData.rootAyahFrequencies, value)
    : windowType === "surah"
      ? getFrequencyFlexible(freqData.rootSurahFrequencies, value)
      : getFrequencyFlexible(freqData.rootFrequencies, value);
}

/**
 * Finds roots that co-occur with the target root.
 */
export function getCollocations(
  targetRoot: string | CollocationTerm,
  tokens: CorpusToken[], // The sorted full corpus
  freqData: RootFrequencyData,
  options: CollocationOptions
): CollocationResult[] {
  const {
    windowType,
    distance = 3,
    minFrequency = 1,
    groupBy = "root",
    filter,
    pairTerm = null,
  } = options;
  const targetTerm = normalizeTerm(targetRoot);
  
  const cooccurrences = new Map<string, number>();
  const collocateLemmas = new Map<string, Set<string>>();
  const collocateWindows = new Map<string, Set<string>>();

  // Find all indices of the target term
  const targetIndices: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokenMatchesTerm(tokens[i], targetTerm)) {
      targetIndices.push(i);
    }
  }

  if (targetIndices.length === 0) return [];

  // Used to prevent counting the same root twice in the same window
  // (Optional depending on rigorous PMI definition, but standard for document-level collocation)
  const countGroupValue = (
    groupValue: string,
    lemma: string,
    windowId: string,
    windowLabel: string,
    tracker: Map<string, Set<string>>
  ) => {
    let windowSet = tracker.get(groupValue);
    if (!windowSet) {
      windowSet = new Set<string>();
      tracker.set(groupValue, windowSet);
    }
    
    if (!windowSet.has(windowId)) {
      windowSet.add(windowId);
      cooccurrences.set(groupValue, (cooccurrences.get(groupValue) || 0) + 1);
    }

    let lemmas = collocateLemmas.get(groupValue);
    if (!lemmas) {
      lemmas = new Set<string>();
      collocateLemmas.set(groupValue, lemmas);
    }
    if (lemma) lemmas.add(lemma);

    let windows = collocateWindows.get(groupValue);
    if (!windows) {
      windows = new Set<string>();
      collocateWindows.set(groupValue, windows);
    }
    windows.add(windowLabel);
  };

  const windowTracker = new Map<string, Set<string>>();

  // Scan windows
  for (const i of targetIndices) {
    const targetToken = tokens[i];
    
    if (windowType === "ayah") {
      // Find boundaries of the current ayah
      let start = i;
      while (start > 0 && tokens[start - 1].sura === targetToken.sura && tokens[start - 1].ayah === targetToken.ayah) {
        start--;
      }
      let end = i;
      while (end < tokens.length - 1 && tokens[end + 1].sura === targetToken.sura && tokens[end + 1].ayah === targetToken.ayah) {
        end++;
      }
      
      const windowId = `${targetToken.sura}:${targetToken.ayah}`;
      const windowLabel = windowId;
      
      for (let j = start; j <= end; j++) {
        const collocate = tokens[j];
        if (j === i) continue;
        const groupValue = getTokenValueByKind(collocate, groupBy);
        if (!groupValue) continue;
        if (tokenMatchesTerm(collocate, targetTerm)) continue;
        if (pairTerm && !tokenMatchesTerm(collocate, pairTerm)) continue;
        if (!tokenMatchesFilter(collocate, filter)) continue;
        countGroupValue(groupValue, collocate.lemma, windowId, windowLabel, windowTracker);
      }
    } else if (windowType === "distance") {
      // Distance-based window
      const start = Math.max(0, i - distance);
      const end = Math.min(tokens.length - 1, i + distance);
      // We use 'i' as the windowId to tie it to this specific instance of the target root
      const windowId = `idx:${i}`;
      const windowLabel = `${targetToken.sura}:${targetToken.ayah}:${targetToken.position}`;

      for (let j = start; j <= end; j++) {
        const collocate = tokens[j];
        if (j === i) continue;
        const groupValue = getTokenValueByKind(collocate, groupBy);
        if (!groupValue) continue;
        if (tokenMatchesTerm(collocate, targetTerm)) continue;
        if (pairTerm && !tokenMatchesTerm(collocate, pairTerm)) continue;
        if (!tokenMatchesFilter(collocate, filter)) continue;
        countGroupValue(groupValue, collocate.lemma, windowId, windowLabel, windowTracker);
      }
    } else {
      // Surah-based window
      let start = i;
      while (start > 0 && tokens[start - 1].sura === targetToken.sura) {
        start--;
      }
      let end = i;
      while (end < tokens.length - 1 && tokens[end + 1].sura === targetToken.sura) {
        end++;
      }

      const windowId = `s:${targetToken.sura}`;
      const windowLabel = `${targetToken.sura}`;

      for (let j = start; j <= end; j++) {
        const collocate = tokens[j];
        if (j === i) continue;
        const groupValue = getTokenValueByKind(collocate, groupBy);
        if (!groupValue) continue;
        if (tokenMatchesTerm(collocate, targetTerm)) continue;
        if (pairTerm && !tokenMatchesTerm(collocate, pairTerm)) continue;
        if (!tokenMatchesFilter(collocate, filter)) continue;
        countGroupValue(groupValue, collocate.lemma, windowId, windowLabel, windowTracker);
      }
    }
  }

  const results: CollocationResult[] = [];
  
  // N = total documents/windows in the corpus
  const N = windowType === "ayah"
    ? freqData.totalAyahs
    : windowType === "surah"
      ? freqData.totalSurahs
      : freqData.totalTokens;
  const targetFreq = getFrequencyForTerm(freqData, targetTerm, windowType);

  if (targetFreq === 0) return results; // Should not happen given we found indices

  // Calculate PMI
  for (const [collocateValue, count] of cooccurrences.entries()) {
    if (count < minFrequency) continue;

    const collocateFreq = getFrequencyForGroupedValue(freqData, groupBy, collocateValue, windowType);

    if (collocateFreq === 0) continue;

    // PMI = log2( P(x, y) / (P(x) * P(y)) )
    // P(x, y) = count / N
    // P(x) = targetFreq / N
    // P(y) = collocateFreq / N
    // => PMI = log2( (count * N) / (targetFreq * collocateFreq) )
    const pmi = Math.log2((count * N) / (targetFreq * collocateFreq));

    results.push({
      root: collocateValue,
      label: collocateValue,
      groupBy,
      count,
      pmi,
      sampleLemmas: Array.from(collocateLemmas.get(collocateValue) || []).slice(0, 8),
      sampleWindows: Array.from(collocateWindows.get(collocateValue) || []).slice(0, 8),
    });
  }

  // Sort by PMI descending, then by raw count
  return results.sort((a, b) => b.pmi - a.pmi || b.count - a.count);
}

/**
 * Returns explicit pair co-occurrence counts and sample shared windows.
 * For distance windows, shared windows are A-centered windows that contain B.
 */
export function getPairCooccurrence(
  termAInput: CollocationTerm,
  termBInput: CollocationTerm,
  tokens: CorpusToken[],
  options: Pick<CollocationOptions, "windowType" | "distance">
): PairCooccurrenceResult {
  const termA = normalizeTerm(termAInput);
  const termB = normalizeTerm(termBInput);
  const { windowType, distance = 3 } = options;

  const windowsA = new Set<string>();
  const windowsB = new Set<string>();
  const shared = new Set<string>();

  const aIndices: number[] = [];
  const bIndices: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokenMatchesTerm(tokens[i], termA)) aIndices.push(i);
    if (tokenMatchesTerm(tokens[i], termB)) bIndices.push(i);
  }

  if (windowType === "ayah") {
    for (const i of aIndices) {
      const token = tokens[i];
      windowsA.add(`${token.sura}:${token.ayah}`);
    }
    for (const i of bIndices) {
      const token = tokens[i];
      windowsB.add(`${token.sura}:${token.ayah}`);
    }
    for (const id of windowsA) {
      if (windowsB.has(id)) shared.add(id);
    }
  } else if (windowType === "distance") {
    for (const i of aIndices) {
      const tokenA = tokens[i];
      const labelA = `${tokenA.sura}:${tokenA.ayah}:${tokenA.position}`;
      windowsA.add(labelA);

      const start = Math.max(0, i - distance);
      const end = Math.min(tokens.length - 1, i + distance);
      for (let j = start; j <= end; j++) {
        if (j === i) continue;
        if (tokenMatchesTerm(tokens[j], termB)) {
          shared.add(labelA);
          break;
        }
      }
    }

    for (const i of bIndices) {
      const tokenB = tokens[i];
      windowsB.add(`${tokenB.sura}:${tokenB.ayah}:${tokenB.position}`);
    }
  } else {
    for (const i of aIndices) {
      const token = tokens[i];
      windowsA.add(`${token.sura}`);
    }
    for (const i of bIndices) {
      const token = tokens[i];
      windowsB.add(`${token.sura}`);
    }
    for (const surah of windowsA) {
      if (windowsB.has(surah)) shared.add(surah);
    }
  }

  return {
    termA,
    termB,
    windowsA: Array.from(windowsA),
    windowsB: Array.from(windowsB),
    sharedWindows: Array.from(shared),
    countA: windowsA.size,
    countB: windowsB.size,
    cooccurrenceCount: shared.size,
  };
}
