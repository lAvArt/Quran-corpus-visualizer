"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import JourneyRail from "@/components/shell/JourneyRail";
import { AuthButton } from "@/components/ui/AuthButton";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";

interface AppWorkspaceShellProps {
  kicker: string;
  title: string;
  description: string;
  status?: ReactNode;
  panelWidth?: "default" | "wide";
  backgroundVariant?: "default" | "search" | "study";
  /** Compact head — modest heading instead of the big editorial display. */
  compact?: boolean;
  children: ReactNode;
}

export default function AppWorkspaceShell({
  kicker,
  title,
  description,
  status,
  panelWidth = "default",
  backgroundVariant = "default",
  compact = false,
  children,
}: AppWorkspaceShellProps) {
  return (
    <main className={`ui-page-shell ui-theme-scope ui-workspace-shell ui-workspace-shell-${backgroundVariant} ui-workspace-railed`}>
      <div className="ui-shell-backdrop" aria-hidden />
      <div className="ui-workspace-atmosphere" aria-hidden />
      <div className="ui-workspace-grid" aria-hidden />
      {/* Single navigation metaphor: the same journey rail used on Explore. */}
      <JourneyRail />
      <header className="ui-workspace-topbar">
        <div className="ui-workspace-topbar-inner">
          <Link href="/" className="ui-workspace-brand" aria-label="Quran Corpus Visualizer home">
            <span className="ui-workspace-brand-mark">
              <Image src="/favicon.svg" alt="" width={22} height={22} />
            </span>
            <span className="ui-workspace-brand-name">Quran Corpus Visualizer</span>
          </Link>

          <div className="ui-workspace-topbar-actions">
            <LanguageSwitcher />
            <AuthButton />
          </div>
        </div>
      </header>
      <section className={`ui-panel ui-page-panel ${panelWidth === "wide" ? "ui-page-panel-wide" : ""}`}>
        <header className={`ui-page-head ${compact ? "ui-page-head--compact" : ""}`}>
          <div>
            <p className="ui-kicker">{kicker}</p>
            <h1 className="ui-title">{title}</h1>
            <p className="ui-subtitle">{description}</p>
          </div>
          {status ? <div className="ui-page-status">{status}</div> : null}
        </header>
        {children}
      </section>
    </main>
  );
}
