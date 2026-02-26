import { describe, it, expect } from "vitest";
import { buildPhaseOneIndexes, normalizeArabicForSearch, queryPhaseOne } from "@/lib/search/indexes";
import type { CorpusToken } from "@/lib/schema/types";

function makeToken(overrides: Partial<CorpusToken> & { id: string }): CorpusToken {
  return {
    sura: 1,
    ayah: 1,
    position: 1,
    text: "test",
    root: "root",
    lemma: "lemma",
    pos: "N",
    morphology: { features: {}, gloss: null, stem: null },
    ...overrides,
  };
}

describe("normalizeArabicForSearch", () => {
  it("normalizes diacritics and hamza/alef variants", () => {
    expect(normalizeArabicForSearch("ٱلْحَمْدُ")).toBe("الحمد");
    expect(normalizeArabicForSearch("عِيسَىٰ")).toBe("عيسي");
  });
});

describe("buildPhaseOneIndexes", () => {
  it("builds empty indexes from empty token array", () => {
    const index = buildPhaseOneIndexes([]);
    expect(index.root.size).toBe(0);
    expect(index.rootNormalized.size).toBe(0);
    expect(index.rootFamilyNormalized.size).toBe(0);
    expect(index.lemma.size).toBe(0);
    expect(index.lemmaNormalized.size).toBe(0);
    expect(index.lemmaLooseNormalized.size).toBe(0);
    expect(index.textNormalized.size).toBe(0);
    expect(index.pos.size).toBe(0);
    expect(index.ayah.size).toBe(0);
  });

  it("indexes tokens by root, lemma, pos, ayah and normalized forms", () => {
    const tokens = [
      makeToken({ id: "1:1:1", sura: 1, ayah: 1, root: "هدي", lemma: "هُدًى", text: "هُدًى", pos: "N" }),
      makeToken({ id: "1:1:2", sura: 1, ayah: 1, root: "هدي", lemma: "هَادِي", text: "هَادِي", pos: "N" }),
      makeToken({ id: "1:2:1", sura: 1, ayah: 2, root: "كتب", lemma: "كِتَاب", text: "كِتَاب", pos: "V" }),
    ];
    const index = buildPhaseOneIndexes(tokens);

    expect(index.root.get("هدي")).toEqual(["1:1:1", "1:1:2"]);
    expect(index.root.get("كتب")).toEqual(["1:2:1"]);
    expect(index.lemma.get("هُدًى")).toEqual(["1:1:1"]);
    expect(index.lemmaNormalized.get("هدي")).toEqual(["1:1:1"]);
    expect(index.pos.get("N")).toEqual(["1:1:1", "1:1:2"]);
    expect(index.pos.get("V")).toEqual(["1:2:1"]);
    expect(index.ayah.get("1:1")).toEqual(["1:1:1", "1:1:2"]);
    expect(index.ayah.get("1:2")).toEqual(["1:2:1"]);
  });
});

describe("queryPhaseOne", () => {
  const tokens = [
    makeToken({ id: "1:1:1", sura: 1, ayah: 1, root: "هدي", lemma: "هُدًى", text: "هُدًى", pos: "N" }),
    makeToken({ id: "1:1:2", sura: 1, ayah: 1, root: "هدي", lemma: "هَادِي", text: "هَادِي", pos: "V" }),
    makeToken({ id: "1:2:1", sura: 1, ayah: 2, root: "حمد", lemma: "حَمْد", text: "ٱلْحَمْدُ", pos: "N" }),
    makeToken({ id: "2:1:1", sura: 2, ayah: 1, root: "عيس", lemma: "عِيسَىٰ", text: "عِيسَىٰ", pos: "N" }),
  ];
  const index = buildPhaseOneIndexes(tokens);

  it("returns empty set for empty query", () => {
    const result = queryPhaseOne(index, {});
    expect(result.size).toBe(0);
  });

  it("filters by root only", () => {
    const result = queryPhaseOne(index, { root: "هدي" });
    expect(result).toEqual(new Set(["1:1:1", "1:1:2"]));
  });

  it("intersects root + pos", () => {
    const result = queryPhaseOne(index, { root: "هدي", pos: "N" });
    expect(result).toEqual(new Set(["1:1:1"]));
  });

  it("intersects root + lemma + ayah", () => {
    const result = queryPhaseOne(index, { root: "هدي", lemma: "هُدًى", ayah: "1:1" });
    expect(result).toEqual(new Set(["1:1:1"]));
  });

  it("finds a lemma by unvocalized Arabic input", () => {
    const result = queryPhaseOne(index, { lemma: "عيسى" });
    expect(result).toEqual(new Set(["2:1:1"]));
  });

  it("finds an inflected word via token text normalization", () => {
    const result = queryPhaseOne(index, { lemma: "الحمد" });
    expect(result).toEqual(new Set(["1:2:1"]));
  });

  it("supports root-field fallback for Arabic word lookup", () => {
    const result = queryPhaseOne(index, { root: "الحمد" });
    expect(result).toEqual(new Set(["1:2:1"]));
  });

  it("returns empty set for non-matching query", () => {
    const result = queryPhaseOne(index, { root: "nonexistent" });
    expect(result.size).toBe(0);
  });
});
