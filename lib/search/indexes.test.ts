import { describe, it, expect } from "vitest";
import { buildPhaseOneIndexes, queryPhaseOne } from "@/lib/search/indexes";
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

describe("buildPhaseOneIndexes", () => {
  it("should build empty indexes from empty token array", () => {
    const index = buildPhaseOneIndexes([]);
    expect(index.root.size).toBe(0);
    expect(index.lemma.size).toBe(0);
    expect(index.pos.size).toBe(0);
    expect(index.ayah.size).toBe(0);
  });

  it("should index tokens by root, lemma, pos, ayah", () => {
    const tokens = [
      makeToken({ id: "1:1:1", sura: 1, ayah: 1, root: "هدي", lemma: "هُدًى", pos: "N" }),
      makeToken({ id: "1:1:2", sura: 1, ayah: 1, root: "هدي", lemma: "هَادِي", pos: "N" }),
      makeToken({ id: "1:2:1", sura: 1, ayah: 2, root: "كتب", lemma: "كِتَاب", pos: "V" }),
    ];
    const index = buildPhaseOneIndexes(tokens);

    expect(index.root.get("هدي")).toEqual(["1:1:1", "1:1:2"]);
    expect(index.root.get("كتب")).toEqual(["1:2:1"]);
    expect(index.lemma.get("هُدًى")).toEqual(["1:1:1"]);
    expect(index.pos.get("N")).toEqual(["1:1:1", "1:1:2"]);
    expect(index.pos.get("V")).toEqual(["1:2:1"]);
    expect(index.ayah.get("1:1")).toEqual(["1:1:1", "1:1:2"]);
    expect(index.ayah.get("1:2")).toEqual(["1:2:1"]);
  });
});

describe("queryPhaseOne", () => {
  const tokens = [
    makeToken({ id: "1:1:1", sura: 1, ayah: 1, root: "هدي", lemma: "هُدًى", pos: "N" }),
    makeToken({ id: "1:1:2", sura: 1, ayah: 1, root: "هدي", lemma: "هَادِي", pos: "V" }),
    makeToken({ id: "1:2:1", sura: 1, ayah: 2, root: "كتب", lemma: "كِتَاب", pos: "N" }),
    makeToken({ id: "2:1:1", sura: 2, ayah: 1, root: "هدي", lemma: "هُدًى", pos: "N" }),
  ];
  const index = buildPhaseOneIndexes(tokens);

  it("should return empty set for empty query", () => {
    const result = queryPhaseOne(index, {});
    expect(result.size).toBe(0);
  });

  it("should filter by root only", () => {
    const result = queryPhaseOne(index, { root: "هدي" });
    expect(result).toEqual(new Set(["1:1:1", "1:1:2", "2:1:1"]));
  });

  it("should intersect root + pos", () => {
    const result = queryPhaseOne(index, { root: "هدي", pos: "N" });
    expect(result).toEqual(new Set(["1:1:1", "2:1:1"]));
  });

  it("should intersect root + lemma + ayah", () => {
    const result = queryPhaseOne(index, { root: "هدي", lemma: "هُدًى", ayah: "1:1" });
    expect(result).toEqual(new Set(["1:1:1"]));
  });

  it("should return empty set for non-matching query", () => {
    const result = queryPhaseOne(index, { root: "nonexistent" });
    expect(result.size).toBe(0);
  });
});
