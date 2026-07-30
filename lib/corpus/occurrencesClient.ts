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

async function get(params: URLSearchParams, signal?: AbortSignal): Promise<OccurrenceAyah[]> {
  try {
    const res = await fetch(`/api/corpus/occurrences?${params.toString()}`, { signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { ayahs?: OccurrenceAyah[] };
    return data.ayahs ?? [];
  } catch {
    return [];
  }
}

export async function fetchOccurrences(
  kind: "root" | "lemma",
  term: string,
  limit = 10,
  signal?: AbortSignal,
): Promise<OccurrenceAyah[]> {
  return get(new URLSearchParams({ kind, term, limit: String(limit) }), signal);
}

/** Fetch specific occurrences by ref (compound names). refs = [sura,ayah,wordStart,len][]. */
export async function fetchOccurrencesByRefs(
  refs: [number, number, number, number][],
  limit = 10,
  signal?: AbortSignal,
): Promise<OccurrenceAyah[]> {
  if (!refs.length) return [];
  const refsParam = refs.map((r) => r.join(":")).join(",");
  return get(new URLSearchParams({ refs: refsParam, limit: String(limit) }), signal);
}
