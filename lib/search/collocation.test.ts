import { describe, it, expect } from "vitest";
import { type CorpusToken, type PartOfSpeech } from "@/lib/schema/types";
import { calculateRootFrequencies, getCollocations, getPairCooccurrence } from "./collocation";

const createToken = (
    id: string,
    sura: number,
    ayah: number,
    position: number,
    root: string,
    lemma: string,
    pos: PartOfSpeech = "N"
): CorpusToken => ({
    id,
    sura,
    ayah,
    position,
    text: id, // Mock
    root,
    lemma,
    pos,
    morphology: { features: {}, gloss: null, stem: null }
});

const mockTokens: CorpusToken[] = [
    createToken("1:1:1", 1, 1, 1, "R-1", "L-1"),
    createToken("1:1:2", 1, 1, 2, "R-2", "L-2"),
    createToken("1:1:3", 1, 1, 3, "R-3", "L-3"),
    createToken("1:1:4", 1, 1, 4, "R-1", "L-1"),

    createToken("1:2:1", 1, 2, 1, "R-2", "L-2"),
    createToken("1:2:2", 1, 2, 2, "R-4", "L-4"),
    createToken("1:2:3", 1, 2, 3, "R-5", "L-5"),
    createToken("1:2:4", 1, 2, 4, "R-1", "L-1"),

    createToken("2:1:1", 2, 1, 1, "R-1", "L-1"),
    createToken("2:1:2", 2, 1, 2, "R-3", "L-3"),
    createToken("2:1:3", 2, 1, 3, "R-6", "L-6"),
    createToken("2:1:4", 2, 1, 4, "R-4", "L-4"),
];

describe("collocation search", () => {
    it("calculates basic root frequencies correctly", () => {
        const data = calculateRootFrequencies(mockTokens);

        expect(data.totalTokens).toBe(12);
        expect(data.totalAyahs).toBe(3); // 1:1, 1:2, 2:1

        // R-1 appears 4 times, in 3 ayahs
        expect(data.rootFrequencies.get("R-1")).toBe(4);
        expect(data.rootAyahFrequencies.get("R-1")).toBe(3);

        // R-2 appears 2 times, in 2 ayahs
        expect(data.rootFrequencies.get("R-2")).toBe(2);
        expect(data.rootAyahFrequencies.get("R-2")).toBe(2);
    });

    it("finds collocations within an ayah window correctly", () => {
        const data = calculateRootFrequencies(mockTokens);
        const collocations = getCollocations("R-1", mockTokens, data, { windowType: "ayah" });

        // Ayahs containing R-1: [1:1, 1:2, 2:1]
        // 1:1 -> R-2, R-3
        // 1:2 -> R-2, R-4, R-5
        // 2:1 -> R-3, R-6, R-4

        // Total co-occurrences:
        // R-2: 2
        // R-3: 2
        // R-4: 2
        // R-5: 1
        // R-6: 1

        expect(collocations.length).toBe(5);

        const r2 = collocations.find(c => c.root === "R-2");
        expect(r2).toBeDefined();
        expect(r2!.count).toBe(2);
    });

    it("finds collocations within a distance window correctly", () => {
        const data = calculateRootFrequencies(mockTokens);
        // distance = 1 (+/- 1 token)
        const collocations = getCollocations("R-1", mockTokens, data, { windowType: "distance", distance: 1 });

        // R-1 instances:
        // idx 0 -> R-2 (idx 1)
        // idx 3 -> R-3 (idx 2), R-2 (idx 4) 
        // idx 7 -> R-5 (idx 6), R-1 (idx 8 - ignored since it's same root)
        // idx 8 -> R-1 (idx 7 - ignored), R-3 (idx 9)

        // Expected co-occurrences exactly near R-1:
        // R-2: 2 times
        // R-3: 2 times
        // R-5: 1 time

        const r2 = collocations.find(c => c.root === "R-2");
        expect(r2).toBeDefined();
        expect(r2!.count).toBe(2);

        const r3 = collocations.find(c => c.root === "R-3");
        expect(r3).toBeDefined();
        expect(r3!.count).toBe(2);
    });

    it("finds collocations within a surah window correctly", () => {
        const data = calculateRootFrequencies(mockTokens);
        const collocations = getCollocations("R-1", mockTokens, data, { windowType: "surah" });

        // Surahs containing R-1: surah 1 and 2
        // Surah 1 contributes R-2,R-3,R-4,R-5
        // Surah 2 contributes R-3,R-4,R-6
        // Counts are once per surah window.
        expect(collocations.length).toBe(5);
        expect(collocations.find(c => c.root === "R-2")?.count).toBe(1);
        expect(collocations.find(c => c.root === "R-3")?.count).toBe(2);
        expect(collocations.find(c => c.root === "R-4")?.count).toBe(2);
        expect(collocations.find(c => c.root === "R-5")?.count).toBe(1);
        expect(collocations.find(c => c.root === "R-6")?.count).toBe(1);
    });

    it("applies POS filter to collocates", () => {
        const posTokens: CorpusToken[] = [
            createToken("1:1:1", 1, 1, 1, "R-1", "L-1", "N"),
            createToken("1:1:2", 1, 1, 2, "R-2", "L-2", "N"),
            createToken("1:1:3", 1, 1, 3, "R-3", "L-3", "V"),
            createToken("1:2:1", 1, 2, 1, "R-1", "L-1", "N"),
            createToken("1:2:2", 1, 2, 2, "R-4", "L-4", "V"),
            createToken("1:2:3", 1, 2, 3, "R-5", "L-5", "N"),
        ];

        const data = calculateRootFrequencies(posTokens);
        const nounOnly = getCollocations("R-1", posTokens, data, {
            windowType: "ayah",
            filter: { pos: ["N"] },
        });

        expect(nounOnly.find((c) => c.root === "R-3")).toBeUndefined();
        expect(nounOnly.find((c) => c.root === "R-4")).toBeUndefined();
        expect(nounOnly.find((c) => c.root === "R-2")?.count).toBe(1);
        expect(nounOnly.find((c) => c.root === "R-5")?.count).toBe(1);
    });

    it("supports root+lemma pair lookups via pairTerm filter", () => {
        const data = calculateRootFrequencies(mockTokens);
        const pair = getCollocations(
            { kind: "root", value: "R-1" },
            mockTokens,
            data,
            {
                windowType: "ayah",
                groupBy: "lemma",
                pairTerm: { kind: "lemma", value: "L-2" },
            }
        );

        expect(pair.length).toBe(1);
        expect(pair[0].label).toBe("L-2");
        expect(pair[0].count).toBe(2);
    });

    it("computes explicit pair co-occurrence metrics", () => {
        const pair = getPairCooccurrence(
            { kind: "root", value: "R-1" },
            { kind: "lemma", value: "L-2" },
            mockTokens,
            { windowType: "ayah" }
        );

        expect(pair.countA).toBe(3);
        expect(pair.countB).toBe(2);
        expect(pair.cooccurrenceCount).toBe(2);
        expect(pair.sharedWindows).toEqual(expect.arrayContaining(["1:1", "1:2"]));
    });

    it("matches lemma terms despite Quranic diacritic variants", () => {
        const arabicTokens: CorpusToken[] = [
            createToken("20:17:1", 20, 17, 1, "عصو", "عَصًا", "N"),
            createToken("20:17:2", 20, 17, 2, "X", "مُوسَىٰ", "N"),
        ];
        const data = calculateRootFrequencies(arabicTokens);
        const collocations = getCollocations(
            { kind: "lemma", value: "موسى" },
            arabicTokens,
            data,
            { windowType: "ayah", groupBy: "root", pairTerm: { kind: "root", value: "عصو" } }
        );

        expect(collocations.length).toBe(1);
        expect(collocations[0].label).toBe("عصو");
        expect(collocations[0].count).toBe(1);
    });

    it("matches lemma input with attached pronoun suffixes (e.g. عصاك)", () => {
        const arabicTokens: CorpusToken[] = [
            createToken("20:17:1", 20, 17, 1, "عصو", "عصا", "N"),
            createToken("20:17:2", 20, 17, 2, "Qwl", "قال", "V"),
        ];
        const data = calculateRootFrequencies(arabicTokens);
        const collocations = getCollocations(
            { kind: "lemma", value: "عصاك" },
            arabicTokens,
            data,
            { windowType: "ayah", groupBy: "root" }
        );

        expect(collocations.length).toBe(1);
        expect(collocations[0].label).toBe("Qwl");
        expect(collocations[0].count).toBe(1);
    });

    it("matches weak-final root variants (e.g. عصا query vs عصو root)", () => {
        const arabicTokens: CorpusToken[] = [
            createToken("7:117:1", 7, 117, 1, "عصو", "عصا", "N"),
            createToken("7:117:2", 7, 117, 2, "سحر", "سحر", "N"),
        ];
        const data = calculateRootFrequencies(arabicTokens);
        const collocations = getCollocations(
            { kind: "root", value: "عصا" },
            arabicTokens,
            data,
            { windowType: "ayah", groupBy: "lemma" }
        );

        expect(collocations.length).toBe(1);
        expect(collocations[0].label).toBe("سحر");
        expect(collocations[0].count).toBe(1);
    });
});
