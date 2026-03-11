"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import AppModeNav from "@/components/ui/AppModeNav";
import { AuthButton } from "@/components/ui/AuthButton";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";

interface AppWorkspaceShellProps {
  kicker: string;
  title: string;
  description: string;
  status?: ReactNode;
  panelWidth?: "default" | "wide";
  backgroundVariant?: "default" | "search" | "study";
  children: ReactNode;
}

export default function AppWorkspaceShell({
  kicker,
  title,
  description,
  status,
  panelWidth = "default",
  backgroundVariant = "default",
  children,
}: AppWorkspaceShellProps) {
  return (
    <main className={`ui-page-shell ui-theme-scope ui-workspace-shell ui-workspace-shell-${backgroundVariant}`}>
      <div className="ui-shell-backdrop" aria-hidden />
      <div className="ui-workspace-atmosphere" aria-hidden />
      <div className="ui-workspace-grid" aria-hidden />
      <header className="ui-workspace-topbar">
        <div className="ui-workspace-topbar-inner">
          <Link href="/" className="ui-workspace-brand" aria-label="Quran Corpus Visualizer home">
            <Image src="/favicon.svg" alt="" width={26} height={26} className="ui-workspace-brand-logo" />
            <div className="ui-workspace-brand-copy">
              <span className="ui-workspace-brand-kicker">Quran Corpus Visualizer</span>
              <strong className="ui-workspace-brand-title">quran.pluragate.org</strong>
            </div>
          </Link>

          <div className="ui-workspace-topbar-nav">
            <AppModeNav />
          </div>

          <div className="ui-workspace-topbar-actions">
            <LanguageSwitcher />
            <AuthButton />
          </div>
        </div>
      </header>
      <section className={`ui-panel ui-page-panel ${panelWidth === "wide" ? "ui-page-panel-wide" : ""}`}>
        <header className="ui-page-head">
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
