/**
 * Single source of truth for the public site origin, used by metadata,
 * sitemap, robots, and JSON-LD. Reads NEXT_PUBLIC_SITE_URL so the domain
 * cutover (quran.pluragate.org → quranobservatory.org) is one env change,
 * not a repo-wide sweep.
 */
export const SITE_URL = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://quran.pluragate.org"
).replace(/\/$/, "");

export const SITE_NAME = "Quran Corpus Visualizer";

export const LOCALES = ["en", "ar"] as const;

/** hreflang map for a path (leading slash, "" for the locale root). */
export function languageAlternates(path: string): Record<string, string> {
    return {
        en: `${SITE_URL}/en${path}`,
        ar: `${SITE_URL}/ar${path}`,
        "x-default": `${SITE_URL}/en${path}`,
    };
}
