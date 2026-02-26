import { describe, expect, it } from "vitest";
import {
  buildLemmaCandidates,
  normalizeArabicForSearch,
  normalizeRootFamily,
} from "@/lib/search/arabicNormalize";

describe("arabicNormalize", () => {
  it("normalizes Arabic orthographic variants consistently", () => {
    expect(normalizeArabicForSearch("ٱلْحَمْدُ")).toBe("الحمد");
    expect(normalizeArabicForSearch("عِيسَىٰ")).toBe("عيسي");
    expect(normalizeArabicForSearch("مُوسَىٰ")).toBe("موسي");
  });

  it("normalizes weak-final root family variants", () => {
    expect(normalizeRootFamily("عصو")).toBe("عصي");
    expect(normalizeRootFamily("عصا")).toBe("عصي");
    expect(normalizeRootFamily("عصى")).toBe("عصي");
  });

  it("produces conservative lemma candidates for suffix forms", () => {
    const candidates = buildLemmaCandidates("عصاك");
    expect(candidates.has("عصاك")).toBe(true);
    expect(candidates.has("عصا")).toBe(true);
  });
});

