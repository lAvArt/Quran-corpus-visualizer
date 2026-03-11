import HomePageClient from "@/components/home/HomePageClient";
import { buildExploreOverviewPayload } from "@/lib/corpus/overviewData";

export default function HomePage() {
  const initialCorpusData = buildExploreOverviewPayload();

  return <HomePageClient initialCorpusData={initialCorpusData} />;
}
