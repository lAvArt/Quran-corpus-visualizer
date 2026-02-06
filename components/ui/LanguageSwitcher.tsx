"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useTransition } from "react";

export default function LanguageSwitcher() {
    const t = useTranslations('LanguageSwitcher');
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();

    const nextLocale = locale === 'ar' ? 'en' : 'ar';

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
