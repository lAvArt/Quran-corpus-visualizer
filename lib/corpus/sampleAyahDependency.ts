import type { AyahDependencyData } from "@/lib/schema/types";

export const sampleAyahDependency: AyahDependencyData = {
  ayah: {
    id: "1:5",
    suraId: 1,
    ayahNumber: 5,
    textUthmani: "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ",
    tokenIds: ["1:5:1", "1:5:2", "1:5:3", "1:5:4", "1:5:5"]
  },
  tokens: [
    {
      id: "1:5:1",
      sura: 1,
      ayah: 5,
      position: 1,
      text: "إِيَّاكَ",
      root: "ايا",
      lemma: "إِيَّاك",
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
      text: "وَ",
      root: "و",
      lemma: "وَ",
      pos: "P",
      morphology: { features: { type: "coordinating" }, gloss: "and", stem: null }
    },
    {
      id: "1:5:4",
      sura: 1,
      ayah: 5,
      position: 4,
      text: "إِيَّاكَ",
      root: "ايا",
      lemma: "إِيَّاك",
      pos: "PRON",
      morphology: { features: { person: "2", gender: "m", number: "sg" }, gloss: "You alone", stem: null }
    },
    {
      id: "1:5:5",
      sura: 1,
      ayah: 5,
      position: 5,
      text: "نَسْتَعِينُ",
      root: "عون",
      lemma: "اِسْتَعَانَ",
      pos: "V",
      morphology: { features: { person: "1", number: "pl", aspect: "impf" }, gloss: "we seek help", stem: "عون" }
    }
  ],
  dependencies: [
    { id: "1:5:dep:1", ayahId: "1:5", dependentTokenId: "1:5:1", headTokenId: "1:5:2", relation: "obj" },
    { id: "1:5:dep:2", ayahId: "1:5", dependentTokenId: "1:5:3", headTokenId: "1:5:5", relation: "cc" },
    { id: "1:5:dep:3", ayahId: "1:5", dependentTokenId: "1:5:4", headTokenId: "1:5:5", relation: "obj" },
    { id: "1:5:dep:4", ayahId: "1:5", dependentTokenId: "1:5:5", headTokenId: "1:5:2", relation: "conj" }
  ]
};
