import { describe, it, expect } from "vitest";
import type { CorpusToken, PartOfSpeech } from "@/lib/schema/types";

describe("CorpusToken type", () => {
  it("should allow valid PartOfSpeech values", () => {
    const validPOS: PartOfSpeech[] = ["N", "V", "P", "ADJ", "PRON"];
    expect(validPOS).toHaveLength(5);
  });

  it("should create a valid CorpusToken", () => {
    const token: CorpusToken = {
      id: "1:1:1",
      sura: 1,
      ayah: 1,
      position: 1,
      text: "بِسْمِ",
      root: "سمو",
      lemma: "ٱسْم",
      pos: "N",
      morphology: {
        features: { CASE: "GEN", DEF: "true" },
        gloss: "In (the) name",
        stem: "ٱسْم",
      },
    };

    expect(token.id).toBe("1:1:1");
    expect(token.sura).toBe(1);
    expect(token.morphology.features.CASE).toBe("GEN");
    expect(token.morphology.gloss).toBe("In (the) name");
  });
});

describe("Token ID format", () => {
  it("should follow sura:ayah:position format", () => {
    const pattern = /^\d+:\d+:\d+$/;
    expect(pattern.test("1:1:1")).toBe(true);
    expect(pattern.test("114:6:3")).toBe(true);
    expect(pattern.test("invalid")).toBe(false);
    expect(pattern.test("1:1")).toBe(false);
  });
});
