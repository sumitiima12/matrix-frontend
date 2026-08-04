import { test, expect, enterApp } from "./fixtures";

// Market-tab labels carry a flag/emoji prefix ("🇮🇳 Indian"), so match by substring via the
// button's accessible name rather than exact text.
const tab = (page, name) => page.getByRole("button", { name: new RegExp(name + "$", "i") }).first();   // anchor to the market pill (ends with the name) so /US/ does not also match "Terms of Use"

test.describe("Smoke", () => {
  test("app boots into the dashboard without crashing", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await enterApp(page);
    // At least the always-available market tabs are on screen — a reliable "we're in" signal.
    for (const m of ["US", "Crypto", "Commodity"]) {
      await expect(tab(page, m)).toBeVisible();
    }
    expect(errors, "no uncaught page errors on load").toEqual([]);
  });

  test("market tabs switch without error", async ({ page }) => {
    await enterApp(page);
    for (const m of ["US", "Crypto", "Indian"]) {
      const t = tab(page, m);
      if (await t.count().catch(() => 0)) { await t.click(); await page.waitForTimeout(400); }
    }
    // Still alive: a price (₹ or $) is on screen.
    await expect(page.locator("text=/₹|\\$/").first()).toBeVisible();
  });
});
