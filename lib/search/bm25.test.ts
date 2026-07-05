import { describe, expect, it } from "vitest";
import { buildBm25Index, queryBm25, tokenizeForBm25, type Bm25Document } from "@/lib/search/bm25";

describe("tokenizeForBm25", () => {
  it("lowercases Latin terms and drops stop words", () => {
    expect(tokenizeForBm25("The Mercy of God")).toEqual(["mercy", "god"]);
  });

  it("normalizes Arabic (strips diacritics, unifies forms)", () => {
    // الرَّحْمَٰن → normalized ال... ; ة → ه ; ى → ي
    expect(tokenizeForBm25("رَحْمَة")).toEqual(["رحمه"]);
  });

  it("splits on punctuation and separators", () => {
    expect(tokenizeForBm25("mercy / compassion, kindness")).toEqual(["mercy", "compassion", "kindness"]);
  });
});

interface Meta {
  ref: string;
}

const DOCS: Array<Bm25Document<Meta>> = [
  { id: "a", meta: { ref: "a" }, fields: { title: "mercy", body: "the quality of mercy is not strained" } },
  { id: "b", meta: { ref: "b" }, fields: { title: "patience", body: "patience and mercy" } },
  { id: "c", meta: { ref: "c" }, fields: { title: "thunder", body: "lightning and storms" } },
];

describe("BM25F", () => {
  const index = buildBm25Index(DOCS, [
    { name: "title", boost: 3 },
    { name: "body", boost: 1 },
  ]);

  it("ranks a title-field match above a body-only match", () => {
    const hits = queryBm25(index, "mercy");
    expect(hits[0].id).toBe("a"); // 'mercy' is in a's title (boost 3)
    expect(hits.map((h) => h.id)).toContain("b");
    expect(hits.map((h) => h.id)).not.toContain("c");
  });

  it("returns empty for a query with no matching terms", () => {
    expect(queryBm25(index, "elephant")).toEqual([]);
  });

  it("accepts a pre-tokenized term array (concept lane)", () => {
    const hits = queryBm25(index, ["patience"]);
    expect(hits[0].id).toBe("b");
  });

  it("respects the limit option", () => {
    const hits = queryBm25(index, "mercy patience thunder", { limit: 1 });
    expect(hits).toHaveLength(1);
  });

  it("carries document meta through to hits", () => {
    const hits = queryBm25(index, "mercy");
    expect(hits[0].meta.ref).toBe("a");
  });
});
