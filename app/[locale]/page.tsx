import type { Metadata } from "next";
import AppShell from "@/components/shell/AppShell";
import MinimalHome from "@/components/home/MinimalHome";
import { buildExploreOverviewPayload } from "@/lib/corpus/overviewData";
import { cookies } from "next/headers";
import { THEME_COOKIE_NAME, parseThemePreferenceCookie } from "@/lib/theme/themePreferences";
import { SITE_URL, languageAlternates } from "@/lib/seo/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    alternates: {
      canonical: `${SITE_URL}/${locale}`,
      languages: languageAlternates(""),
    },
  };
}

type SearchParams = Record<string, string | string[] | undefined>;

// The minimal, search-first home is the default landing. Entering the full
// Observatory is signalled by a deep-link param (the home's CTAs / "skip" push
// ?viz=&root=…, and AppShell hydrates the selection from those params).
export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const entered = Boolean(sp.viz || sp.root || sp.lemma || sp.surah || sp.ayah || sp.token || sp.app);

  if (!entered) {
    return <MinimalHome />;
  }

  const initialCorpusData = buildExploreOverviewPayload();
  const cookieStore = await cookies();
  const initialThemePreference = parseThemePreferenceCookie(cookieStore.get(THEME_COOKIE_NAME)?.value);

  return <AppShell initialCorpusData={initialCorpusData} initialThemePreference={initialThemePreference} />;
}
