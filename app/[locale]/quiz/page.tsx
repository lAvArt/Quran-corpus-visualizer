import { buildExploreOverviewPayload } from "@/lib/corpus/overviewData";
import QuizWorkspace from "./QuizWorkspace";

export default function QuizPage() {
  const { visualizationTokens } = buildExploreOverviewPayload();
  return <QuizWorkspace tokens={visualizationTokens} />;
}
