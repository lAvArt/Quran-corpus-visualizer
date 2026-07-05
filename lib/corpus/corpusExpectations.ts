/**
 * Ground-truth expectations for the full Quran corpus.
 *
 * Derived from the bundled morphology file
 * `public/data/quranic-corpus-morphology-0.4.txt` (Quranic Arabic Corpus,
 * morphology v0.4): 128,219 morphology segment lines collapse to 77,429
 * unique word-level tokens across 114 suras / 6,236 ayahs.
 *
 * These constants let loaders and caches distinguish a genuinely complete
 * corpus load from a partial one (e.g. a single embedded surah) that would
 * otherwise be mistaken for "full" merely because it has a non-empty token
 * set.
 */

/** Exact word-level token count for the full corpus (bundled morphology v0.4). */
export const EXPECTED_FULL_CORPUS_TOKEN_COUNT = 77429;

/**
 * Safety floor for treating a loaded/cached token set as the complete corpus.
 * Set comfortably below EXPECTED_FULL_CORPUS_TOKEN_COUNT so minor drift
 * (source revisions, transient partial fetches) doesn't flag a genuinely
 * full load as incomplete, while a single-surah (or few-surah) partial load
 * still falls well short of it.
 */
export const FULL_CORPUS_TOKEN_FLOOR = 75000;
