/**
 * Quiz question templates — each generates questions from corpus data.
 * Every answer is derived from the same data the question was generated from.
 */

import type { CorpusToken, PartOfSpeech } from "@/lib/schema/types";
import type { RootFrequencyData } from "@/lib/search/collocation";

// ── Types ──────────────────────────────────────────────────────────

export type Difficulty = "easy" | "medium" | "hard";

export interface QuizQuestion {
  id: string;
  templateType: QuestionTemplateType;
  difficulty: Difficulty;
  prompt: string;
  promptValues?: Record<string, string | number>;
  choices: string[];
  correctIndex: number;
  /** Shown after answering — explains the corpus data behind the answer */
  explanation: string;
  explanationValues?: Record<string, string | number>;
  /** The root this question is about (for personalized quiz weighting) */
  subjectRoot: string | null;
}

export type QuestionTemplateType =
  | "root-frequency"
  | "surah-distribution"
  | "gloss-matching"
  | "comparative-frequency"
  | "morphology-pos"
  | "collocation";

export interface QuizCorpusData {
  tokens: CorpusToken[];
  freqData: RootFrequencyData;
  glosses: ReadonlyMap<string, string>;
  surahNames: Record<number, { name: string; arabic: string; verses: number }>;
  locale: string;
  glossLocale: string | null;
  formatNumber: (value: number) => string;
  formatSurahName: (surahId: number) => string;
  formatPosLabel: (pos: PartOfSpeech) => string;
}

/** A seeded PRNG function: () => number in [0, 1) */
export type SeededRng = () => number;

export interface QuestionTemplate {
  type: QuestionTemplateType;
  difficulty: Difficulty;
  /** Can this template produce a question given the data? */
  canGenerate: (data: QuizCorpusData) => boolean;
  /** Generate one question. Returns null if it can't find suitable data. */
  generate: (
    data: QuizCorpusData,
    rng: SeededRng,
    usedRoots: Set<string>,
    preferredRoots?: string[],
  ) => QuizQuestion | null;
}

export interface QuizQuestionValidationResult {
  valid: boolean;
  reason?: string;
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
function fmt(data: QuizCorpusData, n: number): string {
  return data.formatNumber(n);
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

/** Pick a root not in usedRoots, preferring preferredRoots when possible. */
function pickFreshRoot(
  candidates: string[],
  rng: SeededRng,
  usedRoots: Set<string>,
  preferredRoots: string[] = [],
): string | null {
  const available = candidates.filter((r) => !usedRoots.has(r));
  if (available.length === 0) return null;
  const preferred = available.filter((root) => preferredRoots.includes(root));
  const root = pick(preferred.length > 0 ? preferred : available, rng);
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

function normalizeChoice(value: string): string {
  return value.normalize("NFKC").trim();
}

function isChoiceCorrect(question: QuizQuestion, expected: string): boolean {
  return normalizeChoice(question.choices[question.correctIndex] ?? "") === normalizeChoice(expected);
}

export function validateQuizQuestion(
  question: QuizQuestion,
  data: QuizCorpusData,
): QuizQuestionValidationResult {
  if (!Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex >= question.choices.length) {
    return { valid: false, reason: "correctIndex out of range" };
  }

  switch (question.templateType) {
    case "root-frequency": {
      const root = question.subjectRoot;
      if (!root) return { valid: false, reason: "missing subject root" };
      const expected = fmt(data, data.freqData.rootFrequencies.get(root) ?? 0);
      return isChoiceCorrect(question, expected)
        ? { valid: true }
        : { valid: false, reason: "root frequency mismatch" };
    }

    case "surah-distribution": {
      const root = question.subjectRoot;
      if (!root) return { valid: false, reason: "missing subject root" };

      const surahCounts = new Map<number, number>();
      for (const token of data.tokens) {
        if (token.root === root) {
          surahCounts.set(token.sura, (surahCounts.get(token.sura) ?? 0) + 1);
        }
      }

      let topSurah = 0;
      let topCount = -1;
      for (const [surahId, count] of surahCounts) {
        if (count > topCount) {
          topSurah = surahId;
          topCount = count;
        }
      }

      const expected = data.formatSurahName(topSurah);
      return isChoiceCorrect(question, expected)
        ? { valid: true }
        : { valid: false, reason: "surah distribution mismatch" };
    }

    case "gloss-matching": {
      const root = question.subjectRoot;
      if (!root) return { valid: false, reason: "missing subject root" };
      return isChoiceCorrect(question, root)
        ? { valid: true }
        : { valid: false, reason: "gloss root mismatch" };
    }

    case "comparative-frequency": {
      const rootA = String(question.promptValues?.rootA ?? "");
      const rootB = String(question.promptValues?.rootB ?? "");
      if (!rootA || !rootB) return { valid: false, reason: "missing comparative roots" };
      const freqA = data.freqData.rootFrequencies.get(rootA) ?? 0;
      const freqB = data.freqData.rootFrequencies.get(rootB) ?? 0;
      const expected = freqA >= freqB ? rootA : rootB;
      return isChoiceCorrect(question, expected)
        ? { valid: true }
        : { valid: false, reason: "comparative frequency mismatch" };
    }

    case "morphology-pos": {
      const root = question.subjectRoot;
      if (!root) return { valid: false, reason: "missing subject root" };
      const posCounts = new Map<PartOfSpeech, number>();
      for (const token of data.tokens) {
        if (token.root !== root || !token.pos) continue;
        posCounts.set(token.pos, (posCounts.get(token.pos) ?? 0) + 1);
      }

      let topPos: PartOfSpeech | null = null;
      let topCount = -1;
      for (const [pos, count] of posCounts) {
        if (count > topCount) {
          topPos = pos;
          topCount = count;
        }
      }
      if (!topPos) return { valid: false, reason: "missing POS winner" };

      const expected = data.formatPosLabel(topPos);
      return isChoiceCorrect(question, expected)
        ? { valid: true }
        : { valid: false, reason: "morphology POS mismatch" };
    }

    case "collocation": {
      const root = question.subjectRoot;
      if (!root) return { valid: false, reason: "missing subject root" };

      const ayahRoots = new Map<string, Set<string>>();
      for (const token of data.tokens) {
        const key = `${token.sura}:${token.ayah}`;
        if (!ayahRoots.has(key)) ayahRoots.set(key, new Set());
        ayahRoots.get(key)!.add(token.root);
      }

      const cooccurrence = new Map<string, number>();
      for (const roots of ayahRoots.values()) {
        if (!roots.has(root)) continue;
        for (const value of roots) {
          if (value !== root) cooccurrence.set(value, (cooccurrence.get(value) ?? 0) + 1);
        }
      }

      let topRoot = "";
      let topCount = -1;
      for (const [candidate, count] of cooccurrence) {
        if (count > topCount) {
          topRoot = candidate;
          topCount = count;
        }
      }
      if (!topRoot) return { valid: false, reason: "missing collocation winner" };

      return isChoiceCorrect(question, topRoot)
        ? { valid: true }
        : { valid: false, reason: "collocation mismatch" };
    }

    default:
      return { valid: true };
  }
}

// ── Templates ──────────────────────────────────────────────────────

/**
 * EASY: "Root X appears in the Quran ___ times" (pick the right count)
 */
const rootFrequencyTemplate: QuestionTemplate = {
  type: "root-frequency",
  difficulty: "easy",
  canGenerate: (data) => getQuizWorthyRoots(data, false).length >= 4,
  generate(data, rng, usedRoots, preferredRoots) {
    const candidates = getQuizWorthyRoots(data, false);
    const root = pickFreshRoot(candidates, rng, usedRoots, preferredRoots);
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
      fmt(data, freq),
      [...distractorNums].map((value) => fmt(data, value)),
      rng,
    );

    return {
      id: `rf-${root}`,
      templateType: "root-frequency",
      difficulty: "easy",
      prompt: `rootFrequency.prompt`,
      promptValues: { root },
      choices,
      correctIndex,
      explanation: `rootFrequency.explanation`,
      explanationValues: { root, count: fmt(data, freq) },
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
  generate(data, rng, usedRoots, preferredRoots) {
    const candidates = getQuizWorthyRoots(data, false);
    const root = pickFreshRoot(candidates, rng, usedRoots, preferredRoots);
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
    const correctName = data.formatSurahName(topSurah);

    // Pick 3 other surahs that also have this root (but fewer occurrences)
    const otherSurahs = [...surahCounts.keys()].filter((s) => s !== topSurah);
    shuffle(otherSurahs, rng);
    const distractors = otherSurahs
      .slice(0, 3)
      .map((s) => data.formatSurahName(s));
    if (distractors.length < 3) return null;

    const { choices, correctIndex } = buildChoices(correctName, distractors, rng);

    return {
      id: `sd-${root}`,
      templateType: "surah-distribution",
      difficulty: "easy",
      prompt: `surahDistribution.prompt`,
      promptValues: { root },
      choices,
      correctIndex,
      explanation: `surahDistribution.explanation`,
      explanationValues: { root, surah: correctName, count: fmt(data, topCount) },
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
  canGenerate: (data) => data.glossLocale === data.locale && getQuizWorthyRoots(data, true).length >= 4,
  generate(data, rng, usedRoots, preferredRoots) {
    const candidates = getQuizWorthyRoots(data, true);
    const root = pickFreshRoot(candidates, rng, usedRoots, preferredRoots);
    if (!root) return null;

    const gloss = data.glosses.get(root)!;
    const distractors = pickDistractors(candidates, root, 3, rng);
    if (distractors.length < 3) return null;

    const { choices, correctIndex } = buildChoices(root, distractors, rng);

    return {
      id: `gm-${root}`,
      templateType: "gloss-matching",
      difficulty: "medium",
      prompt: `glossMatching.prompt`,
      promptValues: { gloss },
      choices,
      correctIndex,
      explanation: `glossMatching.explanation`,
      explanationValues: { root, gloss },
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
  generate(data, rng, usedRoots, preferredRoots) {
    const candidates = getQuizWorthyRoots(data, false);
    if (candidates.length < 2) return null;

    const rootA = pickFreshRoot(candidates, rng, usedRoots, preferredRoots);
    if (!rootA) return null;
    // Pick rootB without adding to usedRoots (only subject root matters)
    const others = candidates.filter((r) => r !== rootA && !usedRoots.has(r));
    if (others.length === 0) return null;
    const rootB = pick(others, rng);

    const freqA = data.freqData.rootFrequencies.get(rootA) ?? 0;
    const freqB = data.freqData.rootFrequencies.get(rootB) ?? 0;
    const winner = freqA >= freqB ? rootA : rootB;
    const loser = winner === rootA ? rootB : rootA;

    const { choices, correctIndex } = buildChoices(winner, [loser], rng);

    return {
      id: `cf-${rootA}-${rootB}`,
      templateType: "comparative-frequency",
      difficulty: "medium",
      prompt: `comparativeFrequency.prompt`,
      promptValues: { rootA, rootB },
      choices,
      correctIndex,
      explanation: `comparativeFrequency.explanation`,
      explanationValues: {
        winner,
        loser,
        winnerCount: fmt(data, Math.max(freqA, freqB)),
        loserCount: fmt(data, Math.min(freqA, freqB)),
      },
      subjectRoot: rootA,
    };
  },
};

/**
 * HARD: "What is the most common part of speech for root X?"
 */
const morphologyPosTemplate: QuestionTemplate = {
  type: "morphology-pos",
  difficulty: "hard",
  canGenerate: (data) => getQuizWorthyRoots(data, false).length >= 4,
  generate(data, rng, usedRoots, preferredRoots) {
    const candidates = getQuizWorthyRoots(data, false);
    const root = pickFreshRoot(candidates, rng, usedRoots, preferredRoots);
    if (!root) return null;

    const posCounts = new Map<string, number>();
    for (const token of data.tokens) {
      if (token.root !== root || !token.pos) continue;
      posCounts.set(token.pos, (posCounts.get(token.pos) ?? 0) + 1);
    }

    const ranked = [...posCounts.entries()].sort((a, b) => b[1] - a[1]);
    if (ranked.length < 4) return null;

    const [pos, count] = ranked[0];
    const distractors = ranked.slice(1).map(([value]) => data.formatPosLabel(value as PartOfSpeech));
    shuffle(distractors, rng);

    const localizedPos = data.formatPosLabel(pos as PartOfSpeech);
    const { choices, correctIndex } = buildChoices(localizedPos, distractors.slice(0, 3), rng);

    return {
      id: `mp-${root}`,
      templateType: "morphology-pos",
      difficulty: "hard",
      prompt: `morphologyPos.prompt`,
      promptValues: { root },
      choices,
      correctIndex,
      explanation: `morphologyPos.explanation`,
      explanationValues: { root, pos: localizedPos, count: fmt(data, count) },
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
  generate(data, rng, usedRoots, preferredRoots) {
    const candidates = getQuizWorthyRoots(data, false);
    const root = pickFreshRoot(candidates, rng, usedRoots, preferredRoots);
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
    const topCount = sorted[0][1];

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
      promptValues: { root },
      choices,
      correctIndex,
      explanation: `collocation.explanation`,
      explanationValues: { root, collocate: topRoot, count: fmt(data, topCount) },
      subjectRoot: root,
    };
  },
};

// ── Export ──────────────────────────────────────────────────────────

export const ALL_TEMPLATES: QuestionTemplate[] = [
  rootFrequencyTemplate,
  surahDistributionTemplate,
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
