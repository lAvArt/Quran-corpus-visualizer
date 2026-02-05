import type { CorpusToken } from "@/lib/schema/types";

export const sampleTokens: CorpusToken[] = [
  {
    id: "1:2:1",
    sura: 1,
    ayah: 2,
    position: 1,
    text: "الْحَمْدُ",
    root: "حمد",
    lemma: "حَمْد",
    pos: "N",
    morphology: { features: { case: "nom", state: "def" }, gloss: "praise", stem: "حمد" }
  },
  {
    id: "1:2:2",
    sura: 1,
    ayah: 2,
    position: 2,
    text: "لِلَّهِ",
    root: "اله",
    lemma: "اللَّه",
    pos: "N",
    morphology: { features: { case: "gen", state: "def" }, gloss: "Allah", stem: "الله" }
  },
  {
    id: "1:3:1",
    sura: 1,
    ayah: 3,
    position: 1,
    text: "الرَّحْمَٰنِ",
    root: "رحم",
    lemma: "رَحْمَٰن",
    pos: "N",
    morphology: { features: { case: "gen", state: "def" }, gloss: "Most Merciful", stem: "رحمن" }
  },
  {
    id: "1:3:2",
    sura: 1,
    ayah: 3,
    position: 2,
    text: "الرَّحِيمِ",
    root: "رحم",
    lemma: "رَحِيم",
    pos: "ADJ",
    morphology: { features: { case: "gen", state: "def" }, gloss: "Merciful", stem: "رحيم" }
  },
  {
    id: "1:5:1",
    sura: 1,
    ayah: 5,
    position: 1,
    text: "إِيَّاكَ",
    root: "ايا",
    lemma: "إِيَّاك",
    pos: "PRON",
    morphology: { features: { person: "2", gender: "m", number: "sg" }, gloss: "You alone", stem: null }
  },
  {
    id: "1:5:2",
    sura: 1,
    ayah: 5,
    position: 2,
    text: "نَعْبُدُ",
    root: "عبد",
    lemma: "عَبَدَ",
    pos: "V",
    morphology: { features: { person: "1", number: "pl", aspect: "impf" }, gloss: "we worship", stem: "عبد" }
  },
  {
    id: "1:5:3",
    sura: 1,
    ayah: 5,
    position: 3,
    text: "نَسْتَعِينُ",
    root: "عون",
    lemma: "اِسْتَعَانَ",
    pos: "V",
    morphology: { features: { person: "1", number: "pl", aspect: "impf" }, gloss: "we seek help", stem: "عون" }
  },
  {
    id: "1:6:1",
    sura: 1,
    ayah: 6,
    position: 1,
    text: "اهْدِنَا",
    root: "هدي",
    lemma: "هَدَى",
    pos: "V",
    morphology: { features: { mood: "imp", person: "2", number: "sg" }, gloss: "guide us", stem: "هدي" }
  },
  {
    id: "1:7:1",
    sura: 1,
    ayah: 7,
    position: 1,
    text: "الصِّرَاطَ",
    root: "صرط",
    lemma: "صِرَاط",
    pos: "N",
    morphology: { features: { case: "acc", state: "def" }, gloss: "path", stem: "صرط" }
  },
  {
    id: "2:2:3",
    sura: 2,
    ayah: 2,
    position: 3,
    text: "هُدًى",
    root: "هدي",
    lemma: "هُدًى",
    pos: "N",
    morphology: { features: { case: "nom", state: "indef" }, gloss: "guidance", stem: "هدي" }
  },
  {
    id: "2:3:1",
    sura: 2,
    ayah: 3,
    position: 1,
    text: "يُؤْمِنُونَ",
    root: "امن",
    lemma: "آمَنَ",
    pos: "V",
    morphology: { features: { person: "3", number: "pl", aspect: "impf" }, gloss: "they believe", stem: "امن" }
  },
  {
    id: "2:3:4",
    sura: 2,
    ayah: 3,
    position: 4,
    text: "رَزَقْنَاهُمْ",
    root: "رزق",
    lemma: "رَزَقَ",
    pos: "V",
    morphology: { features: { person: "1", number: "pl", aspect: "perf" }, gloss: "We provided them", stem: "رزق" }
  }
];
