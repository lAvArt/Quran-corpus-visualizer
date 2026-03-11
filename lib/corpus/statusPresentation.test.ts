import { describe, expect, it } from "vitest";
import { deriveCorpusReadiness } from "@/lib/corpus/readiness";
import { deriveCorpusStatusPresentation } from "@/lib/corpus/statusPresentation";

describe("deriveCorpusStatusPresentation", () => {
  it("keeps shell messaging visible while deep corpus is loading", () => {
    const readiness = deriveCorpusReadiness("loading", true);

    expect(deriveCorpusStatusPresentation(readiness, "loading", true)).toEqual({
      statusLabel: "shell",
      showShellReadyMessage: true,
      showLoadingMessage: true,
      showFallbackMessage: false,
    });
  });

  it("suppresses shell-ready messaging when fallback data is active", () => {
    const readiness = deriveCorpusReadiness("fallback", false);

    expect(deriveCorpusStatusPresentation(readiness, "fallback", false)).toEqual({
      statusLabel: "fallback",
      showShellReadyMessage: false,
      showLoadingMessage: false,
      showFallbackMessage: true,
    });
  });

  it("marks fully hydrated corpus state without shell notices", () => {
    const readiness = deriveCorpusReadiness("full", false);

    expect(deriveCorpusStatusPresentation(readiness, "full", false)).toEqual({
      statusLabel: "full",
      showShellReadyMessage: false,
      showLoadingMessage: false,
      showFallbackMessage: false,
    });
  });
});
