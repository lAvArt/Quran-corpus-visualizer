"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import { SURAH_NAMES } from "@/lib/data/surahData";
import { ROOT_GLOSSES_AR } from "@/lib/data/rootGlossesAr";
import {
  loadRootStats,
  lookupRoot,
  rootOfTheDay,
  type RootStat,
  type RootStatsIndex,
  type ExampleVerse,
} from "@/lib/corpus/rootStatsClient";

// Each root is tinted by its dominant part of speech (V2 POS spectrum).
const POS_COLOR: Record<string, string> = {
  N: "#E8924A",
  V: "#D06A86",
  ADJ: "#DD6A47",
  PRON: "#56A697",
  P: "#E6C24E",
};
const rootColor = (s: RootStat): string => POS_COLOR[s.pos?.[0]?.[0] ?? "N"] ?? "#E8924A";

interface ResolvedGloss {
  text: string;
  /** True when `text` is a curated Arabic sense (renders rtl); false when
   *  it's the corpus's English gloss (renders ltr, as it always has). */
  isAr: boolean;
}

/**
 * Resolve a root's display gloss. In the `ar` locale, prefer the curated
 * classical Arabic sense (`lib/data/rootGlossesAr.ts`, corpus data — not
 * i18n copy) over the English corpus gloss, so the landing page reads as
 * Arabic rather than mixing in ltr English fragments. Roots outside that
 * curated 48-root set — and every root in non-`ar` locales — keep falling
 * back to the plain English gloss, exactly as before.
 */
function resolveGloss(locale: string, bare: string, englishGloss: string | null | undefined): ResolvedGloss | null {
  if (locale === "ar") {
    const ar = ROOT_GLOSSES_AR[bare];
    if (ar) return { text: ar, isAr: true };
  }
  return englishGloss ? { text: englishGloss, isAr: false } : null;
}

/** Locale-aware sūrah name — Arabic script in `ar`, transliteration otherwise. */
function useSurahName() {
  const locale = useLocale();
  return (id: number): string => {
    const s = SURAH_NAMES[id];
    if (!s) return `Sūrah ${id}`;
    return locale === "ar" ? s.arabic : s.name;
  };
}

/** 114-bar per-sūrah occurrence histogram. */
function SurahStrip({ hist, color, height = 84 }: { hist: number[]; color: string; height?: number }) {
  const [hover, setHover] = useState<{ sura: number; count: number } | null>(null);
  const surahName = useSurahName();
  const W = 720;
  const H = height;
  const n = 114;
  const gap = W / n;
  const max = Math.max(1, ...hist);
  return (
    <div className="mhome-strip">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
        <line x1={0} y1={H - 0.5} x2={W} y2={H - 0.5} style={{ stroke: "rgba(var(--mh-ink-rgb), 0.12)" }} strokeWidth={1} />
        {hist.map((c, i) => {
          if (!c) return null;
          const v = c / max;
          const bh = 3 + v * (H - 12);
          const x = i * gap + gap * 0.18;
          const faint = v <= 0.26;
          const isHover = hover?.sura === i + 1;
          return (
            <rect
              key={i}
              x={x}
              y={H - bh}
              width={Math.max(1.4, gap * 0.6)}
              height={bh}
              rx={1}
              style={{ fill: isHover || !faint ? color : "rgba(var(--mh-ink-rgb), 0.18)" }}
              opacity={isHover ? 1 : v > 0.6 ? 1 : faint ? 1 : 0.55}
            />
          );
        })}
        {/* full-height hover targets so thin bars are easy to catch */}
        {hist.map((c, i) =>
          c ? (
            <rect
              key={`h${i}`}
              x={i * gap}
              y={0}
              width={gap}
              height={H}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHover({ sura: i + 1, count: c })}
              onMouseLeave={() => setHover((h) => (h?.sura === i + 1 ? null : h))}
            />
          ) : null
        )}
      </svg>
      {hover && (
        <div className="mhome-strip-tip" style={{ left: `clamp(70px, ${((hover.sura - 0.5) / n) * 100}%, calc(100% - 70px))` }}>
          <span className="mhome-strip-tip-name">{surahName(hover.sura)}</span>
          <span className="mhome-strip-tip-count" style={{ color }}>
            {hover.count}×
          </span>
        </div>
      )}
    </div>
  );
}

export default function MinimalHome() {
  const t = useTranslations("Home");
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "en";

  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [raised, setRaised] = useState(false);
  const [idx, setIdx] = useState<RootStatsIndex | null>(null);
  // Featured root is stable for the whole local calendar day — same root all
  // day, changing at local midnight — not per session/reload. This is a plain
  // integer day count (for `idx.featured[epochDay % length]`), not a PRNG
  // seed, so it doesn't reuse lib/quiz's date-seed convention (dailyPuzzle.ts
  // / personalizedQuiz.ts hash a UTC-calendar-day string into a mulberry32
  // seed to shuffle a shared, same-for-everyone quiz); that's a different
  // shape of value for a different purpose. Computed once on mount — cheap,
  // and the day boundary shifting under a long-lived tab is a non-issue here.
  const [epochDay] = useState(() => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000));

  useEffect(() => {
    let on = true;
    loadRootStats()
      .then((d) => on && setIdx(d))
      .catch(() => {});
    return () => {
      on = false;
    };
  }, []);

  // Suppress the global site chrome (footer) for a calm, minimal landing.
  useEffect(() => {
    document.documentElement.classList.add("mhome-active");
    return () => document.documentElement.classList.remove("mhome-active");
  }, []);

  // Debounce the query that drives the panel — the view settles once you pause,
  // instead of flickering result/no-match on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDq(q), 200);
    return () => clearTimeout(timer);
  }, [q]);

  // The search bar rides up as soon as it holds text, and lingers a few seconds
  // after being emptied before settling back down (no abrupt drop).
  useEffect(() => {
    if (q.trim().length > 0) {
      setRaised(true);
      return;
    }
    const timer = setTimeout(() => setRaised(false), 2500);
    return () => clearTimeout(timer);
  }, [q]);

  // History guard: pressing Back (browser button / shortcut, or the panel's Back)
  // returns to the resting home instead of leaving the site.
  const searchGuardRef = useRef(false);
  useEffect(() => {
    if (q.trim().length > 0 && !searchGuardRef.current) {
      searchGuardRef.current = true;
      window.history.pushState({ mhomeSearch: true }, "");
    }
  }, [q]);
  useEffect(() => {
    const onPop = () => {
      if (searchGuardRef.current) {
        searchGuardRef.current = false;
        setQ("");
        setDq("");
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Deliberate picks (chips / today / suggestions) resolve immediately.
  const pick = useCallback((v: string) => {
    setQ(v);
    setDq(v);
  }, []);

  const result = useMemo(() => (idx && dq.trim() ? lookupRoot(idx, dq) : null), [idx, dq]);
  const today = useMemo(() => (idx ? rootOfTheDay(idx, epochDay) : null), [idx, epochDay]);
  const todayGloss = useMemo(() => (today ? resolveGloss(locale, today.bare, today.gloss) : null), [today, locale]);
  const chips = useMemo(() => (idx ? idx.featured.slice(0, 6).map((b) => idx.roots[b]).filter(Boolean) : []), [idx]);
  const suggestions = useMemo(() => (idx ? idx.featured.slice(0, 3).map((b) => idx.roots[b]).filter(Boolean) : []), [idx]);

  const hasQuery = dq.trim().length > 0;
  const noMatch = hasQuery && !!idx && !result;

  const enterApp = useCallback(
    (root?: string, viz = "root-network", surah?: number) => {
      const sp = new URLSearchParams({ viz });
      if (root) {
        sp.set("root", root);
        // First contact from home lands calm: dock collapsed, drawer closed,
        // focused constellation only — chrome reveals as the user reaches
        // for it (see AppShell's deep-link hydration).
        sp.set("entry", "calm");
      }
      // Surah-scoped views should land where the root actually occurs.
      if (surah) sp.set("surah", String(surah));
      router.push(`/${locale}?${sp.toString()}`);
    },
    [locale, router]
  );

  const enterAyah = useCallback(
    (s: number, a: number, w: number, root: string) => {
      const sp = new URLSearchParams({
        viz: "radial-sura",
        surah: String(s),
        ayah: String(a),
        token: `${s}:${a}:${w}`,
        root,
      });
      router.push(`/${locale}?${sp.toString()}`);
    },
    [locale, router]
  );

  return (
    <div className={`mhome ${result ? "has-result" : ""}`}>
      <div className="mhome-atmos" aria-hidden="true" />

      {/* corner mark + lang/skip — standard logo affordance: click returns to
          the resting home state (clears any live search) */}
      <button
        type="button"
        className="mhome-mark"
        onClick={() => {
          setQ("");
          setDq("");
          setRaised(false);
        }}
        aria-label="Quranic Linguistics Observatory"
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "inherit", font: "inherit" }}
      >
        <span className="mhome-glyph">
          {/* Same mark as the observatory TopBar so the brand reads as one
              site across surfaces. */}
          <Image src="/favicon.svg" alt="" width={22} height={22} />
        </span>
        <span className="mhome-wordmark">
          Quranic Linguistics
          <br />
          Observatory
        </span>
      </button>
      <div className="mhome-topright">
        <div className="mhome-lang">
          <LanguageSwitcher />
        </div>
        <button type="button" className="mhome-skip" onClick={() => enterApp(undefined, "radial-sura")}>
          {t("skipToApp")}
        </button>
      </div>

      <div className={`mhome-stack ${raised ? "is-active" : ""}`}>
        <h1 className={`mhome-headline ${hasQuery ? "is-hidden" : ""}`}>{t("headline")}</h1>

        {/* search box */}
        <div className="mhome-search">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.5" y2="16.5" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              // Enter = resolve now (skip the debounce); Escape = clear.
              if (e.key === "Enter") setDq(q);
              else if (e.key === "Escape") {
                setQ("");
                setDq("");
              }
            }}
            placeholder={t("placeholder")}
            aria-label={t("eyebrow")}
            autoComplete="off"
            spellCheck={false}
          />
          {result ? (
            <span className="mhome-matched">
              <span className="mhome-match-dot" style={{ background: rootColor(result) }} />
              {t("matched", { root: result.root })}
            </span>
          ) : (
            <kbd className="mhome-enter">{t("enterHint")} ⏎</kbd>
          )}
        </div>

        {/* reveal zone */}
        <div className="mhome-reveal">
          {result ? (
            <ResultPanel stat={result} t={t} onExplore={enterApp} onBack={() => window.history.back()} />
          ) : noMatch ? (
            <div className="mhome-nomatch">
              <p>{t("noMatch", { q: q.trim() })}</p>
              <div className="mhome-chips">
                {suggestions.map((r) => {
                  const g = resolveGloss(locale, r.bare, r.gloss);
                  return (
                    <button key={r.bare} type="button" className="mhome-chip is-suggest" onClick={() => pick(r.bare)}>
                      <span dir="rtl" lang="ar" className="mhome-chip-ar">
                        {r.root}
                      </span>
                      <span
                        className={g?.isAr ? "mhome-gloss-ar" : undefined}
                        dir={g?.isAr ? "rtl" : undefined}
                        lang={g?.isAr ? "ar" : undefined}
                      >
                        {g?.text.split(/[/·]/)[0].trim()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mhome-resting">
              {/* Common roots — right beneath the search bar. */}
              <div className="mhome-chips">
                {chips.map((r) => {
                  const g = resolveGloss(locale, r.bare, r.gloss);
                  return (
                    <button key={r.bare} type="button" className="mhome-chip" onClick={() => pick(r.bare)}>
                      <span dir="rtl" lang="ar" className="mhome-chip-ar">
                        {r.root}
                      </span>
                      {g && (
                        <span
                          className={`mhome-chip-gloss ${g.isAr ? "mhome-gloss-ar" : ""}`}
                          dir={g.isAr ? "rtl" : undefined}
                          lang={g.isAr ? "ar" : undefined}
                        >
                          {g.text.split(/[/·]/)[0].trim()}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Today's root — editorial, uncontained, with a verse carousel. */}
              {today && (
                <section className="mhome-today" aria-label={t("todaysRoot")}>
                  <div className="mhome-today-head">
                    <span className="mhome-today-eyebrow">{t("todaysRoot")}</span>
                    <button type="button" className="mhome-today-all" onClick={() => pick(today.bare)}>
                      {t("seeAll")}
                    </button>
                  </div>
                  <div className="mhome-today-masthead">
                    <div className="mhome-today-id">
                      <span dir="rtl" lang="ar" className="mhome-today-ar" style={{ color: rootColor(today) }}>
                        {today.root}
                      </span>
                      <div className="mhome-today-idmeta">
                        {locale !== "ar" && <span className="mhome-today-translit">{today.translit}</span>}
                        {todayGloss && (
                          <span
                            className={`mhome-today-gloss ${todayGloss.isAr ? "mhome-gloss-ar" : ""}`}
                            dir={todayGloss.isAr ? "rtl" : "ltr"}
                            lang={todayGloss.isAr ? "ar" : undefined}
                          >
                            “{todayGloss.text}”
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mhome-today-stats">
                      <div className="mhome-today-stat">
                        <span className="mhome-today-stat-n" style={{ color: rootColor(today) }}>
                          {today.count.toLocaleString()}
                        </span>
                        <span className="mhome-today-stat-l">{t("statOccurrences")}</span>
                      </div>
                      <div className="mhome-today-stat">
                        <span className="mhome-today-stat-n">
                          {today.surahs}
                          <span className="mhome-today-stat-of"> / 114</span>
                        </span>
                        <span className="mhome-today-stat-l">{t("statSurahs")}</span>
                      </div>
                    </div>
                  </div>
                  {today.examples && today.examples.length > 0 && (
                    <VerseCarousel
                      examples={today.examples}
                      color={rootColor(today)}
                      rootBare={today.bare}
                      glossOf={(r) => resolveGloss(locale, r, idx?.roots[r]?.gloss)}
                      onOpenGraph={(ex) => enterAyah(ex.s, ex.a, ex.w, today.bare)}
                    />
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx>{styles}</style>
    </div>
  );
}

function ResultPanel({
  stat,
  t,
  onExplore,
  onBack,
}: {
  stat: RootStat;
  t: ReturnType<typeof useTranslations>;
  onExplore: (root?: string, viz?: string, surah?: number) => void;
  onBack: () => void;
}) {
  const color = rootColor(stat);
  const surahName = useSurahName();
  const locale = useLocale();
  const resultGloss = resolveGloss(locale, stat.bare, stat.gloss);
  const maxTop = Math.max(1, ...stat.top.map((x) => x[1]));
  return (
    <div className="mhome-result">
      <button type="button" className="mhome-back" onClick={onBack}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        {t("back")}
      </button>
      <div className="mhome-result-head">
        <div className="mhome-count">
          {stat.count.toLocaleString()}
        </div>
        <div className="mhome-count-lab">
          <div className="mhome-occ">{t("occurrences")}</div>
          <div className="mhome-ident">
            <span dir="rtl" lang="ar" className="mhome-ident-ar" style={{ color }}>
              {stat.root}
            </span>
            {locale !== "ar" && <span className="mhome-ident-tr">{stat.translit}</span>}
            {resultGloss && (
              <span
                className={`mhome-ident-gl ${resultGloss.isAr ? "mhome-gloss-ar" : ""}`}
                dir={resultGloss.isAr ? "rtl" : "ltr"}
                lang={resultGloss.isAr ? "ar" : undefined}
              >
                “{resultGloss.text}”
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mhome-stats">
        <div className="mhome-stat">
          <span className="mhome-stat-n">
            {stat.surahs}
            <span className="mhome-stat-of"> / 114</span>
          </span>
          <span className="mhome-stat-l">{t("statSurahs")}</span>
        </div>
        <div className="mhome-stat">
          <span className="mhome-stat-n">{stat.verses.toLocaleString()}</span>
          <span className="mhome-stat-l">{t("statVerses")}</span>
        </div>
        <div className="mhome-stat">
          <span className="mhome-stat-n">{stat.forms}</span>
          <span className="mhome-stat-l">{t("statForms")}</span>
        </div>
        {stat.first && (
          <div className="mhome-stat">
            <span className="mhome-stat-n mhome-stat-ref">{surahName(stat.first.sura)}</span>
            <span className="mhome-stat-l">
              {t("statFirst")} · {stat.first.sura}:{stat.first.ayah}
            </span>
          </div>
        )}
      </div>

      <div className="mhome-where">
        <span className="mhome-where-lab">{t("whereLabel")}</span>
        <span className="mhome-where-of">{t("ofSurahs", { n: stat.surahs })}</span>
      </div>
      <SurahStrip hist={stat.hist} color={color} height={74} />
      {/* The SVG bars always run sūrah 1 → 114 left-to-right, so the axis
          labels must too — even in RTL. */}
      <div className="mhome-ticks" dir="ltr">
        {["1", "30", "60", "90", "114"].map((tk) => (
          <span key={tk}>{tk}</span>
        ))}
      </div>

      <div className="mhome-top">
        {stat.top.map(([sura, c]) => (
          <div key={sura} className="mhome-top-chip">
            <span className="mhome-top-name">{surahName(sura)}</span>
            <span className="mhome-top-bar">
              <span style={{ width: `${Math.round((c / maxTop) * 100)}%`, background: color }} />
            </span>
            <span className="mhome-top-c" style={{ color }}>
              {c}×
            </span>
          </div>
        ))}
      </div>

      <div className="mhome-ctas">
        {/* Primary lands on the radial surah view — one surah, the root's
            words in context — the gentlest first graph; the network is the
            explicit next step up in density. Scope to the SAME surah the
            home preview showed (the root's first occurrence, which is where
            the verse carousel starts) rather than its highest-frequency
            surah, so the view the user opens matches the verse they saw. */}
        <button type="button" className="mhome-cta-p" onClick={() => onExplore(stat.bare, "radial-sura", stat.first?.sura ?? stat.top[0]?.[0])}>
          {t("exploreRoot")} <span aria-hidden="true">→</span>
        </button>
        <div className="mhome-ctas-sub">
          <button type="button" className="mhome-cta-s" onClick={() => onExplore(stat.bare, "root-network")}>
            {t("seeNetwork")}
          </button>
          <button type="button" className="mhome-cta-g" onClick={() => onExplore(stat.bare, "sankey-flow", stat.top[0]?.[0])}>
            {t("compareForms", { n: stat.forms })}
          </button>
        </div>
      </div>
    </div>
  );
}

/** One ayah at a time: auto-advancing, dots, swipe. Click to expand word-by-word. */
function VerseCarousel({
  examples,
  color,
  rootBare,
  glossOf,
  onOpenGraph,
}: {
  examples: ExampleVerse[];
  color: string;
  rootBare: string;
  glossOf: (root: string) => ResolvedGloss | null;
  onOpenGraph: (ex: ExampleVerse) => void;
}) {
  const t = useTranslations("Home");
  const surahName = useSurahName();
  const isRtl = useLocale() === "ar";
  const n = examples.length;
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const [open, setOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const go = useCallback(
    (i: number, d: number) => {
      setDir(d);
      setIdx(((i % n) + n) % n);
    },
    [n]
  );

  // Auto-advance every ~5.5s unless paused (hover / swipe), expanded, or the
  // user prefers reduced motion.
  useEffect(() => {
    if (paused || open || n <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setTimeout(() => {
      setDir(1);
      setIdx((i) => (i + 1) % n);
    }, 5500);
    return () => clearTimeout(timer);
  }, [idx, paused, open, n]);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
    setPaused(true);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    setPaused(false);
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      // "Next" follows the reading direction: swipe left in LTR, right in RTL.
      const forward = isRtl ? dx > 0 : dx < 0;
      if (forward) go(idx + 1, 1);
      else go(idx - 1, -1);
    }
  };

  const ex = examples[idx];

  return (
    <div className="mhome-carousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="mhome-carousel-viewport" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <button
          key={idx}
          type="button"
          className={`mhome-verse ${dir >= 0 ? "is-next" : "is-prev"} ${open ? "is-open" : ""}`}
          onClick={() => setOpen((o) => !o)}
          title={`${surahName(ex.s)} ${ex.s}:${ex.a}`}
          aria-expanded={open}
        >
          <p dir="rtl" lang="ar" className="mhome-verse-ar">
            {ex.words.map((w, j) => (
              <span
                key={j}
                className={w.root === rootBare ? "mhome-verse-hl" : undefined}
                style={w.root === rootBare ? { color } : undefined}
              >
                {w.t}{" "}
              </span>
            ))}
          </p>
          <span className="mhome-verse-ref">
            <span className="mhome-verse-name">{surahName(ex.s)}</span>
            <span className="mhome-verse-num">
              {ex.s}:{ex.a}
            </span>
          </span>
        </button>
      </div>

      {open && (
        <div className="mhome-breakdown">
          <div className="mhome-bd-head">
            <span className="mhome-bd-eyebrow">{t("wordByWord")}</span>
            <button type="button" className="mhome-bd-close" onClick={() => setOpen(false)} aria-label={t("closeVerse")}>
              ×
            </button>
          </div>
          <div className="mhome-bd-words">
            {ex.words
              .filter((w) => w.root)
              .map((w, j) => {
                const gloss = glossOf(w.root);
                return (
                  <div key={j} className={`mhome-bd-word ${w.root === rootBare ? "is-root" : ""}`}>
                    <span dir="rtl" lang="ar" className="mhome-bd-surface">
                      {w.t}
                    </span>
                    <span className="mhome-bd-meta">
                      <span dir="rtl" lang="ar" className="mhome-bd-root" style={{ color: POS_COLOR[w.pos] ?? "#E8924A" }}>
                        {Array.from(w.root).join("-")}
                      </span>
                      <span className="mhome-bd-pos">{t(`pos.${w.pos}`)}</span>
                      {gloss && (
                        <span
                          className={`mhome-bd-gloss ${gloss.isAr ? "mhome-gloss-ar" : ""}`}
                          dir={gloss.isAr ? "rtl" : undefined}
                          lang={gloss.isAr ? "ar" : undefined}
                        >
                          {gloss.text}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
          </div>
          <button type="button" className="mhome-bd-open" onClick={() => onOpenGraph(ex)}>
            {t("openInGraphs")} <span aria-hidden="true">→</span>
          </button>
        </div>
      )}

      {n > 1 && (
        <div className="mhome-dots" role="tablist" aria-label="Verses">
          {examples.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={`Verse ${i + 1} of ${n}`}
              className={`mhome-dot ${i === idx ? "is-active" : ""}`}
              style={i === idx ? { background: color } : undefined}
              onClick={() => go(i, i > idx ? 1 : -1)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const styles = `
  .mhome {
    /* ── Component palette ─────────────────────────────────────────────
       Scoped custom properties; the defaults below are the dark
       "slate-teal" values (must stay pixel-identical to the original
       hardcoded palette). A light "reading mode" override follows.
       POS / root hues stay fixed in both themes: color is data. */
    --mh-canvas: #0E161A;
    --mh-panel: #142026;
    --mh-panel-rgb: 20, 32, 38;
    --mh-raised: #1C2A31;
    --mh-card-rgb: 28, 42, 49;
    --mh-hairline: rgba(198, 222, 230, 0.08);
    --mh-hairline-soft: rgba(198, 222, 230, 0.07);
    --mh-hairline-strong: rgba(198, 222, 230, 0.14);
    --mh-btn-hairline: rgba(237, 225, 209, 0.14);
    --mh-search-border: rgba(251, 234, 210, 0.18);
    --mh-ink: #ECE4D8;
    --mh-ink-rgb: 236, 228, 216;
    --mh-ink-72: rgba(236, 228, 216, 0.7);
    --mh-ink-55: rgba(236, 228, 216, 0.55);
    --mh-ink-hi: #FBEAD2;
    --mh-ink-hi-rgb: 251, 234, 210;
    --mh-accent: #f0b074;
    --mh-accent-rgb: 232, 146, 74;
    --mh-accent-soft: rgba(232, 146, 74, 0.08);
    --mh-accent-border: rgba(232, 146, 74, 0.4);
    --mh-glow: rgba(232, 146, 74, 0.28);
    --mh-cta-bg: #E8924A;
    --mh-cta-ink: #2A1606;
    --mh-count-glow: rgba(251, 234, 210, 0.22);
    --mh-shadow-strong: rgba(0, 0, 0, 0.45);
    --mh-atmos-2: rgba(142, 132, 204, 0.05);

    position: fixed;
    inset: 0;
    background: var(--mh-canvas);
    color: var(--mh-ink);
    font-family: 'Space Grotesk', system-ui, sans-serif;
    overflow-y: auto;
    overflow-x: hidden;
  }
  /* Light "reading mode" — Observatory V3 parchment palette.
     NB: this stylesheet is injected as plain (untransformed) CSS, so the
     theme hook must be a plain selector — :global() would be dropped by
     the browser as an invalid pseudo-class. */
  [data-theme="light"] .mhome {
    --mh-canvas: #F7F3EA;
    --mh-panel: #FFFFFF;
    --mh-panel-rgb: 255, 255, 255;
    --mh-raised: #EFE6D6;
    --mh-card-rgb: 255, 255, 255;
    --mh-hairline: rgba(31, 28, 25, 0.12);
    --mh-hairline-soft: rgba(31, 28, 25, 0.1);
    --mh-hairline-strong: rgba(31, 28, 25, 0.18);
    --mh-btn-hairline: rgba(31, 28, 25, 0.18);
    --mh-search-border: rgba(31, 28, 25, 0.16);
    --mh-ink: #1F1C19;
    --mh-ink-rgb: 31, 28, 25;
    --mh-ink-72: rgba(31, 28, 25, 0.7);
    --mh-ink-55: rgba(31, 28, 25, 0.55);
    --mh-ink-hi: #1F1C19;
    --mh-ink-hi-rgb: 31, 28, 25;
    /* Burnt amber (B5571F family, darkened a touch for AA on parchment). */
    --mh-accent: #A9531B;
    --mh-accent-rgb: 181, 87, 31;
    --mh-accent-soft: rgba(181, 87, 31, 0.1);
    --mh-accent-border: rgba(181, 87, 31, 0.45);
    --mh-glow: rgba(181, 87, 31, 0.16);
    --mh-cta-bg: #B5571F;
    --mh-cta-ink: #FFFFFF;
    --mh-count-glow: rgba(181, 87, 31, 0.14);
    --mh-shadow-strong: rgba(31, 28, 25, 0.14);
    --mh-atmos-2: rgba(142, 132, 204, 0.07);
  }
  /* Root/POS "data colors" (rootColor()/POS_COLOR) are tuned for the dark
     slate-teal canvas and fall below text contrast on parchment (e.g. amber
     #E8924A ≈ 2.2:1). A brightness/saturate filter darkens the rendered
     glyphs enough to read while preserving each color's hue — "color is
     data" still holds, only luminance shifts. Two strengths: large display
     glyphs only need to clear the 3:1 large-text minimum; small labels and
     counts must clear the stricter 4.5:1 body-text minimum, so they get a
     deeper filter. Graphics (bars, dots, chip fills) are untouched — this
     only ever targets colored TEXT. */
  [data-theme="light"] .mhome .mhome-today-ar,
  [data-theme="light"] .mhome .mhome-today-stat-n,
  [data-theme="light"] .mhome .mhome-ident-ar,
  [data-theme="light"] .mhome .mhome-verse-hl {
    filter: brightness(0.62) saturate(1.15);
  }
  [data-theme="light"] .mhome .mhome-top-c,
  [data-theme="light"] .mhome .mhome-bd-root,
  [data-theme="light"] .mhome .mhome-strip-tip-count {
    filter: brightness(0.5) saturate(1.15);
  }
  .mhome-atmos {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(50% 56% at 50% 44%, rgba(var(--mh-accent-rgb), 0.06), transparent 60%),
      radial-gradient(44% 50% at 50% 102%, var(--mh-atmos-2), transparent 60%);
    transition: background 0.5s ease;
  }
  .mhome.has-result .mhome-atmos {
    background: radial-gradient(48% 50% at 50% 26%, rgba(var(--mh-accent-rgb), 0.06), transparent 60%);
  }
  .mhome-mark {
    position: absolute; top: 26px; inset-inline-start: 30px; z-index: 3;
    display: flex; align-items: center; gap: 11px;
  }
  .mhome-glyph {
    width: 30px; height: 30px; border: 1px solid rgba(var(--mh-ink-hi-rgb), 0.4); border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Amiri', serif; font-size: 17px; color: var(--mh-ink-hi);
  }
  .mhome-wordmark {
    font: 600 9.5px/1.5 'Space Grotesk', sans-serif; letter-spacing: 0.18em;
    text-transform: uppercase; color: rgba(var(--mh-ink-rgb), 0.45);
  }
  .mhome-topright {
    position: absolute; top: 22px; inset-inline-end: 26px; z-index: 3;
    display: flex; align-items: center; gap: 12px;
  }
  .mhome-lang :global(.control-pill-btn) {
    background: transparent; border: 1px solid var(--mh-btn-hairline); border-radius: 999px;
    padding: 7px 12px; color: var(--mh-ink-55); cursor: pointer;
    font: 600 11px 'Space Grotesk', sans-serif; letter-spacing: 0.03em;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }
  .mhome-lang :global(.control-pill-btn:hover) { color: var(--mh-ink); border-color: var(--mh-accent-border); }
  .mhome-lang :global(.control-pill-btn.active) {
    background: rgba(var(--mh-accent-rgb), 0.14); border-color: rgba(var(--mh-accent-rgb), 0.45); color: var(--mh-accent);
  }
  .mhome-skip {
    background: transparent; border: 1px solid var(--mh-btn-hairline); border-radius: 999px;
    padding: 7px 14px; color: rgba(var(--mh-ink-rgb), 0.6); cursor: pointer;
    font: 500 11px 'Space Grotesk', sans-serif; letter-spacing: 0.04em; white-space: nowrap;
    transition: color 0.15s, border-color 0.15s;
  }
  .mhome-skip:hover { color: var(--mh-ink); border-color: rgba(var(--mh-accent-rgb), 0.5); }

  /* Idle: the search bar sits toward the middle. Once it holds text it glides
     up (is-active) and holds there; position is binary, not per-letter, and it
     lingers a moment after clearing before settling back. */
  .mhome-stack {
    position: relative; z-index: 2;
    width: min(760px, calc(100vw - 48px));
    margin: 0 auto;
    min-height: 100%;
    display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
    padding: 26vh 0 90px;
    transition: padding-top 0.9s cubic-bezier(0.33, 0, 0.15, 1);
  }
  .mhome-stack.is-active { padding-top: 9.5vh; }
  /* Active state (typing / result / no-match) runs a tighter rhythm so a
     result's stat tiles, histogram and CTA row still clear the fold at
     1440x900 — resting keeps its full, calmer spacing. */
  .mhome-stack.is-active .mhome-reveal { margin-top: 21px; }

  .mhome-headline {
    font-family: 'Fraunces', serif; font-weight: 300; font-size: clamp(30px, 5vw, 46px);
    line-height: 1.08; letter-spacing: -0.015em; text-align: center; color: var(--mh-ink);
    margin: 0 0 2px; transition: opacity 0.3s ease;
  }
  /* Hidden while searching, but keeps its box so the search bar never jumps. */
  .mhome-headline.is-hidden { opacity: 0; pointer-events: none; }

  .mhome-search {
    margin-top: 30px; width: 100%;
    display: flex; align-items: center; gap: 15px; height: 68px; padding: 0 24px;
    background: var(--mh-raised); border: 1px solid var(--mh-search-border); border-radius: 18px;
    box-shadow: 0 22px 60px var(--mh-shadow-strong), 0 0 0 7px rgba(var(--mh-accent-rgb), 0.04);
    transition: border-color 0.25s ease, box-shadow 0.25s ease;
  }
  .mhome-search:focus-within {
    border-color: rgba(var(--mh-accent-rgb), 0.45);
    box-shadow: 0 22px 60px var(--mh-shadow-strong), 0 0 0 7px rgba(var(--mh-accent-rgb), 0.08);
  }
  .mhome-search svg { flex: 0 0 auto; color: rgba(var(--mh-ink-hi-rgb), 0.7); }
  .mhome-search input {
    flex: 1; min-width: 0; background: transparent; border: none; outline: none;
    color: var(--mh-ink); font: 400 21px 'Space Grotesk', sans-serif;
  }
  .mhome-search input::placeholder { color: rgba(var(--mh-ink-rgb), 0.4); }
  .mhome-enter {
    flex: 0 0 auto; font: 500 11px 'Space Grotesk', sans-serif; letter-spacing: 0.04em;
    color: rgba(var(--mh-ink-rgb), 0.45); border: 1px solid var(--mh-btn-hairline);
    padding: 4px 9px; border-radius: 7px;
  }
  .mhome-matched {
    flex: 0 0 auto; display: inline-flex; align-items: center; gap: 7px;
    font: 500 11px 'Space Grotesk', sans-serif; color: rgba(var(--mh-ink-rgb), 0.5);
  }
  .mhome-match-dot { width: 6px; height: 6px; border-radius: 999px; }

  .mhome-reveal { width: 100%; margin-top: 28px; }

  /* resting */
  .mhome-resting { display: flex; flex-direction: column; align-items: stretch; gap: 30px; animation: mhfade 0.4s ease; }

  .mhome-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 7px; }
  .mhome-chip {
    display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px; border-radius: 999px;
    background: rgba(var(--mh-ink-rgb), 0.03); border: 1px solid var(--mh-hairline-soft);
    color: rgba(var(--mh-ink-rgb), 0.66); cursor: pointer; transition: border-color 0.15s, background 0.15s, color 0.15s;
  }
  .mhome-chip:hover { border-color: var(--mh-accent-border); background: rgba(var(--mh-accent-rgb), 0.06); color: var(--mh-ink); }
  .mhome-chip-ar { font-family: 'Amiri', serif; font-size: 14px; }
  .mhome-chip-gloss { font: 400 12px 'Space Grotesk', sans-serif; color: rgba(var(--mh-ink-rgb), 0.5); }
  .mhome-chip.is-suggest { background: var(--mh-accent-soft); border-color: rgba(var(--mh-accent-rgb), 0.25); color: var(--mh-accent); }

  /* today's root — editorial, uncontained */
  .mhome-today { display: flex; flex-direction: column; gap: 18px; }
  .mhome-today-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .mhome-today-eyebrow { font: 600 10px 'Space Grotesk', sans-serif; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(var(--mh-ink-rgb), 0.5); }
  .mhome-today-all { background: none; border: none; padding: 0; cursor: pointer; font: 500 11px 'Space Grotesk', sans-serif; color: rgba(var(--mh-ink-rgb), 0.5); transition: color 0.15s; }
  .mhome-today-all:hover { color: var(--mh-accent); }

  /* masthead — each fact highlighted */
  .mhome-today-masthead { display: flex; align-items: flex-end; justify-content: space-between; gap: 22px 36px; flex-wrap: wrap; }
  .mhome-today-id { display: flex; align-items: baseline; gap: 18px; flex-wrap: wrap; }
  .mhome-today-ar { font-family: 'Amiri', serif; font-size: 44px; line-height: 1; }
  .mhome-today-idmeta { display: flex; flex-direction: column; gap: 3px; }
  .mhome-today-translit { font: 500 14px 'Space Grotesk', sans-serif; color: var(--mh-ink-72); letter-spacing: 0.02em; }
  .mhome-today-gloss { font: 400 16px 'Space Grotesk', sans-serif; color: var(--mh-ink); }
  .mhome-today-stats { display: flex; gap: 28px; }
  .mhome-today-stat { display: flex; flex-direction: column; gap: 5px; }
  .mhome-today-stat-n { font-family: 'Fraunces', serif; font-weight: 400; font-size: 30px; line-height: 1; color: var(--mh-ink); font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
  .mhome-today-stat-of { font-family: 'Space Grotesk', sans-serif; font-size: 15px; color: rgba(var(--mh-ink-rgb), 0.38); }
  .mhome-today-stat-l { font: 600 10px 'Space Grotesk', sans-serif; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(var(--mh-ink-rgb), 0.5); }

  /* verse carousel — one ayah at a time, auto-advancing, dots + swipe */
  .mhome-carousel { display: flex; flex-direction: column; gap: 15px; }
  .mhome-carousel-viewport { position: relative; overflow: hidden; }
  .mhome-verse {
    width: 100%; height: 190px; text-align: start; cursor: pointer;
    display: grid; grid-template-rows: 1fr auto; gap: 14px;
    padding: 20px 22px; border-radius: 16px;
    background: rgba(var(--mh-card-rgb), 0.5); border: 1px solid var(--mh-hairline);
    transition: border-color 0.18s, background 0.18s;
  }
  .mhome-verse:hover { border-color: var(--mh-accent-border); background: rgba(var(--mh-card-rgb), 0.8); }
  .mhome-verse.is-next { animation: mhSlideNext 0.42s cubic-bezier(0.16,1,0.3,1); }
  .mhome-verse.is-prev { animation: mhSlidePrev 0.42s cubic-bezier(0.16,1,0.3,1); }
  .mhome-verse-ar {
    margin: 0; align-self: center;
    font-family: 'Amiri', serif; font-size: 20px; line-height: 1.85; color: rgba(var(--mh-ink-rgb), 0.85);
    /* 3 lines × 37px fits the card's 117px text area — clamp matches what
       actually fits, so long verses ellipsize instead of clipping mid-line. */
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  }
  .mhome-verse-hl { font-weight: 700; text-shadow: 0 0 22px currentColor; }
  .mhome-verse-ref { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .mhome-verse-name { font: 500 12.5px 'Space Grotesk', sans-serif; color: var(--mh-ink); }
  .mhome-verse-num { font: 500 11px 'Space Grotesk', sans-serif; color: rgba(var(--mh-ink-rgb), 0.4); font-variant-numeric: tabular-nums; }

  .mhome-dots { display: flex; justify-content: center; gap: 7px; }
  .mhome-dot {
    width: 6px; height: 6px; padding: 0; border: none; border-radius: 999px; cursor: pointer;
    background: rgba(var(--mh-ink-rgb), 0.22); transition: width 0.22s, background 0.22s;
  }
  .mhome-dot.is-active { width: 22px; }

  @keyframes mhSlideNext { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: none; } }
  @keyframes mhSlidePrev { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: none; } }
  /* In RTL, "next" enters from the left (reading direction is mirrored). */
  :global([dir="rtl"]) .mhome-verse.is-next { animation-name: mhSlidePrev; }
  :global([dir="rtl"]) .mhome-verse.is-prev { animation-name: mhSlideNext; }

  /* inline word-by-word expand */
  .mhome-verse.is-open { border-color: var(--mh-accent-border); background: rgba(var(--mh-card-rgb), 0.8); border-radius: 16px 16px 0 0; }
  .mhome-breakdown {
    margin-top: -1px; padding: 18px 20px 20px; border-radius: 0 0 16px 16px;
    background: rgba(var(--mh-panel-rgb), 0.92); border: 1px solid var(--mh-hairline); border-top: none;
    animation: mhfade 0.3s ease;
  }
  .mhome-bd-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .mhome-bd-eyebrow { font: 600 10px 'Space Grotesk', sans-serif; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(var(--mh-ink-rgb), 0.5); }
  .mhome-bd-close { background: none; border: none; color: rgba(var(--mh-ink-rgb), 0.5); font-size: 20px; line-height: 1; cursor: pointer; padding: 0 4px; transition: color 0.15s; }
  .mhome-bd-close:hover { color: var(--mh-ink); }
  .mhome-bd-words { display: grid; grid-template-columns: 1fr 1fr; gap: 7px 22px; }
  .mhome-bd-word { display: flex; align-items: baseline; justify-content: space-between; gap: 14px; padding: 7px 10px; border-radius: 9px; }
  .mhome-bd-word.is-root { background: var(--mh-accent-soft); }
  .mhome-bd-surface { font-family: 'Amiri', serif; font-size: 21px; color: var(--mh-ink); flex: 0 0 auto; }
  .mhome-bd-meta { display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; justify-content: flex-end; text-align: end; }
  .mhome-bd-root { font-family: 'Amiri', serif; font-size: 15px; }
  .mhome-bd-pos { font: 500 9.5px 'Space Grotesk', sans-serif; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(var(--mh-ink-rgb), 0.45); }
  .mhome-bd-gloss { font: 400 12px 'Space Grotesk', sans-serif; color: rgba(var(--mh-ink-rgb), 0.6); }
  .mhome-bd-open {
    margin-top: 16px; display: inline-flex; align-items: center; gap: 8px; height: 42px; padding: 0 18px;
    border-radius: 11px; background: rgba(var(--mh-accent-rgb), 0.12); border: 1px solid rgba(var(--mh-accent-rgb), 0.32); color: var(--mh-accent);
    font: 600 13px 'Space Grotesk', sans-serif; cursor: pointer; transition: background 0.15s, border-color 0.15s;
  }
  .mhome-bd-open:hover { background: rgba(var(--mh-accent-rgb), 0.2); border-color: rgba(var(--mh-accent-rgb), 0.5); }
  @media (max-width: 640px) { .mhome-bd-words { grid-template-columns: 1fr; } }

  /* no match */
  .mhome-nomatch { text-align: center; animation: mhfade 0.3s ease; }
  .mhome-nomatch p { font: 400 15px 'Space Grotesk', sans-serif; color: rgba(var(--mh-ink-rgb), 0.6); margin: 0 0 14px; }

  /* result */
  .mhome-result { animation: mhfade 0.4s ease; }
  .mhome-back {
    display: inline-flex; align-items: center; gap: 6px; margin-bottom: 17px;
    background: none; border: none; padding: 4px 0; cursor: pointer;
    font: 500 12px 'Space Grotesk', sans-serif; letter-spacing: 0.02em; color: var(--mh-ink-55);
    transition: color 0.15s;
  }
  .mhome-back:hover { color: var(--mh-ink); }
  [dir="rtl"] .mhome-back svg { transform: scaleX(-1); }
  .mhome-result-head { display: flex; align-items: flex-end; gap: 24px; }
  .mhome-count {
    font-family: 'Fraunces', serif; font-weight: 300; font-size: clamp(58px, 9vw, 92px);
    line-height: 0.82; letter-spacing: -0.02em; font-variant-numeric: tabular-nums;
    color: var(--mh-ink-hi);
    text-shadow: 0 0 44px var(--mh-count-glow);
  }
  .mhome-count-lab { padding-bottom: 9px; }
  .mhome-occ { font: 500 13px 'Space Grotesk', sans-serif; letter-spacing: 0.04em; color: rgba(var(--mh-ink-rgb), 0.6); }
  .mhome-ident { display: flex; align-items: center; gap: 9px; margin-top: 8px; flex-wrap: wrap; }
  .mhome-ident-ar { font-family: 'Amiri', serif; font-size: 26px; }
  .mhome-ident-tr { font: 400 14px 'Space Grotesk', sans-serif; color: var(--mh-ink); }
  .mhome-ident-gl { font: 400 13px 'Space Grotesk', sans-serif; color: rgba(var(--mh-ink-rgb), 0.5); }

  /* occurrence stats — proper tiles, not cramped text */
  .mhome-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 19px; }
  .mhome-stat {
    display: flex; flex-direction: column; gap: 6px; padding: 15px 16px; border-radius: 13px;
    background: rgba(var(--mh-card-rgb), 0.45); border: 1px solid var(--mh-hairline-soft);
  }
  .mhome-stat-n {
    font-family: 'Fraunces', serif; font-weight: 400; font-size: 30px; line-height: 1; color: var(--mh-ink);
    font-variant-numeric: tabular-nums; letter-spacing: -0.01em;
  }
  .mhome-stat-of { font-family: 'Space Grotesk', sans-serif; font-size: 15px; color: rgba(var(--mh-ink-rgb), 0.38); letter-spacing: 0; }
  .mhome-stat-ref { font-size: 20px; line-height: 1.15; }
  .mhome-stat-l {
    font: 600 10px 'Space Grotesk', sans-serif; letter-spacing: 0.1em; text-transform: uppercase;
    color: rgba(var(--mh-ink-rgb), 0.5);
  }
  @media (max-width: 640px) {
    .mhome-stats { grid-template-columns: repeat(2, 1fr); }
  }

  .mhome-where { display: flex; align-items: center; justify-content: space-between; margin: 22px 0 8px; }
  .mhome-where-lab { font: 600 10px 'Space Grotesk', sans-serif; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(var(--mh-ink-rgb), 0.5); }
  .mhome-where-of { font: 500 11px 'Space Grotesk', sans-serif; color: rgba(var(--mh-ink-rgb), 0.4); }
  .mhome-ticks { display: flex; justify-content: space-between; margin-top: 7px; font: 500 9.5px 'Space Grotesk', sans-serif; letter-spacing: 0.08em; color: rgba(var(--mh-ink-rgb), 0.32); }

  /* distribution strip hover tooltip — lives in reserved space above the bars
     so it never covers the section label or the chart itself */
  .mhome-strip { position: relative; padding-top: 29px; }
  .mhome-strip-tip {
    position: absolute; top: 0; transform: translateX(-50%);
    display: flex; align-items: center; gap: 8px; white-space: nowrap; pointer-events: none; z-index: 6;
    padding: 5px 11px; border-radius: 9px; background: var(--mh-raised); border: 1px solid var(--mh-hairline-strong);
    box-shadow: 0 8px 24px var(--mh-shadow-strong);
    animation: mhfade 0.15s ease;
  }
  .mhome-strip-tip-name { font: 500 12px 'Space Grotesk', sans-serif; color: var(--mh-ink); }
  .mhome-strip-tip-count { font: 600 12px 'Space Grotesk', sans-serif; font-variant-numeric: tabular-nums; }

  .mhome-top { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 15px; }
  .mhome-top-chip { display: flex; align-items: center; gap: 10px; padding: 8px 13px; border-radius: 11px; background: var(--mh-raised); border: 1px solid var(--mh-hairline); }
  .mhome-top-name { font: 500 13px 'Space Grotesk', sans-serif; color: var(--mh-ink); white-space: nowrap; }
  .mhome-top-bar { width: 40px; height: 4px; border-radius: 999px; background: var(--mh-hairline); overflow: hidden; display: block; flex: 0 0 auto; }
  .mhome-top-bar span { display: block; height: 100%; border-radius: 999px; }
  .mhome-top-c { font: 600 12px 'Space Grotesk', sans-serif; font-variant-numeric: tabular-nums; }

  .mhome-ctas { display: flex; flex-direction: column; align-items: center; gap: 13px; margin-top: 27px; }
  .mhome-ctas-sub { display: flex; flex-wrap: wrap; justify-content: center; gap: 11px; }
  .mhome-cta-p {
    display: inline-flex; align-items: center; justify-content: center; gap: 9px; height: 48px; padding: 0 28px;
    border: none; border-radius: 12px; background: var(--mh-cta-bg); color: var(--mh-cta-ink); font: 600 14px 'Space Grotesk', sans-serif;
    cursor: pointer; transition: filter 0.15s, transform 0.15s; box-shadow: 0 8px 26px rgba(var(--mh-accent-rgb), 0.22);
  }
  .mhome-cta-p:hover { filter: brightness(1.06); transform: translateY(-1px); }
  .mhome-cta-s { height: 44px; padding: 0 18px; border-radius: 12px; background: var(--mh-raised); border: 1px solid var(--mh-hairline); color: var(--mh-ink); font: 600 13px 'Space Grotesk', sans-serif; cursor: pointer; transition: border-color 0.15s; }
  .mhome-cta-g { height: 44px; padding: 0 18px; border-radius: 12px; background: transparent; border: 1px solid var(--mh-hairline); color: var(--mh-ink-72); font: 600 13px 'Space Grotesk', sans-serif; cursor: pointer; transition: border-color 0.15s; }
  .mhome-cta-s:hover, .mhome-cta-g:hover { border-color: var(--mh-accent-border); }

  /* Curated Arabic glosses (ar locale, lib/data/rootGlossesAr.ts) render in
     the Arabic type family, same as every other Arabic-script element on
     this screen — layered after the *-gloss rules above so it wins the
     font-family tie-break while keeping each site's own size/color/spacing. */
  .mhome-gloss-ar { font-family: 'Amiri', serif; }

  @keyframes mhfade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

  @media (max-width: 640px) {
    /* Keep the idle→typing glide on mobile too — just with tighter stops. */
    .mhome-stack { padding-top: 21vh; }
    .mhome-stack.is-active { padding-top: 82px; }
    .mhome-search { height: 58px; padding: 0 18px; }
    .mhome-search input { font-size: 17px; }
    .mhome-result-head { gap: 15px; }
    .mhome-topright { inset-inline-end: 16px; }
    .mhome-mark { inset-inline-start: 18px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .mhome-resting, .mhome-result, .mhome-nomatch, .mhome-verse, .mhome-breakdown, .mhome-strip-tip { animation: none; }
    .mhome-atmos, .mhome-stack, .mhome-search, .mhome-dot, .mhome-headline { transition: none; }
  }
`;
