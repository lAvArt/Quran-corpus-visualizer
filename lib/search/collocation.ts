import type { CorpusToken } from "@/lib/schema/types";

export interface CollocationOptions {
  windowType: "ayah" | "distance";
  distance?: number; // e.g., 3 means +/- 3 tokens
  minFrequency?: number; // Minimum number of times the collocate must appear with the target
}

export interface CollocationResult {
  root: string;
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
  rootFrequencies: Map<string, number>;
  rootAyahFrequencies: Map<string, number>; // Number of ayahs each root appears in
}

/**
 * Pre-calculate frequencies for the entire corpus to speed up PMI calculations.
 */
export function calculateRootFrequencies(tokens: CorpusToken[]): RootFrequencyData {
  const rootFrequencies = new Map<string, number>();
  const rootAyahFrequencies = new Map<string, number>();
  
  const ayahIds = new Set<string>();
  const rootAyahTracker = new Map<string, Set<string>>();

  for (const token of tokens) {
    if (!token.root) continue;
    
    // Total raw count
    rootFrequencies.set(token.root, (rootFrequencies.get(token.root) || 0) + 1);

    const ayahId = `${token.sura}:${token.ayah}`;
    ayahIds.add(ayahId);
    
    // Ayah document frequency
    let ayahSet = rootAyahTracker.get(token.root);
    if (!ayahSet) {
      ayahSet = new Set<string>();
      rootAyahTracker.set(token.root, ayahSet);
    }
    if (!ayahSet.has(ayahId)) {
      ayahSet.add(ayahId);
      rootAyahFrequencies.set(token.root, (rootAyahFrequencies.get(token.root) || 0) + 1);
    }
  }

  return {
    totalTokens: tokens.length,
    totalAyahs: ayahIds.size,
    rootFrequencies,
    rootAyahFrequencies,
  };
}

/**
 * Finds roots that co-occur with the target root.
 */
export function getCollocations(
  targetRoot: string,
  tokens: CorpusToken[], // The sorted full corpus
  freqData: RootFrequencyData,
  options: CollocationOptions
): CollocationResult[] {
  const { windowType, distance = 3, minFrequency = 1 } = options;
  
  const cooccurrences = new Map<string, number>();
  const collocateLemmas = new Map<string, Set<string>>();
  const collocateWindows = new Map<string, Set<string>>();

  // Find all indices of the target root
  const targetIndices: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].root === targetRoot) {
      targetIndices.push(i);
    }
  }

  if (targetIndices.length === 0) return [];

  // Used to prevent counting the same root twice in the same window
  // (Optional depending on rigorous PMI definition, but standard for document-level collocation)
  const countRoot = (
    root: string,
    lemma: string,
    windowId: string,
    windowLabel: string,
    tracker: Map<string, Set<string>>
  ) => {
    let windowSet = tracker.get(root);
    if (!windowSet) {
      windowSet = new Set<string>();
      tracker.set(root, windowSet);
    }
    
    if (!windowSet.has(windowId)) {
      windowSet.add(windowId);
      cooccurrences.set(root, (cooccurrences.get(root) || 0) + 1);
    }

    let lemmas = collocateLemmas.get(root);
    if (!lemmas) {
      lemmas = new Set<string>();
      collocateLemmas.set(root, lemmas);
    }
    if (lemma) lemmas.add(lemma);

    let windows = collocateWindows.get(root);
    if (!windows) {
      windows = new Set<string>();
      collocateWindows.set(root, windows);
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
        if (j !== i && collocate.root && collocate.root !== targetRoot) {
          countRoot(collocate.root, collocate.lemma, windowId, windowLabel, windowTracker);
        }
      }
    } else {
      // Distance-based window
      const start = Math.max(0, i - distance);
      const end = Math.min(tokens.length - 1, i + distance);
      // We use 'i' as the windowId to tie it to this specific instance of the target root
      const windowId = `idx:${i}`;
      const windowLabel = `${targetToken.sura}:${targetToken.ayah}:${targetToken.position}`;

      for (let j = start; j <= end; j++) {
        const collocate = tokens[j];
        if (j !== i && collocate.root && collocate.root !== targetRoot) {
          countRoot(collocate.root, collocate.lemma, windowId, windowLabel, windowTracker);
        }
      }
    }
  }

  const results: CollocationResult[] = [];
  
  // N = total documents/windows in the corpus
  const N = windowType === "ayah" ? freqData.totalAyahs : freqData.totalTokens;
  const targetFreq = windowType === "ayah" 
    ? (freqData.rootAyahFrequencies.get(targetRoot) || 0)
    : (freqData.rootFrequencies.get(targetRoot) || 0);

  if (targetFreq === 0) return results; // Should not happen given we found indices

  // Calculate PMI
  for (const [collocateRoot, count] of cooccurrences.entries()) {
    if (count < minFrequency) continue;

    const collocateFreq = windowType === "ayah"
      ? (freqData.rootAyahFrequencies.get(collocateRoot) || 0)
      : (freqData.rootFrequencies.get(collocateRoot) || 0);

    if (collocateFreq === 0) continue;

    // PMI = log2( P(x, y) / (P(x) * P(y)) )
    // P(x, y) = count / N
    // P(x) = targetFreq / N
    // P(y) = collocateFreq / N
    // => PMI = log2( (count * N) / (targetFreq * collocateFreq) )
    const pmi = Math.log2((count * N) / (targetFreq * collocateFreq));

    results.push({
      root: collocateRoot,
      count,
      pmi,
      sampleLemmas: Array.from(collocateLemmas.get(collocateRoot) || []).slice(0, 8),
      sampleWindows: Array.from(collocateWindows.get(collocateRoot) || []).slice(0, 8),
    });
  }

  // Sort by PMI descending, then by raw count
  return results.sort((a, b) => b.pmi - a.pmi || b.count - a.count);
}
