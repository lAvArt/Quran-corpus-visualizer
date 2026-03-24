"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import AppWorkspaceShell from "@/components/ui/AppWorkspaceShell";
import DailyPuzzle from "@/components/quiz/DailyPuzzle";
import ReviewQuiz from "@/components/quiz/ReviewQuiz";
import { useKnowledge } from "@/lib/context/KnowledgeContext";
import { calculateRootFrequencies } from "@/lib/search/collocation";
import { ROOT_GLOSSES } from "@/lib/data/rootGlosses";
import { SURAH_NAMES } from "@/lib/data/surahData";
import type { CorpusToken } from "@/lib/schema/types";
import type { QuizCorpusData } from "@/lib/quiz/questionTemplates";

interface QuizWorkspaceProps {
  tokens: CorpusToken[];
}

export default function QuizWorkspace({ tokens }: QuizWorkspaceProps) {
  const t = useTranslations("Quiz");
  const { stats } = useKnowledge();

  const corpusData: QuizCorpusData = useMemo(() => ({
    tokens,
    freqData: calculateRootFrequencies(tokens),
    glosses: ROOT_GLOSSES,
    surahNames: SURAH_NAMES,
  }), [tokens]);

  return (
    <AppWorkspaceShell
      kicker={t("kicker")}
      title={t("title")}
      description={t("description")}
      backgroundVariant="study"
      panelWidth="wide"
    >
      <section className="quiz-section">
        <h2 className="quiz-section-heading">{t("dailyPuzzleHeading")}</h2>
        <p className="quiz-section-desc">{t("dailyPuzzleDesc")}</p>
        <DailyPuzzle corpusData={corpusData} />
      </section>

      {stats.total > 0 && (
        <section className="quiz-section quiz-section-review">
          <h2 className="quiz-section-heading">{t("reviewHeading")}</h2>
          <p className="quiz-section-desc">{t("reviewDesc")}</p>
          <ReviewQuiz corpusData={corpusData} />
        </section>
      )}

      <style jsx>{`
        .quiz-section {
          padding: 24px 0;
        }
        .quiz-section + .quiz-section {
          border-top: 1px solid var(--border-primary, #e5e7eb);
          margin-top: 24px;
        }
        .quiz-section-heading {
          font-size: 1.2rem;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .quiz-section-desc {
          font-size: 0.9rem;
          opacity: 0.7;
          margin-bottom: 20px;
        }
      `}</style>
    </AppWorkspaceShell>
  );
}
