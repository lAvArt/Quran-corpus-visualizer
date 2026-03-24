import { describe, expect, it } from "vitest";
import { calculateRootFrequencies } from "@/lib/search/collocation";
import type { CorpusToken, PartOfSpeech } from "@/lib/schema/types";
import {
  ALL_TEMPLATES,
  validateQuizQuestion,
  type QuizCorpusData,
  type QuizQuestion,
} from "./questionTemplates";

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

function buildQuizData(locale = "en"): QuizCorpusData {
  const tokens: CorpusToken[] = [];
  const roots = ["قرب", "برد", "علم", "كتب", "نور", "رحم"];

  for (let sura = 1; sura <= 5; sura++) {
    let position = 1;

    for (let i = 0; i < 10; i++) {
      tokens.push(makeToken(`A-${sura}-${i}`, sura, 1, position++, "قرب", i < 6 ? "N" : i < 8 ? "V" : i === 8 ? "ADJ" : "PRON"));
    }
    for (let i = 0; i < 4; i++) {
      tokens.push(makeToken(`B-${sura}-${i}`, sura, 1, position++, "برد", i < 2 ? "N" : i === 2 ? "V" : "P"));
    }

    for (const root of roots.slice(2)) {
      for (let i = 0; i < 3; i++) {
        tokens.push(makeToken(`${root}-${sura}-${i}`, sura, 2, i + 1, root, i === 0 ? "N" : i === 1 ? "V" : "P"));
      }
    }
  }

  return {
    tokens,
    freqData: calculateRootFrequencies(tokens),
    glosses: new Map([
      ["قرب", "nearness"],
      ["برد", "coolness"],
      ["علم", "knowledge"],
      ["كتب", "writing"],
      ["نور", "light"],
      ["رحم", "mercy"],
    ]),
    surahNames: {
      1: { name: "One", arabic: "الأولى", verses: 7 },
      2: { name: "Two", arabic: "الثانية", verses: 7 },
      3: { name: "Three", arabic: "الثالثة", verses: 7 },
      4: { name: "Four", arabic: "الرابعة", verses: 7 },
      5: { name: "Five", arabic: "الخامسة", verses: 7 },
    },
    locale,
    glossLocale: "en",
    formatNumber: (value) => new Intl.NumberFormat(locale).format(value),
    formatSurahName: (surahId) => locale === "ar"
      ? ({ 1: "الأولى", 2: "الثانية", 3: "الثالثة", 4: "الرابعة", 5: "الخامسة" }[surahId] ?? `سورة ${surahId}`)
      : ({ 1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five" }[surahId] ?? `Surah ${surahId}`),
    formatPosLabel: (pos) => ({
      N: locale === "ar" ? "اسم" : "Noun",
      V: locale === "ar" ? "فعل" : "Verb",
      P: locale === "ar" ? "حرف جر" : "Preposition",
      ADJ: locale === "ar" ? "صفة" : "Adjective",
      PRON: locale === "ar" ? "ضمير" : "Pronoun",
    }[pos]),
  };
}

describe("validateQuizQuestion", () => {
  it("accepts a valid comparative-frequency question", () => {
    const data = buildQuizData("ar");
    const question: QuizQuestion = {
      id: "cf-test",
      templateType: "comparative-frequency",
      difficulty: "medium",
      prompt: "comparativeFrequency.prompt",
      promptValues: { rootA: "قرب", rootB: "برد" },
      choices: ["برد", "قرب"],
      correctIndex: 1,
      explanation: "comparativeFrequency.explanation",
      explanationValues: {
        winner: "قرب",
        loser: "برد",
        winnerCount: data.formatNumber(50),
        loserCount: data.formatNumber(20),
      },
      subjectRoot: "قرب",
    };

    expect(validateQuizQuestion(question, data)).toEqual({ valid: true });
  });

  it("rejects a comparative-frequency question with the wrong correctIndex", () => {
    const data = buildQuizData("ar");
    const question: QuizQuestion = {
      id: "cf-bad",
      templateType: "comparative-frequency",
      difficulty: "medium",
      prompt: "comparativeFrequency.prompt",
      promptValues: { rootA: "قرب", rootB: "برد" },
      choices: ["برد", "قرب"],
      correctIndex: 0,
      explanation: "comparativeFrequency.explanation",
      explanationValues: {
        winner: "قرب",
        loser: "برد",
        winnerCount: data.formatNumber(50),
        loserCount: data.formatNumber(20),
      },
      subjectRoot: "قرب",
    };

    expect(validateQuizQuestion(question, data)).toEqual({
      valid: false,
      reason: "comparative frequency mismatch",
    });
  });

  it("generates a valid comparative-frequency question from the template pool", () => {
    const data = buildQuizData("en");
    const template = ALL_TEMPLATES.find((entry) => entry.type === "comparative-frequency");
    expect(template).toBeDefined();

    const question = template!.generate(data, () => 0, new Set<string>(), []);

    expect(question).not.toBeNull();
    expect(validateQuizQuestion(question!, data)).toEqual({ valid: true });
  });
});
