"use client";

import { useTranslations } from "next-intl";

interface ThemeSwitcherProps {
    theme: "light" | "dark";
    onThemeChange: (theme: "light" | "dark") => void;
}

export default function ThemeSwitcher({ theme, onThemeChange }: ThemeSwitcherProps) {
    const t = useTranslations('VisualizationSwitcher'); // Reusing existing translations for simplicity

    return (
        <div className="header-button-group">
            <button
                type="button"
                className={`control-pill-btn ${theme === "light" ? "active" : ""}`}
                onClick={() => onThemeChange("light")}
                title={t('lightTheme')}
                aria-pressed={theme === "light"}
            >
                {"\u2600"}
            </button>
            <button
                type="button"
                className={`control-pill-btn ${theme === "dark" ? "active" : ""}`}
                onClick={() => onThemeChange("dark")}
                title={t('darkTheme')}
                aria-pressed={theme === "dark"}
            >
                {"\u263E"}
            </button>
        </div>
    );
}
