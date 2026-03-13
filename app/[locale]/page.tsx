import HomePageClient from "@/components/home/HomePageClient";
import { buildExploreOverviewPayload } from "@/lib/corpus/overviewData";
import { cookies } from "next/headers";
import { THEME_COOKIE_NAME, parseThemePreferenceCookie } from "@/lib/theme/themePreferences";

export default async function HomePage() {
  const initialCorpusData = buildExploreOverviewPayload();
  const cookieStore = await cookies();
  const initialThemePreference = parseThemePreferenceCookie(cookieStore.get(THEME_COOKIE_NAME)?.value);

  return <HomePageClient initialCorpusData={initialCorpusData} initialThemePreference={initialThemePreference} />;
}
