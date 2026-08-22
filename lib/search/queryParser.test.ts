import { describe, expect, it } from "vitest";
import { parseSearchQuery } from "@/lib/search/queryParser";

describe("queryParser", () => {
  it("parses structured fields", () => {
    const parsed = parseSearchQuery("root:عصو pos:n ayah:20:17");
    expect(parsed.root).toBe("عصو");
    expect(parsed.pos).toBe("N");
    expect(parsed.ayah).toBe("20:17");
  });

  it("keeps free text while extracting known fields", () => {
    const parsed = parseSearchQuery("lemma:موسى عصاك");
    expect(parsed.lemma).toBe("موسى");
    expect(parsed.freeText).toBe("عصاك");
  });

  it("supports short aliases", () => {
    const parsed = parseSearchQuery("r:سعي l:تسعى p:v");
    expect(parsed.root).toBe("سعي");
    expect(parsed.lemma).toBe("تسعى");
    expect(parsed.pos).toBe("V");
  });
});

describe("near operator", () => {
  it("parses near: and keeps freeText clean", () => {
    const q = parseSearchQuery("إنسان near:يئوس");
    expect(q.near).toBe("يئوس");
    expect(q.freeText).toBe("إنسان");
  });

  it("parses the Arabic alias قرب:", () => {
    const q = parseSearchQuery("لأبيه قرب:يوسف");
    expect(q.near).toBe("يوسف");
    expect(q.freeText).toBe("لأبيه");
  });

  it("an empty near value is dropped, not kept as junk", () => {
    const q = parseSearchQuery("رحمة near:");
    expect(q.near).toBeUndefined();
    expect(q.freeText).toBe("رحمة");
  });
});
