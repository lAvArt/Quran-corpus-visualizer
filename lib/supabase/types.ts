/**
 * Supabase Database type definitions.
 * Run `npx supabase gen types typescript --project-id <id>` to regenerate
 * after schema changes; this file serves as the hand-written baseline until
 * the project is fully bootstrapped.
 */

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export interface Database {
    public: {
        Tables: {
            tracked_roots: {
                Row: {
                    id: string;
                    user_id: string;
                    root: string;
                    state: "learning" | "learned";
                    notes: string;
                    added_at: string;
                    last_reviewed_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    root: string;
                    state?: "learning" | "learned";
                    notes?: string;
                    added_at?: string;
                    last_reviewed_at?: string;
                };
                Update: {
                    state?: "learning" | "learned";
                    notes?: string;
                    last_reviewed_at?: string;
                };
                Relationships: [];
            };
            corpus_tokens: {
                Row: {
                    id: string;
                    sura: number;
                    ayah: number;
                    position: number;
                    text: string;
                    root: string | null;
                    lemma: string | null;
                    pos: string | null;
                    morphology: Json | null;
                    root_normalized: string | null;
                    lemma_normalized: string | null;
                };
                Insert: {
                    id: string;
                    sura: number;
                    ayah: number;
                    position: number;
                    text: string;
                    root?: string | null;
                    lemma?: string | null;
                    pos?: string | null;
                    morphology?: Json | null;
                };
                Update: {
                    root?: string | null;
                    lemma?: string | null;
                    pos?: string | null;
                    morphology?: Json | null;
                };
                Relationships: [];
            };
            ayahs: {
                Row: {
                    id: string;
                    sura_id: number;
                    ayah_number: number;
                    text_uthmani: string;
                    text_simple: string | null;
                };
                Insert: {
                    id: string;
                    sura_id: number;
                    ayah_number: number;
                    text_uthmani: string;
                    text_simple?: string | null;
                };
                Update: {
                    text_uthmani?: string;
                    text_simple?: string | null;
                };
                Relationships: [];
            };
            root_embeddings: {
                Row: {
                    root: string;
                    embedding: number[];
                    model: string;
                    created_at: string;
                };
                Insert: {
                    root: string;
                    embedding: number[];
                    model: string;
                };
                Update: {
                    embedding?: number[];
                };
                Relationships: [];
            };
        };
        Views: {
            collocations: {
                Row: {
                    root_a: string;
                    root_b: string;
                    co_count: number;
                    pmi: number;
                    surah_count: number;
                    window_type: string;
                };
                Relationships: [];
            };
            cross_references: {
                Row: {
                    sura: number;
                    ayah: number;
                    roots: string[];
                };
                Relationships: [];
            };
        };
        Functions: {
            search_roots_semantic: {
                Args: { query_embedding: number[]; match_count: number };
                Returns: Array<{ root: string; similarity: number }>;
            };
            search_corpus_fts: {
                Args: { query: string; limit_n: number };
                Returns: Array<{ id: string; root: string; lemma: string; text: string; sura: number; ayah: number; pos: string; rank: number }>;
            };
            search_corpus_trigram: {
                Args: { query: string; limit_n: number; threshold: number };
                Returns: Array<{ id: string; root: string; lemma: string; text: string; sura: number; ayah: number; pos: string; similarity: number }>;
            };
            get_collocates: {
                Args: { target_root: string; window_type: string; min_pmi: number; limit_n: number };
                Returns: Array<{ root: string; co_count: number; pmi: number; surah_count: number }>;
            };
            cross_reference_roots: {
                Args: { root_a: string; root_b: string };
                Returns: Array<{ sura: number; ayah: number; roots: string[] }>;
            };
        };
        Enums: {
            knowledge_state: "learning" | "learned";
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
}
