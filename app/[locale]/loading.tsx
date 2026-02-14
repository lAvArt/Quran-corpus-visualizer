export default function Loading() {
  return (
    <div className="loading-page">
      <div className="loading-card">
        <div className="loading-spinner" aria-hidden />
        <p className="loading-label">Loading...</p>
      </div>

      <style>{`
        .loading-page {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          min-height: 100dvh;
          background: var(--bg-0, #f7f3ea);
          color: var(--ink, #1f1c19);
        }

        .loading-card {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--line, rgba(31, 28, 25, 0.12));
          border-top-color: var(--accent, #0f766e);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .loading-label {
          margin: 0;
          font-size: 0.9rem;
          color: var(--ink-muted, rgba(31, 28, 25, 0.45));
          font-weight: 500;
          letter-spacing: 0.05em;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .loading-spinner {
            animation: none;
            border-top-color: var(--accent, #0f766e);
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  );
}
