export function isSupabaseFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const cause = error as Error & { cause?: { code?: string } };
  return (
    error.message.toLowerCase().includes("fetch failed") ||
    ["ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT"].includes(cause.cause?.code ?? "")
  );
}

export function formatSupabaseError(
  error: unknown,
  fallback = "Unable to reach the study service right now."
): string {
  if (error instanceof Error) {
    if (isSupabaseFetchError(error)) {
      return fallback;
    }
    return error.message;
  }

  return fallback;
}
