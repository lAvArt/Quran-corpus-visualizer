import SearchWorkspace from "@/components/search/SearchWorkspace";
import { buildExploreOverviewPayload } from "@/lib/corpus/overviewData";

export default function SearchPage() {
  const initialCorpusData = buildExploreOverviewPayload();

  return <SearchWorkspace initialCorpusData={initialCorpusData} />;
}
