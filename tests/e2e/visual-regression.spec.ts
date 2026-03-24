import { expect, test, type Page } from "@playwright/test";

/* ───────────────────────── helpers ───────────────────────── */

/** Skip onboarding dialog for all tests. */
function skipOnboarding(page: Page) {
  return page.addInitScript(() => {
    window.localStorage.setItem(
      "quran-corpus-onboarding",
      JSON.stringify({ version: "2", showOnStartup: false, completed: true }),
    );
  });
}

/** Wait for the explore page to finish loading (corpus + visualization). */
async function waitForExploreReady(page: Page) {
  const loader = page.getByTestId("explore-loading-indicator");
  await loader.waitFor({ state: "hidden", timeout: 60_000 }).catch(() => {});
  await expect(page.locator('[data-tour-id="main-viewport"]')).toBeVisible({ timeout: 30_000 });
  // Let D3 visualizations settle
  await page.waitForTimeout(1500);
}

/** Check if we're on a mobile viewport. */
function isMobile(page: Page): boolean {
  const vw = page.viewportSize();
  return (vw?.width ?? 1280) < 640;
}

/** Seed a dev-mode authenticated user via localStorage. */
function seedAuthUser(page: Page, id = "dev-user-vis", email = "visual-test@example.com") {
  return page.addInitScript(
    ([uid, umail]) => {
      window.localStorage.setItem(
        "qcv-dev-auth-user",
        JSON.stringify({
          id: uid,
          aud: "authenticated",
          role: "authenticated",
          email: umail,
          email_confirmed_at: new Date().toISOString(),
          phone: "",
          confirmed_at: new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
          app_metadata: {},
          user_metadata: {},
          identities: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_anonymous: false,
        }),
      );
    },
    [id, email] as const,
  );
}

/** Seed study knowledge for auth tests. */
function seedStudyKnowledge(page: Page) {
  return page.addInitScript(() => {
    window.localStorage.setItem(
      "qcv-dev-knowledge",
      JSON.stringify([
        { root: "حمد", state: "learning", notes: "Praise root", updatedAt: Date.now() },
        { root: "رحم", state: "learned", notes: "Mercy cluster", updatedAt: Date.now() },
      ]),
    );
    window.localStorage.setItem(
      "quran-corpus-recent-exploration",
      JSON.stringify({
        lastVisualizationMode: "root-network",
        lastSurahId: 1,
        lastRoot: "حمد",
        lastLemma: "حَمْد",
        updatedAt: new Date().toISOString(),
      }),
    );
  });
}

const SCREENSHOT_OPTS = { animations: "disabled" as const };
const FULL_PAGE = { fullPage: true, ...SCREENSHOT_OPTS };
/** Tolerant options for D3 / dynamic content that has natural variance between runs. */
const DYNAMIC_OPTS = { ...SCREENSHOT_OPTS, maxDiffPixelRatio: 0.04 };
const DYNAMIC_FULL = { fullPage: true, ...DYNAMIC_OPTS };

/* ════════════════════════════════════════════════════════════
   1. EXPLORE PAGE — base layout
   ════════════════════════════════════════════════════════════ */

test.describe("visual regression — explore page", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("explore full page", async ({ page }) => {
    await page.goto("/en");
    await waitForExploreReady(page);
    await expect(page).toHaveScreenshot("explore-full.png", DYNAMIC_FULL);
  });

  test("explore visualization viewport", async ({ page }) => {
    await page.goto("/en");
    await waitForExploreReady(page);
    const viewport = page.locator('[data-tour-id="main-viewport"]');
    await expect(viewport).toHaveScreenshot("explore-viewport.png", SCREENSHOT_OPTS);
  });

  test("explore header and controls", async ({ page }) => {
    await page.goto("/en");
    await waitForExploreReady(page);
    const header = page.locator(".floating-header");
    await expect(header).toHaveScreenshot("explore-header.png", SCREENSHOT_OPTS);
  });
});

/* ════════════════════════════════════════════════════════════
   2. DESKTOP SIDEBAR
   ════════════════════════════════════════════════════════════ */

test.describe("visual regression — sidebar (desktop only)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(isMobile(page), "Sidebar tests are desktop-only");
    await skipOnboarding(page);
  });

  test("explore with sidebar open", async ({ page }) => {
    await page.goto("/en");
    await waitForExploreReady(page);

    await page.locator('[data-tour-id="tools-toggle"]').click();
    await expect(page.locator('[data-tour-id="tools-sidebar"]')).toBeVisible();
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("explore-sidebar-open.png", FULL_PAGE);
  });

  test("explore sidebar tabs", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/en");
    await waitForExploreReady(page);

    await page.locator('[data-tour-id="tools-toggle"]').click();
    const sidebar = page.locator('[data-tour-id="tools-sidebar"]');
    await expect(sidebar).toBeVisible();

    // Inspector tab (default)
    await expect(sidebar).toHaveScreenshot("sidebar-inspector-tab.png", SCREENSHOT_OPTS);

    // Search tab
    await page.getByTestId("sidebar-tab-advanced-search").click({ force: true });
    await page.waitForTimeout(300);
    await expect(sidebar).toHaveScreenshot("sidebar-search-tab.png", SCREENSHOT_OPTS);

    // Index tab
    await page.getByTestId("sidebar-tab-index").click({ force: true });
    await page.waitForTimeout(300);
    await expect(sidebar).toHaveScreenshot("sidebar-index-tab.png", SCREENSHOT_OPTS);
  });
});

/* ════════════════════════════════════════════════════════════
   3. MOBILE BOTTOM BAR & OVERLAYS
   ════════════════════════════════════════════════════════════ */

test.describe("visual regression — mobile chrome (mobile only)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isMobile(page), "Mobile-only tests");
    await skipOnboarding(page);
  });

  test("mobile bottom bar visible", async ({ page }) => {
    await page.goto("/en");
    await waitForExploreReady(page);

    await expect(page.getByTestId("mobile-bottom-bar")).toBeVisible();
    await expect(page).toHaveScreenshot("mobile-explore-full.png", FULL_PAGE);
  });

  test("mobile search overlay", async ({ page }) => {
    await page.goto("/en");
    await waitForExploreReady(page);

    await page.getByTestId("mobile-bottom-bar-search").click();
    await expect(page.getByTestId("mobile-search-overlay")).toBeVisible();
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot("mobile-search-overlay.png", FULL_PAGE);
  });

  test("mobile search overlay with results", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/en");
    await waitForExploreReady(page);

    await page.getByTestId("mobile-bottom-bar-search").click();
    const overlay = page.getByTestId("mobile-search-overlay");
    await expect(overlay).toBeVisible();

    const searchInput = overlay.getByRole("combobox");
    await searchInput.fill("praise");
    await expect(page.locator("#global-search-results")).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("mobile-search-results.png", FULL_PAGE);
  });

  test("mobile tools sidebar open", async ({ page }) => {
    await page.goto("/en");
    await waitForExploreReady(page);

    await page.getByTestId("mobile-bottom-bar-tools").click({ force: true });
    await expect(page.locator('[data-tour-id="app-sidebar"]')).toBeVisible();
    await page.waitForTimeout(400);

    await expect(page).toHaveScreenshot("mobile-tools-sidebar.png", FULL_PAGE);
  });

  test("mobile nav menu dropdown", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/en");
    await waitForExploreReady(page);

    await page.getByTestId("mobile-nav-menu-trigger").click({ force: true });
    await expect(page.getByTestId("mobile-nav-menu-dropdown")).toBeVisible();
    await page.waitForTimeout(500);

    const dropdown = page.getByTestId("mobile-nav-menu-dropdown");
    await expect(dropdown).toHaveScreenshot("mobile-nav-menu.png", SCREENSHOT_OPTS);
  });

  test("mobile surfaces mutually exclusive", async ({ page }) => {
    await page.goto("/en");
    await waitForExploreReady(page);

    // Open search → open tools → search should close
    await page.getByTestId("mobile-bottom-bar-search").click();
    await expect(page.getByTestId("mobile-search-overlay")).toBeVisible();

    await page.getByTestId("mobile-bottom-bar-tools").click({ force: true });
    await expect(page.getByTestId("mobile-search-overlay")).toBeHidden();
    await expect(page.locator('[data-tour-id="app-sidebar"]')).toBeVisible();

    await expect(page).toHaveScreenshot("mobile-tools-after-search.png", FULL_PAGE);
  });
});

/* ════════════════════════════════════════════════════════════
   4. SEARCH WORKSPACE
   ════════════════════════════════════════════════════════════ */

test.describe("visual regression — search workspace", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("search workspace initial state", async ({ page }) => {
    await page.goto("/en/search");
    await expect(
      page.getByRole("heading", { name: /find roots, ayahs, lemmas, and glosses faster/i }),
    ).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("search-workspace.png", DYNAMIC_OPTS);
  });

  test("search workspace with results", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/en/search");

    const searchInput = page.getByRole("combobox").first();
    await expect(searchInput).toBeVisible({ timeout: 30_000 });
    await searchInput.click({ force: true });
    await searchInput.pressSequentially("praise", { delay: 50 });
    await expect(
      page.locator("#global-search-results, .search-result-item, [role='listbox']").first(),
    ).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("search-results.png", FULL_PAGE);
  });
});

/* ════════════════════════════════════════════════════════════
   5. AUTH PAGES (all viewports)
   ════════════════════════════════════════════════════════════ */

test.describe("visual regression — auth pages", () => {
  test("login page — sign in tab", async ({ page }) => {
    await page.goto("/en/auth/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("tab", { name: /sign in/i })).toHaveAttribute("aria-selected", "true");

    await expect(page).toHaveScreenshot("auth-login.png", FULL_PAGE);
  });

  test("login page — sign up tab", async ({ page }) => {
    await page.goto("/en/auth/login");
    await expect(page.getByRole("tab", { name: /sign up/i })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("tab", { name: /sign up/i }).click();
    await page.waitForTimeout(200);

    // Confirm password field should appear
    await expect(page.locator('input[autocomplete="new-password"]').first()).toBeVisible();

    await expect(page).toHaveScreenshot("auth-signup.png", FULL_PAGE);
  });

  test("reset password page", async ({ page }) => {
    await page.goto("/en/auth/reset-password");
    await expect(page.getByRole("heading", { name: /reset password/i })).toBeVisible({
      timeout: 30_000,
    });

    await expect(page).toHaveScreenshot("auth-reset-password.png", FULL_PAGE);
  });

  test("update password page (no session)", async ({ page }) => {
    await page.goto("/en/auth/update-password");
    // Without a session this shows an error/redirect state
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot("auth-update-password-no-session.png", FULL_PAGE);
  });
});

/* ════════════════════════════════════════════════════════════
   6. STUDY DASHBOARD — authenticated user
   ════════════════════════════════════════════════════════════ */

test.describe("visual regression — study (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await seedAuthUser(page);
    await seedStudyKnowledge(page);
  });

  test("study dashboard full layout", async ({ page }) => {
    await page.goto("/en/study");
    await expect(page.getByRole("heading", { name: "Study", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator("text=visual-test@example.com")).toBeVisible();
    await expect(page.locator("text=Tracked roots: 2")).toBeVisible();
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot("study-dashboard.png", FULL_PAGE);
  });

  test("study with root editing open", async ({ page }) => {
    await page.goto("/en/study");
    await expect(page.getByRole("heading", { name: "Study", exact: true })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByTestId("study-root-edit-حمد").click();
    await expect(page.getByTestId("study-root-notes-input-حمد")).toBeVisible();
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot("study-root-editing.png", FULL_PAGE);
  });
});

test.describe("visual regression — study anonymous redirect", () => {
  test("anonymous user redirected to login", async ({ page }) => {
    await page.goto("/en/study");
    await expect(page).toHaveURL(/\/en\/auth\/login$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

    await expect(page).toHaveScreenshot("study-redirect-login.png", FULL_PAGE);
  });
});

/* ════════════════════════════════════════════════════════════
   7. RTL LAYOUT
   ════════════════════════════════════════════════════════════ */

test.describe("visual regression — RTL layout", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("arabic explore page", async ({ page }) => {
    await page.goto("/ar");
    await waitForExploreReady(page);
    await expect(page).toHaveScreenshot("explore-rtl.png", FULL_PAGE);
  });

  test("arabic explore with sidebar (desktop)", async ({ page }) => {
    test.skip(isMobile(page), "Desktop-only RTL sidebar test");
    await page.goto("/ar");
    await waitForExploreReady(page);

    await page.locator('[data-tour-id="tools-toggle"]').click();
    await expect(page.locator('[data-tour-id="tools-sidebar"]')).toBeVisible();
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("explore-rtl-sidebar.png", FULL_PAGE);
  });

  test("arabic auth login", async ({ page }) => {
    await page.goto("/ar/auth/login");
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot("auth-login-rtl.png", FULL_PAGE);
  });

  test("arabic study dashboard (authenticated)", async ({ page }) => {
    await seedAuthUser(page, "dev-user-rtl", "rtl-test@example.com");
    await seedStudyKnowledge(page);
    await page.goto("/ar/study");
    await page.waitForTimeout(1500);

    await expect(page).toHaveScreenshot("study-dashboard-rtl.png", FULL_PAGE);
  });
});

/* ════════════════════════════════════════════════════════════
   8. VISUALIZATION MODES (desktop only — force-directed layouts need space)
   ════════════════════════════════════════════════════════════ */

test.describe("visual regression — visualization modes (desktop only)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(isMobile(page), "Viz mode switching tests are desktop-only");
    test.setTimeout(90_000);
    await skipOnboarding(page);
  });

  test("surah distribution view", async ({ page }) => {
    await page.goto("/en");
    await waitForExploreReady(page);

    await page.getByTestId("viz-switcher-trigger").click();
    await page.getByTestId("viz-option-surah-distribution").click();
    await page.waitForTimeout(2000);

    const viewport = page.locator('[data-tour-id="main-viewport"]');
    await expect(viewport).toHaveScreenshot("viz-surah-distribution.png", SCREENSHOT_OPTS);
  });

  test("root network view", async ({ page }) => {
    await page.goto("/en");
    await waitForExploreReady(page);

    await page.getByTestId("viz-switcher-trigger").click();
    await page.getByTestId("viz-option-root-network").click();
    await page.waitForTimeout(2000);

    const viewport = page.locator('[data-tour-id="main-viewport"]');
    await expect(viewport).toHaveScreenshot("viz-root-network.png", SCREENSHOT_OPTS);
  });

  test("corpus architecture view", async ({ page }) => {
    await page.goto("/en");
    await waitForExploreReady(page);

    await page.getByTestId("viz-switcher-trigger").click();
    await page.getByRole("button", { name: /show all visualizations/i }).click();
    await page.getByTestId("viz-option-corpus-architecture").click();
    await page.waitForTimeout(2000);

    const viewport = page.locator('[data-tour-id="main-viewport"]');
    await expect(viewport).toHaveScreenshot("viz-corpus-architecture.png", SCREENSHOT_OPTS);
  });

  test("arc flow view", async ({ page }) => {
    await page.goto("/en");
    await waitForExploreReady(page);

    await page.getByTestId("viz-switcher-trigger").click();
    await page.getByRole("button", { name: /show all visualizations/i }).click();
    await page.getByTestId("viz-option-arc-flow").click();
    await page.waitForTimeout(2000);

    const viewport = page.locator('[data-tour-id="main-viewport"]');
    await expect(viewport).toHaveScreenshot("viz-arc-flow.png", SCREENSHOT_OPTS);
  });

  test("dependency tree view", async ({ page }) => {
    await page.goto("/en");
    await waitForExploreReady(page);

    // Select a token first (dependency tree needs ayah context)
    const searchInput = page.locator('[data-tour-id="global-search-root"] input').first();
    await searchInput.fill("praise");
    await expect(page.locator("#global-search-results")).toBeVisible();
    await page.locator(".search-result-item").first().click();

    await page.getByTestId("viz-switcher-trigger").click();
    await page.getByRole("button", { name: /show all visualizations/i }).click();
    await page.getByTestId("viz-option-dependency-tree").click();
    await page.waitForTimeout(2000);

    const viewport = page.locator('[data-tour-id="main-viewport"]');
    await expect(viewport).toHaveScreenshot("viz-dependency-tree.png", SCREENSHOT_OPTS);
  });

  test("sankey flow view", async ({ page }) => {
    await page.goto("/en");
    await waitForExploreReady(page);

    await page.getByTestId("viz-switcher-trigger").click();
    await page.getByRole("button", { name: /show all visualizations/i }).click();
    await page.getByTestId("viz-option-sankey-flow").click();
    await page.waitForTimeout(2000);

    const viewport = page.locator('[data-tour-id="main-viewport"]');
    await expect(viewport).toHaveScreenshot("viz-sankey-flow.png", SCREENSHOT_OPTS);
  });

  test("collocation network view", async ({ page }) => {
    await page.goto("/en");
    await waitForExploreReady(page);

    // Collocation needs a root context
    const searchInput = page.locator('[data-tour-id="global-search-root"] input').first();
    await searchInput.fill("praise");
    await expect(page.locator("#global-search-results")).toBeVisible();
    await page.locator(".search-result-item").first().click();

    await page.getByTestId("viz-switcher-trigger").click();
    await page.getByRole("button", { name: /show all visualizations/i }).click();
    await page.getByTestId("viz-option-collocation-network").click();
    await page.waitForTimeout(2000);

    const viewport = page.locator('[data-tour-id="main-viewport"]');
    await expect(viewport).toHaveScreenshot("viz-collocation-network.png", SCREENSHOT_OPTS);
  });

  test("knowledge graph view (authenticated)", async ({ page }) => {
    await seedAuthUser(page);
    await seedStudyKnowledge(page);
    await page.goto("/en");
    await waitForExploreReady(page);

    await page.getByTestId("viz-switcher-trigger").click();
    await page.getByTestId("viz-option-knowledge-graph").click();
    await page.waitForTimeout(2000);

    const viewport = page.locator('[data-tour-id="main-viewport"]');
    await expect(viewport).toHaveScreenshot("viz-knowledge-graph.png", SCREENSHOT_OPTS);
  });
});

/* ════════════════════════════════════════════════════════════
   9. MOBILE AUTH FLOW — auth pages on mobile viewport
   ════════════════════════════════════════════════════════════ */

test.describe("visual regression — mobile auth flow (mobile only)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isMobile(page), "Mobile-only auth tests");
  });

  test("mobile login page", async ({ page }) => {
    await page.goto("/en/auth/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveScreenshot("mobile-auth-login.png", FULL_PAGE);
  });

  test("mobile signup tab", async ({ page }) => {
    await page.goto("/en/auth/login");
    await expect(page.getByRole("tab", { name: /sign up/i })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("tab", { name: /sign up/i }).click();
    await page.waitForTimeout(200);
    await expect(page.locator('input[autocomplete="new-password"]').first()).toBeVisible();

    await expect(page).toHaveScreenshot("mobile-auth-signup.png", FULL_PAGE);
  });

  test("mobile reset password page", async ({ page }) => {
    await page.goto("/en/auth/reset-password");
    await expect(page.getByRole("heading", { name: /reset password/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page).toHaveScreenshot("mobile-auth-reset-password.png", FULL_PAGE);
  });

  test("mobile study dashboard", async ({ page }) => {
    await skipOnboarding(page);
    await seedAuthUser(page, "dev-user-mobile", "mobile@example.com");
    await seedStudyKnowledge(page);
    await page.goto("/en/study");
    await expect(page.getByRole("heading", { name: "Study", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator("text=mobile@example.com")).toBeVisible();
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot("mobile-study-dashboard.png", FULL_PAGE);
  });

  test("mobile study root editing", async ({ page }) => {
    await skipOnboarding(page);
    await seedAuthUser(page, "dev-user-mobile2", "mobile2@example.com");
    await seedStudyKnowledge(page);
    await page.goto("/en/study");
    await expect(page.getByRole("heading", { name: "Study", exact: true })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByTestId("study-root-edit-حمد").click();
    await expect(page.getByTestId("study-root-notes-input-حمد")).toBeVisible();
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot("mobile-study-root-editing.png", FULL_PAGE);
  });

  test("mobile study anonymous redirect", async ({ page }) => {
    await page.goto("/en/study");
    await expect(page).toHaveURL(/\/en\/auth\/login$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

    await expect(page).toHaveScreenshot("mobile-study-redirect.png", FULL_PAGE);
  });

  test("mobile arabic auth login (RTL)", async ({ page }) => {
    await page.goto("/ar/auth/login");
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot("mobile-auth-login-rtl.png", DYNAMIC_FULL);
  });
});

/* ════════════════════════════════════════════════════════════
   10. DEGRADED STATES (both viewports)
   ════════════════════════════════════════════════════════════ */

test.describe("visual regression — degraded states", () => {
  test("search unavailable state", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("qcv-dev-search-status", "unavailable");
    });
    await page.goto("/en/search");
    await expect(page.getByTestId("search-workspace-search-message")).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot("degraded-search-unavailable.png", FULL_PAGE);
  });

  test("corpus loading state", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "quran-corpus-onboarding",
        JSON.stringify({ version: "2", showOnStartup: false, completed: true }),
      );
      window.localStorage.setItem("qcv-dev-corpus-status", "loading");
    });
    await page.goto("/en");
    await page.waitForTimeout(1500);

    await expect(page).toHaveScreenshot("degraded-corpus-loading.png", FULL_PAGE);
  });

  test("corpus fallback state", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "quran-corpus-onboarding",
        JSON.stringify({ version: "2", showOnStartup: false, completed: true }),
      );
      window.localStorage.setItem("qcv-dev-corpus-status", "fallback");
    });
    await page.goto("/en");
    await page.waitForTimeout(1500);

    await expect(page).toHaveScreenshot("degraded-corpus-fallback.png", FULL_PAGE);
  });
});
