"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";

interface EmbedCodeModalProps {
  vizMode: VisualizationMode;
  selectedSurahId: number;
  onClose: () => void;
}

export default function EmbedCodeModal({ vizMode, selectedSurahId, onClose }: EmbedCodeModalProps) {
  const t = useTranslations("EmbedModal");
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const embedUrl = `/embed/${vizMode}?surah=${selectedSurahId}&theme=${theme}`;

  const snippet = `<iframe src="${typeof window !== "undefined" ? window.location.origin : ""}${embedUrl}" width="${width}" height="${height}" style="border:0;border-radius:8px" loading="lazy" allowfullscreen></iframe>`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  }, [snippet]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* Trap focus inside dialog */
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => prev?.focus();
  }, []);

  return createPortal(
    <>
      {/* backdrop */}
      <div className="embed-backdrop" onClick={onClose} aria-hidden />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal
        aria-label={t("title")}
        tabIndex={-1}
        className="embed-dialog"
      >
        <h2 className="embed-title">{t("title")}</h2>

        {/* Controls */}
        <div className="embed-controls">
          <label className="embed-field">
            <span>{t("width")}</span>
            <input
              type="number"
              min={300}
              max={1920}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value) || 300)}
            />
          </label>

          <label className="embed-field">
            <span>{t("height")}</span>
            <input
              type="number"
              min={200}
              max={1200}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value) || 200)}
            />
          </label>

          <fieldset className="embed-theme-toggle">
            <legend>{t("theme")}</legend>
            <button
              type="button"
              className={theme === "light" ? "active" : ""}
              onClick={() => setTheme("light")}
            >
              {t("light")}
            </button>
            <button
              type="button"
              className={theme === "dark" ? "active" : ""}
              onClick={() => setTheme("dark")}
            >
              {t("dark")}
            </button>
          </fieldset>
        </div>

        {/* Code snippet */}
        <pre className="embed-code"><code>{snippet}</code></pre>

        <button type="button" className="embed-copy" onClick={handleCopy}>
          {copied ? t("copied") : t("copyCode")}
        </button>

        {/* Live preview */}
        <p className="embed-preview-label">{t("preview")}</p>
        <div className="embed-preview-frame">
          <iframe
            src={embedUrl}
            width={Math.min(width, 560)}
            height={Math.min(height, 320)}
            style={{ border: 0, borderRadius: 6 }}
            loading="lazy"
            title={t("preview")}
          />
        </div>

        <button type="button" className="embed-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <style jsx>{`
        .embed-backdrop {
          position: fixed;
          inset: 0;
          z-index: 900;
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(4px);
        }

        .embed-dialog {
          position: fixed;
          z-index: 901;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: min(620px, 92vw);
          max-height: 88vh;
          overflow-y: auto;
          background: var(--bg, #fff);
          border: 1px solid var(--line, #e5e5e5);
          border-radius: 16px;
          padding: 28px 24px 24px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.22);
          outline: none;
        }

        .embed-title {
          font-size: 1.1rem;
          font-weight: 700;
          margin: 0 0 18px;
          color: var(--ink);
        }

        .embed-controls {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          align-items: flex-end;
          margin-bottom: 16px;
        }

        .embed-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--ink-secondary);
        }

        .embed-field input {
          width: 90px;
          padding: 6px 8px;
          border: 1px solid var(--line);
          border-radius: 8px;
          font-size: 0.82rem;
          background: transparent;
          color: var(--ink);
        }

        .embed-theme-toggle {
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 2px;
          display: flex;
          gap: 2px;
          margin: 0;
        }

        .embed-theme-toggle legend {
          font-size: 0.72rem;
          font-weight: 600;
          padding: 0 4px;
          color: var(--ink-secondary);
        }

        .embed-theme-toggle button {
          border: none;
          border-radius: 6px;
          padding: 5px 12px;
          font-size: 0.76rem;
          font-weight: 600;
          cursor: pointer;
          background: transparent;
          color: var(--ink-secondary);
          transition: background 0.18s, color 0.18s;
        }

        .embed-theme-toggle button.active {
          background: var(--accent, #0f766e);
          color: #fff;
        }

        .embed-code {
          background: var(--surface-secondary, #f5f5f5);
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 14px 16px;
          font-size: 0.74rem;
          line-height: 1.55;
          overflow-x: auto;
          white-space: pre-wrap;
          word-break: break-all;
          margin: 0 0 10px;
          color: var(--ink);
        }

        .embed-copy {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          border: 1px solid var(--accent, #0f766e);
          border-radius: 9px;
          background: transparent;
          color: var(--accent, #0f766e);
          font-weight: 600;
          font-size: 0.8rem;
          cursor: pointer;
          transition: background 0.18s, color 0.18s;
        }

        .embed-copy:hover {
          background: var(--accent, #0f766e);
          color: #fff;
        }

        .embed-preview-label {
          margin: 18px 0 8px;
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--ink-secondary);
        }

        .embed-preview-frame {
          background: var(--surface-secondary, #f5f5f5);
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 10px;
          display: flex;
          justify-content: center;
          overflow: hidden;
        }

        .embed-close {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 8px;
          background: transparent;
          font-size: 1.3rem;
          color: var(--ink-secondary);
          cursor: pointer;
          transition: background 0.18s;
        }

        .embed-close:hover {
          background: var(--surface-secondary, #f0f0f0);
        }

        :global([data-theme="dark"]) .embed-dialog {
          background: var(--bg, #111118);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        }

        :global([data-theme="dark"]) .embed-code {
          background: rgba(255, 255, 255, 0.06);
        }

        :global([data-theme="dark"]) .embed-preview-frame {
          background: rgba(255, 255, 255, 0.04);
        }
      `}</style>
    </>,
    document.body,
  );
}
