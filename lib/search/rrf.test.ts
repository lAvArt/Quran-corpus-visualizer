import { describe, expect, it } from "vitest";
import { rrfMerge } from "@/lib/search/rrf";

describe("rrfMerge", () => {
  it("ranks an item appearing in multiple lists above single-list items", () => {
    const merged = rrfMerge([
      { ids: ["x", "a", "b"] },
      { ids: ["y", "x", "c"] },
    ]);
    // x is in both lists → highest combined reciprocal rank
    expect(merged[0].id).toBe("x");
  });

  it("respects list weights", () => {
    const merged = rrfMerge([
      { ids: ["a"], weight: 0.1 },
      { ids: ["b"], weight: 1 },
    ]);
    expect(merged[0].id).toBe("b");
  });

  it("returns an empty array for empty input", () => {
    expect(rrfMerge([])).toEqual([]);
    expect(rrfMerge([{ ids: [] }])).toEqual([]);
  });

  it("respects the limit option", () => {
    const merged = rrfMerge([{ ids: ["a", "b", "c", "d"] }], { limit: 2 });
    expect(merged).toHaveLength(2);
  });

  it("rewards a higher rank within a single list", () => {
    const merged = rrfMerge([{ ids: ["first", "second", "third"] }]);
    expect(merged.map((m) => m.id)).toEqual(["first", "second", "third"]);
  });
});
