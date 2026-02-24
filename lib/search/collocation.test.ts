import { describe, it, expect } from "vitest";
import { type CorpusToken } from "@/lib/schema/types";
import { calculateRootFrequencies, getCollocations } from "./collocation";

const createToken = (
    id: string,
    sura: number,
    ayah: number,
    position: number,
    root: string,
    lemma: string
): CorpusToken => ({
    id,
    sura,
    ayah,
    position,
    text: id, // Mock
    root,
    lemma,
    pos: "N",
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
});
