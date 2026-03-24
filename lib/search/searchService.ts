import type { CorpusToken } from "@/lib/schema/types";
import { buildPhaseOneIndexes, queryPhaseOne } from "@/lib/search/indexes";
import { normalizeArabicForSearch } from "@/lib/search/arabicNormalize";
import { parseSearchQuery } from "@/lib/search/queryParser";
import type { SearchResultItem, SearchResultKind } from "@/lib/search/searchTypes";
import { SURAH_NAMES } from "@/lib/data/surahData";
import { ROOT_GLOSSES } from "@/lib/data/rootGlosses";

// ============================================================================
// Query Intent Detection — classifies free-text input so the UI can route
// searches automatically without requiring structured syntax from the user.
// ============================================================================

export type QueryIntent =
  | "ayah-ref"         // e.g. "2:255" or "3:7"
  | "arabic-root"      // Short Arabic (2-4 chars, no diacritics) → likely a root
  | "arabic-text"      // Longer Arabic or Arabic with diacritics → token/verse text
  | "english-gloss"    // Latin characters → search English glosses
  | "structured"       // Contains field:value syntax
  | "empty";

const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670]/;
const AYAH_REF_PATTERN = /^\d{1,3}:\d{1,3}$/;
const STRUCTURED_PATTERN = /\b(?:root|r|lemma|l|pos|p|ayah|a|text|t|gloss|g):/i;

export function detectQueryIntent(query: string): QueryIntent {
  const trimmed = query.trim();
  if (!trimmed) return "empty";
  if (STRUCTURED_PATTERN.test(trimmed)) return "structured";
  if (AYAH_REF_PATTERN.test(trimmed)) return "ayah-ref";
  if (ARABIC_RANGE.test(trimmed)) {
    const stripped = trimmed.replace(/[\s\u064B-\u065F\u0670]/g, "");
    if (stripped.length <= 4 && !ARABIC_DIACRITICS.test(trimmed)) return "arabic-root";
    return "arabic-text";
  }
  return "english-gloss";
}

export interface SearchCatalog {
  byId: Map<string, CorpusToken>;
  byRoot: Map<string, CorpusToken[]>;
  byLemma: Map<string, CorpusToken[]>;
  phaseOne: ReturnType<typeof buildPhaseOneIndexes>;
}

function pushBucket(map: Map<string, CorpusToken[]>, key: string, token: CorpusToken) {
  const bucket = map.get(key);
  if (bucket) {
    bucket.push(token);
    return;
  }
  map.set(key, [token]);
}

export function buildSearchCatalog(tokens: CorpusToken[]): SearchCatalog {
  const byId = new Map<string, CorpusToken>();
  const byRoot = new Map<string, CorpusToken[]>();
  const byLemma = new Map<string, CorpusToken[]>();

  for (const token of tokens) {
    byId.set(token.id, token);
    if (token.root) pushBucket(byRoot, token.root, token);
    if (token.lemma) pushBucket(byLemma, token.lemma, token);
  }

  return {
    byId,
    byRoot,
    byLemma,
    phaseOne: buildPhaseOneIndexes(tokens),
  };
}

function buildItem(token: CorpusToken, kind: SearchResultKind, subtitle: string, explanation: string): SearchResultItem {
  return {
    id: `${kind}:${token.id}`,
    kind,
    title: token.text,
    subtitle,
    arabicText: token.text,
    location: {
      surah: token.sura,
      ayah: token.ayah,
      tokenId: token.id,
    },
    explanation,
    matchedRoot: token.root || undefined,
    matchedLemma: token.lemma || undefined,
    matchedText: token.text,
    actionTarget: {
      routeMode: "explore",
      visualizationMode: kind === "ayah" ? "dependency-tree" : "radial-sura",
      selection: {
        surahId: token.sura,
        ayah: token.ayah,
        root: token.root || undefined,
        lemma: token.lemma || undefined,
        tokenId: token.id,
      },
    },
  };
}

function pushUnique(items: SearchResultItem[], seen: Set<string>, item: SearchResultItem) {
  if (seen.has(item.id)) return;
  seen.add(item.id);
  items.push(item);
}

// ---------------------------------------------------------------------------
// Surah name search — matches surah names (English, Arabic, meaning)
// and returns SearchResultItems pointing to the first token of the surah.
// ---------------------------------------------------------------------------

function searchSurahs(query: string, tokens: CorpusToken[]): SearchResultItem[] {
  const lowerQuery = query.toLowerCase();
  const normalizedQuery = normalizeArabicForSearch(query);
  const results: SearchResultItem[] = [];

  for (const [numStr, surah] of Object.entries(SURAH_NAMES)) {
    const num = Number(numStr);
    const nameMatch =
      surah.name.toLowerCase().includes(lowerQuery) ||
      surah.meaning.toLowerCase().includes(lowerQuery) ||
      normalizeArabicForSearch(surah.arabic).includes(normalizedQuery) ||
      surah.arabic.includes(query) ||
      String(num) === query.trim();

    if (!nameMatch) continue;

    // Find the first token of this surah for navigation
    const firstToken = tokens.find((t) => t.sura === num);
    const tokenId = firstToken?.id;

    results.push({
      id: `surah:${num}`,
      kind: "surah",
      title: `${surah.name} — ${surah.meaning}`,
      subtitle: `Surah ${num} · ${surah.verses} verses`,
      arabicText: surah.arabic,
      location: { surah: num, ayah: 1, tokenId },
      explanation: `Surah ${num}: ${surah.name} (${surah.meaning})`,
      actionTarget: {
        routeMode: "explore",
        visualizationMode: "radial-sura",
        selection: { surahId: num, ayah: 1 },
      },
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Translation / meaning search — searches through token glosses (English
// translations of individual words) and root glosses.
// ---------------------------------------------------------------------------

function searchTranslations(
  query: string,
  tokens: CorpusToken[],
  seen: Set<string>,
): SearchResultItem[] {
  const lowerQuery = query.toLowerCase();
  const results: SearchResultItem[] = [];

  // Search root glosses for matching meanings
  for (const [root, gloss] of ROOT_GLOSSES) {
    if (!gloss.toLowerCase().includes(lowerQuery)) continue;

    // Find a representative token with this root
    const token = tokens.find((t) => t.root === root);
    if (!token) continue;

    const item: SearchResultItem = {
      id: `translation:root:${root}`,
      kind: "translation",
      title: gloss,
      subtitle: `Root: ${root}`,
      arabicText: root,
      location: { surah: token.sura, ayah: token.ayah, tokenId: token.id },
      matchedRoot: root,
      explanation: `Root meaning: ${gloss}`,
      actionTarget: {
        routeMode: "explore",
        visualizationMode: "radial-sura",
        selection: { surahId: token.sura, ayah: token.ayah, root, tokenId: token.id },
      },
    };

    if (!seen.has(item.id)) {
      seen.add(item.id);
      results.push(item);
    }
  }

  return results;
}

export function searchCorpus(tokens: CorpusToken[], catalog: SearchCatalog, rawQuery: string): SearchResultItem[] {
  const query = rawQuery.trim();
  if (query.length < 2) return [];

  const parsed = parseSearchQuery(query);
  const freeText = parsed.freeText || parsed.raw;
  const normalizedQuery = normalizeArabicForSearch(freeText);
  const lowercaseQuery = freeText.toLowerCase();

  const results: SearchResultItem[] = [];
  const seen = new Set<string>();

  if (parsed.root || parsed.lemma || parsed.pos || parsed.ayah) {
    const ids = queryPhaseOne(catalog.phaseOne, {
      root: parsed.root,
      lemma: parsed.lemma,
      pos: parsed.pos,
      ayah: parsed.ayah,
    });

    for (const id of ids) {
      const token = catalog.byId.get(id);
      if (!token) continue;
      const kind: SearchResultKind =
        parsed.ayah ? "ayah" :
        parsed.root ? "root" :
        parsed.lemma ? "lemma" :
        parsed.gloss ? "gloss" :
        "token";

      pushUnique(
        results,
        seen,
        buildItem(
          token,
          kind,
          parsed.ayah ? `${token.sura}:${token.ayah}` : token.morphology?.gloss ?? token.lemma,
          parsed.ayah
            ? "Matched exact ayah reference"
            : parsed.root
            ? "Matched root family"
            : parsed.lemma
            ? "Matched lemma"
            : "Matched structured search"
        )
      );
    }
  }

  if (!freeText) {
    return results.slice(0, 24);
  }

  // ---- Surah name search (English name, Arabic name, meaning, number) ----
  const surahResults = searchSurahs(freeText, tokens);
  for (const surahItem of surahResults) {
    pushUnique(results, seen, surahItem);
  }

  for (const [root, rootTokens] of catalog.byRoot) {
    const normalizedRoot = normalizeArabicForSearch(root);
    if (
      root.includes(freeText) ||
      root.replace(/ /g, "").includes(freeText.replace(/ /g, "")) ||
      normalizedRoot.includes(normalizedQuery)
    ) {
      const token = rootTokens[0];
      pushUnique(
        results,
        seen,
        buildItem(token, "root", `Root: ${root} (${rootTokens.length})`, "Matched root neighborhood")
      );
    }
  }

  for (const [lemma, lemmaTokens] of catalog.byLemma) {
    const normalizedLemma = normalizeArabicForSearch(lemma);
    if (lemma.includes(freeText) || normalizedLemma.includes(normalizedQuery)) {
      const token = lemmaTokens[0];
      pushUnique(
        results,
        seen,
        buildItem(token, "lemma", `Lemma: ${lemma}`, "Matched lemma and lexical form")
      );
    }
  }

  for (const token of tokens) {
    const normalizedText = normalizeArabicForSearch(token.text);
    if ((token.text.includes(freeText) || normalizedText.includes(normalizedQuery)) && token.text.trim()) {
      pushUnique(
        results,
        seen,
        buildItem(token, "token", token.text, "Matched Arabic token text")
      );
    }

    const ayahRef = `${token.sura}:${token.ayah}`;
    if (ayahRef === freeText) {
      pushUnique(
        results,
        seen,
        buildItem(token, "ayah", ayahRef, "Matched exact ayah reference")
      );
    }

    const gloss = token.morphology?.gloss?.toLowerCase() ?? "";
    if (gloss.includes(lowercaseQuery)) {
      pushUnique(
        results,
        seen,
        buildItem(token, "gloss", token.morphology?.gloss ?? "", "Matched gloss and lemma")
      );
    }
  }

  // ---- Translation / meaning search (root glosses) ----
  const translationResults = searchTranslations(freeText, tokens, seen);
  for (const item of translationResults) {
    results.push(item);
  }

  const priority: Record<SearchResultKind, number> = {
    ayah: 0,
    root: 1,
    lemma: 2,
    token: 3,
    surah: 4,
    gloss: 5,
    translation: 6,
    semantic: 7,
  };

  return results
    .sort((a, b) => {
      const kindDelta = priority[a.kind] - priority[b.kind];
      if (kindDelta !== 0) return kindDelta;
      const aLoc = a.location;
      const bLoc = b.location;
      if (!aLoc || !bLoc) return 0;
      return aLoc.surah - bLoc.surah || (aLoc.ayah ?? 0) - (bLoc.ayah ?? 0);
    })
    .slice(0, 24);
}

export function groupSearchResults(results: SearchResultItem[]): Array<{
  kind: SearchResultKind;
  items: SearchResultItem[];
}> {
  const grouped = new Map<SearchResultKind, SearchResultItem[]>();
  for (const result of results) {
    const bucket = grouped.get(result.kind);
    if (bucket) {
      bucket.push(result);
      continue;
    }
    grouped.set(result.kind, [result]);
  }

  return [...grouped.entries()].map(([kind, items]) => ({ kind, items }));
}
