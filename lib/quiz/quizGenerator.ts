/**
 * Quiz generator — seeds a PRNG, selects templates by difficulty, and produces questions.
 */

import {
  ALL_TEMPLATES,
  TEMPLATES_BY_DIFFICULTY,
  type Difficulty,
  type QuestionTemplate,
  type QuestionTemplateType,
  type QuizCorpusData,
  type QuizQuestion,
  type SeededRng,
  validateQuizQuestion,
} from "./questionTemplates";

// ── Seeded PRNG (mulberry32) ───────────────────────────────────────

/**
 * Mulberry32 — fast, high-quality 32-bit seeded PRNG.
 * Returns a function () => number in [0, 1).
 */
export function mulberry32(seed: number): SeededRng {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convert a string to a numeric seed via simple hash */
export function hashSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

// ── Generator ──────────────────────────────────────────────────────

export interface GenerateOptions {
  /** Requested difficulty curve, e.g. ["easy","easy","medium","medium","hard"] */
  curve: Difficulty[];
  /** Optional: prefer questions about these roots (for personalized quiz) */
  preferredRoots?: string[];
  /**
   * Optional: force every question's subject root to this exact root
   * (root-focused quiz, e.g. "Quiz me on this root"). Overrides
   * preferredRoots/usedRoots exclusion for subject-root selection —
   * templates still skip themselves (return null) when this root doesn't
   * have enough data for that particular question type.
   */
  lockedRoot?: string;
  /** Seed string or number */
  seed: string | number;
}

/**
 * Generate a set of quiz questions following a difficulty curve.
 *
 * Deterministic for the same seed + data.
 */
export function generateQuiz(data: QuizCorpusData, options: GenerateOptions): QuizQuestion[] {
  const rng = typeof options.seed === "number"
    ? mulberry32(options.seed)
    : mulberry32(hashSeed(options.seed));

  const usedRoots = new Set<string>();
  const questions: QuizQuestion[] = [];

  // With a lockedRoot, `usedRoots` never grows for that root (pickFreshRoot
  // returns it unconditionally — see questionTemplates.ts), so nothing
  // stopped the SAME template from firing again in a later curve slot and
  // producing a question with an identical id/prompt. Track template types
  // already used for the locked root instead, and back that up with a
  // hard id-uniqueness check that applies regardless of mode — no two
  // questions in one quiz may ever share an id.
  const usedLockedRootTemplateTypes = new Set<QuestionTemplateType>();
  const usedQuestionIds = new Set<string>();

  const tryTemplate = (template: QuestionTemplate): boolean => {
    if (options.lockedRoot && usedLockedRootTemplateTypes.has(template.type)) return false;

    const q = template.generate(data, rng, usedRoots, options.preferredRoots, options.lockedRoot);
    if (!q || usedQuestionIds.has(q.id) || !validateQuizQuestion(q, data).valid) return false;

    questions.push(q);
    usedQuestionIds.add(q.id);
    if (options.lockedRoot) usedLockedRootTemplateTypes.add(template.type);
    return true;
  };

  for (const difficulty of options.curve) {
    const templates = TEMPLATES_BY_DIFFICULTY[difficulty].filter((t) => t.canGenerate(data));
    if (templates.length === 0) continue;

    // Try each template in random order until one produces a question
    const order = [...templates];
    shuffleArray(order, rng);

    let produced = false;
    for (const template of order) {
      if (tryTemplate(template)) {
        produced = true;
        break;
      }
    }

    // Fallback: try ALL templates at any difficulty. A slot that still
    // can't produce a fresh question (e.g. a root-focused quiz has already
    // used every template type this root supports) simply yields nothing
    // — a short quiz is fine; a quiz with a duplicate question is not.
    if (!produced) {
      const fallbacks = ALL_TEMPLATES.filter((t) => t.canGenerate(data));
      shuffleArray(fallbacks, rng);
      for (const template of fallbacks) {
        if (tryTemplate(template)) break;
      }
    }
  }

  return questions;
}

function shuffleArray<T>(arr: T[], rng: SeededRng): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
