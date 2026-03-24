"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import QuizCard from "@/components/quiz/QuizCard";
import {
  generateDailyPuzzle,
  todayDateString,
  saveDailyResult,
  loadDailyResult,
  type DailyPuzzleResult,
} from "@/lib/quiz/dailyPuzzle";
import type { QuizCorpusData } from "@/lib/quiz/questionTemplates";

interface DailyPuzzleProps {
  corpusData: QuizCorpusData;
}

export default function DailyPuzzle({ corpusData }: DailyPuzzleProps) {
  const t = useTranslations("Quiz");
  const dateStr = useMemo(() => todayDateString(), []);
  const questions = useMemo(() => generateDailyPuzzle(corpusData, dateStr), [corpusData, dateStr]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [saved, setSaved] = useState<DailyPuzzleResult | null>(() => loadDailyResult(dateStr));

  const handleAnswer = useCallback((correct: boolean) => {
    if (correct) setScore((s) => s + 1);
    setAnswered((a) => a + 1);
  }, []);

  const handleNext = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= questions.length) {
      // Quiz complete
      const finalResult: DailyPuzzleResult = {
        dateStr,
        score,
        total: questions.length,
        completedAt: Date.now(),
      };
      saveDailyResult(finalResult);
      setSaved(finalResult);
    } else {
      setCurrentIndex(nextIndex);
    }
  }, [currentIndex, questions.length, dateStr, score, answered]);

  if (saved) {
    return (
      <div className="daily-complete">
        <div className="daily-complete-icon">🎯</div>
        <h3 className="daily-complete-title">{t("dailyComplete")}</h3>
        <p className="daily-complete-score">
          {t("scoreDisplay", { score: saved.score, total: saved.total })}
        </p>
        <p className="daily-complete-date">{dateStr}</p>
        <style jsx>{`
          .daily-complete {
            text-align: center;
            padding: 40px 24px;
            max-width: 400px;
            margin: 0 auto;
          }
          .daily-complete-icon { font-size: 3rem; margin-bottom: 12px; }
          .daily-complete-title {
            font-size: 1.3rem;
            font-weight: 700;
            margin-bottom: 8px;
          }
          .daily-complete-score {
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--accent-primary, #3b82f6);
          }
          .daily-complete-date {
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
    <div className="daily-puzzle">
      {/* Progress dots */}
      <div className="daily-progress">
        {questions.map((_, i) => (
          <span
            key={i}
            className={`daily-dot ${i === currentIndex ? "active" : ""} ${i < answered ? "done" : ""}`}
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
        <div className="daily-nav">
          <button type="button" className="daily-next-btn" onClick={handleNext}>
            {isLast ? t("finish") : t("next")}
          </button>
        </div>
      )}

      <style jsx>{`
        .daily-puzzle { max-width: 600px; margin: 0 auto; }
        .daily-progress {
          display: flex;
          gap: 8px;
          justify-content: center;
          margin-bottom: 20px;
        }
        .daily-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--border-primary, #ddd);
          transition: background 0.2s;
        }
        .daily-dot.active { background: var(--accent-primary, #3b82f6); }
        .daily-dot.done { background: #22c55e; }
        .daily-nav {
          display: flex;
          justify-content: center;
          margin-top: 16px;
        }
        .daily-next-btn {
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
