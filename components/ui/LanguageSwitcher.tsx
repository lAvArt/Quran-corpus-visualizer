"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useTransition } from "react";

export default function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();

    const toggleLocale = (newLocale: 'ar' | 'en') => {
        if (newLocale === locale) return;
        startTransition(() => {
            router.replace(pathname, { locale: newLocale });
        });
    };

    return (
        <div className="header-button-group">
            <button
                type="button"
                className={`control-pill-btn ${locale === 'ar' ? 'active' : ''}`}
                onClick={() => toggleLocale('ar')}
                disabled={isPending}
            >
                عربي
            </button>
            <button
                type="button"
                className={`control-pill-btn ${locale === 'en' ? 'active' : ''}`}
                onClick={() => toggleLocale('en')}
                disabled={isPending}
            >
                EN
            </button>
        </div>
    );
}
