import { describe, expect, it } from "vitest";
import { buildCorpusOverview, deriveCorpusReadiness } from "@/lib/corpus/readiness";
import type { CorpusToken } from "@/lib/schema/types";

const tokens: CorpusToken[] = [
  {
    id: "1:1:1",
    sura: 1,
    ayah: 1,
    position: 1,
    text: "الحمد",
    root: "حمد",
    lemma: "حمد",
    pos: "N",
    morphology: { features: {}, gloss: "praise", stem: "حمد" },
  },
  {
    id: "2:1:1",
    sura: 2,
    ayah: 1,
    position: 1,
    text: "ذلك",
    root: "",
    lemma: "ذلك",
    pos: "N",
    morphology: { features: {}, gloss: "that", stem: "ذلك" },
  },
  {
    id: "2:2:1",
    sura: 2,
    ayah: 2,
    position: 1,
    text: "رحمة",
    root: "رحم",
    lemma: "رحمة",
    pos: "N",
    morphology: { features: {}, gloss: "mercy", stem: "رحم" },
  },
];

describe("deriveCorpusReadiness", () => {
  it("treats sample data as shell-ready before deep corpus loads", () => {
    expect(deriveCorpusReadiness("sample", false)).toEqual({
      dataStatus: "sample",
      uiStatus: "shell-ready",
      shellReady: true,
      deepDataReady: false,
      canExploreDeeply: false,
    });
  });

  it("keeps shell-ready state while deep corpus is loading", () => {
    expect(deriveCorpusReadiness("loading", true)).toEqual({
      dataStatus: "loading",
      uiStatus: "loading",
      shellReady: true,
      deepDataReady: false,
      canExploreDeeply: false,
    });
  });

  it("marks full corpus as deep-data ready", () => {
    expect(deriveCorpusReadiness("full", false)).toEqual({
      dataStatus: "full",
      uiStatus: "full",
      shellReady: true,
      deepDataReady: true,
      canExploreDeeply: true,
    });
  });

  it("marks fallback as degraded but still shell-ready", () => {
    expect(deriveCorpusReadiness("fallback", false)).toEqual({
      dataStatus: "fallback",
      uiStatus: "fallback",
      shellReady: true,
      deepDataReady: false,
      canExploreDeeply: false,
    });
  });
});

describe("buildCorpusOverview", () => {
  it("summarizes token, surah, and root coverage for shell-ready data", () => {
    expect(buildCorpusOverview(tokens)).toEqual({
      tokenCount: 3,
      surahCount: 2,
      rootCount: 2,
    });
  });
});
