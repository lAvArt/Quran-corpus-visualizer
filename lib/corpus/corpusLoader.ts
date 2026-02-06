/**
 * Corpus Loader - Progressive loading and caching of Quran corpus data
 * Handles loading from API, merging with morphology data, and caching
 */

import { quranApi, type QuranWord } from '@/lib/api/quranApi';


import { corpusCache } from '@/lib/cache/corpusCache';
import { SAMPLE_MORPHOLOGY_DATA } from '@/lib/corpus/morphologyData';
import { loadMorphologyMap, type MorphologyEntry, buildSampleMorphologyMap } from '@/lib/corpus/morphologyLoader';
import type { CorpusToken, PartOfSpeech, AyahRecord } from '@/lib/schema/types';

export interface LoadingProgress {
    currentSura: number;
    totalSuras: number;
    currentTokens: number;
    totalTokens: number;
    status: 'idle' | 'loading' | 'caching' | 'complete' | 'error';
    message: string;
}

export type ProgressCallback = (progress: LoadingProgress) => void;

const sampleMorphologyMap = buildSampleMorphologyMap(SAMPLE_MORPHOLOGY_DATA);
const TOKEN_ID_PATTERN = /^(\d+):(\d+):(\d+)$/;

function buildMorphologyFallbackBySura(
    morphologyMap: Map<string, MorphologyEntry>
): Map<number, CorpusToken[]> {
    const bySura = new Map<number, CorpusToken[]>();

    for (const [tokenId, entry] of morphologyMap.entries()) {
        const match = tokenId.match(TOKEN_ID_PATTERN);
        if (!match) continue;

        const sura = Number(match[1]);
        const ayah = Number(match[2]);
        const position = Number(match[3]);
        const fallbackText = entry.stem || entry.lemma || entry.root || "-";

        if (!bySura.has(sura)) bySura.set(sura, []);
        bySura.get(sura)!.push({
            id: tokenId,
            sura,
            ayah,
            position,
            text: fallbackText,
            root: entry.root || "",
            lemma: entry.lemma || fallbackText,
            pos: (entry.pos ?? "N") as PartOfSpeech,
            morphology: {
                features: entry.features ?? {},
                gloss: null,
                stem: entry.stem ?? null,
            },
        });
    }

    for (const tokens of bySura.values()) {
        tokens.sort((a, b) => a.ayah - b.ayah || a.position - b.position);
    }

    return bySura;
}

/**
 * Convert Quran.com API word to CorpusToken format
 */
function wordToToken(
    sura: number,
    ayah: number,
    word: QuranWord,
    position: number,
    morphologyMap: Map<string, MorphologyEntry> | null
): CorpusToken {
    const tokenId = `${sura}:${ayah}:${position}`;

    // Try to get morphology from bundled data
    const morphData = morphologyMap?.get(tokenId) ?? sampleMorphologyMap.get(tokenId);

    return {
        id: tokenId,
        sura,
        ayah,
        position,
        text: word.text,
        root: morphData?.root ?? '',
        lemma: morphData?.lemma ?? word.text,
        pos: (morphData?.pos ?? 'N') as PartOfSpeech,
        morphology: {
            features: morphData?.features ?? {},
            gloss: word.translation?.text ?? null,
            stem: morphData?.stem ?? null,
        },
    };
}



/**
 * Load full corpus progressively with caching
 */
export async function loadFullCorpus(
    onProgress?: ProgressCallback
): Promise<CorpusToken[]> {
    const progress: LoadingProgress = {
        currentSura: 0,
        totalSuras: 114,
        currentTokens: 0,
        totalTokens: 0,
        status: 'idle',
        message: 'Initializing...',
    };

    const notify = () => onProgress?.(progress);

    try {
        // Load morphology map (required for full-root coverage)
        let morphologyMap: Map<string, MorphologyEntry> | null = null;
        let morphologyFallbackBySura: Map<number, CorpusToken[]> | null = null;
        try {
            morphologyMap = await loadMorphologyMap();
            morphologyFallbackBySura = buildMorphologyFallbackBySura(morphologyMap);
            console.log(`[CorpusLoader] Morphology loaded: ${morphologyMap.size.toLocaleString()} entries`);
        } catch (err) {
            console.warn('[CorpusLoader] Failed to load morphology map, falling back to sample data.', err);
        }

        // Check cache first
        progress.status = 'loading';
        progress.message = 'Checking cache...';
        notify();

        console.log('[CorpusLoader] Checking IndexedDB cache...');
        const cachedCount = await corpusCache.getTokenCount();
        const cacheMeta = await corpusCache.getMetadata('corpus');
        const cacheHasMorphology = Boolean(cacheMeta?.hasMorphology);

        if (cachedCount > 0) {
            console.log(`[CorpusLoader] Found ${cachedCount} cached tokens`);
            progress.message = `Loading ${cachedCount.toLocaleString()} cached tokens...`;
            notify();

            const tokens = await corpusCache.getAllTokens() as CorpusToken[];
            const hasRoots = tokens.some(t => t.root && t.root.trim().length > 0);

            if ((cacheHasMorphology && hasRoots) || !morphologyMap) {
                progress.status = 'complete';
                progress.totalTokens = tokens.length;
                progress.currentTokens = tokens.length;
                progress.message = `Loaded ${tokens.length.toLocaleString()} tokens from cache`;
                notify();
                console.log(`[CorpusLoader] Loaded ${tokens.length} tokens from cache`);
                return tokens;
            }

            console.warn('[CorpusLoader] Cache missing morphology. Rebuilding...');
            await corpusCache.clearAll();
        }

        console.log('[CorpusLoader] No cache found, fetching from API...');

        // Load from API
        progress.message = 'Fetching chapters...';
        notify();

        const chapters = await quranApi.getChapters();
        progress.totalSuras = chapters.length;

        const allTokens: CorpusToken[] = [];
        const allVerses: AyahRecord[] = [];

        for (let i = 0; i < chapters.length; i++) {
            const chapter = chapters[i];
            progress.currentSura = i + 1;
            progress.message = `Loading ${chapter.name_simple} (${i + 1}/${chapters.length})...`;
            notify();

            try {
                // Ensure we get verses with full text
                const verses = await quranApi.getAllVersesForChapter(chapter.id, { words: true });

                for (const verse of verses) {
                    // Create AyahRecord
                    if (verse.words) {
                        const ayahRecord: AyahRecord = {
                            id: verse.verse_key,
                            suraId: chapter.id,
                            ayahNumber: verse.verse_number,
                            textUthmani: verse.text_uthmani || verse.text_uthmani_simple || verse.text_imlaei || verse.text_imlaei_simple || verse.text_simple || "",
                            textSimple: verse.text_imlaei_simple || verse.text_imlaei || verse.text_simple || undefined,
                            tokenIds: []
                        };

                        const verseTokens: CorpusToken[] = [];
                        for (const word of verse.words) {
                            if (word.char_type_name !== 'word') continue;
                            const token = wordToToken(chapter.id, verse.verse_number, word, word.position, morphologyMap);
                            verseTokens.push(token);
                            ayahRecord.tokenIds.push(token.id);
                        }

                        allTokens.push(...verseTokens);
                        allVerses.push(ayahRecord);
                    }
                }

                progress.currentTokens = allTokens.length;
                console.log(`[CorpusLoader] Loaded ${chapter.name_simple}: ${verses.length} verses, ${allTokens.length} tokens`);
                notify();
            } catch (err) {
                console.warn(`[CorpusLoader] Failed to load surah ${chapter.id}:`, err);
                const fallbackTokens = morphologyFallbackBySura?.get(chapter.id) ?? [];
                if (fallbackTokens.length > 0) {
                    allTokens.push(...fallbackTokens);
                    progress.currentTokens = allTokens.length;
                    progress.message = `Using bundled morphology fallback for ${chapter.name_simple} (${i + 1}/${chapters.length})...`;
                    notify();
                    console.log(`[CorpusLoader] Fallback used for surah ${chapter.id}: ${fallbackTokens.length} tokens`);
                }
            }

            // Small delay to avoid rate limiting
            if (i < chapters.length - 1) {
                await new Promise(r => setTimeout(r, 100));
            }
        }

        // Cache the loaded tokens AND verses
        progress.status = 'caching';
        progress.message = 'Caching tokens for offline access...';
        notify();

        await corpusCache.storeTokens(allTokens);
        await corpusCache.storeVerses(allVerses);

        await corpusCache.setMetadata('corpus', {
            tokenCount: allTokens.length,
            hasMorphology: Boolean(morphologyMap),
            morphologyVersion: morphologyMap ? 'qac-0.4' : undefined,
        });

        progress.status = 'complete';
        progress.totalTokens = allTokens.length;
        progress.message = `Loaded and cached ${allTokens.length.toLocaleString()} tokens`;
        notify();

        return allTokens;
    } catch (error) {
        console.error('[CorpusLoader] Critical error:', error);
        progress.status = 'error';
        progress.message = error instanceof Error ? error.message : 'Failed to load corpus';
        notify();
        throw error;
    }
}

/**
 * Load tokens for specific surahs only
 */
export async function loadSurahs(
    suraIds: number[],
    onProgress?: ProgressCallback
): Promise<CorpusToken[]> {
    const progress: LoadingProgress = {
        currentSura: 0,
        totalSuras: suraIds.length,
        currentTokens: 0,
        totalTokens: 0,
        status: 'loading',
        message: 'Loading surahs...',
    };

    const notify = () => onProgress?.(progress);
    const allTokens: CorpusToken[] = [];
    let morphologyMap: Map<string, MorphologyEntry> | null = null;
    let morphologyFallbackBySura: Map<number, CorpusToken[]> | null = null;
    try {
        morphologyMap = await loadMorphologyMap();
        morphologyFallbackBySura = buildMorphologyFallbackBySura(morphologyMap);
        console.log(`[CorpusLoader] Morphology loaded: ${morphologyMap.size.toLocaleString()} entries`);
    } catch (err) {
        console.warn('[CorpusLoader] Failed to load morphology map, falling back to sample data.', err);
    }

    const cacheMeta = await corpusCache.getMetadata('corpus');
    const cacheHasMorphology = Boolean(cacheMeta?.hasMorphology);
    for (let i = 0; i < suraIds.length; i++) {
        const suraId = suraIds[i];
        progress.currentSura = i + 1;
        progress.message = `Loading surah ${suraId}...`;
        notify();

        // Try cache first
        const cached = await corpusCache.getTokensBySura(suraId) as CorpusToken[];

        const cachedHasRoots = cached.some(t => t.root && t.root.trim().length > 0);
        if (cached.length > 0 && ((cacheHasMorphology && cachedHasRoots) || !morphologyMap)) {
            allTokens.push(...cached);
        } else {
            if (cached.length > 0 && !cachedHasRoots) {
                await corpusCache.clearAll();
            }

            // Load from API with full verses
            try {
                const verses = await quranApi.getAllVersesForChapter(suraId, { words: true });
                const verseTokens: CorpusToken[] = [];
                const versesRecords: AyahRecord[] = [];

                for (const verse of verses) {
                    if (verse.words) {
                        const ayahRecord: AyahRecord = {
                            id: verse.verse_key,
                            suraId: suraId,
                            ayahNumber: verse.verse_number,
                            textUthmani: verse.text_uthmani || verse.text_uthmani_simple || verse.text_imlaei || verse.text_imlaei_simple || verse.text_simple || "",
                            textSimple: verse.text_imlaei_simple || verse.text_imlaei || verse.text_simple || undefined,
                            tokenIds: []
                        };

                        for (const word of verse.words) {
                            if (word.char_type_name !== 'word') continue;
                            const token = wordToToken(suraId, verse.verse_number, word, word.position, morphologyMap);
                            verseTokens.push(token);
                            ayahRecord.tokenIds.push(token.id);
                        }
                        versesRecords.push(ayahRecord);
                    }
                }

                allTokens.push(...verseTokens);
                await corpusCache.storeTokens(verseTokens);
                await corpusCache.storeVerses(versesRecords);
            } catch (err) {
                console.warn(`[CorpusLoader] Failed API load for surah ${suraId}, trying morphology fallback.`, err);
                const fallbackTokens = morphologyFallbackBySura?.get(suraId) ?? [];
                allTokens.push(...fallbackTokens);
                await corpusCache.storeTokens(fallbackTokens);
            }
        }

        progress.currentTokens = allTokens.length;
        notify();
    }

    await corpusCache.setMetadata('corpus', {
        tokenCount: allTokens.length,
        hasMorphology: Boolean(morphologyMap),
        morphologyVersion: morphologyMap ? 'qac-0.4' : undefined,
    });

    progress.status = 'complete';
    progress.message = `Loaded ${allTokens.length.toLocaleString()} tokens`;
    notify();

    return allTokens;
}
/**
 * Get full ayah record from cache
 */
export async function getAyah(sura: number, ayah: number): Promise<AyahRecord | null> {
    const id = `${sura}:${ayah}`;
    try {
        const record = (await corpusCache.getVerse(id)) as AyahRecord | null;
        const cachedText = record?.textSimple?.trim() || record?.textUthmani?.trim();
        if (record && cachedText) {
            return record;
        }
    } catch (err) {
        console.warn(`[CorpusLoader] Failed to fetch ayah ${id}`, err);
    }

    try {
        const verse = await quranApi.getVerse(id);
        const fetchedRecord: AyahRecord = {
            id,
            suraId: sura,
            ayahNumber: ayah,
            textUthmani: verse.text_uthmani || verse.text_uthmani_simple || verse.text_imlaei || verse.text_imlaei_simple || verse.text_simple || "",
            textSimple: verse.text_imlaei_simple || verse.text_imlaei || verse.text_simple || undefined,
            tokenIds: verse.words
                ? verse.words
                    .filter((word) => word.char_type_name === 'word')
                    .map((word) => `${sura}:${ayah}:${word.position}`)
                : [],
        };

        try {
            await corpusCache.storeVerses([fetchedRecord]);
        } catch (cacheErr) {
            console.warn(`[CorpusLoader] Failed to cache ayah ${id}`, cacheErr);
        }

        return fetchedRecord;
    } catch (err) {
        console.warn(`[CorpusLoader] Failed to fetch ayah ${id} from API`, err);
        return null;
    }
}
export function getSampleData(): CorpusToken[] {
    return [...SAMPLE_MORPHOLOGY_DATA];
}

/**
 * Clear all cached data
 */
export async function clearCache(): Promise<void> {
    await corpusCache.clearAll();
}
