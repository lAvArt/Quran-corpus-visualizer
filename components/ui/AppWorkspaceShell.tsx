"use client";

import type { ReactNode } from "react";
import AppModeNav from "@/components/ui/AppModeNav";

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
      <section className={`ui-panel ui-page-panel ${panelWidth === "wide" ? "ui-page-panel-wide" : ""}`}>
        <header className="ui-page-head">
          <div>
            <p className="ui-kicker">{kicker}</p>
            <h1 className="ui-title">{title}</h1>
            <p className="ui-subtitle">{description}</p>
            <div className="ui-page-nav-wrap">
              <AppModeNav />
            </div>
          </div>
          {status ? <div className="ui-page-status">{status}</div> : null}
        </header>
        {children}
      </section>
    </main>
  );
}
