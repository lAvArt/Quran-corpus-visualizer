"use client";

import { I18nProvider } from "@/lib/i18n";
import { PwaProvider } from "@/components/providers/PwaProvider";
import { KnowledgeProvider } from "@/lib/context/KnowledgeContext";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
    return (
        <I18nProvider>
            <KnowledgeProvider>
                <PwaProvider>{children}</PwaProvider>
            </KnowledgeProvider>
        </I18nProvider>
    );
}
