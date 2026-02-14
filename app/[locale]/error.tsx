"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Error");

  useEffect(() => {
    console.error("[App Error]", error);
  }, [error]);

  return (
    <div className="error-page">
      <div className="error-card">
        <div className="error-icon" aria-hidden>
          ⚠
        </div>
        <h1 className="error-title">{t("title")}</h1>
        <p className="error-message">{t("message")}</p>
        {error.digest && (
          <p className="error-digest">
            {t("reference")}: <code>{error.digest}</code>
          </p>
        )}
        <div className="error-actions">
          <button className="error-btn primary" onClick={reset}>
            {t("tryAgain")}
          </button>
          <button
            className="error-btn secondary"
            onClick={() => (window.location.href = "/")}
          >
            {t("goHome")}
          </button>
        </div>
      </div>

      <style jsx>{`
        .error-page {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          min-height: 100dvh;
          padding: 2rem;
          background: var(--bg-0, #f7f3ea);
          color: var(--ink, #1f1c19);
        }

        .error-card {
          text-align: center;
          max-width: 480px;
          padding: 3rem 2rem;
          border-radius: 18px;
          background: var(--panel, rgba(255, 255, 255, 0.78));
          border: 1px solid var(--line, rgba(31, 28, 25, 0.12));
          backdrop-filter: blur(12px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
        }

        .error-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .error-title {
          margin: 0 0 0.75rem;
          font-size: 1.5rem;
          font-family: var(--font-display, "Fraunces"), serif;
        }

        .error-message {
          margin: 0 0 1rem;
          color: var(--ink-secondary, rgba(31, 28, 25, 0.7));
          line-height: 1.5;
        }

        .error-digest {
          margin: 0 0 1.5rem;
          font-size: 0.8rem;
          color: var(--ink-muted, rgba(31, 28, 25, 0.45));
        }

        .error-digest code {
          background: var(--bg-2, #e6dcc9);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.75rem;
        }

        .error-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .error-btn {
          padding: 0.6rem 1.4rem;
          border-radius: 99px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid var(--line);
          transition: all 0.2s ease;
        }

        .error-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .error-btn:focus-visible {
          outline: 2px solid var(--accent, #0f766e);
          outline-offset: 2px;
        }

        .error-btn.primary {
          background: var(--accent, #0f766e);
          color: white;
          border-color: transparent;
        }

        .error-btn.secondary {
          background: var(--bg-2, #e6dcc9);
          color: var(--ink);
        }
      `}</style>
    </div>
  );
}
