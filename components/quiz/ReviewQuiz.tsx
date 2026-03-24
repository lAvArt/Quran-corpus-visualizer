"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import QuizCard from "@/components/quiz/QuizCard";
import { useKnowledge } from "@/lib/context/KnowledgeContext";
import { generateReviewQuiz, extractQuizRoots } from "@/lib/quiz/personalizedQuiz";
import type { QuizCorpusData } from "@/lib/quiz/questionTemplates";

interface ReviewQuizProps {
  corpusData: QuizCorpusData;
}

export default function ReviewQuiz({ corpusData }: ReviewQuizProps) {
  const t = useTranslations("Quiz");
  const { roots, updateRoot, stats } = useKnowledge();

  const trackedRootsArray = useMemo(
    () => Array.from(roots.values()),
    [roots],
  );

  const questions = useMemo(
    () => generateReviewQuiz(corpusData, trackedRootsArray),
    [corpusData, trackedRootsArray],
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [finished, setFinished] = useState(false);

  const handleAnswer = useCallback((correct: boolean) => {
    if (correct) setScore((s) => s + 1);
    setAnswered((a) => a + 1);
  }, []);

  const handleNext = useCallback(async () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= questions.length) {
      // Update lastReviewedAt for all reviewed roots
      const reviewedRoots = extractQuizRoots(questions);
      for (const root of reviewedRoots) {
        try {
          await updateRoot(root, { state: roots.get(root)?.state ?? "learning" });
        } catch {
          // Non-critical — quiz still shows results
        }
      }
      setFinished(true);
    } else {
      setCurrentIndex(nextIndex);
    }
  }, [currentIndex, questions, updateRoot, roots]);

  if (stats.total === 0) {
    return (
      <div className="review-empty">
        <p>{t("noTrackedRoots")}</p>
        <style jsx>{`
          .review-empty {
            text-align: center;
            padding: 32px;
            opacity: 0.7;
          }
        `}</style>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="review-complete">
        <div className="review-complete-icon">📖</div>
        <h3 className="review-complete-title">{t("reviewComplete")}</h3>
        <p className="review-complete-score">
          {t("scoreDisplay", { score, total: questions.length })}
        </p>
        <p className="review-complete-roots">
          {t("rootsReviewed", { count: extractQuizRoots(questions).length })}
        </p>
        <style jsx>{`
          .review-complete {
            text-align: center;
            padding: 40px 24px;
            max-width: 400px;
            margin: 0 auto;
          }
          .review-complete-icon { font-size: 3rem; margin-bottom: 12px; }
          .review-complete-title {
            font-size: 1.3rem;
            font-weight: 700;
            margin-bottom: 8px;
          }
          .review-complete-score {
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--accent-primary, #3b82f6);
          }
          .review-complete-roots {
            margin-top: 8px;
            font-size: 0.85rem;
            opacity: 0.6;
          }
        `}</style>
      </div>
    );
  }

  if (questions.length === 0) {
    return <p className="quiz-empty">{t("noQuestions")}</p>;
  }

  const question = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const hasAnswered = answered > currentIndex;

  return (
    <div className="review-quiz">
      {/* Progress dots */}
      <div className="review-progress">
        {questions.map((_, i) => (
          <span
            key={i}
            className={`review-dot ${i === currentIndex ? "active" : ""} ${i < answered ? "done" : ""}`}
          />
        ))}
      </div>

      <QuizCard
        key={question.id}
        question={question}
        questionNumber={currentIndex + 1}
        totalQuestions={questions.length}
        onAnswer={handleAnswer}
      />

      {hasAnswered && (
        <div className="review-nav">
          <button type="button" className="review-next-btn" onClick={handleNext}>
            {isLast ? t("finish") : t("next")}
          </button>
        </div>
      )}

      <style jsx>{`
        .review-quiz { max-width: 600px; margin: 0 auto; }
        .review-progress {
          display: flex;
          gap: 8px;
          justify-content: center;
          margin-bottom: 20px;
        }
        .review-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--border-primary, #ddd);
          transition: background 0.2s;
        }
        .review-dot.active { background: var(--accent-primary, #3b82f6); }
        .review-dot.done { background: #22c55e; }
        .review-nav {
          display: flex;
          justify-content: center;
          margin-top: 16px;
        }
        .review-next-btn {
          padding: 10px 32px;
          border: none;
          border-radius: 8px;
          background: var(--accent-primary, #3b82f6);
          color: white;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
