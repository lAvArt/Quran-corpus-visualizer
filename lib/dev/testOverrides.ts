"use client";

import type { Session, User } from "@supabase/supabase-js";
import type { TrackedRoot } from "@/lib/cache/knowledgeCache";

export const DEV_AUTH_USER_KEY = "qcv-dev-auth-user";
export const DEV_KNOWLEDGE_KEY = "qcv-dev-knowledge";
export const DEV_CORPUS_STATUS_KEY = "qcv-dev-corpus-status";
export const DEV_PENDING_MIGRATION_KEY = "qcv-dev-pending-migration";
export const DEV_SEARCH_STATUS_KEY = "qcv-dev-search-status";

function isDevOverrideEnabled() {
  return process.env.NODE_ENV !== "production" && typeof window !== "undefined";
}

export function readDevAuthUser(): User | null {
  if (!isDevOverrideEnabled()) return null;

  try {
    const raw = window.localStorage.getItem(DEV_AUTH_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function readDevSession(): Session | null {
  const user = readDevAuthUser();
  if (!user) return null;

  return {
    access_token: "dev-access-token",
    refresh_token: "dev-refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user,
  } as Session;
}

export function clearDevAuthUser() {
  if (!isDevOverrideEnabled()) return;
  window.localStorage.removeItem(DEV_AUTH_USER_KEY);
}

export function clearDevPendingMigrationRoots() {
  if (!isDevOverrideEnabled()) return;
  window.localStorage.removeItem(DEV_PENDING_MIGRATION_KEY);
}

export function writeDevKnowledgeRoots(roots: TrackedRoot[]) {
  if (!isDevOverrideEnabled()) return;
  window.localStorage.setItem(DEV_KNOWLEDGE_KEY, JSON.stringify(roots));
}

export function readDevKnowledgeRoots(): TrackedRoot[] | null {
  if (!isDevOverrideEnabled()) return null;

  try {
    const raw = window.localStorage.getItem(DEV_KNOWLEDGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TrackedRoot[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function readDevCorpusStatus(): "sample" | "loading" | "full" | "fallback" | null {
  if (!isDevOverrideEnabled()) return null;

  try {
    const raw = window.localStorage.getItem(DEV_CORPUS_STATUS_KEY);
    if (raw === "sample" || raw === "loading" || raw === "full" || raw === "fallback") {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

export function readDevSearchStatus(): "available" | "unavailable" | null {
  if (!isDevOverrideEnabled()) return null;

  try {
    const raw = window.localStorage.getItem(DEV_SEARCH_STATUS_KEY);
    if (raw === "available" || raw === "unavailable") {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

export function readDevPendingMigrationRoots(): TrackedRoot[] | null {
  if (!isDevOverrideEnabled()) return null;

  try {
    const raw = window.localStorage.getItem(DEV_PENDING_MIGRATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TrackedRoot[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
