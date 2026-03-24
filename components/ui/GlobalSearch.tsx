"use client";

import type { CorpusToken } from "@/lib/schema/types";
import type { SearchMatchType } from "@/lib/analytics/events";
import CommandBar from "@/components/search/CommandBar";

interface GlobalSearchProps {
  tokens: CorpusToken[];
  onTokenSelect: (tokenId: string) => void;
  onTokenHover: (tokenId: string | null) => void;
  onRootSelect?: (root: string | null) => void;
  onSearchOpened?: () => void;
  onSearchQuerySubmitted?: (query: string) => void;
  onSearchResultSelected?: (matchType: SearchMatchType) => void;
  analyticsSurface?: "header" | "sidebar" | "mobile" | "workspace" | "unknown";
  /** When true, shows the advanced filters section inline (used in sidebar search tab) */
  showAdvancedFilters?: boolean;
}

/**
 * Thin backward-compatible adapter — delegates entirely to CommandBar.
 * Consumers should migrate to CommandBar directly over time.
 */
export default function GlobalSearch({
  tokens,
  onTokenSelect,
  onTokenHover,
  onRootSelect,
  onSearchOpened,
  onSearchQuerySubmitted,
  onSearchResultSelected,
  analyticsSurface = "unknown",
  showAdvancedFilters = false,
}: GlobalSearchProps) {
  return (
    <CommandBar
      tokens={tokens}
      variant={showAdvancedFilters ? "panel" : "bar"}
      analyticsSurface={analyticsSurface}
      onTokenSelect={onTokenSelect}
      onTokenHover={onTokenHover}
      onRootSelect={onRootSelect}
      onSearchOpened={onSearchOpened}
      onSearchQuerySubmitted={onSearchQuerySubmitted}
      onSearchResultSelected={onSearchResultSelected}
    />
  );
}
