import type { CorpusToken } from "@/lib/schema/types";
import { buildPhaseOneIndexes, queryPhaseOne } from "@/lib/search/indexes";
import { normalizeArabicForSearch } from "@/lib/search/arabicNormalize";
import { parseSearchQuery } from "@/lib/search/queryParser";
import type { SearchResultItem, SearchResultKind } from "@/lib/search/searchTypes";

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

  const priority: Record<SearchResultKind, number> = {
    ayah: 0,
    root: 1,
    lemma: 2,
    token: 3,
    gloss: 4,
    semantic: 5,
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
