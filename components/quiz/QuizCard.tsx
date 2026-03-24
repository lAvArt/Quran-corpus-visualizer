"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import type { QuizQuestion } from "@/lib/quiz/questionTemplates";

interface QuizCardProps {
  question: QuizQuestion;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (correct: boolean) => void;
}

export default function QuizCard({ question, questionNumber, totalQuestions, onAnswer }: QuizCardProps) {
  const t = useTranslations("Quiz");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  const handleSubmit = useCallback(() => {
    if (selectedIndex === null) return;
    setRevealed(true);
    onAnswer(selectedIndex === question.correctIndex);
  }, [selectedIndex, question.correctIndex, onAnswer]);

  const isCorrect = selectedIndex === question.correctIndex;
  const root = question.subjectRoot ?? "";

  return (
    <div className="quiz-card" data-revealed={revealed ? "true" : undefined}>
      <div className="quiz-card-header">
        <span className="quiz-card-counter">{questionNumber} / {totalQuestions}</span>
        <span className={`quiz-card-difficulty quiz-card-difficulty-${question.difficulty}`}>
          {t(`difficulty.${question.difficulty}`)}
        </span>
      </div>

      <p className="quiz-card-prompt">
        {t(question.prompt, { root })}
      </p>

      <div className="quiz-card-choices" role="radiogroup" aria-label={t("choicesLabel")}>
        {question.choices.map((choice, i) => {
          let state = "";
          if (revealed) {
            if (i === question.correctIndex) state = "correct";
            else if (i === selectedIndex) state = "wrong";
          }

          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={selectedIndex === i}
              className={`quiz-choice ${selectedIndex === i ? "selected" : ""} ${state}`}
              disabled={revealed}
              onClick={() => setSelectedIndex(i)}
            >
              <span className="quiz-choice-letter">{String.fromCharCode(65 + i)}</span>
              <span className="quiz-choice-text">{choice}</span>
            </button>
          );
        })}
      </div>

      {!revealed ? (
        <button
          type="button"
          className="quiz-submit-btn"
          disabled={selectedIndex === null}
          onClick={handleSubmit}
        >
          {t("submit")}
        </button>
      ) : (
        <div className={`quiz-result ${isCorrect ? "quiz-result-correct" : "quiz-result-wrong"}`}>
          <strong>{isCorrect ? t("correct") : t("incorrect")}</strong>
          <p className="quiz-explanation">
            {t(question.explanation, { root, answer: question.choices[question.correctIndex] })}
          </p>
        </div>
      )}

      <style jsx>{`
        .quiz-card {
          background: var(--surface-secondary, #f8f9fa);
          border: 1px solid var(--border-primary, #e0e0e0);
          border-radius: 12px;
          padding: 24px;
          max-width: 600px;
          margin: 0 auto;
        }
        .quiz-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          font-size: 0.85rem;
          opacity: 0.7;
        }
        .quiz-card-difficulty-easy { color: #22c55e; }
        .quiz-card-difficulty-medium { color: #f59e0b; }
        .quiz-card-difficulty-hard { color: #ef4444; }
        .quiz-card-prompt {
          font-size: 1.15rem;
          font-weight: 600;
          line-height: 1.5;
          margin-bottom: 20px;
        }
        .quiz-card-choices {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 20px;
        }
        .quiz-choice {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border: 2px solid var(--border-primary, #ddd);
          border-radius: 8px;
          background: transparent;
          cursor: pointer;
          font-size: 1rem;
          text-align: start;
          transition: border-color 0.15s, background 0.15s;
        }
        .quiz-choice:hover:not(:disabled) {
          border-color: var(--accent-primary, #3b82f6);
        }
        .quiz-choice.selected {
          border-color: var(--accent-primary, #3b82f6);
          background: var(--accent-bg, rgba(59, 130, 246, 0.08));
        }
        .quiz-choice.correct {
          border-color: #22c55e;
          background: rgba(34, 197, 94, 0.1);
        }
        .quiz-choice.wrong {
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }
        .quiz-choice:disabled { cursor: default; }
        .quiz-choice-letter {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--surface-tertiary, #eee);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.85rem;
          flex-shrink: 0;
        }
        .quiz-submit-btn {
          width: 100%;
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          background: var(--accent-primary, #3b82f6);
          color: white;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .quiz-submit-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .quiz-result {
          padding: 16px;
          border-radius: 8px;
          text-align: center;
        }
        .quiz-result-correct { background: rgba(34, 197, 94, 0.1); }
        .quiz-result-wrong { background: rgba(239, 68, 68, 0.1); }
        .quiz-explanation {
          margin-top: 8px;
          font-size: 0.9rem;
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
}
