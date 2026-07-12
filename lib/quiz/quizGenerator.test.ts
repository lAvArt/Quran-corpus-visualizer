import { describe, expect, it } from "vitest";
import { calculateRootFrequencies } from "@/lib/search/collocation";
import type { CorpusToken, PartOfSpeech } from "@/lib/schema/types";
import { generateRootQuiz } from "./personalizedQuiz";
import type { QuizCorpusData } from "./questionTemplates";

function makeToken(
  id: string,
  sura: number,
  ayah: number,
  position: number,
  root: string,
  pos: PartOfSpeech = "N",
): CorpusToken {
  return {
    id,
    sura,
    ayah,
    position,
    text: root,
    root,
    lemma: root,
    pos,
    morphology: { features: {}, gloss: null, stem: root },
  };
}

/**
 * A tiny synthetic corpus with one frequency-1 "target" root plus several
 * high-frequency "filler" roots. The fillers exist purely so each
 * template's `canGenerate` (which checks the *overall* corpus for >= 4
 * quiz-worthy roots, independent of any locked root) reports true — that's
 * what actually lets `rootFrequencyTemplate.generate` run against the
 * frequency-1 locked root in the first place (see lockedRoot bypass in
 * `pickFreshRoot`).
 */
function buildFrequencyOneCorpus(): QuizCorpusData {
  const tokens: CorpusToken[] = [];
  const fillerRoots = ["قرب", "برد", "علم", "كتب", "نور"];

  for (const root of fillerRoots) {
    for (let sura = 1; sura <= 5; sura++) {
      for (let i = 0; i < 3; i++) {
        tokens.push(makeToken(`${root}-${sura}-${i}`, sura, 1, i + 1, root, i === 0 ? "N" : i === 1 ? "V" : "ADJ"));
      }
    }
  }

  // The locked root: exactly one occurrence, one surah, one ayah.
  tokens.push(makeToken("target-1-1", 1, 1, 99, "رحم", "N"));

  return {
    tokens,
    freqData: calculateRootFrequencies(tokens),
    glosses: new Map([["رحم", "mercy"]]),
    surahNames: {
      1: { name: "One", arabic: "الأولى", verses: 7 },
      2: { name: "Two", arabic: "الثانية", verses: 7 },
      3: { name: "Three", arabic: "الثالثة", verses: 7 },
      4: { name: "Four", arabic: "الرابعة", verses: 7 },
      5: { name: "Five", arabic: "الخامسة", verses: 7 },
    },
    locale: "en",
    glossLocale: "en",
    formatNumber: (value) => new Intl.NumberFormat("en").format(value),
    formatSurahName: (surahId) =>
      ({ 1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five" }[surahId] ?? `Surah ${surahId}`),
    formatPosLabel: (pos) =>
      ({ N: "Noun", V: "Verb", ADJ: "Adjective", P: "Preposition", PRON: "Pronoun" }[pos] ?? pos),
  };
}

describe("generateRootQuiz — frequency-1 root (regression: unbounded distractor loop)", () => {
  it("returns within a bounded time with 0..5 unique-id questions, never hangs", () => {
    const data = buildFrequencyOneCorpus();

    const start = Date.now();
    const questions = generateRootQuiz(data, "رحم");
    const elapsedMs = Date.now() - start;

    // The original bug was an unbounded `while` loop that could spin
    // forever for a freq === 1 root — this generous ceiling is just a
    // sanity bound; a healthy run finishes in low single-digit ms.
    expect(elapsedMs).toBeLessThan(2000);

    expect(questions.length).toBeGreaterThanOrEqual(0);
    expect(questions.length).toBeLessThanOrEqual(5);

    const ids = questions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const question of questions) {
      expect(question.subjectRoot).toBe("رحم");
      expect(question.choices.length).toBeGreaterThan(1);
      expect(question.correctIndex).toBeGreaterThanOrEqual(0);
      expect(question.correctIndex).toBeLessThan(question.choices.length);
    }
  });

  it("never repeats the same template type across a locked-root quiz", () => {
    const data = buildFrequencyOneCorpus();
    const questions = generateRootQuiz(data, "رحم");

    const templateTypes = questions.map((q) => q.templateType);
    expect(new Set(templateTypes).size).toBe(templateTypes.length);
  });
});
