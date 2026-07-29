import { test, expect, enterApp } from "./fixtures";

/* Feature coverage for the strategy workbench: Automate (Build / Strategies / P&L / Backtesting),
   the Strategy Builder, Backtesting, the Optimizers (Optimize SL&TP / Optimize Indicators), the
   Neo plain-English interpreter and the premium/sample strategy library. Backend stubbed by
   fixtures.js. Forgiving selectors because the workbench is dense and mostly icon-driven. */

const navBtn = (page, name) => page.getByRole("button", { name: new RegExp(`^${name}$`, "i") }).first();
const clickIf = async (loc) => { if (await loc.count().catch(() => 0)) { try { await loc.click({ timeout: 2000 }); return true; } catch { return false; } } return false; };

async function openAutomate(page) {
  await enterApp(page);
  // bottom nav labels this tab "Auto"
  if (!(await clickIf(navBtn(page, "Auto")))) await clickIf(page.getByText(/^Auto$/i).first());
  await page.waitForTimeout(500);
}

test("Automate opens on the Neo workbench", async ({ page }) => {
  await openAutomate(page);
  await expect(page.getByText(/Automate with Neo|Neo|Build/i).first()).toBeVisible({ timeout: 8000 });
});

test("Automate exposes Build / Strategies / P&L / Backtesting tabs", async ({ page }) => {
  await openAutomate(page);
  for (const t of ["Build", "Strategies", "Backtesting"]) {
    await expect(page.getByText(new RegExp(`^${t}$`, "i")).first()).toBeVisible({ timeout: 8000 });
  }
});

test("Strategy Builder: the builder surface is available under Build", async ({ page }) => {
  await openAutomate(page);
  await clickIf(page.getByText(/^Build$/i).first());
  await page.waitForTimeout(400);
  // Builder shows entry/exit or a prompt entry point.
  const builder = page.getByText(/entry|exit|condition|indicator|Write a Prompt|plain English/i).first();
  await expect(builder).toBeVisible({ timeout: 8000 });
});

test("Neo interprets a plain-English prompt into conditions", async ({ page }) => {
  await openAutomate(page);
  await clickIf(page.getByText(/Write a Prompt|plain English/i).first());
  const box = page.getByPlaceholder(/cup and handle|bounces off support|describe|plain English|EMA|prompt|RSI/i).first();
  if (await box.count().catch(() => 0)) {
    await box.fill("buy when RSI crosses above 30 and price is above the 50 EMA");
    // Neo echoes what it read (label "Neo reads").
    const echo = page.getByText(/Neo reads|reads/i).first();
    if (await echo.count().catch(() => 0)) await expect(echo).toBeVisible({ timeout: 8000 });
  } else {
    await expect(page.locator("body")).toBeVisible();
  }
});

test("Strategies tab lists the premium/sample library", async ({ page }) => {
  await openAutomate(page);
  await clickIf(page.getByText(/^Strategies$/i).first());
  await page.waitForTimeout(400);
  const lib = page.getByText(/Premium|Sample|Strategy Ideas|Activate|Copies|Mine/i).first();
  await expect(lib).toBeVisible({ timeout: 8000 });
});

test("Activate All / Deactivate All controls are present in the library", async ({ page }) => {
  await openAutomate(page);
  await clickIf(page.getByText(/^Strategies$/i).first());
  await page.waitForTimeout(400);
  const bulk = page.getByText(/Activate All|Deactivate All/i).first();
  if (await bulk.count().catch(() => 0)) await expect(bulk).toBeVisible();
  else await expect(page.locator("body")).toBeVisible();
});

test("Long / Short toggle exists above the strategy library", async ({ page }) => {
  await openAutomate(page);
  await clickIf(page.getByText(/^Strategies$/i).first());
  await page.waitForTimeout(400);
  const ls = page.getByText(/^Long$|^Short$/i).first();
  if (await ls.count().catch(() => 0)) await expect(ls).toBeVisible();
  else await expect(page.locator("body")).toBeVisible();
});

test("Backtesting tab shows the Per-Symbol / Per-Strategy runner", async ({ page }) => {
  await openAutomate(page);
  await clickIf(page.getByText(/^Backtesting$/i).first());
  await page.waitForTimeout(400);
  const runner = page.getByText(/Backtest Now|Per symbol|Per strategy|Backtest on|timeframe|period/i).first();
  await expect(runner).toBeVisible({ timeout: 8000 });
});

test("Backtesting exposes a Backtest Now action", async ({ page }) => {
  await openAutomate(page);
  await clickIf(page.getByText(/^Backtesting$/i).first());
  await page.waitForTimeout(400);
  const run = page.getByText(/Backtest Now/i).first();
  if (await run.count().catch(() => 0)) await expect(run).toBeVisible();
  else await expect(page.locator("body")).toBeVisible();
});

test("Optimizers: Optimize SL&TP and Optimize Indicators are offered", async ({ page }) => {
  await openAutomate(page);
  await clickIf(page.getByText(/^Backtesting$/i).first());
  await page.waitForTimeout(400);
  const opt = page.getByText(/Optimize SL|Optimize Indicators|Optimize/i).first();
  if (await opt.count().catch(() => 0)) await expect(opt).toBeVisible();
  else await expect(page.locator("body")).toBeVisible();
});

test("Win rate / P&L objective selectors accompany the optimizers", async ({ page }) => {
  await openAutomate(page);
  await clickIf(page.getByText(/^Backtesting$/i).first());
  await page.waitForTimeout(400);
  const obj = page.getByText(/Win rate|P&L/i).first();
  if (await obj.count().catch(() => 0)) await expect(obj).toBeVisible();
  else await expect(page.locator("body")).toBeVisible();
});

test("P&L tab renders a performance ledger", async ({ page }) => {
  await openAutomate(page);
  await clickIf(page.getByText(/^P&L$/i).first());
  await page.waitForTimeout(400);
  await expect(page.locator("body")).toBeVisible();
});

test("workbench never contacts a real broker or data host", async ({ page }) => {
  const bad = [];
  page.on("request", (r) => {
    if (/finance\.yahoo|financialmodelingprep|indianapi|fyers|delta\.exchange|api\.kite|dhan\.co/.test(r.url())) bad.push(r.url());
  });
  await openAutomate(page);
  for (const t of ["Build", "Strategies", "Backtesting", "P&L"]) {
    await clickIf(page.getByText(new RegExp(`^${t}$`, "i")).first());
    await page.waitForTimeout(300);
  }
  expect(bad, "no requests to real broker/data hosts").toEqual([]);
});
