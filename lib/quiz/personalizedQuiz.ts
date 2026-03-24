/**
 * Study session quiz — generates corpus questions and biases them toward the
 * user's stalest tracked roots when available.
 */

import { generateQuiz } from "./quizGenerator";
import type { Difficulty, QuizCorpusData, QuizQuestion } from "./questionTemplates";
import type { TrackedRoot } from "@/lib/cache/knowledgeCache";

/** Default curve: 2 easy → 2 medium → 1 hard */
const REVIEW_CURVE: Difficulty[] = ["easy", "easy", "medium", "medium", "hard"];

/**
 * Generate a study session from the user's tracked roots.
 *
 * Strategy:
 * - Sort tracked roots by lastReviewedAt ascending (stalest first)
 * - Use those as preferredRoots for the generator when available
 * - When user has no tracked roots, the generator falls back to a generic corpus session
 */
export function generateReviewQuiz(
  data: QuizCorpusData,
  trackedRoots: TrackedRoot[],
): QuizQuestion[] {
  // Sort by stalest first
  const sorted = [...trackedRoots].sort((a, b) => a.lastReviewedAt - b.lastReviewedAt);
  const preferredRoots = sorted.map((r) => r.root);

  // Build a seed from the root list + today's date so it varies day-to-day
  const datePart = new Date().toISOString().slice(0, 10);
  const seed = `review-${datePart}-${preferredRoots.slice(0, 5).join(",") || "generic"}`;

  return generateQuiz(data, {
    curve: REVIEW_CURVE,
    seed,
    preferredRoots,
  });
}

/** Get all root strings that appeared in quiz questions (for updating lastReviewedAt) */
export function extractQuizRoots(questions: QuizQuestion[]): string[] {
  return questions
    .map((q) => q.subjectRoot)
    .filter((r): r is string => r !== null);
}
