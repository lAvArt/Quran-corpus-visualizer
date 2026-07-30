/* Smoke-check: names are findable + correctly counted across surfaces.
 * Run against a live dev server (see the npm wrapper below). Not a unit test —
 * it drives the real UI in Chrome. */
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const SHOTS = ".ux-shots";
const EXPECT: Record<string, number> = {
  "موسى": 136, "عيسى": 25, "محمد": 4, "ابراهيم": 69, "اسماعيل": 12, "مريم": 34,
};

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  let failures = 0;

  // ── HOME search ──
  await page.goto(`${BASE}/en`);
  await page.waitForSelector(".mhome-search input", { state: "visible", timeout: 60000 });
  for (const [name, expected] of Object.entries(EXPECT)) {
    const input = page.locator(".mhome-search input");
    await input.fill("");
    await input.fill(name);
    await input.press("Enter");
    try {
      await page.waitForSelector(".mhome-count", { state: "visible", timeout: 8000 });
      // let the debounced result settle on THIS query
      await page.waitForTimeout(400);
      const countText = (await page.locator(".mhome-count").first().innerText()).replace(/[^\d]/g, "");
      const identText = await page.locator(".mhome-ident-ar").first().innerText().catch(() => "");
      const got = Number(countText);
      const ok = got === expected;
      if (!ok) failures++;
      console.log(`${ok ? "✅" : "❌"} HOME ${name} → ${got} (expected ${expected}) · shows "${identText}"`);
    } catch {
      failures++;
      console.log(`❌ HOME ${name} → NO count card (no match)`);
    }
  }
  // Screenshot the Moses card for the PR.
  const input = page.locator(".mhome-search input");
  await input.fill(""); await input.fill("موسى"); await input.press("Enter");
  await page.waitForSelector(".mhome-count", { state: "visible", timeout: 8000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/names-home-moses.png` });
  console.log(`saved ${SHOTS}/names-home-moses.png`);

  // A function word with no root must resolve too.
  await input.fill(""); await input.fill("حتى"); await input.press("Enter");
  try {
    await page.waitForSelector(".mhome-count", { state: "visible", timeout: 8000 });
    await page.waitForTimeout(300);
    const c = Number((await page.locator(".mhome-count").first().innerText()).replace(/[^\d]/g, ""));
    console.log(`${c > 0 ? "✅" : "❌"} HOME حتى (root-less particle) → ${c}`);
    if (!(c > 0)) failures++;
  } catch { failures++; console.log("❌ HOME حتى → NO count card"); }

  // ── /search workspace: a name query surfaces its occurrence dossier ──
  // The root dossier now falls back to lemma grouping for root-less names; wait
  // for the full corpus so the occurrence total is complete.
  await page.goto(`${BASE}/en/search?q=${encodeURIComponent("موسى")}`);
  try {
    await page.waitForSelector(".workspace-root-title", { state: "visible", timeout: 30000 });
    // Poll until the streaming corpus settles the count at the ground truth.
    let got = 0;
    for (let i = 0; i < 60; i++) {
      const body = await page.locator("body").innerText();
      if (/\b136\b/.test(body)) { got = 136; break; }
      await page.waitForTimeout(2000);
    }
    const title = await page.locator(".workspace-root-title").first().innerText();
    const ok = got === 136;
    if (!ok) failures++;
    console.log(`${ok ? "✅" : "❌"} /search موسى → dossier "${title}" ${ok ? "shows 136 occurrences" : "did not reach 136"}`);
    await page.screenshot({ path: `${SHOTS}/names-search-moses.png` });
  } catch (e) {
    failures++;
    console.log(`❌ /search موسى → ${(e as Error).message.split("\n")[0]}`);
  }

  // ── Inspector deep-link (the "See it in context" destination) counts the name ──
  // Focus Moses' first occurrence (2:51:3) and wait for the full corpus so the
  // occurrence total is complete.
  await page.goto(`${BASE}/en?viz=radial-sura&surah=2&ayah=51&token=2:51:3&lemma=${encodeURIComponent("مُوسَىٰ")}`);
  try {
    await page.waitForSelector('.status-bar-label[data-status="full"]', { state: "attached", timeout: 180000 });
    await page.waitForSelector(".mi-big-count", { state: "visible", timeout: 15000 });
    await page.waitForTimeout(500);
    const n = Number((await page.locator(".mi-big-count").first().innerText()).replace(/[^\d]/g, ""));
    const ok = n === 136;
    if (!ok) failures++;
    console.log(`${ok ? "✅" : "❌"} INSPECTOR موسى → ${n} (expected 136)`);
    await page.screenshot({ path: `${SHOTS}/names-inspector-moses.png` });
  } catch (e) {
    failures++;
    console.log(`❌ INSPECTOR موسى → count not shown (${(e as Error).message.split("\n")[0]})`);
  }

  await browser.close();
  console.log(failures === 0 ? "\nALL NAME CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
