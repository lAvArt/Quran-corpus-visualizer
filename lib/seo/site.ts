/**
 * Single source of truth for the public site origin, used by metadata,
 * sitemap, robots, JSON-LD, and the Supabase auth callback. Reads
 * NEXT_PUBLIC_SITE_URL so a domain move is one env change, not a repo-wide
 * sweep.
 *
 * The default carries the `www.` host on purpose: that is what the deployment
 * actually serves (the apex 308s to it), so canonical URLs, sitemap entries and
 * the OAuth callback all name the host the browser ends up on — no redirect hop
 * in the middle of an auth handshake, and one host to allow-list in Supabase.
 */
export const SITE_URL = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.quranobservatory.org"
).replace(/\/$/, "");

export const SITE_NAME = "Quran Observatory";

export const LOCALES = ["en", "ar"] as const;

/** hreflang map for a path (leading slash, "" for the locale root). */
export function languageAlternates(path: string): Record<string, string> {
    return {
        en: `${SITE_URL}/en${path}`,
        ar: `${SITE_URL}/ar${path}`,
        "x-default": `${SITE_URL}/en${path}`,
    };
}
