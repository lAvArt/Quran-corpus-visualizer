import { buildExploreOverviewPayload } from "@/lib/corpus/overviewData";
import QuizWorkspace from "./QuizWorkspace";

export default function QuizPage() {
  const initialCorpusData = buildExploreOverviewPayload();
  return <QuizWorkspace initialCorpusData={initialCorpusData} />;
}
