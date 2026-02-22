"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createWorker, PSM, Worker } from "tesseract.js";
import type { CorpusToken } from "@/lib/schema/types";
import { normalizeArabicForSearch } from "@/lib/search/indexes";

interface LiveScannerProps {
    allTokens: CorpusToken[];
    onTokenSelect: (tokenId: string) => void;
}

interface ScanResult {
    text: string;
    token?: CorpusToken;
    confidence: number;
    matchScore?: number;
}

interface TokenIndexEntry {
    token: CorpusToken;
    textNormalized: string;
    lemmaNormalized: string;
}

const FRAME_INTERVAL_MS = 2200;
const UPSCALE_FACTOR = 2;
const MIN_WORD_CONFIDENCE = 30;
const MIN_MATCH_SCORE = 0.52;
const NON_ARABIC_MARKS_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const NON_ARABIC_LETTERS_RE = /[^\u0621-\u063A\u0641-\u064A]/g;

function computeOtsuThreshold(histogram: number[], totalPixels: number): number {
    let sumAll = 0;
    for (let i = 0; i < 256; i += 1) {
        sumAll += i * histogram[i];
    }

    let sumBackground = 0;
    let backgroundWeight = 0;
    let maxVariance = 0;
    let threshold = 145;

    for (let i = 0; i < 256; i += 1) {
        backgroundWeight += histogram[i];
        if (backgroundWeight === 0) continue;

        const foregroundWeight = totalPixels - backgroundWeight;
        if (foregroundWeight === 0) break;

        sumBackground += i * histogram[i];

        const meanBackground = sumBackground / backgroundWeight;
        const meanForeground = (sumAll - sumBackground) / foregroundWeight;
        const variance =
            backgroundWeight * foregroundWeight * (meanBackground - meanForeground) ** 2;

        if (variance > maxVariance) {
            maxVariance = variance;
            threshold = i;
        }
    }

    return threshold;
}

function preprocessForArabicOCR(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const pixelCount = width * height;
    const grayscale = new Uint8ClampedArray(pixelCount);
    const histogram = new Array<number>(256).fill(0);

    let min = 255;
    let max = 0;
    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
        const luminance = Math.round(data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722);
        grayscale[p] = luminance;
        if (luminance < min) min = luminance;
        if (luminance > max) max = luminance;
    }

    const range = Math.max(1, max - min);
    for (let p = 0; p < pixelCount; p += 1) {
        const normalized = Math.min(255, Math.max(0, Math.round(((grayscale[p] - min) * 255) / range)));
        const boosted = Math.min(255, Math.round((normalized / 255) ** 0.9 * 255));
        grayscale[p] = boosted;
        histogram[boosted] += 1;
    }

    const threshold = computeOtsuThreshold(histogram, pixelCount);

    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
        const g = grayscale[p];
        const binary = g > threshold ? 255 : 0;
        const enhanced = Math.round(g * 0.7 + binary * 0.3);
        data[i] = enhanced;
        data[i + 1] = enhanced;
        data[i + 2] = enhanced;
    }

    ctx.putImageData(imageData, 0, 0);
}

function normalizeScannedArabicWord(raw: string): string {
    return normalizeArabicForSearch(raw.normalize("NFKC"))
        .replace(NON_ARABIC_MARKS_RE, "")
        .replace(NON_ARABIC_LETTERS_RE, "");
}

function foldArabicSkeleton(value: string): string {
    return value
        .replace(/[بتثني]/g, "ب")
        .replace(/[جحخ]/g, "ح")
        .replace(/[دذ]/g, "د")
        .replace(/[رز]/g, "ر")
        .replace(/[سش]/g, "س")
        .replace(/[صض]/g, "ص")
        .replace(/[طظ]/g, "ط")
        .replace(/[عغ]/g, "ع")
        .replace(/[فق]/g, "ف");
}

function boundedLevenshtein(a: string, b: string, maxDistance: number): number {
    const aLength = a.length;
    const bLength = b.length;
    if (Math.abs(aLength - bLength) > maxDistance) return maxDistance + 1;
    if (a === b) return 0;

    let previous = new Array<number>(bLength + 1);
    let current = new Array<number>(bLength + 1);

    for (let j = 0; j <= bLength; j += 1) {
        previous[j] = j;
    }

    for (let i = 1; i <= aLength; i += 1) {
        current[0] = i;
        let rowMin = current[0];

        for (let j = 1; j <= bLength; j += 1) {
            const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
            const value = Math.min(
                previous[j] + 1,
                current[j - 1] + 1,
                previous[j - 1] + substitutionCost
            );
            current[j] = value;
            if (value < rowMin) rowMin = value;
        }

        if (rowMin > maxDistance) return maxDistance + 1;
        [previous, current] = [current, previous];
    }

    return previous[bLength];
}

export default function LiveScanner({ allTokens, onTokenSelect }: LiveScannerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const workerRef = useRef<Worker | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const isProcessingRef = useRef(false);

    const [isScanning, setIsScanning] = useState(false);
    const [worker, setWorker] = useState<Worker | null>(null);
    const [status, setStatus] = useState<string>("Initializing Engine...");
    const [results, setResults] = useState<ScanResult[]>([]);

    const matchingIndexes = useMemo(() => {
        const exactLookup = new Map<string, TokenIndexEntry[]>();
        const skeletonLookup = new Map<string, TokenIndexEntry[]>();

        const push = (map: Map<string, TokenIndexEntry[]>, key: string, entry: TokenIndexEntry) => {
            if (!key) return;
            const existing = map.get(key);
            if (existing) {
                existing.push(entry);
            } else {
                map.set(key, [entry]);
            }
        };

        for (const token of allTokens) {
            const textNormalized = normalizeArabicForSearch(token.text);
            const lemmaNormalized = normalizeArabicForSearch(token.lemma);
            const entry: TokenIndexEntry = {
                token,
                textNormalized,
                lemmaNormalized
            };

            push(exactLookup, textNormalized, entry);
            push(exactLookup, lemmaNormalized, entry);

            push(skeletonLookup, foldArabicSkeleton(textNormalized), entry);
            push(skeletonLookup, foldArabicSkeleton(lemmaNormalized), entry);
        }

        return { exactLookup, skeletonLookup };
    }, [allTokens]);

    const matchTokenForWord = useCallback((normalizedWord: string) => {
        const exact = matchingIndexes.exactLookup.get(normalizedWord);
        if (exact?.length) {
            return {
                token: exact[0].token,
                matchScore: 1
            };
        }

        const wordSkeleton = foldArabicSkeleton(normalizedWord);
        const candidates = matchingIndexes.skeletonLookup.get(wordSkeleton);
        if (!candidates?.length) return null;

        const length = normalizedWord.length;
        const maxDistance = length <= 4 ? 1 : length <= 7 ? 2 : 3;
        let best: { entry: TokenIndexEntry; distance: number; compareLength: number } | null = null;
        const seen = new Set<string>();

        for (const candidate of candidates) {
            if (seen.has(candidate.token.id)) continue;
            seen.add(candidate.token.id);

            const textDiff = Math.abs(candidate.textNormalized.length - length);
            const lemmaDiff = Math.abs(candidate.lemmaNormalized.length - length);
            if (Math.min(textDiff, lemmaDiff) > maxDistance) continue;

            const textDistance = boundedLevenshtein(
                normalizedWord,
                candidate.textNormalized,
                maxDistance
            );
            const lemmaDistance = boundedLevenshtein(
                normalizedWord,
                candidate.lemmaNormalized,
                maxDistance
            );

            const distance = Math.min(textDistance, lemmaDistance);
            if (distance > maxDistance) continue;

            const compareLength = Math.max(
                normalizedWord.length,
                distance === textDistance
                    ? candidate.textNormalized.length
                    : candidate.lemmaNormalized.length
            );

            if (!best || distance < best.distance || (distance === best.distance && compareLength < best.compareLength)) {
                best = { entry: candidate, distance, compareLength };
                if (distance === 0) break;
            }
        }

        if (!best) return null;
        const similarity = 1 - best.distance / Math.max(1, best.compareLength);
        if (similarity < MIN_MATCH_SCORE) return null;

        return {
            token: best.entry.token,
            matchScore: similarity
        };
    }, [matchingIndexes]);

    // Initialize Scanner & Camera
    useEffect(() => {
        let active = true;

        const init = async () => {
            try {
                // 1. Ask for Camera
                setStatus("Requesting camera access...");
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: "environment" },
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        frameRate: { ideal: 30, max: 30 }
                    },
                    audio: false
                });
                streamRef.current = stream;

                if (!active) return;

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }

                // 2. Load Tesseract Worker
                setStatus("Loading Arabic OCR engine...");
                const w = await createWorker("ara");
                await w.setParameters({
                    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
                    preserve_interword_spaces: "1",
                    user_defined_dpi: "300",
                    tessedit_char_blacklist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
                });

                if (!active) {
                    await w.terminate();
                    return;
                }

                workerRef.current = w;
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
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
            if (workerRef.current) {
                void workerRef.current.terminate();
                workerRef.current = null;
            }
        };
    }, []);

    const processFrame = useCallback(async () => {
        if (!worker || !videoRef.current || !canvasRef.current || !isScanning || isProcessingRef.current) {
            return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video.videoWidth === 0) return;

        // Determine target box dimensions (70% width, 40% height, centered).
        const targetWidth = Math.max(1, Math.floor(video.videoWidth * 0.7));
        const targetHeight = Math.max(1, Math.floor(video.videoHeight * 0.4));
        const startX = (video.videoWidth - targetWidth) / 2;
        const startY = (video.videoHeight - targetHeight) / 2;

        // Set canvas to an upscaled target for cleaner OCR.
        canvas.width = targetWidth * UPSCALE_FACTOR;
        canvas.height = targetHeight * UPSCALE_FACTOR;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        isProcessingRef.current = true;

        try {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.filter = "grayscale(100%) contrast(165%) brightness(108%)";
            ctx.drawImage(
                video,
                startX, startY, targetWidth, targetHeight,
                0, 0, canvas.width, canvas.height
            );
            ctx.filter = "none";
            preprocessForArabicOCR(ctx, canvas.width, canvas.height);

            const { data: ocrData } = await worker.recognize(
                canvas,
                { rotateAuto: true },
                { blocks: true }
            );

            const rawCandidates: Array<{ text: string; confidence: number }> = [];
            if (ocrData.blocks?.length) {
                ocrData.blocks.forEach(block => {
                    block.paragraphs.forEach(paragraph => {
                        paragraph.lines.forEach(line => {
                            line.words.forEach(word => {
                                rawCandidates.push({ text: word.text, confidence: word.confidence });
                            });
                        });
                    });
                });
            } else if (ocrData.text) {
                ocrData.text.split(/[\s\n]+/).forEach(word => {
                    rawCandidates.push({ text: word, confidence: ocrData.confidence });
                });
            }

            const matchedTokens: ScanResult[] = [];
            rawCandidates.forEach(candidate => {
                if (candidate.confidence < MIN_WORD_CONFIDENCE) return;

                const normalized = normalizeScannedArabicWord(candidate.text);
                if (!normalized) return;
                if (normalized.length < 2) return;

                const match = matchTokenForWord(normalized);
                if (!match) return;

                matchedTokens.push({
                    text: normalized,
                    token: match.token,
                    confidence: candidate.confidence,
                    matchScore: match.matchScore
                });
            });

            if (matchedTokens.length > 0) {
                const ayahScoreMap = new Map<string, { score: number; count: number }>();
                matchedTokens.forEach(mt => {
                    if (!mt.token) return;
                    const ayahKey = `${mt.token.sura}:${mt.token.ayah}`;
                    const scoreWeight =
                        (mt.confidence / 100) * (mt.matchScore ?? 0.6) * Math.min(1.6, mt.text.length / 4);
                    const current = ayahScoreMap.get(ayahKey);
                    if (current) {
                        current.score += scoreWeight;
                        current.count += 1;
                    } else {
                        ayahScoreMap.set(ayahKey, { score: scoreWeight, count: 1 });
                    }
                });

                let bestAyah: string | null = null;
                let bestScore = 0;
                let bestCount = 0;
                ayahScoreMap.forEach((value, key) => {
                    if (
                        value.score > bestScore ||
                        (value.score === bestScore && value.count > bestCount)
                    ) {
                        bestAyah = key;
                        bestScore = value.score;
                        bestCount = value.count;
                    }
                });

                const consensusResults = bestAyah && bestCount >= 2
                    ? matchedTokens.filter(mt => mt.token && `${mt.token.sura}:${mt.token.ayah}` === bestAyah)
                    : matchedTokens;

                setResults(prev => {
                    const newResults = [...prev];
                    consensusResults.forEach(mt => {
                        if (!newResults.some(r => r.token?.id === mt.token?.id)) {
                            newResults.unshift(mt);
                        }
                    });
                    return newResults.slice(0, 10);
                });
            }
        } catch (err) {
            console.error("OCR Error:", err);
        } finally {
            isProcessingRef.current = false;
        }
    }, [isScanning, matchTokenForWord, worker]);

    // Processing loop
    useEffect(() => {
        if (!isScanning) return;

        let cancelled = false;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const run = async () => {
            if (cancelled) return;
            await processFrame();
            if (!cancelled) {
                timeoutId = setTimeout(run, FRAME_INTERVAL_MS);
            }
        };

        void run();

        return () => {
            cancelled = true;
            if (timeoutId) clearTimeout(timeoutId);
        };
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
