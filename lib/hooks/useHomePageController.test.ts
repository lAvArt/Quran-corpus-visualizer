import { describe, expect, it } from "vitest";
import { resolveFocusedTokenIdForSelection } from "@/lib/hooks/useHomePageController";

// Regression coverage for the `handleSearchResultNavigate` deep-link bug:
// `?viz=dependency-tree&surah=2&ayah=255` rendered ayah 2 (the default)
// instead of ayah 255, because a bare `selection.ayah` (no `tokenId`) was
// dropped on the floor instead of being turned into a focus target.
describe("resolveFocusedTokenIdForSelection", () => {
  it("synthesizes a first-word token id from a bare ayah + surahId (the deep-link bug case)", () => {
    expect(resolveFocusedTokenIdForSelection({ surahId: 2, ayah: 255 }, 1)).toBe("2:255:1");
  });

  it("prefers selection.tokenId when present, even alongside an ayah", () => {
    expect(
      resolveFocusedTokenIdForSelection({ surahId: 2, ayah: 255, tokenId: "2:255:3" }, 1)
    ).toBe("2:255:3");
  });

  it("falls back to the currently-selected surah when selection.surahId is absent", () => {
    expect(resolveFocusedTokenIdForSelection({ ayah: 7 }, 9)).toBe("9:7:1");
  });

  it("returns null when neither tokenId nor ayah is present", () => {
    expect(resolveFocusedTokenIdForSelection({ surahId: 2, root: "كتب" }, 1)).toBeNull();
  });

  it("returns null when selection is undefined (clears focus, e.g. surah-only navigation)", () => {
    expect(resolveFocusedTokenIdForSelection(undefined, 1)).toBeNull();
  });
});
