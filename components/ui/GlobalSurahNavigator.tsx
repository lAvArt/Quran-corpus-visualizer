"use client";

import { useCallback } from "react";
import { SURAH_NAMES } from "@/lib/data/surahData";

interface GlobalSurahNavigatorProps {
    currentSurahId: number;
    onSurahChange: (id: number) => void;
    theme?: "light" | "dark";
}

export default function GlobalSurahNavigator({
    currentSurahId,
    onSurahChange,
    theme = "dark",
}: GlobalSurahNavigatorProps) {
    const surah = SURAH_NAMES[currentSurahId];

    const handlePrev = useCallback(() => {
        if (currentSurahId > 1) onSurahChange(currentSurahId - 1);
    }, [currentSurahId, onSurahChange]);

    const handleNext = useCallback(() => {
        if (currentSurahId < 114) onSurahChange(currentSurahId + 1);
    }, [currentSurahId, onSurahChange]);

    if (!surah) return null;

    return (
        <div className="surah-navigator" data-theme={theme}>
            <button
                className="nav-btn"
                onClick={handlePrev}
                disabled={currentSurahId <= 1}
            >
                ←
            </button>

            <div className="surah-info">
                <span className="surah-number">{currentSurahId}</span>
                <div className="surah-names">
                    <span className="surah-name-en">{surah.name}</span>
                    <span className="surah-name-ar arabic-text">{surah.arabic}</span>
                </div>
            </div>

            <button
                className="nav-btn"
                onClick={handleNext}
                disabled={currentSurahId >= 114}
            >
                →
            </button>

            <style jsx>{`
        .surah-navigator {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(12px);
          border-radius: 99px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .nav-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: rgba(255, 255, 255, 0.1);
          color: inherit;
          border-radius: 50%;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .nav-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.1);
        }

        .nav-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .surah-info {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 140px;
          justify-content: center;
        }

        .surah-number {
          font-size: 12px;
          opacity: 0.6;
          font-weight: 500;
          width: 20px;
          text-align: center;
        }

        .surah-names {
          display: flex;
          flex-direction: column;
          align-items: center;
          line-height: 1.1;
        }

        .surah-name-en {
          font-size: 13px;
          font-weight: 600;
        }

        .surah-name-ar {
          font-size: 11px;
          opacity: 0.8;
        }

        :global([data-theme="light"]) .surah-navigator {
          background: rgba(0, 0, 0, 0.05);
          border-color: rgba(0, 0, 0, 0.05);
          color: var(--ink);
        }
        
        :global([data-theme="light"]) .nav-btn {
          background: rgba(0, 0, 0, 0.05);
        }

        :global([data-theme="dark"]) .surah-navigator {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.05);
          color: white;
        }
      `}</style>
        </div>
    );
}
