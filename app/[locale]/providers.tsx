"use client";

import { I18nProvider } from "@/lib/i18n";
import { PwaProvider } from "@/components/providers/PwaProvider";
import { AuthProvider } from "@/lib/context/AuthContext";
import { KnowledgeProvider } from "@/lib/context/KnowledgeContext";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
    return (
        <I18nProvider>
            <AuthProvider>
                <KnowledgeProvider>
                    <PwaProvider>{children}</PwaProvider>
                </KnowledgeProvider>
            </AuthProvider>
        </I18nProvider>
    );
}
