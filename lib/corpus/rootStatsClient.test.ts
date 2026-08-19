import { describe, expect, it } from "vitest";
import { rootPrefixMatches, type RootStat, type RootStatsIndex } from "@/lib/corpus/rootStatsClient";

function root(bare: string, count: number): RootStat {
  return {
    root: bare.split("").join("-"),
    bare,
    bw: bare,
    translit: bare.split("").join(" · "),
    gloss: null,
    count,
    surahs: 1,
    verses: 1,
    forms: 1,
    first: { sura: 1, ayah: 1 },
    top: [],
    hist: [],
    pos: [],
  };
}

const idx: RootStatsIndex = {
  version: 1,
  rootCount: 5,
  featured: [],
  roots: {
    رحم: root("رحم", 339),
    رزق: root("رزق", 123),
    ربب: root("ربب", 980),
    علم: root("علم", 854),
    كتب: root("كتب", 319),
  },
};

describe("rootPrefixMatches", () => {
  // The home screen is a search box: it has to answer the first keystroke.
  // A length gate here used to keep it silent until the third character, which
  // read as "the app can't find anything".
  it("suggests from a single letter, most frequent first", () => {
    const hits = rootPrefixMatches(idx, "ر");
    expect(hits.map((r) => r.bare)).toEqual(["ربب", "رحم", "رزق"]);
  });

  it("narrows as more letters arrive", () => {
    expect(rootPrefixMatches(idx, "رح").map((r) => r.bare)).toEqual(["رحم"]);
  });

  it("excludes the exact match — the caller lists that one itself", () => {
    expect(rootPrefixMatches(idx, "رحم")).toEqual([]);
  });

  it("caps the candidate list", () => {
    expect(rootPrefixMatches(idx, "ر", 2).map((r) => r.bare)).toEqual(["ربب", "رحم"]);
  });

  it("stays quiet on an empty query", () => {
    expect(rootPrefixMatches(idx, "")).toEqual([]);
    expect(rootPrefixMatches(idx, "   ")).toEqual([]);
  });
});
