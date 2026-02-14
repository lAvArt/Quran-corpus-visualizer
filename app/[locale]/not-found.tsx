import { useTranslations } from "next-intl";

export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    <div className="notfound-page">
      <div className="notfound-card">
        <div className="notfound-code" aria-hidden>
          404
        </div>
        <h1 className="notfound-title">{t("title")}</h1>
        <p className="notfound-message">{t("message")}</p>
        <a href="/" className="notfound-btn">
          {t("goHome")}
        </a>
      </div>

      <style>{`
        .notfound-page {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          min-height: 100dvh;
          padding: 2rem;
          background: var(--bg-0, #f7f3ea);
          color: var(--ink, #1f1c19);
        }

        .notfound-card {
          text-align: center;
          max-width: 480px;
          padding: 3rem 2rem;
          border-radius: 18px;
          background: var(--panel, rgba(255, 255, 255, 0.78));
          border: 1px solid var(--line, rgba(31, 28, 25, 0.12));
          backdrop-filter: blur(12px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
        }

        .notfound-code {
          font-size: 5rem;
          font-weight: 800;
          font-family: var(--font-display, "Fraunces"), serif;
          color: var(--accent, #0f766e);
          line-height: 1;
          margin-bottom: 0.5rem;
          opacity: 0.7;
        }

        .notfound-title {
          margin: 0 0 0.75rem;
          font-size: 1.5rem;
          font-family: var(--font-display, "Fraunces"), serif;
        }

        .notfound-message {
          margin: 0 0 1.5rem;
          color: var(--ink-secondary, rgba(31, 28, 25, 0.7));
          line-height: 1.5;
        }

        .notfound-btn {
          display: inline-block;
          padding: 0.6rem 1.6rem;
          border-radius: 99px;
          font-size: 0.9rem;
          font-weight: 600;
          text-decoration: none;
          background: var(--accent, #0f766e);
          color: white;
          transition: all 0.2s ease;
        }

        .notfound-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .notfound-btn:focus-visible {
          outline: 2px solid var(--accent, #0f766e);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}
