/**
 * Quran.com API v4 Client
 * Primary data source for Quranic text, translations, and word-by-word data.
 * 
 * API Base: https://api.quran.com/api/v4
 * 
 * For morphological data (roots, lemmas, POS), we use bundled corpus data
 * from the Quranic Arabic Corpus (corpus.quran.com) since the quran.com API
 * does not provide detailed morphological analysis.
 */

const API_BASE = "https://api.quran.com/api/v4";
const DEFAULT_VERSE_FIELDS = ["text_uthmani", "text_imlaei", "text_imlaei_simple"];

export interface QuranChapter {
  id: number;
  revelation_place: "makkah" | "madinah";
  revelation_order: number;
  bismillah_pre: boolean;
  name_simple: string;
  name_complex: string;
  name_arabic: string;
  verses_count: number;
  pages: [number, number];
  translated_name: {
    language_name: string;
    name: string;
  };
}

export interface QuranWord {
  id: number;
  position: number;
  audio_url: string | null;
  char_type_name: "word" | "end" | "pause";
  code_v1: string;
  page_number: number;
  line_number: number;
  text: string;
  text_uthmani?: string;
  translation: {
    text: string;
    language_name: string;
  };
  transliteration: {
    text: string | null;
    language_name: string;
  };
}

export interface QuranVerse {
  id: number;
  verse_number: number;
  verse_key: string;
  hizb_number: number;
  rub_el_hizb_number: number;
  ruku_number: number;
  manzil_number: number;
  sajdah_number: number | null;
  page_number: number;
  juz_number: number;
  words?: QuranWord[];
  text_uthmani?: string;
  text_simple?: string;
  text_imlaei?: string;
  text_imlaei_simple?: string;
  text_uthmani_simple?: string;
}

export interface ChaptersResponse {
  chapters: QuranChapter[];
}

export interface VersesResponse {
  verses: QuranVerse[];
  pagination: {
    per_page: number;
    current_page: number;
    next_page: number | null;
    total_pages: number;
    total_records: number;
  };
}

class QuranApiClient {
  private cache = new Map<string, unknown>();

  private async fetchWithCache<T>(endpoint: string): Promise<T> {
    if (this.cache.has(endpoint)) {
      return this.cache.get(endpoint) as T;
    }

    const response = await fetch(`${API_BASE}${endpoint}`);
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    this.cache.set(endpoint, data);
    return data as T;
  }

  async getChapters(): Promise<QuranChapter[]> {
    const response = await this.fetchWithCache<ChaptersResponse>("/chapters");
    return response.chapters;
  }

  async getChapter(id: number): Promise<QuranChapter> {
    const response = await this.fetchWithCache<{ chapter: QuranChapter }>(`/chapters/${id}`);
    return response.chapter;
  }

  async getVersesByChapter(
    chapterId: number,
    options: {
      words?: boolean;
      page?: number;
      perPage?: number;
      translations?: number[];
      fields?: string[];
      wordFields?: string[];
    } = {}
  ): Promise<VersesResponse> {
    const params = new URLSearchParams();
    if (options.words) params.set("words", "true");
    if (options.page) params.set("page", options.page.toString());
    if (options.perPage) params.set("per_page", options.perPage.toString());
    params.set("fields", options.fields?.length ? options.fields.join(",") : DEFAULT_VERSE_FIELDS.join(","));
    if (options.words && options.wordFields?.length) {
      params.set("word_fields", options.wordFields.join(","));
    }
    if (options.translations?.length) {
      params.set("translations", options.translations.join(","));
    }

    const query = params.toString();
    const endpoint = `/verses/by_chapter/${chapterId}${query ? `?${query}` : ""}`;
    return this.fetchWithCache<VersesResponse>(endpoint);
  }

  async getVerse(
    verseKey: string,
    options: { words?: boolean; fields?: string[]; wordFields?: string[] } = {}
  ): Promise<QuranVerse> {
    const params = new URLSearchParams();
    if (options.words) params.set("words", "true");
    params.set("fields", options.fields?.length ? options.fields.join(",") : DEFAULT_VERSE_FIELDS.join(","));
    if (options.words && options.wordFields?.length) {
      params.set("word_fields", options.wordFields.join(","));
    }

    const query = params.toString();
    const endpoint = `/verses/by_key/${verseKey}${query ? `?${query}` : ""}`;
    const response = await this.fetchWithCache<{ verse: QuranVerse }>(endpoint);
    return response.verse;
  }

  async getAllVersesForChapter(
    chapterId: number,
    options: { words?: boolean; fields?: string[] } = {}
  ): Promise<QuranVerse[]> {
    const allVerses: QuranVerse[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.getVersesByChapter(chapterId, {
        ...options,
        page,
        perPage: 50,
      });
      allVerses.push(...response.verses);
      hasMore = response.pagination.next_page !== null;
      page++;
    }

    return allVerses;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const quranApi = new QuranApiClient();
