import { describe, expect, it } from "vitest";
import { landingPath } from "@/lib/auth/landingPath";

/** How the callback consumes the result — the reason the guard exists. */
const resolve = (next: string | null) =>
    new URL(landingPath(next), "https://www.quranobservatory.org").toString();

describe("landingPath", () => {
    it("sends a password reset to the auth-scoped page", () => {
        expect(landingPath("update-password")).toBe("/auth/update-password");
    });

    it("defaults to the root when nothing is asked for", () => {
        expect(landingPath(null)).toBe("/");
        expect(landingPath("")).toBe("/");
    });

    it("keeps an ordinary same-origin path", () => {
        expect(landingPath("/ar/study")).toBe("/ar/study");
        expect(landingPath("ar/study")).toBe("/ar/study");
    });

    // The whole point: this route hands out a session, so it must never bounce
    // the browser to someone else's origin.
    it.each([
        "//evil.com",
        "/\\evil.com",
        "https://evil.com",
        "http://evil.com/steal",
        "javascript:alert(1)",
        "//evil.com/ar/study",
    ])("refuses to leave the origin for %s", (hostile) => {
        expect(resolve(hostile).startsWith("https://www.quranobservatory.org/")).toBe(true);
    });

    it("resolves a legitimate path against the origin unchanged", () => {
        expect(resolve("/ar/profile")).toBe("https://www.quranobservatory.org/ar/profile");
    });
});
