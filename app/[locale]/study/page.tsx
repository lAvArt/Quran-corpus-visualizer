import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import StudyHub from "@/components/study/StudyHub";
import { SITE_URL, languageAlternates } from "@/lib/seo/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return {
    title: t("studyTitle"),
    description: t("studyDescription"),
    alternates: {
      canonical: `${SITE_URL}/${locale}/study`,
      languages: languageAlternates("/study"),
    },
  };
}

export default function StudyPage() {
  return <StudyHub />;
}
