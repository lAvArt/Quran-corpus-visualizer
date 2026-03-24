/**
 * Quiz question templates — each generates questions from corpus data.
 * Every answer is derived from the same data the question was generated from.
 */

import type { CorpusToken } from "@/lib/schema/types";
import type { RootFrequencyData } from "@/lib/search/collocation";

// ── Types ──────────────────────────────────────────────────────────

export type Difficulty = "easy" | "medium" | "hard";

export interface QuizQuestion {
  id: string;
  templateType: QuestionTemplateType;
  difficulty: Difficulty;
  prompt: string;
  choices: string[];
  correctIndex: number;
  /** Shown after answering — explains the corpus data behind the answer */
  explanation: string;
  /** The root this question is about (for personalized quiz weighting) */
  subjectRoot: string | null;
}

export type QuestionTemplateType =
  | "root-frequency"
  | "surah-distribution"
  | "root-identification"
  | "gloss-matching"
  | "comparative-frequency"
  | "morphology-pos"
  | "collocation";

export interface QuizCorpusData {
  tokens: CorpusToken[];
  freqData: RootFrequencyData;
  glosses: ReadonlyMap<string, string>;
  surahNames: Record<number, { name: string; arabic: string; verses: number }>;
}

/** A seeded PRNG function: () => number in [0, 1) */
export type SeededRng = () => number;

export interface QuestionTemplate {
  type: QuestionTemplateType;
  difficulty: Difficulty;
  /** Can this template produce a question given the data? */
  canGenerate: (data: QuizCorpusData) => boolean;
  /** Generate one question. Returns null if it can't find suitable data. */
  generate: (data: QuizCorpusData, rng: SeededRng, usedRoots: Set<string>) => QuizQuestion | null;
}

// ── Helpers ────────────────────────────────────────────────────────

/** Pick a random element from an array using the seeded RNG */
function pick<T>(arr: T[], rng: SeededRng): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Shuffle array in-place using Fisher-Yates with seeded RNG */
function shuffle<T>(arr: T[], rng: SeededRng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Format a large number with locale-style commas */
function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Get "quiz-worthy" roots: frequency > 10, appears in 5+ surahs.
 * Optionally filter to only roots with glosses.
 */
function getQuizWorthyRoots(
  data: QuizCorpusData,
  requireGloss: boolean,
): string[] {
  const roots: string[] = [];
  for (const [root, freq] of data.freqData.rootFrequencies) {
    if (freq <= 10) continue;
    const surahCount = data.freqData.rootSurahFrequencies.get(root) ?? 0;
    if (surahCount < 5) continue;
    if (requireGloss && !data.glosses.has(root)) continue;
    roots.push(root);
  }
  return roots;
}

/** Pick a root not in usedRoots, mark it used, return it. Returns null if none available. */
function pickFreshRoot(candidates: string[], rng: SeededRng, usedRoots: Set<string>): string | null {
  const available = candidates.filter((r) => !usedRoots.has(r));
  if (available.length === 0) return null;
  const root = pick(available, rng);
  usedRoots.add(root);
  return root;
}

/** Generate N distinct distractors from a pool, excluding the correct answer */
function pickDistractors(pool: string[], correct: string, count: number, rng: SeededRng): string[] {
  const options = pool.filter((x) => x !== correct);
  shuffle(options, rng);
  return options.slice(0, count);
}

/** Build a multiple-choice question from correct + distractors, shuffle, return choices + correctIndex */
function buildChoices(correct: string, distractors: string[], rng: SeededRng): { choices: string[]; correctIndex: number } {
  const choices = [correct, ...distractors];
  shuffle(choices, rng);
  return { choices, correctIndex: choices.indexOf(correct) };
}

// ── Templates ──────────────────────────────────────────────────────

/**
 * EASY: "Root X appears in the Quran ___ times" (pick the right count)
 */
const rootFrequencyTemplate: QuestionTemplate = {
  type: "root-frequency",
  difficulty: "easy",
  canGenerate: (data) => getQuizWorthyRoots(data, false).length >= 4,
  generate(data, rng, usedRoots) {
    const candidates = getQuizWorthyRoots(data, false);
    const root = pickFreshRoot(candidates, rng, usedRoots);
    if (!root) return null;

    const freq = data.freqData.rootFrequencies.get(root)!;
    // Generate plausible but wrong counts: ±30-70% of real value
    const distractorNums = new Set<number>();
    while (distractorNums.size < 3) {
      const factor = 0.3 + rng() * 0.7;
      const sign = rng() > 0.5 ? 1 : -1;
      const d = Math.max(1, Math.round(freq * (1 + sign * factor)));
      if (d !== freq) distractorNums.add(d);
    }

    const { choices, correctIndex } = buildChoices(
      fmt(freq),
      [...distractorNums].map(fmt),
      rng,
    );

    return {
      id: `rf-${root}`,
      templateType: "root-frequency",
      difficulty: "easy",
      prompt: `rootFrequency.prompt`,
      choices,
      correctIndex,
      explanation: `rootFrequency.explanation`,
      subjectRoot: root,
    };
  },
};

/**
 * EASY: "Which surah contains root X the most?"
 */
const surahDistributionTemplate: QuestionTemplate = {
  type: "surah-distribution",
  difficulty: "easy",
  canGenerate: (data) => getQuizWorthyRoots(data, false).length >= 4,
  generate(data, rng, usedRoots) {
    const candidates = getQuizWorthyRoots(data, false);
    const root = pickFreshRoot(candidates, rng, usedRoots);
    if (!root) return null;

    // Find surah with max occurrences of this root
    const surahCounts = new Map<number, number>();
    for (const t of data.tokens) {
      if (t.root === root) {
        surahCounts.set(t.sura, (surahCounts.get(t.sura) ?? 0) + 1);
      }
    }
    if (surahCounts.size < 4) return null;

    let topSurah = 0;
    let topCount = 0;
    for (const [s, c] of surahCounts) {
      if (c > topCount) { topSurah = s; topCount = c; }
    }
    const correctName = data.surahNames[topSurah]?.name ?? `Surah ${topSurah}`;

    // Pick 3 other surahs that also have this root (but fewer occurrences)
    const otherSurahs = [...surahCounts.keys()].filter((s) => s !== topSurah);
    shuffle(otherSurahs, rng);
    const distractors = otherSurahs
      .slice(0, 3)
      .map((s) => data.surahNames[s]?.name ?? `Surah ${s}`);
    if (distractors.length < 3) return null;

    const { choices, correctIndex } = buildChoices(correctName, distractors, rng);

    return {
      id: `sd-${root}`,
      templateType: "surah-distribution",
      difficulty: "easy",
      prompt: `surahDistribution.prompt`,
      choices,
      correctIndex,
      explanation: `surahDistribution.explanation`,
      subjectRoot: root,
    };
  },
};

/**
 * EASY: "The word X comes from which root?"
 */
const rootIdentificationTemplate: QuestionTemplate = {
  type: "root-identification",
  difficulty: "easy",
  canGenerate: (data) => getQuizWorthyRoots(data, false).length >= 4,
  generate(data, rng, usedRoots) {
    const candidates = getQuizWorthyRoots(data, false);
    const root = pickFreshRoot(candidates, rng, usedRoots);
    if (!root) return null;

    // Pick a random word (token text) derived from this root
    const rootTokens = data.tokens.filter((t) => t.root === root);
    if (rootTokens.length === 0) return null;
    const _token = pick(rootTokens, rng);

    // Distractors: other quiz-worthy roots
    const distractors = pickDistractors(candidates, root, 3, rng);
    if (distractors.length < 3) return null;

    const { choices, correctIndex } = buildChoices(root, distractors, rng);

    return {
      id: `ri-${root}`,
      templateType: "root-identification",
      difficulty: "easy",
      prompt: `rootIdentification.prompt`,
      choices,
      correctIndex,
      explanation: `rootIdentification.explanation`,
      subjectRoot: root,
    };
  },
};

/**
 * MEDIUM: "Which root means 'mercy / compassion'?"
 */
const glossMatchingTemplate: QuestionTemplate = {
  type: "gloss-matching",
  difficulty: "medium",
  canGenerate: (data) => getQuizWorthyRoots(data, true).length >= 4,
  generate(data, rng, usedRoots) {
    const candidates = getQuizWorthyRoots(data, true);
    const root = pickFreshRoot(candidates, rng, usedRoots);
    if (!root) return null;

    const _gloss = data.glosses.get(root)!;
    const distractors = pickDistractors(candidates, root, 3, rng);
    if (distractors.length < 3) return null;

    const { choices, correctIndex } = buildChoices(root, distractors, rng);

    return {
      id: `gm-${root}`,
      templateType: "gloss-matching",
      difficulty: "medium",
      prompt: `glossMatching.prompt`,
      choices,
      correctIndex,
      explanation: `glossMatching.explanation`,
      subjectRoot: root,
    };
  },
};

/**
 * MEDIUM: "Which root appears more: X or Y?"
 */
const comparativeFrequencyTemplate: QuestionTemplate = {
  type: "comparative-frequency",
  difficulty: "medium",
  canGenerate: (data) => getQuizWorthyRoots(data, false).length >= 4,
  generate(data, rng, usedRoots) {
    const candidates = getQuizWorthyRoots(data, false);
    if (candidates.length < 2) return null;

    const rootA = pickFreshRoot(candidates, rng, usedRoots);
    if (!rootA) return null;
    // Pick rootB without adding to usedRoots (only subject root matters)
    const others = candidates.filter((r) => r !== rootA && !usedRoots.has(r));
    if (others.length === 0) return null;
    const rootB = pick(others, rng);

    const freqA = data.freqData.rootFrequencies.get(rootA) ?? 0;
    const freqB = data.freqData.rootFrequencies.get(rootB) ?? 0;
    const winner = freqA >= freqB ? rootA : rootB;
    const loser = winner === rootA ? rootB : rootA;
    const _winnerFreq = Math.max(freqA, freqB);
    const _loserFreq = Math.min(freqA, freqB);

    const { choices, correctIndex } = buildChoices(winner, [loser], rng);

    return {
      id: `cf-${rootA}-${rootB}`,
      templateType: "comparative-frequency",
      difficulty: "medium",
      prompt: `comparativeFrequency.prompt`,
      choices,
      correctIndex,
      explanation: `comparativeFrequency.explanation`,
      subjectRoot: rootA,
    };
  },
};

/**
 * HARD: "How many verbs derive from root X?"
 */
const morphologyPosTemplate: QuestionTemplate = {
  type: "morphology-pos",
  difficulty: "hard",
  canGenerate: (data) => getQuizWorthyRoots(data, false).length >= 4,
  generate(data, rng, usedRoots) {
    const candidates = getQuizWorthyRoots(data, false);
    const root = pickFreshRoot(candidates, rng, usedRoots);
    if (!root) return null;

    const verbCount = data.tokens.filter((t) => t.root === root && t.pos === "V").length;
    if (verbCount === 0) return null;

    // Generate plausible wrong counts
    const distractorNums = new Set<number>();
    while (distractorNums.size < 3) {
      const offset = Math.floor(rng() * Math.max(10, verbCount)) + 1;
      const sign = rng() > 0.5 ? 1 : -1;
      const d = Math.max(0, verbCount + sign * offset);
      if (d !== verbCount) distractorNums.add(d);
    }

    const { choices, correctIndex } = buildChoices(
      fmt(verbCount),
      [...distractorNums].map(fmt),
      rng,
    );

    return {
      id: `mp-${root}`,
      templateType: "morphology-pos",
      difficulty: "hard",
      prompt: `morphologyPos.prompt`,
      choices,
      correctIndex,
      explanation: `morphologyPos.explanation`,
      subjectRoot: root,
    };
  },
};

/**
 * HARD: "Which root co-occurs most with X in the same ayah?"
 */
const collocationTemplate: QuestionTemplate = {
  type: "collocation",
  difficulty: "hard",
  canGenerate: (data) => getQuizWorthyRoots(data, false).length >= 4,
  generate(data, rng, usedRoots) {
    const candidates = getQuizWorthyRoots(data, false);
    const root = pickFreshRoot(candidates, rng, usedRoots);
    if (!root) return null;

    // Build ayah-level co-occurrence counts for this root
    const ayahRoots = new Map<string, Set<string>>(); // ayahKey → set of roots
    for (const t of data.tokens) {
      const key = `${t.sura}:${t.ayah}`;
      if (!ayahRoots.has(key)) ayahRoots.set(key, new Set());
      ayahRoots.get(key)!.add(t.root);
    }

    const cooccurrence = new Map<string, number>();
    for (const [, roots] of ayahRoots) {
      if (!roots.has(root)) continue;
      for (const r of roots) {
        if (r !== root) cooccurrence.set(r, (cooccurrence.get(r) ?? 0) + 1);
      }
    }

    const sorted = [...cooccurrence.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length < 4) return null;

    const topRoot = sorted[0][0];
    const _topCount = sorted[0][1];

    // Distractors from positions 1–6 (real co-occurring roots, just not #1)
    const distractorPool = sorted.slice(1, 7).map(([r]) => r);
    shuffle(distractorPool, rng);
    const distractors = distractorPool.slice(0, 3);
    if (distractors.length < 3) return null;

    const { choices, correctIndex } = buildChoices(topRoot, distractors, rng);

    return {
      id: `co-${root}`,
      templateType: "collocation",
      difficulty: "hard",
      prompt: `collocation.prompt`,
      choices,
      correctIndex,
      explanation: `collocation.explanation`,
      subjectRoot: root,
    };
  },
};

// ── Export ──────────────────────────────────────────────────────────

export const ALL_TEMPLATES: QuestionTemplate[] = [
  rootFrequencyTemplate,
  surahDistributionTemplate,
  rootIdentificationTemplate,
  glossMatchingTemplate,
  comparativeFrequencyTemplate,
  morphologyPosTemplate,
  collocationTemplate,
];

export const TEMPLATES_BY_DIFFICULTY: Record<Difficulty, QuestionTemplate[]> = {
  easy: ALL_TEMPLATES.filter((t) => t.difficulty === "easy"),
  medium: ALL_TEMPLATES.filter((t) => t.difficulty === "medium"),
  hard: ALL_TEMPLATES.filter((t) => t.difficulty === "hard"),
};
