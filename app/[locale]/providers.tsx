"use client";

import { I18nProvider } from "@/lib/i18n";
import { PwaProvider } from "@/components/providers/PwaProvider";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
    return (
        <I18nProvider>
            <PwaProvider>{children}</PwaProvider>
        </I18nProvider>
    );
}
