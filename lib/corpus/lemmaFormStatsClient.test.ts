import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { lookupForm, lookupLemma, type LemmaFormStats } from "@/lib/corpus/lemmaFormStatsClient";

describe("lemma/form drill-down stats", () => {
  const file = path.resolve(process.cwd(), "public", "data", "lemma-form-stats.json");
  const idx = JSON.parse(readFileSync(file, "utf8")) as LemmaFormStats;

  it("narrows a root query to its lemma and exact form", () => {
    // عزيز: lemma عَزِيز (word + inflections) is broader than the exact form عَزِيزٌ.
    const lemma = lookupLemma(idx, "عزيز");
    const form = lookupForm(idx, "عزيز");
    expect(lemma).not.toBeNull();
    expect(form).not.toBeNull();
    expect(lemma!.c).toBeGreaterThan(form!.c);
    expect(lemma!.refs.length).toBeGreaterThan(0);
  });

  it("resolves an ال-prefixed query to its bare lemma via the form link", () => {
    // العزيز → form ٱلْعَزِيزُ → lemma عَزِيز
    const lemma = lookupLemma(idx, "العزيز");
    expect(lemma?.d).toBe(lookupLemma(idx, "عزيز")?.d);
  });

  it("rasm-folds a modern spelling the corpus writes defectively", () => {
    // صالح is written صلح in the rasm; both the lemma and exact form must resolve.
    expect(lookupLemma(idx, "صالح")).not.toBeNull();
    expect(lookupForm(idx, "صالح")).not.toBeNull();
  });

  it.each(["قرآن", "قران", "قرءان", "قرأن"])("resolves hamza spelling %s to root قرا", (q) => {
    expect(lookupForm(idx, q)).not.toBeNull();
    expect(lookupLemma(idx, q)?.r).toBe("قرا");
  });

  it("returns null for a non-word", () => {
    expect(lookupForm(idx, "زقزقةxyz")).toBeNull();
    expect(lookupLemma(idx, "زقزقةxyz")).toBeNull();
  });
});
