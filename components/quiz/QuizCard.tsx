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
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(246, 240, 231, 0.9)),
            radial-gradient(circle at top right, color-mix(in srgb, var(--accent-2), white 70%), transparent 38%);
          border: 1px solid color-mix(in srgb, var(--accent), var(--line) 62%);
          border-radius: 24px;
          padding: 26px;
          max-width: 680px;
          margin: 0 auto;
          box-shadow: 0 26px 54px rgba(15, 23, 42, 0.12);
        }
        .quiz-card::before {
          content: "";
          position: absolute;
          inset: 0 auto auto 0;
          width: 100%;
          height: 3px;
          background: linear-gradient(90deg, var(--accent), var(--accent-2), var(--accent-3));
          opacity: 0.9;
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
          border-radius: 999px;
          border: 1px solid rgba(17, 24, 39, 0.08);
          background: rgba(255, 255, 255, 0.62);
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .quiz-card-difficulty-easy {
          color: #0f8a52;
          border-color: rgba(15, 138, 82, 0.18);
          background: rgba(15, 138, 82, 0.1);
        }
        .quiz-card-difficulty-medium {
          color: #b06a00;
          border-color: rgba(176, 106, 0, 0.2);
          background: rgba(245, 158, 11, 0.12);
        }
        .quiz-card-difficulty-hard {
          color: #b91c1c;
          border-color: rgba(185, 28, 28, 0.2);
          background: rgba(239, 68, 68, 0.12);
        }
        .quiz-card-prompt {
          margin: 0 0 1.15rem;
          font-size: 1.28rem;
          font-weight: 600;
          line-height: 1.45;
          color: var(--ink);
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
          border: 1px solid rgba(17, 24, 39, 0.12);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.54);
          color: var(--ink);
          cursor: pointer;
          font-size: 1rem;
          text-align: start;
          transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
        }
        .quiz-choice:hover:not(:disabled) {
          transform: translateY(-1px);
          border-color: color-mix(in srgb, var(--accent), white 22%);
          box-shadow: 0 8px 18px color-mix(in srgb, var(--accent-glow), transparent 40%);
        }
        .quiz-choice.selected {
          border-color: var(--accent);
          background: color-mix(in srgb, var(--accent), rgba(255, 255, 255, 0.86) 86%);
          box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent), white 16%);
        }
        .quiz-choice.correct {
          border-color: #22c55e;
          background: rgba(34, 197, 94, 0.14);
        }
        .quiz-choice.wrong {
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.14);
        }
        .quiz-choice:disabled { cursor: default; }
        .quiz-choice-letter {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(17, 24, 39, 0.06);
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
          border: 1px solid color-mix(in srgb, var(--accent), white 18%);
          border-radius: 16px;
          background: color-mix(in srgb, var(--accent), black 6%);
          color: #fbf7f0;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 14px 28px color-mix(in srgb, var(--accent-glow), transparent 22%);
          transition: opacity 0.15s, transform 0.15s ease;
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
          border-radius: 18px;
          text-align: start;
          border: 1px solid rgba(17, 24, 39, 0.08);
        }
        .quiz-result-correct { background: rgba(34, 197, 94, 0.1); }
        .quiz-result-wrong { background: rgba(239, 68, 68, 0.1); }
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
          background:
            linear-gradient(180deg, rgba(24, 30, 38, 0.96), rgba(18, 23, 30, 0.94)),
            radial-gradient(circle at top right, color-mix(in srgb, var(--accent-2), transparent 78%), transparent 38%);
          border-color: rgba(255, 255, 255, 0.08);
          box-shadow: 0 28px 60px rgba(0, 0, 0, 0.32);
        }
        :global([data-theme="dark"] .quiz-card-counter),
        :global([data-theme="dark"] .quiz-card-difficulty) {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.08);
          color: rgba(226, 232, 240, 0.86);
        }
        :global([data-theme="dark"] .quiz-choice) {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.08);
          color: rgba(241, 245, 249, 0.96);
        }
        :global([data-theme="dark"] .quiz-choice.selected) {
          background: color-mix(in srgb, var(--accent), transparent 86%);
          border-color: color-mix(in srgb, var(--accent), white 18%);
        }
        :global([data-theme="dark"] .quiz-choice-letter) {
          background: rgba(255, 255, 255, 0.06);
          color: rgba(226, 232, 240, 0.72);
        }
        :global([data-theme="dark"] .quiz-result) {
          border-color: rgba(255, 255, 255, 0.08);
        }
        :global([data-theme="dark"] .quiz-result strong),
        :global([data-theme="dark"] .quiz-answer-reveal) {
          color: rgba(248, 250, 252, 0.96);
        }
        :global([data-theme="dark"] .quiz-explanation) {
          color: rgba(226, 232, 240, 0.76);
        }
        @media (max-width: 720px) {
          .quiz-card {
            padding: 1rem;
            border-radius: 20px;
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
