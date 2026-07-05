import { describe, expect, it } from "vitest";
import { parseMorphologyText } from "@/lib/corpus/morphologyLoader";

describe("parseMorphologyText root attribution", () => {
  it("applies first-root-wins to a synthetic two-root word", async () => {
    const text = [
      "(9:9:9:1)\tkitaAbu\tN\tSTEM|POS:N|LEM:kitaAb|ROOT:ktb|M|NOM",
      "(9:9:9:2)\tEilomu\tN\tSTEM|POS:N|LEM:Eilom|ROOT:Elm|M|NOM",
    ].join("\n");

    const map = await parseMorphologyText(text);
    const entry = map.get("9:9:9");

    expect(entry).toBeDefined();
    // Buckwalter ktb → كتب. Last-wins would have produced علم (Elm).
    expect(entry?.root).toBe("كتب");
    expect(entry?.lemma).toBe("كِتَاب");
  });

  it("attributes 20:94:2 (the corpus's only two-root word) to bny, matching build-root-stats", async () => {
    // Verbatim segments from public/data/quranic-corpus-morphology-0.4.txt.
    const text = [
      "(20:94:2:1)\tya\tVOC\tPREFIX|ya+",
      "(20:94:2:2)\tbona\tN\tSTEM|POS:N|LEM:{bon|ROOT:bny|M|ACC",
      "(20:94:2:3)\t&um~a\tN\tSTEM|POS:N|LEM:>um~|ROOT:Amm|FS|GEN",
      "(20:94:2:4)\t\tPRON\tSUFFIX|PRON:1S",
    ].join("\n");

    const map = await parseMorphologyText(text);
    const entry = map.get("20:94:2");

    // First root-bearing segment (ROOT:bny → بني) wins; last-wins used to flip
    // this word to ROOT:Amm → امم and desync it from scripts/build-root-stats.ts.
    expect(entry?.root).toBe("بني");
    expect(entry?.root).not.toBe("امم");
  });

  it("still fills rootless words from their segments (lemma fallback, no root)", async () => {
    const text = "(1:1:1:1)\tbi\tP\tPREFIX|bi+";

    const map = await parseMorphologyText(text);
    const entry = map.get("1:1:1");

    expect(entry?.root).toBe("");
    expect(entry?.lemma).toBe("بِ");
  });

  it("lets a later root-bearing segment attribute a word whose first segment is a rootless prefix", async () => {
    const text = [
      "(1:1:2:1)\t{lo\tDET\tPREFIX|Al+",
      "(1:1:2:2)\tHamodu\tN\tSTEM|POS:N|LEM:Hamod|ROOT:Hmd|M|NOM",
    ].join("\n");

    const map = await parseMorphologyText(text);

    expect(map.get("1:1:2")?.root).toBe("حمد");
  });
});
