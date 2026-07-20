import { test, expect, enterApp } from "./fixtures";

// High-value journeys. Selectors are forgiving (text/regex) because the UI is dense.

test("open a stock and see its detail", async ({ page }) => {
  await enterApp(page);
  await page.getByText("RELIANCE", { exact: true }).first().click();
  await page.waitForTimeout(600);
  await expect(page.locator("text=/₹|\\$/").first()).toBeVisible();
});

test("Automate: Neo interprets a plain-English prompt", async ({ page }) => {
  await enterApp(page);
  await page.getByText("Auto", { exact: true }).first().click();
  await page.waitForTimeout(500);
  // Enter prompt mode if the toggle exists.
  const promptTab = page.getByText(/Write a Prompt/i).first();
  if (await promptTab.count().catch(() => 0)) await promptTab.click();
  const box = page.getByPlaceholder(/cup and handle|bounces off support|describe|plain English|EMA/i).first();
  if (await box.count().catch(() => 0)) {
    await box.fill("buy when a cup and handle forms and RSI is above 50");
    await expect(page.getByText(/Neo reads/i).first()).toBeVisible();
  }
});

test("Profile opens; delete-account (if signed in) warns about data loss", async ({ page }) => {
  await enterApp(page);
  const profile = page.getByText(/Login|Profile/i).first();
  if (await profile.count().catch(() => 0)) {
    await profile.click();
    await page.waitForTimeout(300);
    const del = page.getByText(/Delete account/i).first();
    if (await del.count().catch(() => 0)) {
      await del.click();
      await expect(page.getByText(/permanent|cannot be undone|erased|deleted/i).first()).toBeVisible();
      await page.getByText(/Cancel/i).first().click();
    }
  }
});

test("no real broker/market host is ever contacted", async ({ page }) => {
  const bad = [];
  page.on("request", (r) => {
    if (/finance\.yahoo|financialmodelingprep|indianapi|fyers|delta\.exchange|api\.kite|dhan\.co/.test(r.url())) bad.push(r.url());
  });
  await enterApp(page);
  await page.waitForTimeout(1000);
  for (const m of ["US", "Crypto", "Indian"]) { await page.getByText(m, { exact: true }).first().click(); await page.waitForTimeout(300); }
  expect(bad, "no requests to real broker/data hosts").toEqual([]);
});
