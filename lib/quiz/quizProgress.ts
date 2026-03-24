export type QuizSessionType = "daily" | "study";

export interface QuizSessionRecord {
  id: string;
  sessionType: QuizSessionType;
  score: number;
  total: number;
  completedAt: number;
  reviewedRoots: number;
  usedTrackedRoots: boolean;
}

export interface QuizProgressSummary {
  completedSessions: number;
  dailySessions: number;
  studySessions: number;
  questionsAnswered: number;
  correctAnswers: number;
  averageAccuracy: number;
  lastCompletedAt: number | null;
  lastSessionType: QuizSessionType | null;
}

const STORAGE_KEY = "qcv-quiz-progress-v1";
const MAX_SESSIONS = 50;
export const QUIZ_PROGRESS_EVENT = "qcv-quiz-progress-updated";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function emitQuizProgressChanged(): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(QUIZ_PROGRESS_EVENT));
}

export function loadQuizProgress(): QuizSessionRecord[] {
  if (!isBrowser()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as QuizSessionRecord[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((entry) => (
        typeof entry?.id === "string"
        && (entry.sessionType === "daily" || entry.sessionType === "study")
        && typeof entry.score === "number"
        && typeof entry.total === "number"
        && typeof entry.completedAt === "number"
        && typeof entry.reviewedRoots === "number"
        && typeof entry.usedTrackedRoots === "boolean"
      ))
      .sort((a, b) => b.completedAt - a.completedAt);
  } catch {
    return [];
  }
}

export function saveQuizSession(session: QuizSessionRecord): void {
  if (!isBrowser()) return;

  try {
    const history = loadQuizProgress().filter((entry) => entry.id !== session.id);
    const next = [session, ...history].slice(0, MAX_SESSIONS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    emitQuizProgressChanged();
  } catch {
    // Ignore storage failures.
  }
}

export function clearQuizProgress(): void {
  if (!isBrowser()) return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
    emitQuizProgressChanged();
  } catch {
    // Ignore storage failures.
  }
}

export function summarizeQuizProgress(records: QuizSessionRecord[]): QuizProgressSummary {
  const completedSessions = records.length;
  const dailySessions = records.filter((entry) => entry.sessionType === "daily").length;
  const studySessions = records.filter((entry) => entry.sessionType === "study").length;
  const questionsAnswered = records.reduce((sum, entry) => sum + entry.total, 0);
  const correctAnswers = records.reduce((sum, entry) => sum + entry.score, 0);
  const averageAccuracy = questionsAnswered > 0 ? Math.round((correctAnswers / questionsAnswered) * 100) : 0;
  const lastCompletedAt = records[0]?.completedAt ?? null;
  const lastSessionType = records[0]?.sessionType ?? null;

  return {
    completedSessions,
    dailySessions,
    studySessions,
    questionsAnswered,
    correctAnswers,
    averageAccuracy,
    lastCompletedAt,
    lastSessionType,
  };
}
