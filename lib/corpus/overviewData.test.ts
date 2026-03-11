import { describe, expect, it } from "vitest";
import {
  buildCorpusOverviewData,
  buildExploreOverviewPayload,
  buildShellCorpusTokens,
  buildVisualizationCorpusTokens,
  mergeCorpusTokens,
} from "@/lib/corpus/overviewData";
import { sampleAyahDependency } from "@/lib/corpus/sampleAyahDependency";
import type { CorpusToken } from "@/lib/schema/types";

const unsortedTokens: CorpusToken[] = [
  {
    id: "2:3:2",
    sura: 2,
    ayah: 3,
    position: 2,
    text: "token-b",
    root: "b",
    lemma: "b",
    pos: "N",
    morphology: { features: {}, gloss: "b", stem: "b" },
  },
  {
    id: "1:1:1",
    sura: 1,
    ayah: 1,
    position: 1,
    text: "token-a",
    root: "a",
    lemma: "a",
    pos: "N",
    morphology: { features: {}, gloss: "a", stem: "a" },
  },
];

describe("mergeCorpusTokens", () => {
  it("deduplicates by token id and sorts by location", () => {
    const merged = mergeCorpusTokens(
      unsortedTokens,
      [
        {
          ...unsortedTokens[1],
          text: "token-a-replacement",
        },
      ]
    );

    expect(merged.map((token) => token.id)).toEqual(["1:1:1", "2:3:2"]);
    expect(merged[0]?.text).toBe("token-a-replacement");
  });
});

describe("buildShellCorpusTokens", () => {
  it("provides shell-ready sample coverage", () => {
    const shellTokens = buildShellCorpusTokens();

    expect(shellTokens.length).toBeGreaterThan(0);
    expect(new Set(shellTokens.map((token) => token.id)).size).toBe(shellTokens.length);
  });
});

describe("buildVisualizationCorpusTokens", () => {
  it("ensures dependency sample tokens are present for inspector-ready visualization state", () => {
    const shellTokens = buildShellCorpusTokens();
    const visualizationTokens = buildVisualizationCorpusTokens(shellTokens, []);

    expect(visualizationTokens.some((token) => token.id === sampleAyahDependency.tokens[4]?.id)).toBe(true);
  });
});

describe("buildCorpusOverviewData", () => {
  it("returns shell tokens, visualization tokens, and an overview summary", () => {
    const deepTokens: CorpusToken[] = [
      {
        id: "3:1:1",
        sura: 3,
        ayah: 1,
        position: 1,
        text: "token-c",
        root: "c",
        lemma: "c",
        pos: "N",
        morphology: { features: {}, gloss: "c", stem: "c" },
      },
    ];

    const overviewData = buildCorpusOverviewData(deepTokens);

    expect(overviewData.shellTokens.length).toBeGreaterThan(0);
    expect(overviewData.visualizationTokens.some((token) => token.id === "3:1:1")).toBe(true);
    expect(overviewData.overview.tokenCount).toBe(overviewData.visualizationTokens.length);
    expect(overviewData.overview.surahCount).toBeGreaterThan(0);
    expect(overviewData.overview.rootCount).toBeGreaterThan(0);
  });
});

describe("buildExploreOverviewPayload", () => {
  it("returns shell-backed data without requiring deep corpus tokens", () => {
    const overviewData = buildExploreOverviewPayload();

    expect(overviewData.shellTokens.length).toBeGreaterThan(0);
    expect(overviewData.visualizationTokens.length).toBeGreaterThanOrEqual(overviewData.shellTokens.length);
    expect(overviewData.overview.tokenCount).toBe(overviewData.visualizationTokens.length);
  });
});
