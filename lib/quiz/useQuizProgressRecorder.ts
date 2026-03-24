"use client";

import { useCallback } from "react";
import { useAuth } from "@/lib/context/AuthContext";
import { readDevAuthUser } from "@/lib/dev/testOverrides";
import { upsertQuizAttempt } from "@/lib/supabase/quizService";
import {
  emitQuizProgressChanged,
  saveQuizSession,
  type QuizSessionRecord,
} from "./quizProgress";

export function useQuizProgressRecorder() {
  const { user } = useAuth();
  const isDevQuizMode = Boolean(user && readDevAuthUser());

  const recordSession = useCallback(async (session: QuizSessionRecord) => {
    if (!user || isDevQuizMode) {
      saveQuizSession(session);
      return;
    }

    try {
      await upsertQuizAttempt(user.id, session);
      emitQuizProgressChanged();
    } catch {
      saveQuizSession(session);
    }
  }, [isDevQuizMode, user]);

  return { recordSession };
}
