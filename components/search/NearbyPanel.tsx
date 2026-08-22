"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
    calculateRootFrequencies,
    getCollocations,
    type CollocationTerm,
} from "@/lib/search/collocation";
import { foldRasmAlef, normalizeArabicForSearch } from "@/lib/search/arabicNormalize";
import { loadNameStats, type NameStatsIndex } from "@/lib/corpus/nameStatsClient";
import { loadLemmaFormStats, lookupForm, lookupLemma, type LemmaFormStats } from "@/lib/corpus/lemmaFormStatsClient";
import type { CorpusToken } from "@/lib/schema/types";

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
    /** Open an ayah reference ("6:74") in the surrounding workspace. */
    onOpenRef?: (sura: number, ayah: number) => void;
}

export default function NearbyPanel({ tokens, term, pairValue = null, isCorpusLoading, onOpenRef }: NearbyPanelProps) {
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
                            <span className="nearby-label" lang="ar" dir="rtl">{row.label}</span>
                            <span className="nearby-count">×{row.count.toLocaleString()}</span>
                            <span className="nearby-refs">
                                {row.sampleWindows.slice(0, 4).map((w) => {
                                    const [sura, ayah] = w.split(":").map(Number);
                                    return (
                                        <button
                                            key={w}
                                            type="button"
                                            className="nearby-ref"
                                            onClick={() => onOpenRef?.(sura, ayah)}
                                        >
                                            {sura}:{ayah}
                                        </button>
                                    );
                                })}
                            </span>
                            {/* PMI is kept, quietly: useful for "distinctively
                                associated", misleading as a primary sort. */}
                            <span className="nearby-pmi" title={t("pmiHint")}>{row.pmi.toFixed(1)}</span>
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
                .nearby-head { display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: flex-start; }
                .nearby-sub { margin: 2px 0 0; font-size: 0.85rem; color: var(--muted); }
                .nearby-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
                .nearby-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 0.82rem; color: var(--muted); cursor: pointer; }
                .nearby-loading, .nearby-empty { margin: 12px 0 0; font-size: 0.85rem; color: var(--muted); }
                .nearby-list { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
                .nearby-row {
                    display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 2fr) auto;
                    gap: 10px; align-items: center; padding: 7px 10px; border-radius: 10px;
                    background: var(--ui-surface); border: 1px solid var(--line);
                }
                .nearby-label { font-size: 1.05rem; }
                .nearby-count { font-variant-numeric: tabular-nums; font-weight: 600; }
                .nearby-refs { display: flex; flex-wrap: wrap; gap: 5px; }
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
