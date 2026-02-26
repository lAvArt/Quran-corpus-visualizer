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

