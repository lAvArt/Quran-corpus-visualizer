"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import { SURAH_NAMES } from "@/lib/data/surahData";
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
        <line x1={0} y1={H - 0.5} x2={W} y2={H - 0.5} stroke="rgba(236,228,216,0.12)" strokeWidth={1} />
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
              fill={isHover || !faint ? color : "rgba(236,228,216,0.18)"}
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
  // Featured root varies per user/session (random, stable within the session).
  const [rootSeed] = useState(() => Math.floor(Math.random() * 1_000_000));

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
  const today = useMemo(() => (idx ? rootOfTheDay(idx, rootSeed) : null), [idx, rootSeed]);
  const chips = useMemo(() => (idx ? idx.featured.slice(0, 6).map((b) => idx.roots[b]).filter(Boolean) : []), [idx]);
  const suggestions = useMemo(() => (idx ? idx.featured.slice(0, 3).map((b) => idx.roots[b]).filter(Boolean) : []), [idx]);

  const hasQuery = dq.trim().length > 0;
  const noMatch = hasQuery && !!idx && !result;

  const enterApp = useCallback(
    (root?: string, viz = "root-network", surah?: number) => {
      const sp = new URLSearchParams({ viz });
      if (root) sp.set("root", root);
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

      {/* corner mark + lang/skip */}
      <div className="mhome-mark">
        <span className="mhome-glyph">ق</span>
        <span className="mhome-wordmark">
          Quranic Linguistics
          <br />
          Observatory
        </span>
      </div>
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
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(251,234,210,0.7)" strokeWidth="1.8" aria-hidden="true">
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
                {suggestions.map((r) => (
                  <button key={r.bare} type="button" className="mhome-chip is-suggest" onClick={() => pick(r.bare)}>
                    <span dir="rtl" lang="ar" className="mhome-chip-ar">
                      {r.root}
                    </span>
                    <span>{r.gloss?.split(/[/·]/)[0].trim()}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mhome-resting">
              {/* Common roots — right beneath the search bar. */}
              <div className="mhome-chips">
                {chips.map((r) => (
                  <button key={r.bare} type="button" className="mhome-chip" onClick={() => pick(r.bare)}>
                    <span dir="rtl" lang="ar" className="mhome-chip-ar">
                      {r.root}
                    </span>
                    {r.gloss && <span className="mhome-chip-gloss">{r.gloss.split(/[/·]/)[0].trim()}</span>}
                  </button>
                ))}
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
                        {today.gloss && (
                          <span className="mhome-today-gloss" dir="ltr">
                            “{today.gloss}”
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
                      glossOf={(r) => idx?.roots[r]?.gloss ?? null}
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
        <div className="mhome-count" style={{ color: "#FBEAD2" }}>
          {stat.count.toLocaleString()}
        </div>
        <div className="mhome-count-lab">
          <div className="mhome-occ">{t("occurrences")}</div>
          <div className="mhome-ident">
            <span dir="rtl" lang="ar" className="mhome-ident-ar" style={{ color }}>
              {stat.root}
            </span>
            {locale !== "ar" && <span className="mhome-ident-tr">{stat.translit}</span>}
            {stat.gloss && (
              <span className="mhome-ident-gl" dir="ltr">
                “{stat.gloss}”
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
      <SurahStrip hist={stat.hist} color={color} />
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
        <button type="button" className="mhome-cta-p" onClick={() => onExplore(stat.bare, "root-network")}>
          {t("exploreRoot")} <span aria-hidden="true">→</span>
        </button>
        <div className="mhome-ctas-sub">
          <button type="button" className="mhome-cta-s" onClick={() => onExplore(stat.bare, "radial-sura", stat.top[0]?.[0])}>
            {t("readVerses", { n: stat.verses })}
          </button>
          <button type="button" className="mhome-cta-g" onClick={() => onExplore(stat.bare, "root-flow")}>
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
  glossOf: (root: string) => string | null;
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
                      {gloss && <span className="mhome-bd-gloss">{gloss}</span>}
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
    position: fixed;
    inset: 0;
    background: #0E161A;
    color: #ECE4D8;
    font-family: 'Space Grotesk', system-ui, sans-serif;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .mhome-atmos {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(50% 56% at 50% 44%, rgba(232,146,74,0.06), transparent 60%),
      radial-gradient(44% 50% at 50% 102%, rgba(142,132,204,0.05), transparent 60%);
    transition: background 0.5s ease;
  }
  .mhome.has-result .mhome-atmos {
    background: radial-gradient(48% 50% at 50% 26%, rgba(232,146,74,0.06), transparent 60%);
  }
  .mhome-mark {
    position: absolute; top: 26px; inset-inline-start: 30px; z-index: 3;
    display: flex; align-items: center; gap: 11px;
  }
  .mhome-glyph {
    width: 30px; height: 30px; border: 1px solid rgba(251,234,210,0.4); border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Amiri', serif; font-size: 17px; color: #FBEAD2;
  }
  .mhome-wordmark {
    font: 600 9.5px/1.5 'Space Grotesk', sans-serif; letter-spacing: 0.18em;
    text-transform: uppercase; color: rgba(236,228,216,0.45);
  }
  .mhome-topright {
    position: absolute; top: 22px; inset-inline-end: 26px; z-index: 3;
    display: flex; align-items: center; gap: 12px;
  }
  .mhome-lang :global(.control-pill-btn) {
    background: transparent; border: 1px solid rgba(237,225,209,0.14); border-radius: 999px;
    padding: 7px 12px; color: rgba(236,228,216,0.55); cursor: pointer;
    font: 600 11px 'Space Grotesk', sans-serif; letter-spacing: 0.03em;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }
  .mhome-lang :global(.control-pill-btn:hover) { color: #ECE4D8; border-color: rgba(232,146,74,0.4); }
  .mhome-lang :global(.control-pill-btn.active) {
    background: rgba(232,146,74,0.14); border-color: rgba(232,146,74,0.45); color: #f0b074;
  }
  .mhome-skip {
    background: transparent; border: 1px solid rgba(237,225,209,0.14); border-radius: 999px;
    padding: 7px 14px; color: rgba(236,228,216,0.6); cursor: pointer;
    font: 500 11px 'Space Grotesk', sans-serif; letter-spacing: 0.04em; white-space: nowrap;
    transition: color 0.15s, border-color 0.15s;
  }
  .mhome-skip:hover { color: #ECE4D8; border-color: rgba(232,146,74,0.5); }

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
  .mhome-stack.is-active { padding-top: 11vh; }

  .mhome-headline {
    font-family: 'Fraunces', serif; font-weight: 300; font-size: clamp(30px, 5vw, 46px);
    line-height: 1.08; letter-spacing: -0.015em; text-align: center; color: #ECE4D8;
    margin: 0 0 2px; transition: opacity 0.3s ease;
  }
  /* Hidden while searching, but keeps its box so the search bar never jumps. */
  .mhome-headline.is-hidden { opacity: 0; pointer-events: none; }

  .mhome-search {
    margin-top: 30px; width: 100%;
    display: flex; align-items: center; gap: 15px; height: 68px; padding: 0 24px;
    background: #1C2A31; border: 1px solid rgba(251,234,210,0.18); border-radius: 18px;
    box-shadow: 0 22px 60px rgba(0,0,0,0.45), 0 0 0 7px rgba(232,146,74,0.04);
    transition: border-color 0.25s ease, box-shadow 0.25s ease;
  }
  .mhome-search:focus-within {
    border-color: rgba(232,146,74,0.45);
    box-shadow: 0 22px 60px rgba(0,0,0,0.45), 0 0 0 7px rgba(232,146,74,0.08);
  }
  .mhome-search svg { flex: 0 0 auto; }
  .mhome-search input {
    flex: 1; min-width: 0; background: transparent; border: none; outline: none;
    color: #ECE4D8; font: 400 21px 'Space Grotesk', sans-serif;
  }
  .mhome-search input::placeholder { color: rgba(236,228,216,0.4); }
  .mhome-enter {
    flex: 0 0 auto; font: 500 11px 'Space Grotesk', sans-serif; letter-spacing: 0.04em;
    color: rgba(236,228,216,0.45); border: 1px solid rgba(237,225,209,0.14);
    padding: 4px 9px; border-radius: 7px;
  }
  .mhome-matched {
    flex: 0 0 auto; display: inline-flex; align-items: center; gap: 7px;
    font: 500 11px 'Space Grotesk', sans-serif; color: rgba(236,228,216,0.5);
  }
  .mhome-match-dot { width: 6px; height: 6px; border-radius: 999px; }

  .mhome-reveal { width: 100%; margin-top: 28px; }

  /* resting */
  .mhome-resting { display: flex; flex-direction: column; align-items: stretch; gap: 30px; animation: mhfade 0.4s ease; }

  .mhome-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 7px; }
  .mhome-chip {
    display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px; border-radius: 999px;
    background: rgba(236,228,216,0.03); border: 1px solid rgba(198,222,230,0.07);
    color: rgba(236,228,216,0.66); cursor: pointer; transition: border-color 0.15s, background 0.15s, color 0.15s;
  }
  .mhome-chip:hover { border-color: rgba(232,146,74,0.4); background: rgba(232,146,74,0.06); color: #ECE4D8; }
  .mhome-chip-ar { font-family: 'Amiri', serif; font-size: 14px; }
  .mhome-chip-gloss { font: 400 12px 'Space Grotesk', sans-serif; color: rgba(236,228,216,0.5); }
  .mhome-chip.is-suggest { background: rgba(232,146,74,0.08); border-color: rgba(232,146,74,0.25); color: #f0b074; }

  /* today's root — editorial, uncontained */
  .mhome-today { display: flex; flex-direction: column; gap: 18px; }
  .mhome-today-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .mhome-today-eyebrow { font: 600 10px 'Space Grotesk', sans-serif; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(236,228,216,0.5); }
  .mhome-today-all { background: none; border: none; padding: 0; cursor: pointer; font: 500 11px 'Space Grotesk', sans-serif; color: rgba(236,228,216,0.5); transition: color 0.15s; }
  .mhome-today-all:hover { color: #f0b074; }

  /* masthead — each fact highlighted */
  .mhome-today-masthead { display: flex; align-items: flex-end; justify-content: space-between; gap: 22px 36px; flex-wrap: wrap; }
  .mhome-today-id { display: flex; align-items: baseline; gap: 18px; flex-wrap: wrap; }
  .mhome-today-ar { font-family: 'Amiri', serif; font-size: 44px; line-height: 1; }
  .mhome-today-idmeta { display: flex; flex-direction: column; gap: 3px; }
  .mhome-today-translit { font: 500 14px 'Space Grotesk', sans-serif; color: rgba(236,228,216,0.7); letter-spacing: 0.02em; }
  .mhome-today-gloss { font: 400 16px 'Space Grotesk', sans-serif; color: #ECE4D8; }
  .mhome-today-stats { display: flex; gap: 28px; }
  .mhome-today-stat { display: flex; flex-direction: column; gap: 5px; }
  .mhome-today-stat-n { font-family: 'Fraunces', serif; font-weight: 400; font-size: 30px; line-height: 1; color: #ECE4D8; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
  .mhome-today-stat-of { font-family: 'Space Grotesk', sans-serif; font-size: 15px; color: rgba(236,228,216,0.38); }
  .mhome-today-stat-l { font: 600 10px 'Space Grotesk', sans-serif; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(236,228,216,0.5); }

  /* verse carousel — one ayah at a time, auto-advancing, dots + swipe */
  .mhome-carousel { display: flex; flex-direction: column; gap: 15px; }
  .mhome-carousel-viewport { position: relative; overflow: hidden; }
  .mhome-verse {
    width: 100%; height: 190px; text-align: start; cursor: pointer;
    display: grid; grid-template-rows: 1fr auto; gap: 14px;
    padding: 20px 22px; border-radius: 16px;
    background: rgba(28,42,49,0.5); border: 1px solid rgba(198,222,230,0.08);
    transition: border-color 0.18s, background 0.18s;
  }
  .mhome-verse:hover { border-color: rgba(232,146,74,0.4); background: rgba(28,42,49,0.8); }
  .mhome-verse.is-next { animation: mhSlideNext 0.42s cubic-bezier(0.16,1,0.3,1); }
  .mhome-verse.is-prev { animation: mhSlidePrev 0.42s cubic-bezier(0.16,1,0.3,1); }
  .mhome-verse-ar {
    margin: 0; align-self: center;
    font-family: 'Amiri', serif; font-size: 20px; line-height: 1.85; color: rgba(236,228,216,0.85);
    /* 3 lines × 37px fits the card's 117px text area — clamp matches what
       actually fits, so long verses ellipsize instead of clipping mid-line. */
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  }
  .mhome-verse-hl { font-weight: 700; text-shadow: 0 0 22px currentColor; }
  .mhome-verse-ref { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .mhome-verse-name { font: 500 12.5px 'Space Grotesk', sans-serif; color: #ECE4D8; }
  .mhome-verse-num { font: 500 11px 'Space Grotesk', sans-serif; color: rgba(236,228,216,0.4); font-variant-numeric: tabular-nums; }

  .mhome-dots { display: flex; justify-content: center; gap: 7px; }
  .mhome-dot {
    width: 6px; height: 6px; padding: 0; border: none; border-radius: 999px; cursor: pointer;
    background: rgba(236,228,216,0.22); transition: width 0.22s, background 0.22s;
  }
  .mhome-dot.is-active { width: 22px; }

  @keyframes mhSlideNext { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: none; } }
  @keyframes mhSlidePrev { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: none; } }
  /* In RTL, "next" enters from the left (reading direction is mirrored). */
  :global([dir="rtl"]) .mhome-verse.is-next { animation-name: mhSlidePrev; }
  :global([dir="rtl"]) .mhome-verse.is-prev { animation-name: mhSlideNext; }

  /* inline word-by-word expand */
  .mhome-verse.is-open { border-color: rgba(232,146,74,0.4); background: rgba(28,42,49,0.8); border-radius: 16px 16px 0 0; }
  .mhome-breakdown {
    margin-top: -1px; padding: 18px 20px 20px; border-radius: 0 0 16px 16px;
    background: rgba(20,32,38,0.92); border: 1px solid rgba(198,222,230,0.08); border-top: none;
    animation: mhfade 0.3s ease;
  }
  .mhome-bd-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .mhome-bd-eyebrow { font: 600 10px 'Space Grotesk', sans-serif; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(236,228,216,0.5); }
  .mhome-bd-close { background: none; border: none; color: rgba(236,228,216,0.5); font-size: 20px; line-height: 1; cursor: pointer; padding: 0 4px; transition: color 0.15s; }
  .mhome-bd-close:hover { color: #ECE4D8; }
  .mhome-bd-words { display: grid; grid-template-columns: 1fr 1fr; gap: 7px 22px; }
  .mhome-bd-word { display: flex; align-items: baseline; justify-content: space-between; gap: 14px; padding: 7px 10px; border-radius: 9px; }
  .mhome-bd-word.is-root { background: rgba(232,146,74,0.08); }
  .mhome-bd-surface { font-family: 'Amiri', serif; font-size: 21px; color: #ECE4D8; flex: 0 0 auto; }
  .mhome-bd-meta { display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; justify-content: flex-end; text-align: end; }
  .mhome-bd-root { font-family: 'Amiri', serif; font-size: 15px; }
  .mhome-bd-pos { font: 500 9.5px 'Space Grotesk', sans-serif; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(236,228,216,0.45); }
  .mhome-bd-gloss { font: 400 12px 'Space Grotesk', sans-serif; color: rgba(236,228,216,0.6); }
  .mhome-bd-open {
    margin-top: 16px; display: inline-flex; align-items: center; gap: 8px; height: 42px; padding: 0 18px;
    border-radius: 11px; background: rgba(232,146,74,0.12); border: 1px solid rgba(232,146,74,0.32); color: #f0b074;
    font: 600 13px 'Space Grotesk', sans-serif; cursor: pointer; transition: background 0.15s, border-color 0.15s;
  }
  .mhome-bd-open:hover { background: rgba(232,146,74,0.2); border-color: rgba(232,146,74,0.5); }
  @media (max-width: 640px) { .mhome-bd-words { grid-template-columns: 1fr; } }

  /* no match */
  .mhome-nomatch { text-align: center; animation: mhfade 0.3s ease; }
  .mhome-nomatch p { font: 400 15px 'Space Grotesk', sans-serif; color: rgba(236,228,216,0.6); margin: 0 0 14px; }

  /* result */
  .mhome-result { animation: mhfade 0.4s ease; }
  .mhome-back {
    display: inline-flex; align-items: center; gap: 6px; margin-bottom: 20px;
    background: none; border: none; padding: 4px 0; cursor: pointer;
    font: 500 12px 'Space Grotesk', sans-serif; letter-spacing: 0.02em; color: rgba(236,228,216,0.55);
    transition: color 0.15s;
  }
  .mhome-back:hover { color: #ECE4D8; }
  [dir="rtl"] .mhome-back svg { transform: scaleX(-1); }
  .mhome-result-head { display: flex; align-items: flex-end; gap: 24px; }
  .mhome-count {
    font-family: 'Fraunces', serif; font-weight: 300; font-size: clamp(58px, 9vw, 92px);
    line-height: 0.82; letter-spacing: -0.02em; font-variant-numeric: tabular-nums;
    text-shadow: 0 0 44px rgba(251,234,210,0.22);
  }
  .mhome-count-lab { padding-bottom: 9px; }
  .mhome-occ { font: 500 13px 'Space Grotesk', sans-serif; letter-spacing: 0.04em; color: rgba(236,228,216,0.6); }
  .mhome-ident { display: flex; align-items: center; gap: 9px; margin-top: 8px; flex-wrap: wrap; }
  .mhome-ident-ar { font-family: 'Amiri', serif; font-size: 26px; }
  .mhome-ident-tr { font: 400 14px 'Space Grotesk', sans-serif; color: #ECE4D8; }
  .mhome-ident-gl { font: 400 13px 'Space Grotesk', sans-serif; color: rgba(236,228,216,0.5); }

  /* occurrence stats — proper tiles, not cramped text */
  .mhome-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 22px; }
  .mhome-stat {
    display: flex; flex-direction: column; gap: 6px; padding: 15px 16px; border-radius: 13px;
    background: rgba(28,42,49,0.45); border: 1px solid rgba(198,222,230,0.07);
  }
  .mhome-stat-n {
    font-family: 'Fraunces', serif; font-weight: 400; font-size: 30px; line-height: 1; color: #ECE4D8;
    font-variant-numeric: tabular-nums; letter-spacing: -0.01em;
  }
  .mhome-stat-of { font-family: 'Space Grotesk', sans-serif; font-size: 15px; color: rgba(236,228,216,0.38); letter-spacing: 0; }
  .mhome-stat-ref { font-size: 20px; line-height: 1.15; }
  .mhome-stat-l {
    font: 600 10px 'Space Grotesk', sans-serif; letter-spacing: 0.1em; text-transform: uppercase;
    color: rgba(236,228,216,0.5);
  }
  @media (max-width: 640px) {
    .mhome-stats { grid-template-columns: repeat(2, 1fr); }
  }

  .mhome-where { display: flex; align-items: center; justify-content: space-between; margin: 26px 0 9px; }
  .mhome-where-lab { font: 600 10px 'Space Grotesk', sans-serif; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(236,228,216,0.5); }
  .mhome-where-of { font: 500 11px 'Space Grotesk', sans-serif; color: rgba(236,228,216,0.4); }
  .mhome-ticks { display: flex; justify-content: space-between; margin-top: 7px; font: 500 9.5px 'Space Grotesk', sans-serif; letter-spacing: 0.08em; color: rgba(236,228,216,0.32); }

  /* distribution strip hover tooltip — lives in reserved space above the bars
     so it never covers the section label or the chart itself */
  .mhome-strip { position: relative; padding-top: 34px; }
  .mhome-strip-tip {
    position: absolute; top: 0; transform: translateX(-50%);
    display: flex; align-items: center; gap: 8px; white-space: nowrap; pointer-events: none; z-index: 6;
    padding: 5px 11px; border-radius: 9px; background: #1C2A31; border: 1px solid rgba(198,222,230,0.14);
    box-shadow: 0 8px 24px rgba(0,0,0,0.45);
    animation: mhfade 0.15s ease;
  }
  .mhome-strip-tip-name { font: 500 12px 'Space Grotesk', sans-serif; color: #ECE4D8; }
  .mhome-strip-tip-count { font: 600 12px 'Space Grotesk', sans-serif; font-variant-numeric: tabular-nums; }

  .mhome-top { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
  .mhome-top-chip { display: flex; align-items: center; gap: 10px; padding: 8px 13px; border-radius: 11px; background: #1C2A31; border: 1px solid rgba(198,222,230,0.08); }
  .mhome-top-name { font: 500 13px 'Space Grotesk', sans-serif; color: #ECE4D8; white-space: nowrap; }
  .mhome-top-bar { width: 40px; height: 4px; border-radius: 999px; background: rgba(198,222,230,0.08); overflow: hidden; display: block; flex: 0 0 auto; }
  .mhome-top-bar span { display: block; height: 100%; border-radius: 999px; }
  .mhome-top-c { font: 600 12px 'Space Grotesk', sans-serif; font-variant-numeric: tabular-nums; }

  .mhome-ctas { display: flex; flex-direction: column; align-items: center; gap: 13px; margin-top: 32px; }
  .mhome-ctas-sub { display: flex; flex-wrap: wrap; justify-content: center; gap: 11px; }
  .mhome-cta-p {
    display: inline-flex; align-items: center; justify-content: center; gap: 9px; height: 48px; padding: 0 28px;
    border: none; border-radius: 12px; background: #E8924A; color: #2A1606; font: 600 14px 'Space Grotesk', sans-serif;
    cursor: pointer; transition: filter 0.15s, transform 0.15s; box-shadow: 0 8px 26px rgba(232,146,74,0.22);
  }
  .mhome-cta-p:hover { filter: brightness(1.06); transform: translateY(-1px); }
  .mhome-cta-s { height: 44px; padding: 0 18px; border-radius: 12px; background: #1C2A31; border: 1px solid rgba(198,222,230,0.08); color: #ECE4D8; font: 600 13px 'Space Grotesk', sans-serif; cursor: pointer; transition: border-color 0.15s; }
  .mhome-cta-g { height: 44px; padding: 0 18px; border-radius: 12px; background: transparent; border: 1px solid rgba(198,222,230,0.08); color: rgba(236,228,216,0.7); font: 600 13px 'Space Grotesk', sans-serif; cursor: pointer; transition: border-color 0.15s; }
  .mhome-cta-s:hover, .mhome-cta-g:hover { border-color: rgba(232,146,74,0.4); }

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
