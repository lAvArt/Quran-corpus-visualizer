import { expect, test, type Page, type TestInfo } from "@playwright/test";

/**
 * Motion-compliance checks for JS-driven animation (D3 transitions,
 * framer-motion springs/staggers) that bypasses the global CSS
 * `@media (prefers-reduced-motion: reduce)` rule in globals.css. See
 * lib/viz/motionPrefs.ts for the shared helpers these components consult.
 */

function skipOnboarding(page: Page) {
  return page.addInitScript(() => {
    window.localStorage.setItem(
      "quran-corpus-onboarding",
      JSON.stringify({ version: "2", showOnStartup: false, completed: true }),
    );
    // Dismiss the per-mode viz intro card so it never overlays the canvas
    // these tests sample and screenshot.
    window.localStorage.setItem(
      "quran-corpus-viz-intro",
      JSON.stringify({ "surah-distribution": true, "root-network": true }),
    );
  });
}

/** Waits for the explore shell to finish its initial load (corpus + viz). */
async function waitForExploreReady(page: Page) {
  await page
    .getByTestId("explore-loading-indicator")
    .waitFor({ state: "hidden", timeout: 60_000 })
    .catch(() => {});
  await expect(page.locator('[data-tour-id="main-viewport"] svg')).toBeVisible({ timeout: 30_000 });
}

test.describe("motion compliance — reduced motion (entrance is instant)", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("surah distribution: node entrance skips the stagger under reduced motion", async ({ page }, testInfo: TestInfo) => {
    test.setTimeout(60_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/en?viz=surah-distribution");
    await waitForExploreReady(page);

    const nodes = page.locator(".surah-node-group");
    await nodes.first().waitFor({ state: "attached", timeout: 30_000 });

    // A short grace window (far shorter than the ~1s+ uncapped entrance this
    // guards against) lets the zero-duration transition paint, without
    // giving a broken/un-gated version enough time to "coincidentally" settle.
    await page.waitForTimeout(150);

    const count = await nodes.count();
    expect(count).toBeGreaterThan(0);
    // Sample the LAST node in DOM order (surahNodes are built in ascending
    // surah-id order, so this one would carry the largest uncapped stagger
    // delay — the most sensitive point to regress on).
    const lateNode = nodes.nth(count - 1);
    const opacity = await lateNode.evaluate((el) => Number(getComputedStyle(el).opacity));
    expect(opacity).toBeGreaterThan(0.9);

    // Let corpus streaming plateau, then re-assert on the full set: under
    // reduced motion every node — initial flush and late-streamed alike —
    // must already sit at its final opacity the moment it exists.
    let lastCount = count;
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(1000);
      const next = await nodes.count();
      if (next === lastCount) break;
      lastCount = next;
    }
    const opacities = await nodes.evaluateAll((els) =>
      els.map((el) => Number(getComputedStyle(el).opacity)),
    );
    expect(opacities.filter((o) => o < 0.95)).toHaveLength(0);

    // Evidence screenshot "for the record" — written to the test's output dir
    // and attached to the report rather than asserted against a committed
    // baseline, because the settled state of this D3 scatter varies with
    // corpus-streaming timing across machines/runs and a pixel baseline here
    // would be flaky by construction.
    const viewport = page.locator('[data-tour-id="main-viewport"]');
    const evidencePath = testInfo.outputPath("motion-reduced-surah-distribution.png");
    await viewport.screenshot({ animations: "disabled", path: evidencePath });
    await testInfo.attach("motion-reduced-surah-distribution", {
      path: evidencePath,
      contentType: "image/png",
    });
  });

  test("root network: edge entrance skips the stagger under reduced motion", async ({ page }) => {
    test.setTimeout(60_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/en?viz=root-network");
    await waitForExploreReady(page);

    const edges = page.locator(".edge");
    await edges.first().waitFor({ state: "attached", timeout: 30_000 });
    await page.waitForTimeout(150);

    const count = await edges.count();
    expect(count).toBeGreaterThan(0);
    // Last edge in render order carries the largest uncapped per-item delay.
    const lateEdge = edges.nth(count - 1);
    const opacity = await lateEdge.evaluate((el) => Number(getComputedStyle(el).opacity));
    // Edge opacity settles to 0.3 (dim) or 0.9 (highlighted) — either way it
    // should already be at its target, not still fading up from 0.
    expect(opacity).toBeGreaterThan(0.2);
  });
});

test.describe("motion compliance — normal motion timing", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("surah distribution: full entrance wave settles within ~750ms", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/en?viz=surah-distribution");
    await waitForExploreReady(page);

    const nodes = page.locator(".surah-node-group");
    await nodes.first().waitFor({ state: "attached", timeout: 30_000 });

    // The full ~600ms-capped wave only means something once most of the 114
    // surahs have streamed in — on a thin/partial snapshot the "last"
    // rendered node could have a trivially small index (and thus a trivially
    // small delay) regardless of whether the cap is even applied. Give the
    // corpus a bounded window to fill in as much as this environment's
    // network conditions allow; the exact cap value (114 -> 600ms) is
    // verified independent of corpus/network speed in
    // lib/viz/motionPrefs.test.ts, so this E2E check only needs to confirm
    // that whatever wave size DID render actually settles in time — it isn't
    // the sole proof of the 600ms figure.
    let lastCount = await nodes.count();
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(1000);
      const next = await nodes.count();
      if (next === lastCount) break; // stopped growing — corpus streaming has plateaued
      lastCount = next;
    }

    // Entrance stagger is capped at 600ms total (motionSafeStagger); allow a
    // little extra for the spring itself to visually converge.
    await page.waitForTimeout(750);

    const opacities = await nodes.evaluateAll((els) =>
      els.map((el) => Number(getComputedStyle(el).opacity)),
    );
    expect(opacities.length).toBeGreaterThan(0);
    const unsettled = opacities.filter((o) => o < 0.95);
    expect(unsettled).toHaveLength(0);
  });
});
