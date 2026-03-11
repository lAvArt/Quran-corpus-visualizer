"use client";

import { usePathname } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import type { AppMode } from "@/lib/schema/appShell";

const MODE_TO_PATH: Record<AppMode, string> = {
  explore: "/",
  search: "/search",
  study: "/study",
};

export default function AppModeNav() {
  const pathname = usePathname();
  const labels: Record<AppMode, string> = {
    explore: "Explore",
    search: "Search",
    study: "Study",
  };

  return (
    <nav className="ui-mode-nav" aria-label="App mode navigation" data-testid="app-mode-nav">
      {(["explore", "search", "study"] as AppMode[]).map((mode) => {
        const href = MODE_TO_PATH[mode];
        const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));

        return (
          <Link
            key={mode}
            href={href}
            className={`ui-mode-link ${isActive ? "active" : ""}`}
            data-testid={`app-mode-link-${mode}`}
            data-active={isActive ? "true" : "false"}
          >
            {labels[mode]}
          </Link>
        );
      })}
    </nav>
  );
}
