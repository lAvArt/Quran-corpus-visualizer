"use client";

import { useTranslations } from "next-intl";
import type { QuizQuestion } from "@/lib/quiz/questionTemplates";

interface QuizCardProps {
  question: QuizQuestion;
  questionNumber: number;
  totalQuestions: number;
  selectedIndex: number | null;
  revealed: boolean;
  onSelect: (index: number) => void;
  onSubmit: () => void;
}

export default function QuizCard({
  question,
  questionNumber,
  totalQuestions,
  selectedIndex,
  revealed,
  onSelect,
  onSubmit,
}: QuizCardProps) {
  const t = useTranslations("Quiz");

  const isCorrect = selectedIndex === question.correctIndex;
  const promptText = t(question.prompt, question.promptValues);
  const explanationText = t(question.explanation, question.explanationValues);

  return (
    <div className="quiz-card" data-revealed={revealed ? "true" : undefined}>
      <div className="quiz-card-header">
        <span className="quiz-card-counter">{questionNumber} / {totalQuestions}</span>
        <span className={`quiz-card-difficulty quiz-card-difficulty-${question.difficulty}`}>
          {t(`difficulty.${question.difficulty}`)}
        </span>
      </div>

      <p className="quiz-card-prompt">
        {promptText}
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
              onClick={() => onSelect(i)}
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
          onClick={onSubmit}
        >
          {t("submit")}
        </button>
      ) : (
        <div className={`quiz-result ${isCorrect ? "quiz-result-correct" : "quiz-result-wrong"}`}>
          <strong>{isCorrect ? t("correct") : t("incorrect")}</strong>
          {!isCorrect ? (
            <p className="quiz-answer-reveal">
              {t("correctAnswerLabel", { answer: question.choices[question.correctIndex] })}
            </p>
          ) : null}
          <p className="quiz-explanation">
            {explanationText}
          </p>
        </div>
      )}

      <style jsx>{`
        .quiz-card {
          position: relative;
          overflow: hidden;
          color: var(--ink);
          background: var(--bg-2);
          border: 1px solid var(--line);
          border-radius: var(--radius-lg);
          padding: 24px;
          max-width: 680px;
          margin: 0 auto;
          font-family: var(--font-sans);
        }
        .quiz-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 18px;
          font-size: 0.82rem;
          color: var(--ink-secondary);
        }
        .quiz-card-counter,
        .quiz-card-difficulty {
          display: inline-flex;
          align-items: center;
          min-height: 2rem;
          padding: 0.35rem 0.75rem;
          border-radius: var(--radius-pill);
          border: 1px solid var(--line);
          background: var(--panel);
          color: var(--ink-secondary);
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .quiz-card-difficulty-easy {
          color: #56a697;
          border-color: color-mix(in srgb, #56a697 40%, var(--line));
          background: color-mix(in srgb, #56a697 12%, transparent);
        }
        .quiz-card-difficulty-medium {
          color: var(--accent);
          border-color: color-mix(in srgb, var(--accent) 40%, var(--line));
          background: color-mix(in srgb, var(--accent) 12%, transparent);
        }
        .quiz-card-difficulty-hard {
          color: #dd6a47;
          border-color: color-mix(in srgb, #dd6a47 40%, var(--line));
          background: color-mix(in srgb, #dd6a47 12%, transparent);
        }
        .quiz-card-prompt {
          margin: 0 0 1.15rem;
          font-size: 1.32rem;
          font-weight: 600;
          line-height: 1.45;
          color: var(--ink);
          font-family: var(--font-sans);
        }
        .quiz-card-prompt :global([dir="rtl"]),
        .quiz-card-prompt :global(.arabic) {
          font-family: var(--font-arabic);
        }
        .quiz-card-choices {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }
        .quiz-choice {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 0.92rem 1rem;
          border: 1px solid var(--line);
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--ink);
          cursor: pointer;
          font-size: 1rem;
          font-family: var(--font-sans);
          text-align: start;
          transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
        }
        .quiz-choice:hover:not(:disabled) {
          transform: translateY(-1px);
          border-color: color-mix(in srgb, var(--accent) 45%, var(--line));
          background: color-mix(in srgb, var(--selection) 5%, transparent);
        }
        .quiz-choice.selected {
          border-color: var(--accent);
          background: color-mix(in srgb, var(--accent) 10%, transparent);
        }
        .quiz-choice.correct {
          border-color: #56a697;
          background: color-mix(in srgb, #56a697 14%, transparent);
        }
        .quiz-choice.wrong {
          border-color: #dd6a47;
          background: color-mix(in srgb, #dd6a47 14%, transparent);
        }
        .quiz-choice:disabled { cursor: default; }
        .quiz-choice-letter {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: color-mix(in srgb, var(--selection) 8%, transparent);
          border: 1px solid var(--line);
          color: var(--ink-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.85rem;
          flex-shrink: 0;
        }
        .quiz-submit-btn {
          width: 100%;
          padding: 0.95rem 1.2rem;
          border: 1px solid var(--accent);
          border-radius: var(--radius-pill);
          background: var(--accent);
          color: var(--accent-ink);
          font-size: 1rem;
          font-weight: 600;
          font-family: var(--font-sans);
          cursor: pointer;
          box-shadow: 0 14px 28px color-mix(in srgb, var(--accent-glow), transparent 22%);
          transition: opacity 0.15s, transform 0.15s ease, background 0.15s ease;
        }
        .quiz-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          background: color-mix(in srgb, var(--accent), black 12%);
        }
        .quiz-submit-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          box-shadow: none;
        }
        .quiz-result {
          padding: 1rem 1.05rem;
          border-radius: var(--radius-md);
          text-align: start;
          border: 1px solid var(--line);
        }
        .quiz-result-correct {
          border-color: color-mix(in srgb, #56a697 40%, var(--line));
          background: color-mix(in srgb, #56a697 10%, transparent);
        }
        .quiz-result-wrong {
          border-color: color-mix(in srgb, #dd6a47 40%, var(--line));
          background: color-mix(in srgb, #dd6a47 10%, transparent);
        }
        .quiz-result strong {
          display: block;
          font-size: 1rem;
          color: var(--ink);
        }
        .quiz-explanation {
          margin-top: 8px;
          font-size: 0.94rem;
          line-height: 1.55;
          color: var(--ink-secondary);
        }
        .quiz-answer-reveal {
          margin: 8px 0 0;
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--ink);
        }
        :global([data-theme="dark"] .quiz-card) {
          background: var(--panel);
          border-color: var(--line);
        }
        @media (max-width: 720px) {
          .quiz-card {
            padding: 1rem;
            border-radius: var(--radius-md);
          }
          .quiz-card-header {
            align-items: flex-start;
            flex-direction: column;
          }
          .quiz-card-prompt {
            font-size: 1.08rem;
          }
        }
      `}</style>
    </div>
  );
}
