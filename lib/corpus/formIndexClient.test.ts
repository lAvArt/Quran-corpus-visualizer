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

  // Hamza handling: the corpus writes قرآن with an explicit hamza (قرءان). EVERY
  // modern spelling must reach root قرا — and NOT the rasm-fold's wrong قرن.
  it.each([
    ["قرآن", "قرا"], // madda
    ["القرآن", "قرا"],
    ["قران", "قرا"], // bare alef (was resolving to the wrong root قرن)
    ["القران", "قرا"],
    ["قرأن", "قرا"], // hamza-on-alef
    ["قرءان", "قرا"], // explicit hamza (as the corpus writes it)
  ])("resolves hamza spelling %s → root %s", (word, root) => {
    expect(lookupFormRoot(idx, word)).toBe(root);
  });

  // The hamza alias is ADDITIVE — a direct plain-alef key must never be
  // clobbered by a hamza word that folds onto it (امن stays believe, not آمن).
  it("keeps a direct plain-alef key winning over a hamza-fold alias", () => {
    expect(lookupFormRoot(idx, "امن")).toBe("امن");
  });

  // Regression: madda words the corpus writes WITHOUT a hamza (مآب → ماب) must
  // still resolve via the plain spelling, not be broken by the bridge.
  it("keeps a madda word written without hamza resolving (مآب → اوب)", () => {
    expect(lookupFormRoot(idx, "مآب")).toBe("اوب");
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
