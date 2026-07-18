/**
 * Builds the per-entity BM25F indexes that power lexical + concept search.
 *
 * Four separate indexes (root / lemma / ayah / surah) instead of one mixed
 * index: keeping each entity kind in its own index means BM25's per-field
 * length normalization compares like with like (an ayah's Arabic field is
 * normalized against other ayahs, not against empty root-doc fields).
 *
 * Every document id is also the SearchResultItem id, so ranked ids from
 * `queryBm25` / `rrfMerge` map straight back to results via `metaById`.
 */

import type { CorpusToken } from "@/lib/schema/types";
import { ROOT_GLOSSES } from "@/lib/data/rootGlosses";
import { SURAH_NAMES } from "@/lib/data/surahData";
import { buildBm25Index, type Bm25Document, type Bm25Index } from "@/lib/search/bm25";

export type SearchDocKind = "root" | "lemma" | "ayah" | "surah";

interface BaseMeta {
  tokenId?: string;
  sura: number;
  ayah?: number;
}

export type SearchDocMeta =
  | (BaseMeta & { kind: "root"; root: string; lemma: string; count: number; gloss: string })
  | (BaseMeta & { kind: "lemma"; root: string; lemma: string; gloss: string })
  | (BaseMeta & { kind: "ayah" })
  | (BaseMeta & { kind: "surah" });

export interface SearchIndexes {
  root: Bm25Index<SearchDocMeta>;
  lemma: Bm25Index<SearchDocMeta>;
  ayah: Bm25Index<SearchDocMeta>;
  surah: Bm25Index<SearchDocMeta>;
  metaById: Map<string, SearchDocMeta>;
  /** Distinct roots that carry a gloss — passed to the concept lane for grounding. */
  glossedRoots: Array<{ root: string; gloss: string }>;
}

const MAX_FORMS = 40; // cap distinct word forms per root/lemma to bound field length
const MAX_GLOSSES = 12; // cap distinct token glosses gathered per root/lemma

function joinCapped(values: Iterable<string>, cap: number): string {
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    out.push(value);
    if (out.length >= cap) break;
  }
  return out.join(" ");
}

export function buildSearchIndexes(tokens: CorpusToken[]): SearchIndexes {
  const metaById = new Map<string, SearchDocMeta>();

  interface RootAgg { rep: CorpusToken; count: number; forms: Set<string>; glosses: Set<string>; lemmas: Set<string> }
  interface LemmaAgg { rep: CorpusToken; forms: Set<string>; glosses: Set<string>; root: string }
  interface AyahAgg { rep: CorpusToken; texts: string[]; glosses: Set<string>; roots: Set<string> }

  const roots = new Map<string, RootAgg>();
  const lemmas = new Map<string, LemmaAgg>();
  const ayahs = new Map<string, AyahAgg>();
  const surahFirstToken = new Map<number, CorpusToken>();

  for (const token of tokens) {
    if (!surahFirstToken.has(token.sura)) surahFirstToken.set(token.sura, token);

    const gloss = token.morphology?.gloss?.trim() ?? "";

    if (token.root) {
      let agg = roots.get(token.root);
      if (!agg) {
        agg = { rep: token, count: 0, forms: new Set(), glosses: new Set(), lemmas: new Set() };
        roots.set(token.root, agg);
      }
      agg.count++;
      if (token.text.trim()) agg.forms.add(token.text);
      if (gloss) agg.glosses.add(gloss);
      if (token.lemma) agg.lemmas.add(token.lemma);
    }

    if (token.lemma) {
      let agg = lemmas.get(token.lemma);
      if (!agg) {
        agg = { rep: token, forms: new Set(), glosses: new Set(), root: token.root };
        lemmas.set(token.lemma, agg);
      }
      if (token.text.trim()) agg.forms.add(token.text);
      if (gloss) agg.glosses.add(gloss);
    }

    const ayahKey = `${token.sura}:${token.ayah}`;
    let ayahAgg = ayahs.get(ayahKey);
    if (!ayahAgg) {
      ayahAgg = { rep: token, texts: [], glosses: new Set(), roots: new Set() };
      ayahs.set(ayahKey, ayahAgg);
    }
    if (token.text.trim()) ayahAgg.texts.push(token.text);
    if (gloss) ayahAgg.glosses.add(gloss);
    if (token.root) ayahAgg.roots.add(token.root);
  }

  // ── Root index ──
  const rootDocs: Array<Bm25Document<SearchDocMeta>> = [];
  const glossedRoots: Array<{ root: string; gloss: string }> = [];
  for (const [root, agg] of roots) {
    const id = `root:${root}`;
    const staticGloss = ROOT_GLOSSES.get(root) ?? "";
    const glossText = [staticGloss, joinCapped(agg.glosses, MAX_GLOSSES)].filter(Boolean).join(" ");
    const meta: SearchDocMeta = {
      kind: "root",
      root,
      lemma: agg.rep.lemma,
      count: agg.count,
      gloss: staticGloss || [...agg.glosses][0] || "",
      tokenId: agg.rep.id,
      sura: agg.rep.sura,
      ayah: agg.rep.ayah,
    };
    metaById.set(id, meta);
    rootDocs.push({
      id,
      meta,
      fields: {
        root,
        gloss: glossText,
        lemmas: joinCapped(agg.lemmas, MAX_FORMS),
        forms: joinCapped(agg.forms, MAX_FORMS),
      },
    });
    if (glossText) glossedRoots.push({ root, gloss: glossText });
  }

  // ── Lemma index ──
  const lemmaDocs: Array<Bm25Document<SearchDocMeta>> = [];
  for (const [lemma, agg] of lemmas) {
    const id = `lemma:${lemma}`;
    const meta: SearchDocMeta = {
      kind: "lemma",
      root: agg.root,
      lemma,
      gloss: [...agg.glosses][0] ?? "",
      tokenId: agg.rep.id,
      sura: agg.rep.sura,
      ayah: agg.rep.ayah,
    };
    metaById.set(id, meta);
    lemmaDocs.push({
      id,
      meta,
      fields: {
        lemma,
        gloss: joinCapped(agg.glosses, MAX_GLOSSES),
        forms: joinCapped(agg.forms, MAX_FORMS),
      },
    });
  }

  // ── Ayah index ──
  const ayahDocs: Array<Bm25Document<SearchDocMeta>> = [];
  for (const [key, agg] of ayahs) {
    const id = `ayah:${key}`;
    const surah = SURAH_NAMES[agg.rep.sura];
    const meta: SearchDocMeta = {
      kind: "ayah",
      tokenId: agg.rep.id,
      sura: agg.rep.sura,
      ayah: agg.rep.ayah,
    };
    metaById.set(id, meta);
    ayahDocs.push({
      id,
      meta,
      fields: {
        arabic: agg.texts.join(" "),
        gloss: joinCapped(agg.glosses, 64),
        roots: [...agg.roots].join(" "),
        surah: surah ? `${surah.name} ${surah.meaning} ${surah.arabic}` : "",
      },
    });
  }

  // ── Surah index ──
  const surahDocs: Array<Bm25Document<SearchDocMeta>> = [];
  for (const [numStr, surah] of Object.entries(SURAH_NAMES)) {
    const sura = Number(numStr);
    const id = `surah:${sura}`;
    const rep = surahFirstToken.get(sura);
    const meta: SearchDocMeta = { kind: "surah", sura, tokenId: rep?.id };
    metaById.set(id, meta);
    surahDocs.push({
      id,
      meta,
      fields: { name: surah.name, meaning: surah.meaning, arabic: surah.arabic },
    });
  }

  return {
    root: buildBm25Index(rootDocs, [
      { name: "root", boost: 3 },
      { name: "gloss", boost: 2 },
      { name: "lemmas", boost: 1 },
      { name: "forms", boost: 1 },
    ]),
    lemma: buildBm25Index(lemmaDocs, [
      { name: "lemma", boost: 3 },
      { name: "gloss", boost: 1.5 },
      { name: "forms", boost: 1 },
    ]),
    ayah: buildBm25Index(ayahDocs, [
      { name: "arabic", boost: 2 },
      { name: "gloss", boost: 1.5 },
      { name: "roots", boost: 1 },
      { name: "surah", boost: 0.5 },
    ]),
    surah: buildBm25Index(surahDocs, [
      { name: "name", boost: 3 },
      { name: "meaning", boost: 2 },
      { name: "arabic", boost: 2 },
    ]),
    metaById,
    glossedRoots,
  };
}
