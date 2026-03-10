"use client";

import type { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export default function AuthShell({ title, description, footer, children }: AuthShellProps) {
  return (
    <main className="ui-page-shell ui-page-shell-centered ui-theme-scope">
      <div className="ui-shell-backdrop" aria-hidden />
      <section className="ui-panel ui-page-panel ui-page-panel-narrow">
        <header>
          <p className="ui-kicker">Quran Corpus Visualizer</p>
          <h1 className="ui-title">{title}</h1>
          {description ? <p className="ui-subtitle">{description}</p> : null}
        </header>

        <div style={{ display: "grid", gap: "1rem", marginTop: "1.25rem" }}>{children}</div>
        {footer ? <footer style={{ marginTop: "1rem", color: "var(--ink-muted)", fontSize: "0.88rem" }}>{footer}</footer> : null}
      </section>
    </main>
  );
}
