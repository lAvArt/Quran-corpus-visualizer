import { describe, it, expect } from "vitest";
import { buildRootWordFlows, uniqueRoots } from "@/lib/search/rootFlows";
import type { CorpusToken } from "@/lib/schema/types";

function makeToken(overrides: Partial<CorpusToken> & { id: string }): CorpusToken {
  return {
    sura: 1,
    ayah: 1,
    position: 1,
    text: "test",
    root: "",
    lemma: "",
    pos: "N",
    morphology: { features: {}, gloss: null, stem: null },
    ...overrides,
  };
}

describe("buildRootWordFlows", () => {
  it("should return empty array for empty tokens", () => {
    expect(buildRootWordFlows([])).toEqual([]);
  });

  it("should group tokens by root::lemma", () => {
    const tokens = [
      makeToken({ id: "1:1:1", root: "هدي", lemma: "هُدًى" }),
      makeToken({ id: "1:1:2", root: "هدي", lemma: "هُدًى" }),
      makeToken({ id: "1:1:3", root: "هدي", lemma: "هَادِي" }),
      makeToken({ id: "1:2:1", root: "كتب", lemma: "كِتَاب" }),
    ];

    const flows = buildRootWordFlows(tokens);
    expect(flows).toHaveLength(3);

    const hudaFlow = flows.find((f) => f.root === "هدي" && f.lemma === "هُدًى");
    expect(hudaFlow).toBeDefined();
    expect(hudaFlow!.count).toBe(2);
    expect(hudaFlow!.tokenIds).toEqual(["1:1:1", "1:1:2"]);
  });

  it("should sort by count descending, then root ascending", () => {
    const tokens = [
      makeToken({ id: "1", root: "ب", lemma: "x" }),
      makeToken({ id: "2", root: "ا", lemma: "y" }),
      makeToken({ id: "3", root: "ا", lemma: "y" }),
    ];

    const flows = buildRootWordFlows(tokens);
    expect(flows[0].root).toBe("ا");
    expect(flows[0].count).toBe(2);
    expect(flows[1].root).toBe("ب");
    expect(flows[1].count).toBe(1);
  });
});

describe("uniqueRoots", () => {
  it("should return empty array for empty tokens", () => {
    expect(uniqueRoots([])).toEqual([]);
  });

  it("should return sorted unique roots", () => {
    const tokens = [
      makeToken({ id: "1", root: "كتب" }),
      makeToken({ id: "2", root: "هدي" }),
      makeToken({ id: "3", root: "كتب" }),
      makeToken({ id: "4", root: "علم" }),
    ];

    const roots = uniqueRoots(tokens);
    expect(roots).toHaveLength(3);
    // Sorted by Arabic collation
    expect(roots).toContain("كتب");
    expect(roots).toContain("هدي");
    expect(roots).toContain("علم");
  });
});
