import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { FULL_CORPUS_TOKEN_FLOOR } from "@/lib/corpus/corpusExpectations";
import type { CorpusToken } from "@/lib/schema/types";

const h = vi.hoisted(() => ({
  loadFullCorpus: vi.fn(),
  loadSurahContext: vi.fn(),
}));

vi.mock("@/lib/corpus/corpusLoader", () => ({
  loadFullCorpus: h.loadFullCorpus,
  loadSurahContext: h.loadSurahContext,
}));

vi.mock("@/lib/analytics/events", () => ({
  trackClientError: vi.fn(),
  trackCorpusDeepReady: vi.fn(),
  trackCorpusFallbackUsed: vi.fn(),
  trackCorpusShellReady: vi.fn(),
}));

import { trackClientError } from "@/lib/analytics/events";
import { useCorpusData } from "@/lib/hooks/useCorpusData";

function makeTokens(count: number): CorpusToken[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `2:1:${index + 1}`,
    sura: 2,
    ayah: 1,
    position: index + 1,
    text: `t${index + 1}`,
    root: "كتب",
    lemma: "كتاب",
    pos: "N",
    morphology: { features: {}, gloss: null, stem: null },
  }));
}

describe("useCorpusData full-corpus floor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    h.loadSurahContext.mockResolvedValue([]);
  });

  it("reports 'fallback', not 'full', when the loaded token set is below the floor", async () => {
    const partialTokens = makeTokens(1200);
    h.loadFullCorpus.mockResolvedValue(partialTokens);

    const { result } = renderHook(() => useCorpusData());

    await waitFor(() => expect(result.current.isLoadingCorpus).toBe(false));

    expect(result.current.dataStatus).toBe("fallback");
    expect(result.current.readiness.deepDataReady).toBe(false);
    expect(result.current.readiness.canExploreDeeply).toBe(false);
    // The partial tokens are still surfaced for visualization…
    expect(result.current.deepTokens).toHaveLength(1200);
    // …and the truncation is reported instead of silently claiming "full".
    expect(trackClientError).toHaveBeenCalledWith(
      "corpus",
      "partial_corpus_result",
      expect.objectContaining({ token_count: 1200 })
    );
  });

  it("reports 'full' when the loaded token set reaches the floor", async () => {
    h.loadFullCorpus.mockResolvedValue(makeTokens(FULL_CORPUS_TOKEN_FLOOR));

    const { result } = renderHook(() => useCorpusData());

    await waitFor(() => expect(result.current.dataStatus).toBe("full"));
    expect(result.current.readiness.deepDataReady).toBe(true);
    expect(result.current.deepTokens).toHaveLength(FULL_CORPUS_TOKEN_FLOOR);
  });

  it("reports 'fallback' when the corpus resolves empty", async () => {
    h.loadFullCorpus.mockResolvedValue([]);

    const { result } = renderHook(() => useCorpusData());

    await waitFor(() => expect(result.current.dataStatus).toBe("fallback"));
    expect(result.current.deepTokens).toHaveLength(0);
    expect(trackClientError).toHaveBeenCalledWith(
      "corpus",
      "empty_corpus_result",
      expect.objectContaining({ stage: "load_full_corpus" })
    );
  });

  it("reports 'fallback' when the load fails", async () => {
    h.loadFullCorpus.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useCorpusData());

    await waitFor(() => expect(result.current.dataStatus).toBe("fallback"));
  });
});
