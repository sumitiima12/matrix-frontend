import { test, expect, enterApp } from "./fixtures";

test.describe("Smoke", () => {
  test("app boots into the dashboard without crashing", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await enterApp(page);
    // The market tabs are always present text on the dashboard — a reliable "we're in" signal.
    for (const m of ["Indian", "US", "Crypto", "Commodity"]) {
      await expect(page.getByText(m, { exact: true }).first()).toBeVisible();
    }
    expect(errors, "no uncaught page errors on load").toEqual([]);
  });

  test("market tabs switch without error", async ({ page }) => {
    await enterApp(page);
    for (const m of ["US", "Crypto", "Indian"]) {
      await page.getByText(m, { exact: true }).first().click();
      await page.waitForTimeout(400);
    }
    // Still alive: a price (₹ or $) is on screen.
    await expect(page.locator("text=/₹|\\$/").first()).toBeVisible();
  });
});
