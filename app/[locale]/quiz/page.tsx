import { Suspense } from "react";
import { buildExploreOverviewPayload } from "@/lib/corpus/overviewData";
import QuizWorkspace from "./QuizWorkspace";

export default function QuizPage() {
  const initialCorpusData = buildExploreOverviewPayload();
  return (
    // QuizWorkspace reads ?root= via useSearchParams (for the root-focused
    // quiz deep link from the inspector) — Next requires a Suspense
    // boundary around any component using it so this route can still be
    // statically prerendered.
    <Suspense fallback={null}>
      <QuizWorkspace initialCorpusData={initialCorpusData} />
    </Suspense>
  );
}
