"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import CommandBar from "@/components/search/CommandBar";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import { AuthButton } from "@/components/ui/AuthButton";
import MobileNavMenu from "@/components/ui/MobileNavMenu";
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

        .shell-topbar-inner {
          pointer-events: auto;
          position: relative;
          display: flex;
          align-items: center;
          gap: 0.8rem;
          width: 100%;
          min-height: var(--header-dock-height);
          padding: 0.36rem 1rem;
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
          min-height: var(--header-dock-height);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.36rem 0;
          pointer-events: auto;
          z-index: 52;
        }

        .shell-topbar-search :global(.global-search) {
          width: 100%;
          max-width: none;
        }

        .shell-topbar-center {
          flex: 1 1 0;
          min-width: 0;
          display: flex;
          justify-content: center;
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
