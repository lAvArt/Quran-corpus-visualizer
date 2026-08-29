/**
 * Renders each gallery visualization to a real PNG for search indexing.
 *
 * The graphs are inline SVG built client-side by D3, which Google cannot index
 * as images. This snapshots them through the chromeless `/embed/{mode}` routes
 * into `public/graphs/{mode}.png`, which the `/{locale}/viz/{mode}` pages then
 * carry as a plain <img> on a crawlable URL.
 *
 * Requires a running server (dev or `npm start`), same as scripts/ux-shots.ts.
 *
 * Usage:
 *   npm run build && npm start          # in one terminal
 *   npx tsx scripts/build-graph-images.ts [--base http://localhost:3000]
 *     [--out public/graphs] [--settle 6000] [--theme dark]
 */
import { chromium, type Browser } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';
import {
    VIZ_GALLERY,
    GRAPH_IMAGE_WIDTH,
    GRAPH_IMAGE_HEIGHT,
} from '../lib/seo/vizGallery';

function arg(name: string, fallback: string): string {
    const idx = process.argv.indexOf(`--${name}`);
    return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

const BASE = arg('base', 'http://localhost:3000').replace(/\/$/, '');
const OUT_DIR = arg('out', path.join('public', 'graphs'));
const SETTLE_MS = Number(arg('settle', '6000'));
const THEME = arg('theme', 'dark') === 'light' ? 'light' : 'dark';

/** Same channel fallback as ux-shots.ts: machines without the Playwright
 *  download still work through system Edge/Chrome. */
async function launchBrowser(): Promise<Browser> {
    const channels: Array<string | undefined> = [undefined, 'msedge', 'chrome'];
    let lastError: unknown;
    for (const channel of channels) {
        try {
            return await chromium.launch(channel ? { channel } : {});
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError;
}

/**
 * The graphs mount empty and fill in asynchronously, so `load` is far too early.
 * Wait for the SVG to actually carry geometry, then let animations settle.
 */
async function waitForGraph(page: import('@playwright/test').Page): Promise<number> {
    await page.waitForSelector('svg', { timeout: 45_000 });
    try {
        await page.waitForFunction(
            () => {
                const svgs = Array.from(document.querySelectorAll('svg'));
                return svgs.some(
                    (s) => s.querySelectorAll('path, circle, rect, line, text').length > 20
                );
            },
            { timeout: 45_000 }
        );
    } catch {
        // Fall through: capture whatever rendered rather than failing the run.
        // The per-mode element count below makes a thin capture obvious.
    }
    await page.waitForTimeout(SETTLE_MS);
    return page.evaluate(() => {
        const svgs = Array.from(document.querySelectorAll('svg'));
        return Math.max(
            0,
            ...svgs.map((s) => s.querySelectorAll('path, circle, rect, line, text').length)
        );
    });
}

async function main(): Promise<void> {
    await fs.mkdir(OUT_DIR, { recursive: true });
    const browser = await launchBrowser();
    const failures: string[] = [];

    try {
        for (const entry of VIZ_GALLERY) {
            const query = [entry.embedQuery, `theme=${THEME}`].filter(Boolean).join('&');
            const url = `${BASE}/embed/${entry.mode}?${query}`;
            const context = await browser.newContext({
                viewport: { width: GRAPH_IMAGE_WIDTH, height: GRAPH_IMAGE_HEIGHT },
                // 1, not 2, on purpose: the file must actually BE the size the
                // page's <img>, og:image:width and ImageObject all declare.
                // A 2x capture made those declarations wrong and each PNG ~1.3 MB.
                deviceScaleFactor: 1,
            });
            const page = await context.newPage();

            try {
                const response = await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
                if (response && !response.ok()) {
                    throw new Error(`HTTP ${response.status()}`);
                }
                const marks = await waitForGraph(page);
                const file = path.join(OUT_DIR, `${entry.mode}.png`);
                await page.screenshot({ path: file });
                const { size } = await fs.stat(file);
                console.log(
                    `  ${entry.mode.padEnd(22)} ${String(marks).padStart(5)} marks  ${(size / 1024).toFixed(0)} KB`
                );
                if (marks < 20) failures.push(`${entry.mode} (only ${marks} marks — likely empty)`);
            } catch (error) {
                failures.push(`${entry.mode} (${(error as Error).message})`);
                console.error(`  ${entry.mode}: FAILED — ${(error as Error).message}`);
            } finally {
                await context.close();
            }
        }
    } finally {
        await browser.close();
    }

    if (failures.length > 0) {
        console.error(`\n${failures.length} capture(s) need attention:`);
        for (const f of failures) console.error(`  - ${f}`);
        process.exit(1);
    }
    console.log(`\nWrote ${VIZ_GALLERY.length} graph image(s) to ${OUT_DIR}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
