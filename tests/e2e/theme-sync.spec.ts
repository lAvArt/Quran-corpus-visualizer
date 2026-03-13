import { expect, test } from "@playwright/test";
import { DEFAULT_CUSTOM_COLOR_THEME } from "../../lib/theme/colorThemes";

const THEME_COOKIE_NAME = "quran-corpus-theme";

function encodeThemeCookie(theme: "light" | "dark") {
  return encodeURIComponent(
    JSON.stringify({
      theme,
      colorThemeId: "teal-amber",
      customColorTheme: DEFAULT_CUSTOM_COLOR_THEME,
    })
  );
}

test.describe("theme sync", () => {
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

  test("search restores the saved dark theme on hard refresh", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "quran-corpus-viz-state",
        JSON.stringify({
          theme: "dark",
          colorThemeId: "teal-amber",
        })
      );
    });

    await page.goto("/en/search");
    await page.reload();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect
      .poll(() =>
        page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg-0").trim())
      )
      .toBe("#0c0b0d");
    await expect
      .poll(() => page.evaluate(() => document.cookie.includes("quran-corpus-theme=")))
      .toBe(true);
  });

  test("explore SSR respects a persisted light theme cookie", async ({ context, page }) => {
    await context.addCookies([
      {
        name: THEME_COOKIE_NAME,
        value: encodeThemeCookie("light"),
        url: "http://127.0.0.1:3000",
      },
    ]);

    const response = await context.request.get("/en");
    const html = await response.text();

    expect(html).toContain('data-theme="light"');
    expect(html).toContain('class="immersive-dashboard" data-theme="light"');

    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator(".immersive-dashboard")).toHaveAttribute("data-theme", "light");
  });
});
