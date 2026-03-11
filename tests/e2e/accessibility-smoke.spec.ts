import { expect, test } from "@playwright/test";

test.describe("accessibility smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "quran-corpus-onboarding",
        JSON.stringify({
          version: "2",
          showOnStartup: false,
          completed: true,
        })
      );
    });
  });

  test("explore exposes landmarks and keyboard-reachable mode navigation", async ({ page }) => {
    await page.goto("/en");

    const modeNav = page.getByRole("navigation", { name: /app mode navigation/i });
    const exploreLink = page.getByTestId("app-mode-link-explore");

    await expect(modeNav).toBeVisible();
    await expect(page.locator("main[data-tour-id='main-viewport']")).toBeVisible();
    await exploreLink.focus();
    await expect(exploreLink).toBeFocused();
  });

  test("search exposes a labeled search input and primary heading", async ({ page }) => {
    await page.goto("/en/search");

    await expect(page.getByRole("heading", { name: /find roots, ayahs, lemmas, and glosses faster/i })).toBeVisible();
    await expect(page.getByRole("combobox", { name: /search roots, words, meanings/i }).first()).toBeVisible();
    await expect(page.getByTestId("app-mode-nav")).toBeVisible();
    await expect(page.getByTestId("app-mode-nav")).toHaveAttribute("aria-label", /app mode navigation/i);
  });

  test("auth login exposes labeled inputs and tabbed auth navigation", async ({ page }) => {
    await page.goto("/en/auth/login");

    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /sign up/i })).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
  });
});
