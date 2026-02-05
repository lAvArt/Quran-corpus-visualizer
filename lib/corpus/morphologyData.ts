/**
 * Quranic Arabic Corpus Morphology Data
 * 
 * This module provides morphological annotations from the Quranic Arabic Corpus
 * (corpus.quran.com). Since the corpus doesn't have a public REST API, we bundle
 * essential morphological data for the visualizations.
 * 
 * Data structure follows the JQuranTree model:
 * - Root (trilateral/quadrilateral consonant root)
 * - Lemma (dictionary form)
 * - POS (part of speech)
 * - Morphological features (case, gender, number, person, etc.)
 */

import type { CorpusToken, PartOfSpeech, Morphology } from "@/lib/schema/types";

// Extended POS types following Quranic Arabic Corpus conventions
export type ExtendedPOS =
  | "N"      // Noun
  | "PN"     // Proper noun
  | "V"      // Verb
  | "ADJ"    // Adjective
  | "P"      // Preposition
  | "PRON"   // Pronoun
  | "DEM"    // Demonstrative
  | "REL"    // Relative pronoun
  | "CONJ"   // Conjunction
  | "PART"   // Particle
  | "NEG"    // Negative particle
  | "INTG"   // Interrogative
  | "VOC"    // Vocative particle
  | "EMPH"   // Emphatic particle
  | "RES"    // Restriction particle
  | "COND"   // Conditional particle
  | "ANS"    // Answer particle
  | "PREV"   // Preventive particle
  | "INC"    // Inceptive particle
  | "SUR"    // Surprise particle
  | "SUP"    // Supplemental particle
  | "EXP"    // Explanation particle
  | "AMD"    // Amendment particle
  | "EXH"    // Exhortation particle
  | "AVR"    // Aversion particle
  | "CERT"   // Certainty particle
  | "RET"    // Retraction particle
  | "EXL"    // Exceptive particle
  | "FUT"    // Future particle
  | "INL"    // Interjectional particle
  | "COM"    // Comitative particle
  | "RSLT"   // Result particle
  | "CIRC"   // Circumstantial particle
  | "CAUS"   // Cause particle
  | "T"      // Time adverb
  | "LOC";   // Location adverb

// Common Arabic roots with their semantic fields
export const ROOT_SEMANTIC_FIELDS: Record<string, string[]> = {
  "ر ح م": ["mercy", "compassion", "womb"],
  "ع ل م": ["knowledge", "learning", "science"],
  "ح م د": ["praise", "gratitude", "commendation"],
  "ك ت ب": ["writing", "book", "prescription"],
  "ق ر أ": ["reading", "recitation", "gathering"],
  "س م ع": ["hearing", "listening", "obedience"],
  "ب ص ر": ["sight", "vision", "insight"],
  "ق ل ب": ["heart", "turning", "transformation"],
  "ن ف س": ["soul", "self", "breath"],
  "ر ب ب": ["lord", "master", "nurturing"],
  "إ ل ه": ["deity", "god", "worship"],
  "ص ل و": ["prayer", "blessing", "connection"],
  "ز ك و": ["purification", "growth", "charity"],
  "ص و م": ["fasting", "abstaining", "silence"],
  "ح ج ج": ["pilgrimage", "argument", "proof"],
  "أ م ن": ["faith", "security", "trust"],
  "ك ف ر": ["disbelief", "covering", "ingratitude"],
  "ص د ق": ["truth", "sincerity", "charity"],
  "ع د ل": ["justice", "balance", "equality"],
  "ظ ل م": ["wrongdoing", "darkness", "oppression"],
};

// Sample morphology data for Al-Fatiha (Surah 1)
// In production, this would be loaded from a JSON file or database
export const SAMPLE_MORPHOLOGY_DATA: CorpusToken[] = [
  // 1:1 - Bismillah
  {
    id: "1:1:1",
    sura: 1,
    ayah: 1,
    position: 1,
    text: "بِسْمِ",
    root: "س م و",
    lemma: "اِسْم",
    pos: "N" as PartOfSpeech,
    morphology: {
      features: {
        case: "GEN",
        gender: "M",
        number: "S",
      },
      gloss: "In the name",
      stem: "اسم",
    },
  },
  {
    id: "1:1:2",
    sura: 1,
    ayah: 1,
    position: 2,
    text: "ٱللَّهِ",
    root: "أ ل ه",
    lemma: "ٱللَّه",
    pos: "N" as PartOfSpeech,
    morphology: {
      features: {
        case: "GEN",
        gender: "M",
        number: "S",
        type: "proper",
      },
      gloss: "Allah",
      stem: "الله",
    },
  },
  {
    id: "1:1:3",
    sura: 1,
    ayah: 1,
    position: 3,
    text: "ٱلرَّحْمَـٰنِ",
    root: "ر ح م",
    lemma: "رَحْمَٰن",
    pos: "ADJ" as PartOfSpeech,
    morphology: {
      features: {
        case: "GEN",
        gender: "M",
        number: "S",
        pattern: "فَعْلَان",
      },
      gloss: "the Most Gracious",
      stem: "رحمن",
    },
  },
  {
    id: "1:1:4",
    sura: 1,
    ayah: 1,
    position: 4,
    text: "ٱلرَّحِيمِ",
    root: "ر ح م",
    lemma: "رَحِيم",
    pos: "ADJ" as PartOfSpeech,
    morphology: {
      features: {
        case: "GEN",
        gender: "M",
        number: "S",
        pattern: "فَعِيل",
      },
      gloss: "the Most Merciful",
      stem: "رحيم",
    },
  },
  // 1:2 - Al-Hamdulillah
  {
    id: "1:2:1",
    sura: 1,
    ayah: 2,
    position: 1,
    text: "ٱلْحَمْدُ",
    root: "ح م د",
    lemma: "حَمْد",
    pos: "N" as PartOfSpeech,
    morphology: {
      features: {
        case: "NOM",
        gender: "M",
        number: "S",
        definiteness: "DEF",
      },
      gloss: "All praise",
      stem: "حمد",
    },
  },
  {
    id: "1:2:2",
    sura: 1,
    ayah: 2,
    position: 2,
    text: "لِلَّهِ",
    root: "أ ل ه",
    lemma: "ٱللَّه",
    pos: "N" as PartOfSpeech,
    morphology: {
      features: {
        case: "GEN",
        gender: "M",
        number: "S",
        type: "proper",
      },
      gloss: "to Allah",
      stem: "الله",
    },
  },
  {
    id: "1:2:3",
    sura: 1,
    ayah: 2,
    position: 3,
    text: "رَبِّ",
    root: "ر ب ب",
    lemma: "رَبّ",
    pos: "N" as PartOfSpeech,
    morphology: {
      features: {
        case: "GEN",
        gender: "M",
        number: "S",
      },
      gloss: "Lord",
      stem: "رب",
    },
  },
  {
    id: "1:2:4",
    sura: 1,
    ayah: 2,
    position: 4,
    text: "ٱلْعَـٰلَمِينَ",
    root: "ع ل م",
    lemma: "عَالَم",
    pos: "N" as PartOfSpeech,
    morphology: {
      features: {
        case: "GEN",
        gender: "M",
        number: "P",
        definiteness: "DEF",
      },
      gloss: "the worlds",
      stem: "عالم",
    },
  },
  // 1:3
  {
    id: "1:3:1",
    sura: 1,
    ayah: 3,
    position: 1,
    text: "ٱلرَّحْمَـٰنِ",
    root: "ر ح م",
    lemma: "رَحْمَٰن",
    pos: "ADJ" as PartOfSpeech,
    morphology: {
      features: {
        case: "GEN",
        gender: "M",
        number: "S",
      },
      gloss: "the Most Gracious",
      stem: "رحمن",
    },
  },
  {
    id: "1:3:2",
    sura: 1,
    ayah: 3,
    position: 2,
    text: "ٱلرَّحِيمِ",
    root: "ر ح م",
    lemma: "رَحِيم",
    pos: "ADJ" as PartOfSpeech,
    morphology: {
      features: {
        case: "GEN",
        gender: "M",
        number: "S",
      },
      gloss: "the Most Merciful",
      stem: "رحيم",
    },
  },
  // 1:4
  {
    id: "1:4:1",
    sura: 1,
    ayah: 4,
    position: 1,
    text: "مَـٰلِكِ",
    root: "م ل ك",
    lemma: "مَالِك",
    pos: "N" as PartOfSpeech,
    morphology: {
      features: {
        case: "GEN",
        gender: "M",
        number: "S",
      },
      gloss: "Master",
      stem: "مالك",
    },
  },
  {
    id: "1:4:2",
    sura: 1,
    ayah: 4,
    position: 2,
    text: "يَوْمِ",
    root: "ي و م",
    lemma: "يَوْم",
    pos: "N" as PartOfSpeech,
    morphology: {
      features: {
        case: "GEN",
        gender: "M",
        number: "S",
      },
      gloss: "Day",
      stem: "يوم",
    },
  },
  {
    id: "1:4:3",
    sura: 1,
    ayah: 4,
    position: 3,
    text: "ٱلدِّينِ",
    root: "د ي ن",
    lemma: "دِين",
    pos: "N" as PartOfSpeech,
    morphology: {
      features: {
        case: "GEN",
        gender: "M",
        number: "S",
        definiteness: "DEF",
      },
      gloss: "Judgment",
      stem: "دين",
    },
  },
  // 1:5
  {
    id: "1:5:1",
    sura: 1,
    ayah: 5,
    position: 1,
    text: "إِيَّاكَ",
    root: "أ ي ي",
    lemma: "إِيَّا",
    pos: "PRON" as PartOfSpeech,
    morphology: {
      features: {
        person: "2",
        gender: "M",
        number: "S",
      },
      gloss: "You alone",
      stem: "إيا",
    },
  },
  {
    id: "1:5:2",
    sura: 1,
    ayah: 5,
    position: 2,
    text: "نَعْبُدُ",
    root: "ع ب د",
    lemma: "عَبَدَ",
    pos: "V" as PartOfSpeech,
    morphology: {
      features: {
        person: "1",
        gender: "M",
        number: "P",
        mood: "IND",
        voice: "ACT",
        aspect: "IMPF",
      },
      gloss: "we worship",
      stem: "عبد",
    },
  },
  {
    id: "1:5:3",
    sura: 1,
    ayah: 5,
    position: 3,
    text: "وَإِيَّاكَ",
    root: "أ ي ي",
    lemma: "إِيَّا",
    pos: "PRON" as PartOfSpeech,
    morphology: {
      features: {
        person: "2",
        gender: "M",
        number: "S",
      },
      gloss: "and You alone",
      stem: "إيا",
    },
  },
  {
    id: "1:5:4",
    sura: 1,
    ayah: 5,
    position: 4,
    text: "نَسْتَعِينُ",
    root: "ع و ن",
    lemma: "اِسْتَعَانَ",
    pos: "V" as PartOfSpeech,
    morphology: {
      features: {
        person: "1",
        gender: "M",
        number: "P",
        mood: "IND",
        voice: "ACT",
        aspect: "IMPF",
        form: "X",
      },
      gloss: "we seek help",
      stem: "استعان",
    },
  },
  // 1:6
  {
    id: "1:6:1",
    sura: 1,
    ayah: 6,
    position: 1,
    text: "ٱهْدِنَا",
    root: "ه د ي",
    lemma: "هَدَى",
    pos: "V" as PartOfSpeech,
    morphology: {
      features: {
        person: "2",
        gender: "M",
        number: "S",
        mood: "IMP",
        voice: "ACT",
      },
      gloss: "Guide us",
      stem: "هدى",
    },
  },
  {
    id: "1:6:2",
    sura: 1,
    ayah: 6,
    position: 2,
    text: "ٱلصِّرَٰطَ",
    root: "ص ر ط",
    lemma: "صِرَاط",
    pos: "N" as PartOfSpeech,
    morphology: {
      features: {
        case: "ACC",
        gender: "M",
        number: "S",
        definiteness: "DEF",
      },
      gloss: "the path",
      stem: "صراط",
    },
  },
  {
    id: "1:6:3",
    sura: 1,
    ayah: 6,
    position: 3,
    text: "ٱلْمُسْتَقِيمَ",
    root: "ق و م",
    lemma: "مُسْتَقِيم",
    pos: "ADJ" as PartOfSpeech,
    morphology: {
      features: {
        case: "ACC",
        gender: "M",
        number: "S",
        definiteness: "DEF",
        form: "X",
      },
      gloss: "the straight",
      stem: "مستقيم",
    },
  },
  // 1:7
  {
    id: "1:7:1",
    sura: 1,
    ayah: 7,
    position: 1,
    text: "صِرَٰطَ",
    root: "ص ر ط",
    lemma: "صِرَاط",
    pos: "N" as PartOfSpeech,
    morphology: {
      features: {
        case: "ACC",
        gender: "M",
        number: "S",
      },
      gloss: "path",
      stem: "صراط",
    },
  },
  {
    id: "1:7:2",
    sura: 1,
    ayah: 7,
    position: 2,
    text: "ٱلَّذِينَ",
    root: "",
    lemma: "ٱلَّذِي",
    pos: "PRON" as PartOfSpeech,
    morphology: {
      features: {
        gender: "M",
        number: "P",
        type: "REL",
      },
      gloss: "those who",
      stem: null,
    },
  },
  {
    id: "1:7:3",
    sura: 1,
    ayah: 7,
    position: 3,
    text: "أَنْعَمْتَ",
    root: "ن ع م",
    lemma: "أَنْعَمَ",
    pos: "V" as PartOfSpeech,
    morphology: {
      features: {
        person: "2",
        gender: "M",
        number: "S",
        voice: "ACT",
        aspect: "PERF",
        form: "IV",
      },
      gloss: "You have blessed",
      stem: "أنعم",
    },
  },
  {
    id: "1:7:4",
    sura: 1,
    ayah: 7,
    position: 4,
    text: "عَلَيْهِمْ",
    root: "ع ل و",
    lemma: "عَلَىٰ",
    pos: "P" as PartOfSpeech,
    morphology: {
      features: {},
      gloss: "upon them",
      stem: "على",
    },
  },
  {
    id: "1:7:5",
    sura: 1,
    ayah: 7,
    position: 5,
    text: "غَيْرِ",
    root: "غ ي ر",
    lemma: "غَيْر",
    pos: "N" as PartOfSpeech,
    morphology: {
      features: {
        case: "GEN",
        gender: "M",
        number: "S",
      },
      gloss: "not",
      stem: "غير",
    },
  },
  {
    id: "1:7:6",
    sura: 1,
    ayah: 7,
    position: 6,
    text: "ٱلْمَغْضُوبِ",
    root: "غ ض ب",
    lemma: "مَغْضُوب",
    pos: "N" as PartOfSpeech,
    morphology: {
      features: {
        case: "GEN",
        gender: "M",
        number: "S",
        definiteness: "DEF",
        voice: "PASS",
      },
      gloss: "those who earned wrath",
      stem: "مغضوب",
    },
  },
  {
    id: "1:7:7",
    sura: 1,
    ayah: 7,
    position: 7,
    text: "عَلَيْهِمْ",
    root: "ع ل و",
    lemma: "عَلَىٰ",
    pos: "P" as PartOfSpeech,
    morphology: {
      features: {},
      gloss: "upon them",
      stem: "على",
    },
  },
  {
    id: "1:7:8",
    sura: 1,
    ayah: 7,
    position: 8,
    text: "وَلَا",
    root: "",
    lemma: "لَا",
    pos: "P" as PartOfSpeech,
    morphology: {
      features: {
        type: "NEG",
      },
      gloss: "and not",
      stem: null,
    },
  },
  {
    id: "1:7:9",
    sura: 1,
    ayah: 7,
    position: 9,
    text: "ٱلضَّآلِّينَ",
    root: "ض ل ل",
    lemma: "ضَالّ",
    pos: "N" as PartOfSpeech,
    morphology: {
      features: {
        case: "GEN",
        gender: "M",
        number: "P",
        definiteness: "DEF",
      },
      gloss: "those who go astray",
      stem: "ضال",
    },
  },
];

// Utility functions for morphology analysis
export function getTokensByRoot(tokens: CorpusToken[], root: string): CorpusToken[] {
  return tokens.filter((t) => t.root === root);
}

export function getTokensByPOS(tokens: CorpusToken[], pos: PartOfSpeech): CorpusToken[] {
  return tokens.filter((t) => t.pos === pos);
}

export function getRootFrequency(tokens: CorpusToken[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const token of tokens) {
    if (token.root) {
      freq.set(token.root, (freq.get(token.root) ?? 0) + 1);
    }
  }
  return freq;
}

export function getLemmaFrequency(tokens: CorpusToken[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token.lemma, (freq.get(token.lemma) ?? 0) + 1);
  }
  return freq;
}

export function getPOSDistribution(tokens: CorpusToken[]): Map<PartOfSpeech, number> {
  const dist = new Map<PartOfSpeech, number>();
  for (const token of tokens) {
    dist.set(token.pos, (dist.get(token.pos) ?? 0) + 1);
  }
  return dist;
}
