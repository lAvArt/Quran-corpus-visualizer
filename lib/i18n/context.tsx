"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { translations, type Language, type Translations } from "./translations";

interface I18nContextValue {
    language: Language;
    t: Translations;
    setLanguage: (lang: Language) => void;
    isRTL: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "quran-corpus-viz-lang";

export function I18nProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<Language>(() => {
        if (typeof window === "undefined") return "en";
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored === "ar" || stored === "en") return stored;
        } catch {
            // Ignore
        }
        return "en";
    });

    const setLanguage = useCallback((lang: Language) => {
        setLanguageState(lang);
        try {
            localStorage.setItem(STORAGE_KEY, lang);
        } catch {
            // Ignore
        }
    }, []);

    // Update document direction when language changes
    useEffect(() => {
        document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
        document.documentElement.lang = language;
    }, [language]);

    const value: I18nContextValue = {
        language,
        t: translations[language],
        setLanguage,
        isRTL: language === "ar",
    };

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error("useI18n must be used within I18nProvider");
    }
    return context;
}

// Helper for components that may be used outside provider during SSR
export function useI18nSafe(): I18nContextValue {
    const context = useContext(I18nContext);
    if (!context) {
        return {
            language: "en",
            t: translations.en,
            setLanguage: () => { },
            isRTL: false,
        };
    }
    return context;
}
