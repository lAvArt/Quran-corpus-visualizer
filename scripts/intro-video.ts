/**
 * Intro/help video capture harness — guided-tutorial edition.
 *
 * Records REAL app footage with Playwright's screencast. Structural rules,
 * learned the hard way:
 *  - The corpus warms up FIRST under the opening card (recording runs; the
 *    warm-up stretch is trimmed with ffmpeg), so every visible frame says
 *    "Full corpus ready".
 *  - ONE SPA session throughout: scene changes navigate via the app's own UI
 *    (brand link, rail buttons, CTAs) — goto/setContent would drop the
 *    client-side corpus cache.
 *  - Title cards are persistent in-page overlays that CROSSFADE between
 *    slides and only lift when a scene starts — the app never flashes
 *    through between cards.
 *  - A lower-third caption narrates each beat (the "real tutorial" layer).
 *  - Cursor animates fully in-page (rAF); output re-encoded to CFR 30fps
 *    H.264 (raw screencast is VFR → flicker).
 *
 * Usage: npx tsx scripts/intro-video.ts [--base http://localhost:3000]
 *        [--locale en] [--out .ux-shots/intro-video]
 */
import { chromium, type Page } from "@playwright/test";
import { execFileSync } from "child_process";
import { createRequire } from "module";
import path from "path";
import { promises as fs } from "fs";

const require = createRequire(import.meta.url);

function arg(name: string, fallback: string): string {
    const idx = process.argv.indexOf(`--${name}`);
    return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

const BASE = arg("base", "http://localhost:3000").replace(/\/$/, "");
const LOCALE = arg("locale", "en");
const OUT_DIR = arg("out", ".ux-shots/intro-video");

const W = 1920;
const H = 1080;
const CORPUS_READY_TIMEOUT_MS = 240_000;

interface Slide { step?: string; heading: string; sub: string }
interface Copy {
    welcome: Slide;
    ready: Slide;
    s1: Slide; s2: Slide; s3: Slide; s4: Slide;
    close: Slide;
    cap: Record<string, string>;
}

const COPY: Record<string, Copy> = {
    en: {
        welcome: { heading: "Welcome to the Quran Observatory", sub: "A 90-second guided tour" },
        ready: { heading: "Every word has a root", sub: "1,600+ roots, 77,000+ words — all explorable" },
        s1: { step: "Step 1", heading: "Search any root", sub: "Arabic or English — just start typing" },
        s2: { step: "Step 2", heading: "Read it in context", sub: "One surah, every word, on a ring" },
        s3: { step: "Step 3", heading: "Study the root's network", sub: "Closest companions first, then the whole field" },
        s4: { step: "Step 4", heading: "Inspect and track", sub: "Morphology on click — build your study list" },
        close: { heading: "Now explore it yourself", sub: "quranobservatory.org" },
        cap: {
            type: "Type any root — try رحم (mercy)",
            profile: "Instant profile: occurrences, meaning, and where it lives",
            cta: "“See it in context” opens the surah map",
            zoom: "Zoom in — every word appears in place",
            network: "Its strongest companions orbit closest",
            expand: "“Show full network” reveals the whole field",
            drag: "Drag any root — it stays where you drop it",
            inspect: "Click a root for its full morphology",
            track: "Track it — it joins your study list",
        },
    },
    ar: {
        welcome: { heading: "مرحبًا بك في مرصد اللسانيات القرآنية", sub: "جولة إرشادية في ٩٠ ثانية" },
        ready: { heading: "لكل كلمة جذر", sub: "أكثر من ١٦٠٠ جذر و٧٧ ألف كلمة — كلها قابلة للاستكشاف" },
        s1: { step: "الخطوة ١", heading: "ابحث عن أي جذر", sub: "بالعربية أو الإنجليزية — ابدأ الكتابة فحسب" },
        s2: { step: "الخطوة ٢", heading: "اقرأه في سياقه", sub: "سورة واحدة، كل كلماتها، على حلقة" },
        s3: { step: "الخطوة ٣", heading: "ادرس شبكة الجذر", sub: "أقرب مرافقيه أولًا، ثم الحقل الكامل" },
        s4: { step: "الخطوة ٤", heading: "افحص وتتبّع", sub: "الصرف بنقرة — وابنِ قائمة دراستك" },
        close: { heading: "الآن استكشف بنفسك", sub: "quranobservatory.org" },
        cap: {
            type: "اكتب أي جذر — جرّب رحم",
            profile: "ملف فوري: التكرارات والمعنى ومواضع الورود",
            cta: "«شاهده في سياقه» يفتح خريطة السورة",
            zoom: "كبّر — تظهر كل كلمة في موضعها",
            network: "أقوى مرافقيه يدورون في المدار الأقرب",
            expand: "«عرض الشبكة الكاملة» يكشف الحقل كله",
            drag: "اسحب أي جذر — يبقى حيث تتركه",
            inspect: "انقر على جذر لعرض صرفه الكامل",
            track: "تتبّعه — ينضم إلى قائمة دراستك",
        },
    },
};
const copy = COPY[LOCALE] ?? COPY.en;
const RTL = LOCALE === "ar";

/** In-page helpers: cursor + persistent crossfading cards + caption bar. */
const PAGE_HELPERS = `
  (() => {
    const ensureCursor = () => {
      let el = document.getElementById("qcv-cursor");
      if (el) return el;
      el = document.createElement("div");
      el.id = "qcv-cursor";
      el.style.cssText = [
        "position:fixed", "z-index:2147483647", "width:26px", "height:26px",
        "border-radius:50%", "pointer-events:none", "top:0", "left:0",
        "background:radial-gradient(circle, rgba(232,146,74,0.95) 0%, rgba(232,146,74,0.35) 55%, transparent 75%)",
        "box-shadow:0 0 16px rgba(232,146,74,0.55)",
        "transform:translate(-50%,-50%)",
      ].join(";");
      (document.body ?? document.documentElement).appendChild(el);
      return el;
    };
    window.__qcvGlide = (x, y, ms) => new Promise((resolve) => {
      const el = ensureCursor();
      const x0 = parseFloat(el.style.left) || x;
      const y0 = parseFloat(el.style.top) || y;
      const t0 = performance.now();
      const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      const step = (now) => {
        const t = Math.min(1, (now - t0) / ms);
        const k = ease(t);
        el.style.left = (x0 + (x - x0) * k) + "px";
        el.style.top = (y0 + (y - y0) * k) + "px";
        if (t < 1) requestAnimationFrame(step);
        else resolve(undefined);
      };
      requestAnimationFrame(step);
    });
    window.__qcvPulse = () => {
      const el = ensureCursor();
      el.animate(
        [{ transform: "translate(-50%,-50%) scale(1)" }, { transform: "translate(-50%,-50%) scale(1.8)" }, { transform: "translate(-50%,-50%) scale(1)" }],
        { duration: 260, easing: "ease-out" }
      );
    };

    // Persistent card layer: shows/crossfades slides, only __qcvCardHide
    // reveals the app — no gaps between consecutive slides.
    const cardLayer = () => {
      let layer = document.getElementById("qcv-card");
      if (layer) return layer;
      layer = document.createElement("div");
      layer.id = "qcv-card";
      layer.style.cssText = [
        "position:fixed", "inset:0", "z-index:2147483646", "display:grid",
        "place-content:center", "text-align:center",
        "background:#0E161A", "opacity:0", "transition:opacity 300ms ease",
        "color:#ECE4D8",
        // The layer persists (for crossfades) — it must NEVER intercept the
        // real clicks the scenes make while it's faded out.
        "pointer-events:none",
      ].join(";");
      document.body.appendChild(layer);
      return layer;
    };
    window.__qcvCardShow = (step, heading, sub, rtl) => new Promise((resolve) => {
      const layer = cardLayer();
      const inner = document.createElement("div");
      inner.style.cssText = "display:grid;gap:16px;opacity:0;transition:opacity 280ms ease;direction:" + (rtl ? "rtl" : "ltr");
      inner.innerHTML =
        (step ? '<div style="font-size:20px;letter-spacing:0.18em;text-transform:uppercase;color:#E8924A;font-family:system-ui,sans-serif;font-weight:700">' + step + '</div>' : '') +
        '<h1 style="margin:0;font-size:58px;font-weight:500;letter-spacing:-0.01em;font-family:Georgia,serif">' + heading + '</h1>' +
        '<div style="width:64px;height:2px;background:#E8924A;margin:8px auto 0;border-radius:2px"></div>' +
        '<p style="margin:0;font-size:24px;color:rgba(236,228,216,0.6);font-family:system-ui,sans-serif">' + sub + '</p>';
      const old = layer.firstElementChild;
      if (old) { old.style.opacity = "0"; setTimeout(() => old.remove(), 300); }
      layer.appendChild(inner);
      layer.style.opacity = "1";
      requestAnimationFrame(() => { inner.style.opacity = "1"; });
      setTimeout(resolve, 340);
    });
    window.__qcvCardHide = () => new Promise((resolve) => {
      const layer = document.getElementById("qcv-card");
      if (!layer) { resolve(undefined); return; }
      layer.style.opacity = "0";
      setTimeout(() => { layer.replaceChildren(); resolve(undefined); }, 320);
    });

    // Lower-third caption — the tutorial narration during live scenes.
    window.__qcvCaption = (text, rtl) => {
      let cap = document.getElementById("qcv-caption");
      if (!cap) {
        cap = document.createElement("div");
        cap.id = "qcv-caption";
        cap.style.cssText = [
          "position:fixed", "bottom:96px", "left:50%", "transform:translateX(-50%)",
          "z-index:2147483645", "max-width:70vw", "padding:12px 22px",
          "border-radius:999px", "background:rgba(8,14,17,0.85)",
          "border:1px solid rgba(232,146,74,0.4)", "backdrop-filter:blur(8px)",
          "color:#ECE4D8", "font-family:system-ui,sans-serif", "font-size:20px",
          "text-align:center", "opacity:0", "transition:opacity 250ms ease",
          "pointer-events:none", "white-space:nowrap",
        ].join(";");
        document.body.appendChild(cap);
      }
      cap.style.direction = rtl ? "rtl" : "ltr";
      cap.textContent = text;
      cap.style.opacity = "1";
    };
    window.__qcvCaptionHide = () => {
      const cap = document.getElementById("qcv-caption");
      if (cap) cap.style.opacity = "0";
    };
  })();
`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function glide(page: Page, x: number, y: number, ms = 380): Promise<void> {
    await page.evaluate(
        ([px, py, pms]) => (window as unknown as { __qcvGlide(x: number, y: number, ms: number): Promise<void> }).__qcvGlide(px, py, pms),
        [x, y, ms] as [number, number, number]
    );
    await page.mouse.move(x, y);
}

async function glideToAndClick(page: Page, selector: string, ms = 380): Promise<void> {
    await page.locator(selector).first().evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center" }));
    await sleep(450);
    const box = await page.locator(selector).first().boundingBox();
    if (!box) throw new Error(`No box for ${selector}`);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await glide(page, cx, cy, ms);
    await page.evaluate(() => (window as unknown as { __qcvPulse(): void }).__qcvPulse());
    await page.mouse.click(cx, cy);
}

async function dragBy(page: Page, selector: string, dx: number, dy: number): Promise<void> {
    const box = await page.locator(selector).first().boundingBox();
    if (!box) throw new Error(`No box for ${selector}`);
    const sx = box.x + box.width / 2;
    const sy = box.y + box.height / 2;
    await glide(page, sx, sy, 380);
    await page.mouse.down();
    const steps = 22;
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const cx = sx + dx * k;
        const cy = sy + dy * k;
        await page.evaluate(([px, py]) => (window as unknown as { __qcvGlide(x: number, y: number, ms: number): Promise<void> }).__qcvGlide(px, py, 16), [cx, cy] as [number, number]);
        await page.mouse.move(cx, cy);
        await sleep(18);
    }
    await page.mouse.up();
}

async function showCard(page: Page, slide: Slide, holdMs = 1800): Promise<void> {
    await page.evaluate(
        ([s, h, su, rtl]) => (window as unknown as { __qcvCardShow(s: string | null, h: string, su: string, rtl: boolean): Promise<void> }).__qcvCardShow(s || null, h, su, rtl as unknown as boolean),
        [slide.step ?? "", slide.heading, slide.sub, RTL] as [string, string, string, boolean]
    );
    await sleep(holdMs);
}

async function hideCard(page: Page): Promise<void> {
    await page.evaluate(() => (window as unknown as { __qcvCardHide(): Promise<void> }).__qcvCardHide());
    await sleep(250);
}

async function caption(page: Page, text: string): Promise<void> {
    await page.evaluate(
        ([t, rtl]) => (window as unknown as { __qcvCaption(t: string, rtl: boolean): void }).__qcvCaption(t, rtl as unknown as boolean),
        [text, RTL] as [string, boolean]
    );
}

async function captionHide(page: Page): Promise<void> {
    await page.evaluate(() => (window as unknown as { __qcvCaptionHide(): void }).__qcvCaptionHide());
}

async function run(): Promise<void> {
    await fs.mkdir(OUT_DIR, { recursive: true });
    const browser = await chromium
        .launch({ headless: true })
        .catch(() => chromium.launch({ headless: true, channel: "msedge" }));
    const context = await browser.newContext({
        viewport: { width: W, height: H },
        recordVideo: { dir: OUT_DIR, size: { width: W, height: H } },
        locale: RTL ? "ar" : "en",
    });
    await context.addCookies([
        { name: "quran-corpus-theme", value: encodeURIComponent(JSON.stringify({ theme: "dark", colorThemeId: "teal-amber" })), url: BASE },
        { name: "NEXT_LOCALE", value: LOCALE, url: BASE },
    ]);
    await context.addInitScript(() => {
        window.localStorage.setItem("quran-corpus-onboarding", JSON.stringify({ version: "2", showOnStartup: false, completed: true }));
        window.localStorage.setItem("quran-corpus-viz-intro", JSON.stringify({ dismissed: ["radial-sura", "root-network"] }));
    });
    await context.addInitScript(PAGE_HELPERS);

    const page = await context.newPage();
    const recordStart = Date.now();

    // ── Warm-up UNDER the welcome card (recording gets trimmed to the point
    // where the card is already up, so the app never leaks through). ──
    await page.goto(`${BASE}/${LOCALE}?viz=radial-sura&surah=1`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await showCard(page, copy.welcome, 200); // mounted immediately; holds through warm-up
    await page.waitForSelector('.status-bar-label[data-status="full"]', { timeout: CORPUS_READY_TIMEOUT_MS });
    const trimSeconds = Math.max(0, (Date.now() - recordStart) / 1000 - 0.2);
    console.log(`corpus ready — trimming first ${trimSeconds.toFixed(1)}s`);

    // Welcome sequence (all crossfades — no app peek-through).
    await sleep(2400);
    await showCard(page, copy.ready, 2400);
    await showCard(page, copy.s1, 2000);

    // ── Scene 1: home search ──
    await hideCard(page);
    await glideToAndClick(page, ".brand-block", 500);
    await page.waitForSelector(".mhome-search input", { timeout: 20_000 });
    await sleep(700);
    await caption(page, copy.cap.type);
    const searchBox = await page.locator(".mhome-search input").first().boundingBox();
    if (!searchBox) throw new Error("home search input not found");
    await glide(page, searchBox.x + searchBox.width * 0.35, searchBox.y + searchBox.height / 2, 450);
    await page.locator(".mhome-search input").first().click();
    for (const ch of "رحم") {
        await page.keyboard.type(ch);
        await sleep(210);
    }
    await sleep(1400);
    await caption(page, copy.cap.profile);
    const strip = await page.locator(".mhome-strip").first().boundingBox();
    if (strip) await glide(page, strip.x + strip.width * 0.35, strip.y + strip.height / 2, 450);
    await sleep(1600);

    // ── Scene 2: read it in context ──
    await caption(page, copy.cap.cta);
    await sleep(600);
    await glideToAndClick(page, ".mhome-cta-p", 420);
    await captionHide(page);
    await showCard(page, copy.s2, 1900);
    await hideCard(page);
    await sleep(3200); // entry fit + highlight focus (corpus already full)

    if ((await page.locator(".viz-zoom-btn").count()) === 0) {
        await glideToAndClick(page, '[data-testid="journey-panel-toggle"]', 420);
        await sleep(700);
    }
    await caption(page, copy.cap.zoom);
    for (let i = 0; i < 3; i++) {
        await glideToAndClick(page, ".viz-zoom-btn >> nth=0", 260);
        await sleep(600);
    }
    await sleep(1600);
    await captionHide(page);

    // ── Scene 3: root network ──
    await showCard(page, copy.s3, 1900);
    await hideCard(page);
    await glideToAndClick(page, '[data-testid="journey-root"]', 450);
    await page.waitForSelector(".rn-node", { timeout: 30_000 });
    await caption(page, copy.cap.network);
    await sleep(3600);

    let pillVisible = await page
        .waitForSelector('[data-testid="root-network-focus-expand-pill"]', { timeout: 8_000 })
        .then(() => true)
        .catch(() => false);
    if (!pillVisible) {
        const rahm = page.locator('.rn-node[data-node-id="root-رحم"]');
        if (await rahm.count()) {
            await glideToAndClick(page, '.rn-node[data-node-id="root-رحم"]', 450);
            pillVisible = await page
                .waitForSelector('[data-testid="root-network-focus-expand-pill"]', { timeout: 8_000 })
                .then(() => true)
                .catch(() => false);
        }
    }
    if (pillVisible) {
        await caption(page, copy.cap.expand);
        await glideToAndClick(page, '[data-testid="root-network-focus-expand-pill"]', 420);
        await sleep(2800);
    }

    await caption(page, copy.cap.drag);
    const node = await page.locator(".rn-node").first().boundingBox();
    if (node) {
        await dragBy(page, ".rn-node >> nth=0", 130, -90);
        await sleep(1100);
    }
    await captionHide(page);

    // ── Scene 4: inspect + track ──
    await showCard(page, copy.s4, 1900);
    await hideCard(page);
    await caption(page, copy.cap.inspect);
    const rahmNode = page.locator('.rn-node[data-node-id="root-رحم"]');
    if (await rahmNode.count()) {
        await glideToAndClick(page, '.rn-node[data-node-id="root-رحم"]', 450);
    } else {
        await glideToAndClick(page, ".rn-node >> nth=1", 450);
    }
    await sleep(2000);
    const track = page.locator(".mi-btn-track").first();
    if (await track.count()) {
        await caption(page, copy.cap.track);
        await glideToAndClick(page, ".mi-btn-track", 450);
        await sleep(1400);
    }
    await captionHide(page);

    // ── Closing ──
    await showCard(page, copy.close, 2400);

    await context.close();
    const video = page.video();
    if (video) {
        const p = await video.path();
        const webm = path.join(OUT_DIR, `intro-${LOCALE}.webm`);
        await fs.rename(p, webm).catch(async () => {
            await fs.copyFile(p, webm);
        });
        const ffmpeg = require("ffmpeg-static") as string;
        const mp4 = path.join(OUT_DIR, `intro-${LOCALE}.mp4`);
        execFileSync(ffmpeg, [
            "-ss", trimSeconds.toFixed(2),
            "-i", webm,
            "-vf", "fps=30,format=yuv420p",
            "-c:v", "libx264", "-crf", "18", "-preset", "slow",
            "-movflags", "+faststart",
            "-y", mp4,
        ], { stdio: "pipe" });
        console.log(`video: ${mp4}`);
    }
    await browser.close();
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
