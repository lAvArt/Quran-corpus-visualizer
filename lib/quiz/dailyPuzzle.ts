/**
 * Daily puzzle — deterministic 5-question quiz seeded by today's date.
 * Same date → same questions for all users.
 */

import { generateQuiz } from "./quizGenerator";
import type { Difficulty, QuizCorpusData, QuizQuestion } from "./questionTemplates";

/** Difficulty curve: 2 easy → 2 medium → 1 hard */
const DAILY_CURVE: Difficulty[] = ["easy", "easy", "medium", "medium", "hard"];

/**
 * Generate today's puzzle. Pure function — deterministic for a given date string.
 * @param data - Corpus data for question generation
 * @param dateStr - ISO date string "YYYY-MM-DD" (defaults to today)
 */
export function generateDailyPuzzle(
  data: QuizCorpusData,
  dateStr?: string,
): QuizQuestion[] {
  const seed = dateStr ?? new Date().toISOString().slice(0, 10);
  return generateQuiz(data, { curve: DAILY_CURVE, seed });
}

/** Get today's date as "YYYY-MM-DD" */
export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/** localStorage key for daily puzzle completion */
export function dailyStorageKey(dateStr: string): string {
  return `qcv-daily-puzzle-${dateStr}`;
}

export interface DailyPuzzleResult {
  dateStr: string;
  score: number;
  total: number;
  completedAt: number;
}

/** Save daily puzzle result to localStorage */
export function saveDailyResult(result: DailyPuzzleResult): void {
  try {
    localStorage.setItem(dailyStorageKey(result.dateStr), JSON.stringify(result));
  } catch {
    // localStorage unavailable
  }
}

/** Load today's daily puzzle result (null if not completed) */
export function loadDailyResult(dateStr: string): DailyPuzzleResult | null {
  try {
    const raw = localStorage.getItem(dailyStorageKey(dateStr));
    if (!raw) return null;
    return JSON.parse(raw) as DailyPuzzleResult;
  } catch {
    return null;
  }
}
