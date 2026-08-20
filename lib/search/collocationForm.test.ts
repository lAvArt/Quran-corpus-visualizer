import { describe, expect, it } from "vitest";
import { calculateRootFrequencies, getCollocations } from "@/lib/search/collocation";
import type { CorpusToken, PartOfSpeech } from "@/lib/schema/types";

/**
 * The two properties the "nearby" search layer rests on, modelled on the real
 * shape of ﴿وَإِذْ قَالَ إِبْرَٰهِيمُ لِأَبِيهِ﴾:
 *
 *   1. anchoring on the exact written form means those tokens and no others —
 *      لِأَبِيهِ must not drag in لِأَبِى, which shares the lemma أَب;
 *   2. the speaker is sometimes named only in a PREVIOUS ayah, so an
 *      ayah-scoped window answers some occurrences and silently misses others.
 *
 * In the corpus 6:74 and 19:41 are thousands of tokens apart. The fixture pads
 * between passages so a distance window cannot reach across them by accident —
 * without that padding every token is "nearby" every other one and the
 * assertions pass for the wrong reason.
 */
let id = 0;
// NOTE: the app's PartOfSpeech has no "PN" — normalizePos() folds proper nouns
// into "N" — so names here are plain nouns and the assertions key off lemmas
// instead. The UI's "names only" filter uses the curated name index for the
// same reason; see components/search/NearbyPanel.tsx.
function tok(sura: number, ayah: number, position: number, text: string, lemma: string, root: string, pos: PartOfSpeech = "N"): CorpusToken {
    return { id: `t${(id += 1)}`, sura, ayah, position, text, root, lemma, pos, morphology: {} as CorpusToken["morphology"] };
}
/** Distance padding: unrelated tokens in an unrelated sūrah. */
const filler = (n: number, sura: number) =>
    Array.from({ length: n }, (_, k) => tok(sura, 1, k + 1, `حشو${k}`, `حَشْو${k}`, "حشو"));

// 6:74-like — the name shares the ayah with the word.
const sameAyah = [
    tok(6, 74, 1, "قال", "قَال", "قول", "V"),
    tok(6, 74, 2, "إبراهيم", "إِبْرَٰهِيم", ""),
    tok(6, 74, 3, "لأبيه", "أَب", "ابو"),
];
// 19:41–42-like — the name sits in the PRECEDING ayah, four tokens back.
const priorAyah = [
    tok(19, 41, 1, "واذكر", "ذَكَر", "ذكر", "V"),
    tok(19, 41, 2, "في", "فِى", "", "P"),
    tok(19, 41, 3, "الكتاب", "كِتَٰب", "كتب"),
    tok(19, 41, 4, "إبراهيم", "إِبْرَٰهِيم", ""),
    tok(19, 42, 1, "إذ", "إِذ", "", "P"),
    tok(19, 42, 2, "قال", "قَال", "قول", "V"),
    tok(19, 42, 3, "لأبيه", "أَب", "ابو"),
];
// A decoy far away: same LEMMA (أَب), different written form, different name.
const decoy = [
    tok(2, 133, 1, "لأبي", "أَب", "ابو"),
    tok(2, 133, 2, "يعقوب", "يَعْقُوب", ""),
];
const corpus = [...sameAyah, ...filler(40, 90), ...priorAyah, ...filler(40, 91), ...decoy];
const freq = calculateRootFrequencies(corpus);

const namesNear = (
    anchor: { kind: "form" | "lemma"; value: string },
    windowType: "ayah" | "distance",
    distance?: number,
) =>
    getCollocations(anchor, corpus, freq, {
        windowType, distance, groupBy: "lemma", minFrequency: 1,
    });

const countOf = (rows: ReturnType<typeof namesNear>, label: string) =>
    rows.find((r) => r.label === label)?.count ?? 0;

describe("collocation: exact-form anchoring", () => {
    it("counts only the written form, not its lemma family", () => {
        // Anchoring on لأبيه must never reach يعقوب, who sits beside لأبي.
        expect(countOf(namesNear({ kind: "form", value: "لأبيه" }, "distance", 10), "يَعْقُوب")).toBe(0);
    });

    it("…and the decoy IS reachable when anchored by lemma — so the test above bites", () => {
        expect(countOf(namesNear({ kind: "lemma", value: "أَب" }, "distance", 10), "يَعْقُوب")).toBe(1);
    });
});

describe("collocation: window width decides what is found", () => {
    const form = { kind: "form" as const, value: "لأبيه" };

    it("an ayah window finds only the speaker who shares the ayah", () => {
        expect(countOf(namesNear(form, "ayah"), "إِبْرَٰهِيم")).toBe(1);
    });

    it("a wide-enough distance window crosses the ayah boundary and finds both", () => {
        expect(countOf(namesNear(form, "distance", 10), "إِبْرَٰهِيم")).toBe(2);
    });

    it("a window too narrow to reach back still finds only the adjacent one", () => {
        expect(countOf(namesNear(form, "distance", 1), "إِبْرَٰهِيم")).toBe(1);
    });
});
