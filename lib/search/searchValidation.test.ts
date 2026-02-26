import { describe, expect, it } from "vitest";
import type { CorpusToken } from "@/lib/schema/types";
import { buildPhaseOneIndexes, queryPhaseOne } from "@/lib/search/indexes";

function token(overrides: Partial<CorpusToken> & { id: string }): CorpusToken {
  const { id, ...rest } = overrides;
  return {
    id,
    sura: 1,
    ayah: 1,
    position: 1,
    text: "x",
    root: "x",
    lemma: "x",
    pos: "N",
    morphology: { features: {}, gloss: null, stem: null },
    ...rest,
  };
}

describe("search validation (regression guard)", () => {
  const tokens: CorpusToken[] = [
    token({ id: "20:17:1", sura: 20, ayah: 17, position: 1, text: "عصاك", root: "عصو", lemma: "عصا", pos: "N" }),
    token({ id: "20:20:1", sura: 20, ayah: 20, position: 1, text: "تسعى", root: "سعي", lemma: "سعى", pos: "V" }),
    token({ id: "20:21:1", sura: 20, ayah: 21, position: 1, text: "حية", root: "حيي", lemma: "حية", pos: "N" }),
    token({ id: "7:117:1", sura: 7, ayah: 117, position: 1, text: "عصا", root: "عصو", lemma: "عصا", pos: "N" }),
  ];

  const index = buildPhaseOneIndexes(tokens);

  it("finds pronoun-suffixed input by lemma/text equivalence", () => {
    const ids = queryPhaseOne(index, { lemma: "عصاك" });
    expect(ids.has("20:17:1")).toBe(true);
  });

  it("finds weak-root variant queries", () => {
    const ids = queryPhaseOne(index, { root: "عصا" });
    expect(ids.has("20:17:1")).toBe(true);
    expect(ids.has("7:117:1")).toBe(true);
  });

  it("keeps exact ayah filtering stable", () => {
    const ids = queryPhaseOne(index, { root: "عصو", ayah: "20:17" });
    expect(ids).toEqual(new Set(["20:17:1"]));
  });
});
