import {
  loadQuizProgress,
  saveQuizSession,
  summarizeQuizProgress,
  type QuizSessionRecord,
} from "./quizProgress";

describe("quizProgress", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stores sessions and summarizes quiz history", () => {
    const sessions: QuizSessionRecord[] = [
      {
        id: "study-1",
        sessionType: "study",
        score: 4,
        total: 5,
        completedAt: 2_000,
        reviewedRoots: 2,
        usedTrackedRoots: true,
      },
      {
        id: "daily-2026-03-24",
        sessionType: "daily",
        score: 3,
        total: 5,
        completedAt: 1_000,
        reviewedRoots: 0,
        usedTrackedRoots: false,
      },
    ];

    for (const session of sessions) {
      saveQuizSession(session);
    }

    expect(loadQuizProgress()).toEqual(sessions);
    expect(summarizeQuizProgress(loadQuizProgress())).toEqual({
      completedSessions: 2,
      dailySessions: 1,
      studySessions: 1,
      questionsAnswered: 10,
      correctAnswers: 7,
      averageAccuracy: 70,
      lastCompletedAt: 2_000,
      lastSessionType: "study",
    });
  });

  it("replaces sessions with the same id", () => {
    saveQuizSession({
      id: "daily-2026-03-24",
      sessionType: "daily",
      score: 2,
      total: 5,
      completedAt: 1_000,
      reviewedRoots: 0,
      usedTrackedRoots: false,
    });

    saveQuizSession({
      id: "daily-2026-03-24",
      sessionType: "daily",
      score: 5,
      total: 5,
      completedAt: 2_000,
      reviewedRoots: 0,
      usedTrackedRoots: false,
    });

    expect(loadQuizProgress()).toEqual([
      {
        id: "daily-2026-03-24",
        sessionType: "daily",
        score: 5,
        total: 5,
        completedAt: 2_000,
        reviewedRoots: 0,
        usedTrackedRoots: false,
      },
    ]);
  });
});
