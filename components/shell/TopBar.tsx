"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import CommandBar from "@/components/search/CommandBar";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import { AuthButton } from "@/components/ui/AuthButton";
import MobileNavMenu from "@/components/ui/MobileNavMenu";
import { useVizControl } from "@/lib/hooks/VizControlContext";
import type { CorpusToken } from "@/lib/schema/types";
import type { SearchMatchType } from "@/lib/analytics/events";
import type { SearchResultItem } from "@/lib/search/searchTypes";

interface TopBarProps {
  allTokens: CorpusToken[];
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  onTokenSelect: (tokenId: string) => void;
  onTokenHover: (tokenId: string | null) => void;
  onRootSelect: (root: string | null) => void;
  onSearchOpened: () => void;
  onSearchQuerySubmitted: (query: string) => void;
  onSearchResultSelected: (matchType: SearchMatchType) => void;
  onResultNavigate?: (result: SearchResultItem) => void;
  /** Slot rendered in the center of the top bar */
  centerSlot?: ReactNode;
}

export default function TopBar({
  allTokens,
  theme,
  setTheme,
  onTokenSelect,
  onTokenHover,
  onRootSelect,
  onSearchOpened,
  onSearchQuerySubmitted,
  onSearchResultSelected,
  onResultNavigate,
  centerSlot,
}: TopBarProps) {
  const t = useTranslations("Index");
  const tMobileBar = useTranslations("MobileBottomBar");
  const { toggleMobileSearch } = useVizControl();

  return (
    <header className="shell-topbar">
      <div className="shell-topbar-inner">
        <Link
          href="/"
          className="brand-block"
          data-tour-id="header-brand"
          aria-label={t("eyebrow")}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <span className="brand-mark">
            <Image src="/favicon.svg" alt="" width={22} height={22} />
          </span>
          <span className="brand-name">{t("eyebrow")}</span>
        </Link>

        {/* ── Center: status/breadcrumb bar ── */}
        {centerSlot && <div className="shell-topbar-center desktop-only">{centerSlot}</div>}

        {/* ≤980px: the CommandBar below is desktop-only, leaving the center
            of the bar empty — this button fills that gap and opens the same
            mobile search surface as MobileBottomBar's search trigger. */}
        <button
          type="button"
          className="topbar-mobile-search-btn mobile-only"
          data-testid="topbar-mobile-search-trigger"
          onClick={toggleMobileSearch}
          aria-label={tMobileBar("search")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>

        <div className="shell-topbar-actions">
          <div className="desktop-only" style={{ display: "contents" }}>
            <div className="header-button-group">
              <LanguageSwitcher />
              <AuthButton />
            </div>
          </div>
          <MobileNavMenu theme={theme} onThemeChange={setTheme} />
        </div>
      </div>

      {/* Search bar OUTSIDE shell-topbar-inner to escape its backdrop-filter containing block */}
      <div className="shell-topbar-search desktop-only" data-tour-id="global-search">
        <CommandBar
          tokens={allTokens}
          variant="bar"
          analyticsSurface="header"
          onTokenSelect={onTokenSelect}
          onTokenHover={onTokenHover}
          onRootSelect={onRootSelect}
          onSearchOpened={onSearchOpened}
          onSearchQuerySubmitted={onSearchQuerySubmitted}
          onSearchResultSelected={onSearchResultSelected}
          onResultNavigate={onResultNavigate}
        />
      </div>

      <style jsx>{`
        .shell-topbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 50;
          pointer-events: none;
          --centered-shell-dock-width: min(calc(100vw - 24px), 520px, 40vw);
        }

        /* Wide monitors (2K+): a 520px bar centered in 2560px of viewport
           reads as unanchored/misplaced. Let the centered dock grow with the
           screen so it stays proportionate. */
        @media (min-width: 1800px) {
          .shell-topbar {
            --centered-shell-dock-width: min(680px, 32vw);
          }
        }

        .shell-topbar-inner {
          pointer-events: auto;
          position: relative;
          display: flex;
          align-items: center;
          gap: 0.8rem;
          width: 100%;
          /* Banner and the centered search slot share ONE explicit height —
             previously the banner grew to ~56px from its content while the
             search slot grew to ~64px from ITS content, so the search pill
             overhung the banner's bottom border by a couple of px. */
          height: var(--topbar-height, 58px);
          min-height: 0;
          padding: 0 1rem;
          background: var(--toolbar-bg);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }

        :global([data-theme="dark"]) .shell-topbar-inner {
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: none;
        }

        .brand-block {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }

        .brand-mark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--line);
          background: var(--bg-2);
          flex-shrink: 0;
        }

        .brand-name {
          font-family: var(--font-display, "Fraunces"), serif;
          font-size: 0.9rem;
          font-weight: 600;
          letter-spacing: -0.01em;
          color: var(--ink);
          white-space: nowrap;
        }

        @media (max-width: 760px) {
          .brand-name {
            display: none;
          }
        }

        .shell-topbar-search {
          position: fixed;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: var(--centered-shell-dock-width);
          height: var(--topbar-height, 58px);
          min-height: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 2px;
          pointer-events: auto;
          z-index: 52;
        }

        .shell-topbar-search :global(.global-search) {
          width: 100%;
          max-width: none;
        }

        /* Keep the pill comfortably INSIDE the banner: cap its height below
           the shared bar height so there's visible breathing room above and
           below instead of the pill kissing the banner's border. */
        .shell-topbar-search :global(.search-input-wrapper) {
          max-height: 46px;
        }

        .shell-topbar-center {
          flex: 1 1 0;
          min-width: 0;
          display: flex;
          justify-content: center;
        }

        /* Absolutely centered in the bar regardless of how wide the brand
           block / actions cluster are — physical left/translateX is safe
           here (RTL included) since the button has no logical inset base to
           conflict with; it just needs to sit in the dead-center gap. */
        .topbar-mobile-search-btn {
          /* .mobile-only (globals.css) handles hiding this at >=981px; below
             that it falls back to this flex layout for icon centering. */
          display: flex;
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 40px;
          height: 40px;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid var(--line);
          border-radius: var(--radius-pill);
          color: var(--ink);
          cursor: pointer;
          transition: all 0.2s;
        }

        .topbar-mobile-search-btn:hover,
        .topbar-mobile-search-btn:focus-visible {
          background: var(--bg-2);
          color: var(--accent);
          border-color: var(--accent);
        }

        .topbar-mobile-search-btn:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }

        .shell-topbar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
          margin-inline-start: auto;
        }

        @media (max-width: 980px) {
          .shell-topbar-inner {
            gap: 0.4rem;
            padding: 0.3rem 0.5rem;
          }

          .shell-topbar-search {
            position: static;
            transform: none;
            width: auto;
            flex: 1 1 0;
            min-width: 100px;
          }
        }

        @media (max-width: 1100px) {
          .shell-topbar {
            --centered-shell-dock-width: min(calc(100vw - 16px), 400px);
          }
        }

        @media (max-width: 600px) {
          .shell-topbar-inner {
            padding: 0.25rem 0.4rem;
            gap: 0.3rem;
          }
        }
      `}</style>
    </header>
  );
}
