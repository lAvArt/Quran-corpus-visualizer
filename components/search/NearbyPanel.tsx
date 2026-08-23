"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
    calculateRootFrequencies,
    getCollocations,
    type CollocationTerm,
} from "@/lib/search/collocation";
import { foldRasmAlef, normalizeArabicForSearch } from "@/lib/search/arabicNormalize";
import { loadNameStats, type NameStatsIndex } from "@/lib/corpus/nameStatsClient";
import { loadLemmaFormStats, lookupForm, lookupLemma, type LemmaFormStats } from "@/lib/corpus/lemmaFormStatsClient";
import type { CorpusToken } from "@/lib/schema/types";
import { fetchOccurrencesByRefs, type OccurrenceAyah } from "@/lib/corpus/occurrencesClient";

/**
 * "What is named near this?" — collocation as a search answer rather than a graph.
 *
 * The engine already supported this (getCollocations with a distance window);
 * what was missing was a way to ask from the search surface. Anchoring is on the
 * exact WRITTEN FORM when the query is one, because that is the question people
 * actually ask: لِأَبِيهِ occurs 9 times, and "who is speaking" is a property of
 * those 9 tokens — not of the lemma أَب, which covers 117.
 *
 * Live tokens cannot be text-matched for that (token.text is font glyphs), so
 * form anchoring goes through the precomputed form index instead: it knows every
 * position the form occupies, and the engine accepts those positions directly
 * (anchorRefs). Only forms whose ref list is COMPLETE anchor this way — 91% of
 * forms; the capped high-frequency remainder falls back to lemma anchoring —
 * and a badge says which anchor is in effect rather than letting the two read
 * alike.
 *
 * "Names only" cannot use the part-of-speech tag: normalizePos() folds QAC's PN
 * into plain "N", so a loaded token cannot say whether it is a proper noun. The
 * curated name index can — it marks each entry kind "name" or "word" — and is
 * the better authority anyway, since it is the same list the rest of the search
 * treats as أعلام.
 *
 * Window width is a first-class control, not a hidden default, because it
 * changes the answer: the speaker beside لِأَبِيهِ is named in the same ayah 5
 * times out of 9, and only in a PREVIOUS ayah the other 4 times. An ayah-scoped
 * window reports إبراهيم ×4; ±10 tokens reports ×8. Neither is wrong — they
 * answer different questions — so the control says which one is on screen.
 */

type WindowChoice = "ayah" | 5 | 10;

const WINDOWS: WindowChoice[] = ["ayah", 5, 10];

export interface NearbyPanelProps {
    tokens: CorpusToken[];
    /** The user's query, used verbatim as the anchor. */
    term: string;
    /** near:X / قرب:X — restrict neighbours to this word's family. */
    pairValue?: string | null;
    isCorpusLoading: boolean;
}

export default function NearbyPanel({ tokens, term, pairValue = null, isCorpusLoading }: NearbyPanelProps) {
    const t = useTranslations("NearbySearch");
    // The window DEFAULT follows the anchor, because the two anchors ask
    // different questions with different natural scopes. A form anchor is "who
    // is around these exact tokens" — the speaker often sits in the PREVIOUS
    // ayah, so it needs a token window (±10). A family anchor is "what stands
    // out near this word" — there PMI only suppresses مِن and إِنّ when
    // frequencies are counted per ayah, so the ayah window is the one that
    // ranks خَلَقَ and كَفُور above the particles. The user's explicit pick
    // always wins; it resets with the query.
    const [windowPref, setWindowPref] = useState<WindowChoice | null>(null);
    // Default OFF: the broader "what stands out near this word" question (إنسان →
    // يئوس، كفور، نطفة…) is the general case; "who is named" narrows it.
    const [namesOnly, setNamesOnly] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [nameIdx, setNameIdx] = useState<NameStatsIndex | null>(null);
    const [drillIdx, setDrillIdx] = useState<LemmaFormStats | null>(null);

    useEffect(() => {
        let alive = true;
        loadNameStats().then((d) => alive && setNameIdx(d)).catch(() => {});
        loadLemmaFormStats().then((d) => alive && setDrillIdx(d)).catch(() => {});
        return () => { alive = false; };
    }, []);

    useEffect(() => setExpanded(false), [term, windowPref, namesOnly]);
    useEffect(() => setWindowPref(null), [term]);

    /** Explicit anchor override; "auto" resolves by the typed-form heuristic below. */
    const [anchorPref, setAnchorPref] = useState<"auto" | "form" | "lemma">("auto");
    useEffect(() => setAnchorPref("auto"), [term]);

    /** Normalized lemma keys of everything the corpus treats as a proper name. */
    const nameKeys = useMemo(() => {
        const keys = new Set<string>();
        for (const entry of Object.values(nameIdx?.names ?? {})) {
            if (entry.kind !== "name") continue;
            keys.add(entry.key);
            if (entry.lemma) keys.add(normalizeArabicForSearch(entry.lemma));
        }
        return keys;
    }, [nameIdx]);

    // One O(n) pass over the corpus, reused across every control change.
    const freq = useMemo(() => (tokens.length ? calculateRootFrequencies(tokens) : null), [tokens]);

    /**
     * Anchor kind. A query that is written somewhere in the corpus is treated as
     * a form (exact tokens); otherwise fall back to lemma, which carries the
     * engine's affix tolerance. Root anchoring is left to the root card above —
     * this panel is about the words as written.
     */
    const anchor = useMemo<{
        term: CollocationTerm;
        refs?: [number, number, number][];
        /** Both anchors resolvable — the badge becomes a switch. */
        switchable: boolean;
    } | null>(() => {
        const q = term.trim();
        if (!q || !tokens.length) return null;
        if (drillIdx) {
            const form = lookupForm(drillIdx, q);
            // Complete refs only: a capped list would silently count a subset
            // and present it with the same confidence as the whole.
            const formOk = !!form && form.refs.length >= form.c;
            const lem = form?.l ? lookupLemma(drillIdx, form.l) : lookupLemma(drillIdx, q);
            // WHICH anchor the user means, when both exist: typing the
            // dictionary form itself (انسان, which IS the lemma) asks about the
            // word everywhere — its bare spelling happens to occur once, at
            // 17:13, and answering with that one ayah is technically right and
            // practically wrong. Typing an inflected or cliticized form asks
            // about those exact tokens. Rasm folding on both sides keeps the
            // comparison stable across the dagger alif.
            const typedTheLemma =
                !!lem &&
                foldRasmAlef(normalizeArabicForSearch(q)) === foldRasmAlef(normalizeArabicForSearch(lem.d));
            const switchable = formOk && !!lem;
            const useForm =
                anchorPref === "form" ? formOk :
                anchorPref === "lemma" ? false :
                formOk && !typedTheLemma;
            if (useForm && form) {
                return { term: { kind: "form", value: q }, refs: form.refs.map(([su, ay, w]) => [su, ay, w]), switchable };
            }
            if (lem) return { term: { kind: "lemma", value: lem.d }, switchable };
        }
        return { term: { kind: "lemma", value: q }, switchable: false };
    }, [term, tokens, drillIdx, anchorPref]);

    const windowChoice: WindowChoice = windowPref ?? (anchor?.refs ? 10 : "ayah");

    const rows = useMemo(() => {
        if (!anchor || !freq) return [];
        return getCollocations(anchor.term, tokens, freq, {
            windowType: windowChoice === "ayah" ? "ayah" : "distance",
            distance: windowChoice === "ayah" ? undefined : windowChoice,
            groupBy: "lemma",
            minFrequency: 1,
            anchorRefs: anchor.refs,
            pairTerm: pairValue ? { kind: "lemma", value: pairValue } : null,
            // A pair query has ONE row and it is the result set — keep every
            // window instead of the sample strip.
            sampleCap: pairValue ? 1000 : undefined,
            // Content words only. Particles and pronouns are structure, never
            // the answer to either question this panel asks; where a corpus
            // path leaves pos untagged (everything "N") this simply keeps all.
            filter: { pos: ["N", "V", "ADJ"] },
        })
            .filter((r) => !namesOnly || nameKeys.has(normalizeArabicForSearch(r.label)))
            // Two questions, two orders. Names are sparse and every mention
            // matters, so count leads (إبراهيم ×8 before ازر ×1 — raw PMI would
            // invert them). The open list asks "what stands out", where raw
            // count surfaces مِن and إِنّ; salience = count × PMI puts خَلَقَ,
            // كَفُور and يَـُٔوس on top for إنسان, which is the expected answer.
            .sort(namesOnly
                ? (a, b) => b.count - a.count || b.pmi - a.pmi
                : (a, b) => b.count * Math.max(b.pmi, 0) - a.count * Math.max(a.pmi, 0))
            .slice(0, expanded ? 36 : 12);
    }, [anchor, freq, tokens, windowChoice, namesOnly, nameKeys, expanded, pairValue]);

    const locale = useLocale();

    /**
     * Inline ayah preview. A ref pill used to push an ayah FILTER into the
     * workspace — technically something, visibly nothing. A collocation row is
     * a claim about two words standing together; the evidence is the ayah
     * itself, so clicking the pill now opens it right here, with the previous
     * and next ayahs one tap away (the anchor's sentence often starts an ayah
     * earlier — that is the whole reason the ±N window exists).
     */
    // The row label is part of the key: several rows can cite the same ayah
    // (قَالَ and إِبْرَٰهِيم both sample 6:74), and without it one click opened
    // the same preview under every one of them.
    const [openRef, setOpenRef] = useState<{ sura: number; ayah: number; row: string } | null>(null);
    const [preview, setPreview] = useState<Record<string, OccurrenceAyah | null>>({});
    useEffect(() => setOpenRef(null), [term, pairValue]);

    const loadAyah = (sura: number, ayah: number) => {
        const key = `${sura}:${ayah}`;
        if (preview[key] !== undefined) return;
        setPreview((m) => ({ ...m, [key]: null }));
        fetchOccurrencesByRefs([[sura, ayah, 1, 1]], 1)
            .then((rows) => setPreview((m) => ({ ...m, [key]: rows[0] ?? null })))
            .catch(() => setPreview((m) => ({ ...m, [key]: null })));
    };
    const openAyah = (sura: number, ayah: number, row: string) => {
        setOpenRef({ sura, ayah, row });
        loadAyah(sura, ayah);
    };

    /** Highlight by CONTENT (the API's positions use drifting word numbers). */
    const highlightKeys = useMemo(() => {
        const keys = new Set<string>();
        const add = (v?: string | null) => {
            if (!v) return;
            const k = foldRasmAlef(normalizeArabicForSearch(v));
            if (k.length >= 2) keys.add(k);
        };
        add(term);
        add(pairValue);
        if (anchor?.term.kind === "lemma") add(anchor.term.value);
        return keys;
    }, [term, pairValue, anchor]);

    const renderAyahText = (text: string, markLabel?: string) => {
        const marks = new Set(highlightKeys);
        if (markLabel) {
            const k = foldRasmAlef(normalizeArabicForSearch(markLabel));
            if (k.length >= 2) marks.add(k);
        }
        return text.split(/\s+/).filter(Boolean).map((tok, i) => {
            // Small combining letters (U+06E5–U+06E8) are real letters in the
            // rasm (إِبْرَٰهِـۧمَ at 2:133); restore before normalizing or the
            // word can never match its key. Highlight-only — the shared
            // normalizer keys the shipped indexes.
            const restored = tok.replace(/\u06E5|\u06E6|\u06E7|\u06E8/g, (m) =>
                m === "\u06E5" ? "و" : m === "\u06E8" ? "ن" : "ي");
            const norm = foldRasmAlef(normalizeArabicForSearch(restored));
            const hit = norm.length >= 2 && [...marks].some((k) => norm === k || norm.includes(k));
            return (
                <span key={i} className={hit ? "nearby-hl" : undefined}>{tok}{" "}</span>
            );
        });
    };

    if (!anchor) return null;

    return (
        <article className="workspace-root-card" data-testid="search-nearby-panel">
            <div className="nearby-head">
                <div>
                    <p className="ui-kicker">{t("title")}</p>
                    <p className="nearby-sub">
                        {t("subtitle", { term: term.trim() })}
                        {/* Which anchor produced these numbers — exact tokens or
                            the lemma family. The two can differ by an order of
                            magnitude, so it must be said — and where both are
                            available, chosen. */}
                        {pairValue && (
                            <span className="nearby-anchor-badge">{t("pairedWith", { pair: pairValue })}</span>
                        )}
                        {anchor?.switchable ? (
                            <button
                                type="button"
                                className="nearby-anchor-badge nearby-anchor-toggle"
                                title={t("anchorSwitchHint")}
                                onClick={() => setAnchorPref(anchor.refs ? "lemma" : "form")}
                            >
                                {anchor.refs ? t("anchorForm") : t("anchorLemma")} ⇄
                            </button>
                        ) : (
                            <span className="nearby-anchor-badge">
                                {anchor?.refs ? t("anchorForm") : t("anchorLemma")}
                            </span>
                        )}
                    </p>
                </div>
                <div className="nearby-controls">
                    <div className="header-button-group" role="group" aria-label={t("windowLabel")}>
                        {WINDOWS.map((w) => (
                            <button
                                key={String(w)}
                                type="button"
                                className={`control-pill-btn ${windowChoice === w ? "active" : ""}`}
                                onClick={() => setWindowPref(w)}
                            >
                                {w === "ayah" ? t("windowAyah") : t("windowTokens", { n: w })}
                            </button>
                        ))}
                    </div>
                    <label className="nearby-toggle">
                        <input
                            type="checkbox"
                            checked={namesOnly}
                            onChange={(e) => setNamesOnly(e.target.checked)}
                        />
                        <span>{t("namesOnly")}</span>
                    </label>
                </div>
            </div>

            {isCorpusLoading && (
                <p className="nearby-loading" role="status">{t("stillLoading")}</p>
            )}

            {rows.length === 0 ? (
                <p className="nearby-empty">{t("empty")}</p>
            ) : (
                <>
                <ul className="nearby-list">
                    {rows.map((row) => (
                        <li key={row.label} className="nearby-row">
                            <div className="nearby-row-head">
                                <span className="nearby-label" lang="ar" dir="rtl">{row.label}</span>
                                <span className="nearby-count">×{row.count.toLocaleString()}</span>
                                {/* PMI is kept, quietly: useful for "distinctively
                                    associated", misleading as a primary sort. */}
                                <span className="nearby-pmi" title={t("pmiHint")}>{row.pmi.toFixed(1)}</span>
                            </div>
                            <div className="nearby-refs">
                                {(pairValue ? row.sampleWindows : row.sampleWindows.slice(0, 6)).map((w) => {
                                    const [sura, ayah] = w.split(":").map(Number);
                                    const active = openRef?.row === row.label && openRef?.sura === sura && openRef?.ayah === ayah;
                                    return (
                                        <button
                                            key={w}
                                            type="button"
                                            className={`nearby-ref ${active ? "is-open" : ""}`}
                                            aria-expanded={active}
                                            onClick={() => (active ? setOpenRef(null) : openAyah(sura, ayah, row.label))}
                                        >
                                            {sura}:{ayah}
                                        </button>
                                    );
                                })}
                            </div>
                            {openRef?.row === row.label && (
                                <div className="nearby-preview" dir="rtl">
                                    {(() => {
                                        const key = `${openRef.sura}:${openRef.ayah}`;
                                        const ay = preview[key];
                                        if (!ay) {
                                            return <p className="nearby-preview-wait">{t("previewLoading")}</p>;
                                        }
                                        return (
                                            <>
                                                <p className="nearby-preview-ar" lang="ar">{renderAyahText(ay.text, row.label)}</p>
                                                <div className="nearby-preview-foot" dir="ltr">
                                                    <span className="nearby-preview-ref">{openRef.sura}:{openRef.ayah}</span>
                                                    <span className="nearby-preview-nav">
                                                        {openRef.ayah > 1 && (
                                                            <button type="button" className="nearby-ref" onClick={() => openAyah(openRef.sura, openRef.ayah - 1, row.label)}>
                                                                {t("prevAyah")}
                                                            </button>
                                                        )}
                                                        <button type="button" className="nearby-ref" onClick={() => openAyah(openRef.sura, openRef.ayah + 1, row.label)}>
                                                            {t("nextAyah")}
                                                        </button>
                                                        <a
                                                            className="nearby-ref nearby-open-graph"
                                                            href={`/${locale}?viz=radial-sura&surah=${openRef.sura}&ayah=${openRef.ayah}`}
                                                        >
                                                            {t("openInObservatory")}
                                                        </a>
                                                    </span>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
                {!expanded && rows.length >= 12 && (
                    <button type="button" className="nearby-more" onClick={() => setExpanded(true)}>
                        {t("showMore")}
                    </button>
                )}
                </>
            )}

            <style jsx>{`
                .nearby-head { display: flex; flex-wrap: wrap; gap: 12px 16px; justify-content: space-between; align-items: flex-start; }
                .nearby-controls { min-width: 0; }
                .nearby-toggle { white-space: nowrap; }
                .nearby-sub { margin: 2px 0 0; font-size: 0.85rem; color: var(--muted); }
                .nearby-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
                .nearby-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 0.82rem; color: var(--muted); cursor: pointer; }
                .nearby-loading, .nearby-empty { margin: 12px 0 0; font-size: 0.85rem; color: var(--muted); }
                .nearby-list { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
                .nearby-row {
                    display: flex; flex-direction: column; gap: 7px;
                    padding: 10px 12px; border-radius: 10px;
                    background: var(--ui-surface); border: 1px solid var(--line);
                }
                .nearby-row-head { display: flex; align-items: baseline; gap: 10px; }
                .nearby-label { font-size: 1.1rem; }
                .nearby-count { font-variant-numeric: tabular-nums; font-weight: 600; }
                .nearby-row-head .nearby-pmi { margin-inline-start: auto; }
                .nearby-refs { display: flex; flex-wrap: wrap; gap: 5px; }
                .nearby-ref.is-open { color: var(--fg); border-color: var(--accent); }
                .nearby-preview {
                    margin-top: 4px; padding: 12px 14px; border-radius: 10px;
                    background: color-mix(in srgb, var(--ui-surface) 55%, transparent);
                    border: 1px dashed var(--line);
                }
                .nearby-preview-ar { margin: 0; font-size: 1.35rem; line-height: 2.3; }
                .nearby-hl { color: var(--accent); font-weight: 700; }
                .nearby-preview-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
                .nearby-preview-ref { font-size: 0.78rem; color: var(--muted); font-variant-numeric: tabular-nums; }
                .nearby-preview-nav { display: flex; gap: 6px; flex-wrap: wrap; }
                .nearby-preview-wait { margin: 0; font-size: 0.82rem; color: var(--muted); }
                .nearby-open-graph { text-decoration: none; }
                .nearby-ref {
                    padding: 2px 7px; border-radius: 999px; cursor: pointer; font-size: 0.75rem;
                    font-variant-numeric: tabular-nums; background: transparent;
                    border: 1px solid var(--line); color: var(--muted);
                }
                .nearby-ref:hover { color: var(--fg); border-color: var(--accent); }
                .nearby-pmi { font-size: 0.72rem; color: var(--muted); font-variant-numeric: tabular-nums; }
                .nearby-anchor-badge {
                    margin-inline-start: 8px; padding: 1px 8px; border-radius: 999px;
                    font-size: 0.7rem; border: 1px solid var(--line); color: var(--muted);
                }
                .nearby-anchor-toggle { cursor: pointer; background: transparent; }
                .nearby-anchor-toggle:hover { color: var(--fg); border-color: var(--accent); }
                .nearby-more {
                    margin-top: 10px; align-self: center; padding: 6px 16px; border-radius: 999px;
                    cursor: pointer; font-size: 0.8rem; background: transparent;
                    border: 1px solid var(--line); color: var(--muted);
                }
                .nearby-more:hover { color: var(--fg); border-color: var(--accent); }
            `}</style>
        </article>
    );
}
