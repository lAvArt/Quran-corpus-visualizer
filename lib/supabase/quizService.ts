import type { QuizSessionRecord } from "@/lib/quiz/quizProgress";
import { createClient } from "@/lib/supabase/client";

function supabaseRowToQuizSession(row: {
  session_key: string;
  session_type: string;
  score: number;
  total: number;
  completed_at: string;
  reviewed_roots: number;
  used_tracked_roots: boolean;
}): QuizSessionRecord {
  return {
    id: row.session_key,
    sessionType: row.session_type as QuizSessionRecord["sessionType"],
    score: row.score,
    total: row.total,
    completedAt: new Date(row.completed_at).getTime(),
    reviewedRoots: row.reviewed_roots,
    usedTrackedRoots: row.used_tracked_roots,
  };
}

export async function getQuizAttempts(): Promise<QuizSessionRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("session_key, session_type, score, total, completed_at, reviewed_roots, used_tracked_roots")
    .order("completed_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(supabaseRowToQuizSession);
}

export async function upsertQuizAttempt(userId: string, session: QuizSessionRecord): Promise<QuizSessionRecord> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quiz_attempts")
    .upsert(
      {
        user_id: userId,
        session_key: session.id,
        session_type: session.sessionType,
        score: session.score,
        total: session.total,
        completed_at: new Date(session.completedAt).toISOString(),
        reviewed_roots: session.reviewedRoots,
        used_tracked_roots: session.usedTrackedRoots,
      },
      { onConflict: "user_id,session_key", ignoreDuplicates: false },
    )
    .select("session_key, session_type, score, total, completed_at, reviewed_roots, used_tracked_roots")
    .single();

  if (error) throw new Error(error.message);
  return supabaseRowToQuizSession(data);
}

export async function batchUpsertQuizAttempts(userId: string, sessions: QuizSessionRecord[]): Promise<number> {
  if (sessions.length === 0) return 0;

  const supabase = createClient();
  const rows = sessions.map((session) => ({
    user_id: userId,
    session_key: session.id,
    session_type: session.sessionType,
    score: session.score,
    total: session.total,
    completed_at: new Date(session.completedAt).toISOString(),
    reviewed_roots: session.reviewedRoots,
    used_tracked_roots: session.usedTrackedRoots,
  }));

  const { error } = await supabase
    .from("quiz_attempts")
    .upsert(rows, { onConflict: "user_id,session_key", ignoreDuplicates: false });

  if (error) throw new Error(error.message);
  return rows.length;
}
