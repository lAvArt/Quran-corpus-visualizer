import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuizSessionRecord } from "@/lib/quiz/quizProgress";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

import {
  batchUpsertQuizAttempts,
  getQuizAttempts,
  upsertQuizAttempt,
} from "./quizService";

const COMPLETED_AT = "2026-03-24T00:00:00.000Z";
const COMPLETED_AT_MS = new Date(COMPLETED_AT).getTime();

const makeRow = (sessionKey: string, sessionType = "study") => ({
  session_key: sessionKey,
  session_type: sessionType,
  score: 4,
  total: 5,
  completed_at: COMPLETED_AT,
  reviewed_roots: 2,
  used_tracked_roots: true,
});

const makeSession = (id: string, sessionType: QuizSessionRecord["sessionType"] = "study"): QuizSessionRecord => ({
  id,
  sessionType,
  score: 4,
  total: 5,
  completedAt: COMPLETED_AT_MS,
  reviewedRoots: 2,
  usedTrackedRoots: true,
});

describe("quizService", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("maps remote quiz attempts into local records", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [makeRow("study-1"), makeRow("daily-1", "daily")], error: null }),
      }),
    });

    const attempts = await getQuizAttempts();

    expect(attempts).toEqual([
      makeSession("study-1", "study"),
      makeSession("daily-1", "daily"),
    ]);
  });

  it("upserts one quiz attempt", async () => {
    const upsertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: makeRow("study-1"), error: null }),
      }),
    });
    mockFrom.mockReturnValue({ upsert: upsertMock });

    const result = await upsertQuizAttempt("uid", makeSession("study-1"));

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "uid",
        session_key: "study-1",
        session_type: "study",
      }),
      expect.any(Object),
    );
    expect(result).toEqual(makeSession("study-1"));
  });

  it("batch upserts quiz attempts", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ upsert: upsertMock });

    const count = await batchUpsertQuizAttempts("uid", [
      makeSession("study-1"),
      makeSession("daily-1", "daily"),
    ]);

    expect(count).toBe(2);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ user_id: "uid", session_key: "study-1", session_type: "study" }),
        expect.objectContaining({ user_id: "uid", session_key: "daily-1", session_type: "daily" }),
      ]),
      expect.any(Object),
    );
  });
});
