import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { lookupName, namePrefixMatches, type NameStat, type NameStatsIndex } from "@/lib/corpus/nameStatsClient";
import { normalizeArabicForSearch } from "@/lib/search/arabicNormalize";

function entry(over: Partial<NameStat> & { root: string; key: string }): NameStat {
  return {
    kind: "name",
    bare: over.root,
    bw: "",
    lemma: over.root,
    translit: "",
    gloss: null,
    count: 1,
    surahs: 1,
    verses: 1,
    forms: 1,
    first: { sura: 1, ayah: 1 },
    rep: { sura: 1, ayah: 1, word: 1 },
    top: [],
    hist: [],
    pos: [["N", 1]],
    ...over,
  };
}

function makeIndex(entries: NameStat[], aliasIndex: Record<string, string> = {}): NameStatsIndex {
  const names: Record<string, NameStat> = {};
  for (const e of entries) names[e.key] = e;
  return { version: 2, entryCount: entries.length, nameCount: entries.length, aliasIndex, featured: [], names };
}

describe("lookupName", () => {
  const idx = makeIndex([
    entry({ key: normalizeArabicForSearch("موسى"), root: "موسى", gloss: "Moses", translit: "Mūsā", count: 136 }),
    entry({ key: normalizeArabicForSearch("مريم"), root: "مريم", gloss: "Mary", translit: "Maryam", count: 34 }),
  ]);

  it("resolves an Arabic name typed as-is", () => {
    expect(lookupName(idx, "موسى")?.gloss).toBe("Moses");
  });

  it("folds ى→ي / hamza / diacritics via the shared normalizer", () => {
    // dagger-alif + alif-maqsura spelling must still hit the same key
    expect(lookupName(idx, "مُوسَىٰ")?.count).toBe(136);
    expect(lookupName(idx, "موسي")?.count).toBe(136); // ya spelling
  });

  it("strips a leading definite article / clitic", () => {
    expect(lookupName(idx, "ومريم")?.gloss).toBe("Mary");
  });

  it("resolves an English name", () => {
    expect(lookupName(idx, "moses")?.count).toBe(136);
    expect(lookupName(idx, "mary")?.gloss).toBe("Mary");
  });

  it("resolves by transliteration prefix", () => {
    expect(lookupName(idx, "mus")?.gloss).toBe("Moses");
  });

  it("resolves a partial Arabic prefix to the closest name", () => {
    expect(lookupName(idx, "موس")?.gloss).toBe("Moses"); // موس → موسى
  });

  it("does not prefix-match a query shorter than 3 chars", () => {
    expect(lookupName(idx, "مو")).toBeNull();
  });

  it("returns null for an unknown word", () => {
    expect(lookupName(idx, "زقزقة")).toBeNull();
    expect(lookupName(idx, "xyzzy")).toBeNull();
  });
});

describe("lookupName aliases", () => {
  const idx = makeIndex(
    [
      entry({
        key: normalizeArabicForSearch("سليمن"), root: "سليمن", gloss: "Solomon",
        translit: "Sulaymān", latinAliases: ["sulaiman"], count: 17,
      }),
    ],
    // dagger-alif full spelling → canonical key
    { [normalizeArabicForSearch("سليمان")]: normalizeArabicForSearch("سليمن") },
  );

  it("resolves an alternate Arabic spelling via aliasIndex", () => {
    expect(lookupName(idx, "سليمان")?.gloss).toBe("Solomon"); // full-alif spelling
  });

  it("resolves a Latin alias", () => {
    expect(lookupName(idx, "sulaiman")?.count).toBe(17);
  });
});

describe("name-stats.json data integrity", () => {
  const file = path.resolve(process.cwd(), "public", "data", "name-stats.json");
  const data = JSON.parse(readFileSync(file, "utf8")) as NameStatsIndex;

  // Ground truth from the QAC morphology file (per-word occurrence counts).
  const EXPECTED: Array<[string, number, string]> = [
    ["موسى", 136, "Moses"],
    ["عيسى", 25, "Jesus"],
    ["محمد", 4, "Muhammad"],
    ["ابراهيم", 69, "Abraham"],
    ["اسماعيل", 12, "Ishmael"],
    ["مريم", 34, "Mary"],
  ];

  it.each(EXPECTED)("%s occurs %i times with gloss %s", (name, count, gloss) => {
    const e = data.names[normalizeArabicForSearch(name)];
    expect(e, `${name} missing from name-stats`).toBeDefined();
    expect(e.count).toBe(count);
    expect(e.gloss).toBe(gloss);
    expect(e.rep).not.toBeNull();
  });

  it("also indexes root-less function words (e.g. حتى)", () => {
    const e = data.names[normalizeArabicForSearch("حتى")];
    expect(e).toBeDefined();
    expect(e.count).toBeGreaterThan(0);
  });

  it("resolves full-alif spellings of dagger-alif names via aliasIndex", () => {
    // Solomon is stored "سليمن"; users type "سليمان".
    const key = data.aliasIndex?.[normalizeArabicForSearch("سليمان")];
    expect(key, "سليمان alias missing").toBeDefined();
    expect(data.names[key!].gloss).toBe("Solomon");
  });

  it("resolves a partial prefix to the closest name (اسماع → اسماعيل)", () => {
    expect(lookupName(data, "اسماع")?.gloss).toBe("Ishmael");
    expect(lookupName(data, "ابراه")?.gloss).toBe("Abraham");
  });

  it("namePrefixMatches returns same-prefix names for the chooser", () => {
    const hits = namePrefixMatches(data, "عمر");
    expect(hits.some((e) => e.gloss?.startsWith("Imran"))).toBe(true); // عمران
  });

  // The chooser suggests from the first keystroke; only the auto-resolve path
  // (lookupName) still waits for 3 chars, so one letter offers choices rather
  // than silently picking a name for the user.
  it("namePrefixMatches suggests from a single letter", () => {
    expect(namePrefixMatches(data, "م").length).toBeGreaterThan(0);
    expect(namePrefixMatches(data, "مو").length).toBeGreaterThan(0);
    expect(lookupName(data, "مو")).toBeNull();
  });

  it("indexes multi-word compound names", () => {
    const dhul = data.names[normalizeArabicForSearch("ذو القرنين")];
    expect(dhul, "ذو القرنين missing").toBeDefined();
    expect(dhul.count).toBe(3);
    expect(data.names[normalizeArabicForSearch("يأجوج ومأجوج")]).toBeDefined();
  });
});
