-- Migration 006: Fix mutable search_path on all public functions.
-- Prevents search_path-based injection (Supabase lint: function_search_path_mutable).

ALTER FUNCTION public.search_roots_semantic(vector, integer)
    SET search_path = public, pg_catalog;

ALTER FUNCTION public.search_corpus_fts(text, integer)
    SET search_path = public, pg_catalog;

ALTER FUNCTION public.search_corpus_trigram(text, integer, double precision)
    SET search_path = public, pg_catalog;

ALTER FUNCTION public.get_collocates(text, text, double precision, integer)
    SET search_path = public, pg_catalog;

ALTER FUNCTION public.cross_reference_roots(text, text)
    SET search_path = public, pg_catalog;

ALTER FUNCTION public.refresh_corpus_views()
    SET search_path = public, pg_catalog;
