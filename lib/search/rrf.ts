/**
 * Reciprocal Rank Fusion — combine several ranked lists into one.
 *
 * RRF is rank-based, so it fuses lists whose raw scores are on different scales
 * (e.g. separate BM25 indexes, or the lexical vs. concept lanes) without any
 * score calibration. Each list contributes weight · 1 / (k + rank) to every id
 * it ranks; ids are then ordered by their summed contribution.
 */

export interface RankedList {
  /** Ordered ids, best first. */
  ids: string[];
  /** Relative trust in this list (default 1). */
  weight?: number;
}

export interface RrfResult {
  id: string;
  score: number;
}

export function rrfMerge(lists: RankedList[], options: { k?: number; limit?: number } = {}): RrfResult[] {
  const k = options.k ?? 60;
  const scores = new Map<string, number>();

  for (const list of lists) {
    const weight = list.weight ?? 1;
    for (let rank = 0; rank < list.ids.length; rank++) {
      const id = list.ids[rank];
      scores.set(id, (scores.get(id) ?? 0) + weight / (k + rank + 1));
    }
  }

  const merged = [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);

  return options.limit ? merged.slice(0, options.limit) : merged;
}
