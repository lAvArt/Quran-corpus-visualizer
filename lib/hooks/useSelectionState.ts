"use client";

import { useMemo, useState } from "react";
import type { CorpusToken } from "@/lib/schema/types";

export interface SelectionState {
  selectedSurahId: number;
  selectedRoot: string | null;
  selectedLemma: string | null;
  focusedTokenId: string | null;
  hoverTokenId: string | null;
  searchLockedRoot: string | null;

  // Computed
  focusedToken: CorpusToken | null;
  inspectorToken: CorpusToken | null;
  inspectorMode: "hover" | "focus" | "idle";
  selectedAyahInSurah: number | null;
  selectedRootValue: string | null;
  selectedLemmaValue: string | null;
  representativeToken: CorpusToken | null;
  inspectorTokenFinal: CorpusToken | null;
  inspectorModeFinal: "hover" | "focus" | "idle";
  tokenById: Map<string, CorpusToken>;

  // Setters
  setSelectedSurahId: (id: number) => void;
  setSelectedRoot: (root: string | null) => void;
  setSelectedLemma: (lemma: string | null) => void;
  setFocusedTokenId: (id: string | null) => void;
  setHoverTokenId: (id: string | null) => void;
  setSearchLockedRoot: (root: string | null) => void;
}

export function useSelectionState(allTokens: CorpusToken[]): SelectionState {
  const [selectedSurahId, setSelectedSurahId] = useState<number>(1);
  const [selectedRoot, setSelectedRoot] = useState<string | null>(null);
  const [selectedLemma, setSelectedLemma] = useState<string | null>(null);
  const [focusedTokenId, setFocusedTokenId] = useState<string | null>(null);
  const [hoverTokenId, setHoverTokenId] = useState<string | null>(null);
  const [searchLockedRoot, setSearchLockedRoot] = useState<string | null>(null);

  const tokenById = useMemo(
    () => new Map(allTokens.map((token) => [token.id, token])),
    [allTokens]
  );

  const focusedToken = useMemo(
    () => (focusedTokenId ? tokenById.get(focusedTokenId) ?? null : null),
    [focusedTokenId, tokenById]
  );

  const inspectorToken =
    focusedToken || (hoverTokenId ? tokenById.get(hoverTokenId) : null) || null;
  const inspectorMode: "hover" | "focus" | "idle" =
    focusedTokenId ? "focus" : hoverTokenId ? "hover" : "idle";

  const selectedAyahInSurah =
    focusedToken && focusedToken.sura === selectedSurahId
      ? focusedToken.ayah
      : null;

  const selectedRootValue = focusedToken?.root || selectedRoot || null;
  const selectedLemmaValue = focusedToken?.lemma || selectedLemma || null;

  const representativeToken = useMemo(() => {
    if (focusedToken) return null;
    if (!selectedRoot) return null;
    const inSurah = allTokens.find(
      (token) => token.root === selectedRoot && token.sura === selectedSurahId
    );
    if (inSurah) return inSurah;
    return allTokens.find((token) => token.root === selectedRoot) ?? null;
  }, [focusedToken, selectedRoot, allTokens, selectedSurahId]);

  const inspectorTokenFinal = inspectorToken || representativeToken;
  const inspectorModeFinal: "hover" | "focus" | "idle" = inspectorToken
    ? inspectorMode
    : representativeToken
      ? "focus"
      : "idle";

  return {
    selectedSurahId,
    selectedRoot,
    selectedLemma,
    focusedTokenId,
    hoverTokenId,
    searchLockedRoot,
    focusedToken,
    inspectorToken,
    inspectorMode,
    selectedAyahInSurah,
    selectedRootValue,
    selectedLemmaValue,
    representativeToken,
    inspectorTokenFinal,
    inspectorModeFinal,
    tokenById,
    setSelectedSurahId,
    setSelectedRoot,
    setSelectedLemma,
    setFocusedTokenId,
    setHoverTokenId,
    setSearchLockedRoot,
  };
}
