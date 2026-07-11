import { afterEach, describe, expect, it, vi } from "vitest";
import { motionSafeDuration, motionSafeStagger, prefersReducedMotion } from "@/lib/viz/motionPrefs";

/** Stubs `window.matchMedia("(prefers-reduced-motion: reduce)")` to the given value. */
function setReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? matches : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe("motionPrefs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("prefersReducedMotion", () => {
    it("returns false when the OS has no reduced-motion preference", () => {
      setReducedMotion(false);
      expect(prefersReducedMotion()).toBe(false);
    });

    it("returns true when the OS asks for reduced motion", () => {
      setReducedMotion(true);
      expect(prefersReducedMotion()).toBe(true);
    });

    it("is SSR-safe: false when matchMedia is unavailable", () => {
      const original = window.matchMedia;
      // @ts-expect-error - simulate an environment without matchMedia (SSR)
      delete window.matchMedia;
      expect(prefersReducedMotion()).toBe(false);
      window.matchMedia = original;
    });
  });

  describe("motionSafeDuration", () => {
    it("passes the duration through unchanged when motion is allowed", () => {
      setReducedMotion(false);
      expect(motionSafeDuration(1000)).toBe(1000);
      expect(motionSafeDuration(0)).toBe(0);
    });

    it("collapses to 0 under reduced motion regardless of the requested duration", () => {
      setReducedMotion(true);
      expect(motionSafeDuration(1000)).toBe(0);
      expect(motionSafeDuration(180)).toBe(0);
    });
  });

  describe("motionSafeStagger", () => {
    it("scales linearly with index when under the cap", () => {
      setReducedMotion(false);
      expect(motionSafeStagger(0, 10)).toBe(0);
      expect(motionSafeStagger(5, 10)).toBe(50);
      expect(motionSafeStagger(30, 10)).toBe(300);
    });

    it("caps at 600ms by default no matter how large the index", () => {
      setReducedMotion(false);
      // 114 surahs * 10ms/item = 1140ms uncapped — the exact SurahDistributionGraph
      // scenario this cap exists for.
      expect(motionSafeStagger(114, 10)).toBe(600);
      expect(motionSafeStagger(1000, 10)).toBe(600);
    });

    it("honors a custom cap", () => {
      setReducedMotion(false);
      expect(motionSafeStagger(100, 20, 300)).toBe(300);
      expect(motionSafeStagger(5, 20, 300)).toBe(100);
    });

    it("is always 0 under reduced motion, even for index 0 vs a large index", () => {
      setReducedMotion(true);
      expect(motionSafeStagger(0, 10)).toBe(0);
      expect(motionSafeStagger(114, 10)).toBe(0);
      expect(motionSafeStagger(9999, 4, 600)).toBe(0);
    });
  });
});
