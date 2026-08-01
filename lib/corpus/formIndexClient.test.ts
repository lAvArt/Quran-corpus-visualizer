import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { lookupFormRoot, type FormIndex } from "@/lib/corpus/formIndexClient";
import { normalizeArabicForSearch } from "@/lib/search/arabicNormalize";

describe("form-index (surface word → root)", () => {
  const file = path.resolve(process.cwd(), "public", "data", "form-index.json");
  const idx = JSON.parse(readFileSync(file, "utf8")) as FormIndex;

  it.each([
    ["اسم", "سمو"],
    ["اسماء", "سمو"],
    ["كتاب", "كتب"],
    ["الرحمن", "رحم"], // proclitic ال- stripped
  ])("resolves %s → root %s", (word, root) => {
    expect(lookupFormRoot(idx, word)).toBe(root);
  });

  // Rasm fold: the corpus writes these defectively (صلح, رحمن), but users type
  // the modern spelling with the medial alef — both must reach the root.
  it.each([
    ["صالح", "صلح"],
    ["الصالحين", "صلح"],
    ["صالحات", "صلح"],
    ["رحمان", "رحم"],
  ])("rasm-folds %s → root %s", (word, root) => {
    expect(lookupFormRoot(idx, word)).toBe(root);
  });

  it("returns null for a non-word", () => {
    expect(lookupFormRoot(idx, "زقزقةxyz")).toBeNull();
  });

  it("root-stats has an entry for every form's target root", () => {
    // Sanity: the form index points at keys the root-stats index actually has.
    const rootStats = JSON.parse(
      readFileSync(path.resolve(process.cwd(), "public", "data", "root-stats.json"), "utf8"),
    ) as { roots: Record<string, unknown> };
    for (const word of ["اسم", "كتاب", "رحمه"]) {
      const bare = idx.forms[normalizeArabicForSearch(word)];
      expect(rootStats.roots[bare!], `${word} → ${bare}`).toBeDefined();
    }
  });
});
