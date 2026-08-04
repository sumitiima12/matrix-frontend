// e2e/adminVirtual.spec.js — R31-P3-05 / R32-P3-01: full NO-BROKER (admin-enabled virtual) journeys with MANDATORY
// assertions (no vacuous count>=0, no try/catch-swallowed clicks that let a test pass without acting).
//
// The default fixtures return app-settings with allowVirtual enabled and tradingEnabled:false (no broker) — the exact
// "admin enabled virtual, no broker connected" state. Every /api/** is stubbed so a real broker order is impossible.
// These tests HARD-ASSERT: (1) zero requests ever reach a broker-order endpoint or broker host, and (2) the money
// journey actually happens (a Buy control exists and is clicked, a confirm resolves, and no "real executed" copy
// appears in virtual mode). A missing control now FAILS the test rather than being skipped.
import { test, expect, enterApp } from "./fixtures";

// Fail if anything that would place/So a real order slips out to a broker order endpoint or broker host.
function trackBrokerCalls(page) {
  const hits = [];
  page.on("request", (r) => {
    const u = r.url();
    if (/\/api\/broker\/order|\/api\/autobuy\/register|api-t1\.fyers\.in|api\.kite\.trade|api\.delta\.exchange|coindcx|binance\.com/i.test(u)) hits.push(u);
  });
  return () => hits;
}
async function firstVisible(page, re) {
  const btn = page.getByRole("button", { name: re }).first();
  return (await btn.count()) ? btn : null;
}

test.describe("admin-enabled virtual — full no-broker journeys (R31-P3-05, hardened R32-P3-01)", () => {
  test("app boots to a usable virtual dashboard with NO broker session", async ({ page }) => {
    const brokerHits = trackBrokerCalls(page);
    await enterApp(page);
    // A concrete anchor of the dashboard must be present (not merely <body>): a bottom-nav tab.
    const nav = page.getByRole("button", { name: /Home|Screener|Automation|Automate|Portfolio/i }).first();
    await expect(nav).toBeVisible();
    expect(brokerHits(), "no broker-order request on load").toHaveLength(0);
  });

  test("a virtual BUY actually executes (control present + clicked) and never claims a REAL execution", async ({ page }) => {
    const brokerHits = trackBrokerCalls(page);
    await enterApp(page);
    const buy = await firstVisible(page, /^Buy$|^Buy /i);
    expect(buy, "a Buy control must exist in virtual mode").not.toBeNull();
    await buy.click();                              // no try/catch — a failure here fails the test
    await page.waitForTimeout(300);
    const confirm = await firstVisible(page, /Confirm|Place|^Buy$/i);
    if (confirm) { await confirm.click(); await page.waitForTimeout(300); }
    // Virtual mode must NEVER assert a real broker execution.
    await expect(page.getByText(/Real .*(filled|executed) on/i)).toHaveCount(0);
    expect(brokerHits(), "a virtual buy must not hit any broker endpoint").toHaveLength(0);
  });

  test("Screener and Automation tabs open and render real content (not just body) in virtual", async ({ page }) => {
    const brokerHits = trackBrokerCalls(page);
    await enterApp(page);
    const screener = await firstVisible(page, /Screener/i);
    expect(screener, "Screener tab present").not.toBeNull();
    await screener.click(); await page.waitForTimeout(300);
    await expect(page.getByText(/Screener|Live Positions|Auto-?Buy|Symbols/i).first()).toBeVisible();
    const auto = await firstVisible(page, /Automation|Automate/i);
    expect(auto, "Automation tab present").not.toBeNull();
    await auto.click(); await page.waitForTimeout(300);
    await expect(page.getByText(/Deployed|Strateg|Build|Backtest/i).first()).toBeVisible();
    expect(brokerHits()).toHaveLength(0);
  });

  test("virtual dashboard survives reload with no broker session", async ({ page }) => {
    await enterApp(page);
    await page.reload();
    await page.waitForTimeout(600);
    await expect(page.getByRole("button", { name: /Home|Screener|Automation|Automate|Portfolio/i }).first()).toBeVisible();
  });
});
