"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/context/AuthContext";
import { readDevAuthUser } from "@/lib/dev/testOverrides";
import { isSupabaseFetchError } from "@/lib/supabase/errors";
import { batchUpsertQuizAttempts, getQuizAttempts } from "@/lib/supabase/quizService";
import {
  QUIZ_PROGRESS_EVENT,
  clearQuizProgress,
  loadQuizProgress,
  summarizeQuizProgress,
  type QuizProgressSummary,
} from "./quizProgress";

function readSummary(): QuizProgressSummary {
  return summarizeQuizProgress(loadQuizProgress());
}

export function useQuizProgressSummary(): QuizProgressSummary {
  const { user } = useAuth();
  const [summary, setSummary] = useState<QuizProgressSummary>(() => readSummary());

  useEffect(() => {
    let cancelled = false;
    const isDevQuizMode = Boolean(user && readDevAuthUser());

    async function refresh() {
      if (user && !isDevQuizMode) {
        try {
          const localAttempts = loadQuizProgress();
          if (localAttempts.length > 0) {
            await batchUpsertQuizAttempts(user.id, localAttempts);
            clearQuizProgress();
          }

          const remoteAttempts = await getQuizAttempts();
          if (!cancelled) {
            setSummary(summarizeQuizProgress(remoteAttempts));
          }
          return;
        } catch (error) {
          if (!isSupabaseFetchError(error)) {
            console.warn("[useQuizProgressSummary] Failed to load remote quiz history", error);
          }
        }
      }

      if (!cancelled) {
        setSummary(readSummary());
      }
    }

    void refresh();

    const handleRefresh = () => {
      void refresh();
    };

    window.addEventListener(QUIZ_PROGRESS_EVENT, handleRefresh);
    window.addEventListener("storage", handleRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener(QUIZ_PROGRESS_EVENT, handleRefresh);
      window.removeEventListener("storage", handleRefresh);
    };
  }, [user]);

  return summary;
}
