"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createWorker, Worker } from "tesseract.js";
import { useTranslations } from "next-intl";
import type { CorpusToken } from "@/lib/schema/types";
import { normalizeArabicForSearch } from "@/lib/search/indexes";

interface LiveScannerProps {
    allTokens: CorpusToken[];
    onTokenSelect: (tokenId: string) => void;
    onRootSelect?: (root: string | null) => void;
}

interface ScanResult {
    text: string;
    token?: CorpusToken;
    confidence: number;
}

export default function LiveScanner({ allTokens, onTokenSelect, onRootSelect }: LiveScannerProps) {
    const t = useTranslations("AppSidebar"); // We can just use hardcoded strings for now for the scanner UI since it's experimental

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [worker, setWorker] = useState<Worker | null>(null);
    const [status, setStatus] = useState<string>("Initializing Engine...");
    const [results, setResults] = useState<ScanResult[]>([]);

    // Initialize Scanner & Camera
    useEffect(() => {
        let active = true;
        let stream: MediaStream | null = null;

        const init = async () => {
            try {
                // 1. Ask for Camera
                setStatus("Requesting camera access...");
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment" }
                });

                if (!active) return;

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }

                // 2. Load Tesseract Worker
                setStatus("Loading Arabic OCR engine...");
                const w = await createWorker('ara');
                if (!active) {
                    await w.terminate();
                    return;
                }
                setWorker(w);
                setStatus("Ready. Point at Arabic text.");
                setIsScanning(true);
            } catch (err) {
                console.error("Scanner intialization failed:", err);
                setStatus("Failed to access camera or load engine.");
            }
        };
        init();

        return () => {
            active = false;
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            if (worker) {
                worker.terminate();
            }
        };
    }, []); // Empty dep array because we only want to load once on mount

    const processFrame = useCallback(async () => {
        if (!worker || !videoRef.current || !canvasRef.current || !isScanning) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video.videoWidth === 0) return;

        // Draw current video frame to canvas
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
            const { data } = await worker.recognize(canvas);

            if (data && data.text) {
                const words = data.text.split(/[\s\n]+/).filter(w => w.length > 2);

                const matchedTokens = words.map(word => {
                    const normalized = normalizeArabicForSearch(word);
                    // Just find the first occurrence in the corpus for demo purposes
                    const token = allTokens.find(t =>
                        normalizeArabicForSearch(t.text) === normalized ||
                        normalizeArabicForSearch(t.lemma) === normalized
                    );

                    return {
                        text: word,
                        token,
                        confidence: data.confidence
                    };
                }).filter(r => r.token); // Only keep recognized words that exist in corpus

                if (matchedTokens.length > 0) {
                    // Update results with new unique finds
                    setResults(prev => {
                        const newResults = [...prev];
                        matchedTokens.forEach(mt => {
                            if (!newResults.some(r => r.token?.id === mt.token?.id)) {
                                newResults.unshift(mt);
                            }
                        });
                        return newResults.slice(0, 10); // Keep last 10
                    });
                }
            }
        } catch (err) {
            console.error("OCR Error:", err);
        }
    }, [worker, isScanning, allTokens]);

    // Processing loop
    useEffect(() => {
        if (!isScanning) return;

        const intervalId = setInterval(() => {
            processFrame();
        }, 2000); // Process every 2 seconds

        return () => clearInterval(intervalId);
    }, [isScanning, processFrame]);

    return (
        <div className="live-scanner">
            <div className="scanner-status">
                <span className={`status-indicator ${isScanning ? 'active' : ''}`} />
                {status}
            </div>

            <div className="video-container">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="scanner-video"
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* Target overlay */}
                <div className="scanner-overlay">
                    <div className="target-box" />
                </div>
            </div>

            <div className="scanner-results">
                <h3>Detected Words</h3>
                {results.length === 0 ? (
                    <p className="no-results">Scanning for matching Arabic words...</p>
                ) : (
                    <div className="results-list">
                        {results.map((res, i) => (
                            <div
                                key={`${res.token?.id}-${i}`}
                                className="result-item"
                                onClick={() => {
                                    if (res.token) {
                                        onTokenSelect(res.token.id);
                                        if (res.token.root && onRootSelect) {
                                            onRootSelect(res.token.root);
                                        }
                                    }
                                }}
                            >
                                <span className="result-arabic">{res.text}</span>
                                <div className="result-meta">
                                    <span>{res.token?.id}</span>
                                    {res.token?.root && <span>Root: {res.token.root}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style jsx>{`
                .live-scanner {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    gap: 16px;
                }

                .scanner-status {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.8rem;
                    color: var(--ink-secondary);
                    padding: 8px 12px;
                    background: var(--bg-2);
                    border-radius: 8px;
                    border: 1px solid var(--line);
                }

                .status-indicator {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: var(--ink-muted);
                }
                
                .status-indicator.active {
                    background: var(--accent);
                    box-shadow: 0 0 8px var(--accent);
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }

                .video-container {
                    position: relative;
                    width: 100%;
                    height: 200px;
                    border-radius: 12px;
                    overflow: hidden;
                    background: #000;
                    border: 1px solid var(--line);
                }

                .scanner-video {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .scanner-overlay {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0, 0, 0, 0.2);
                    pointer-events: none;
                }

                .target-box {
                    width: 70%;
                    height: 40%;
                    border: 2px solid rgba(255, 255, 255, 0.7);
                    border-radius: 8px;
                    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.4);
                }

                .scanner-results {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    min-height: 0;
                }

                .scanner-results h3 {
                    font-size: 0.9rem;
                    margin: 0 0 8px 0;
                    color: var(--ink);
                }

                .no-results {
                    font-size: 0.85rem;
                    color: var(--ink-muted);
                    font-style: italic;
                    text-align: center;
                    padding: 24px 0;
                }

                .results-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    overflow-y: auto;
                    padding-right: 4px;
                }

                .result-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 12px;
                    background: var(--bg-1);
                    border: 1px solid var(--line);
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .result-item:hover {
                    border-color: var(--accent);
                    background: var(--bg-2);
                }

                .result-arabic {
                    font-family: var(--font-arabic, "Amiri"), "Noto Sans Arabic", serif;
                    font-size: 1.4rem;
                    direction: rtl;
                }

                .result-meta {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    font-size: 0.7rem;
                    color: var(--ink-secondary);
                }
            `}</style>
        </div>
    );
}
