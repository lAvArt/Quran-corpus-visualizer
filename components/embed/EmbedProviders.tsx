"use client";

import { AuthProvider } from "@/lib/context/AuthContext";
import { KnowledgeProvider } from "@/lib/context/KnowledgeContext";
import type { ReactNode } from "react";

export function EmbedProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <KnowledgeProvider>{children}</KnowledgeProvider>
    </AuthProvider>
  );
}
