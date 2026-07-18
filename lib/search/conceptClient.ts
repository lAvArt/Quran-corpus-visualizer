/**
 * Client for the Claude-backed concept-expansion lane (/api/search/concept).
 *
 * Returns corpus terms (roots / lemmas / gloss keywords) that the caller feeds
 * into the local BM25F index. A small in-memory LRU avoids repeat LLM calls for
 * queries the user has already run this session.
 */

export interface ConceptExpansion {
  terms: string[];
  roots: string[];
  glossKeywords: string[];
  disclaimer: string;
}

const EMPTY: ConceptExpansion = { terms: [], roots: [], glossKeywords: [], disclaimer: "" };
const CACHE_LIMIT = 50;
const cache = new Map<string, ConceptExpansion>();

function remember(key: string, value: ConceptExpansion) {
  cache.delete(key);
  cache.set(key, value);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

export async function fetchConceptExpansion(
  query: string,
  signal?: AbortSignal,
): Promise<ConceptExpansion> {
  const key = query.trim().toLowerCase();
  if (!key) return EMPTY;

  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const res = await fetch("/api/search/concept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query.trim() }),
      signal,
    });
    if (!res.ok) return EMPTY;

    const json = (await res.json()) as {
      terms?: string[];
      roots?: string[];
      glossKeywords?: string[];
      metadata?: { disclaimer?: string };
    };

    const expansion: ConceptExpansion = {
      terms: json.terms ?? [],
      roots: json.roots ?? [],
      glossKeywords: json.glossKeywords ?? [],
      disclaimer: json.metadata?.disclaimer ?? "",
    };
    remember(key, expansion);
    return expansion;
  } catch {
    return EMPTY;
  }
}
