/**
 * Client for /api/corpus/occurrences — the first N ayahs that contain a root or
 * lemma, for the home search result's verse carousel. Best-effort: any failure
 * (offline, Supabase down) resolves to an empty list so the count card still
 * shows without a carousel.
 */

export interface OccurrenceAyah {
  sura: number;
  ayah: number;
  /** Uthmani ayah text. */
  text: string;
  /** 1-indexed word positions of the searched word in this ayah (for highlight). */
  positions: number[];
}

export async function fetchOccurrences(
  kind: "root" | "lemma",
  term: string,
  limit = 10,
  signal?: AbortSignal,
): Promise<OccurrenceAyah[]> {
  try {
    const params = new URLSearchParams({ kind, term, limit: String(limit) });
    const res = await fetch(`/api/corpus/occurrences?${params.toString()}`, { signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { ayahs?: OccurrenceAyah[] };
    return data.ayahs ?? [];
  } catch {
    return [];
  }
}
