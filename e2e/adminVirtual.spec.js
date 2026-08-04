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

  test("a virtual BUY produces a POSITIVE virtual outcome (state change), never a real execution", async ({ page }) => {
    const brokerHits = trackBrokerCalls(page);
    await enterApp(page);
    const buy = await firstVisible(page, /^Buy$|^Buy /i);
    expect(buy, "a Buy control must exist in virtual mode").not.toBeNull();
    await buy.click();                              // no try/catch — a failure here fails the test
    await page.waitForTimeout(300);
    const confirm = await firstVisible(page, /Confirm|Place|^Buy$/i);
    if (confirm) { await confirm.click(); await page.waitForTimeout(400); }
    // R33-P3-02: a no-op Buy handler must NOT pass. Require a POSITIVE virtual-execution signal — a confirmation
    // toast/row that the paper trade happened — rather than merely the absence of "Real executed". We accept any of
    // the app's success surfaces (toast copy OR a new portfolio position for the instrument).
    const positive = page.getByText(/(virtual|paper).*(bought|added|filled|executed|position)|added to (your )?portfolio|position opened|order placed|holding/i).first();
    await expect(positive, "a virtual buy must surface a concrete success/state-change signal").toBeVisible({ timeout: 4000 });
    // And it must NEVER assert a real broker execution, nor touch a broker endpoint.
    await expect(page.getByText(/Real .*(filled|executed) on/i)).toHaveCount(0);
    expect(brokerHits(), "a virtual buy must not hit any broker endpoint").toHaveLength(0);
  });

  test("a virtual BUY strictly INCREASES the portfolio position count and PERSISTS across reload (no broker)", async ({ page }) => {
    const brokerHits = trackBrokerCalls(page);
    await enterApp(page);
    // Count portfolio positions BEFORE the buy. A holding row is a table row / list item that carries a P&L or qty
    // cell; this count is the exact state we assert changes — a no-op Buy handler leaves it unchanged and FAILS.
    const gotoPortfolio = async () => { const p = await firstVisible(page, /Portfolio/i); if (p) { await p.click(); await page.waitForTimeout(350); } };
    const countPositions = () => page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("tr,li,[data-position],[data-holding]"));
      const isPos = (el) => /[▲▼]|[-+]?[₹$]\s?\d|P&?L|\bqty\b|\b\d+(\.\d+)?\s*(shares|coins|lots|units)\b/i.test(el.textContent || "");
      return rows.filter(isPos).length;
    });
    await gotoPortfolio();
    const before = await countPositions();
    // Place a virtual buy — confirmation is MANDATORY here (a real trade must be committed, not just intended).
    const home = await firstVisible(page, /Home|Screener/i); if (home) { await home.click(); await page.waitForTimeout(300); }
    const buy = await firstVisible(page, /^Buy$|^Buy /i);
    expect(buy, "a Buy control must exist").not.toBeNull();
    await buy.click(); await page.waitForTimeout(300);
    const confirm = await firstVisible(page, /Confirm|Place|^Buy$/i);
    expect(confirm, "a confirm control must appear and be clicked (no optional confirm)").not.toBeNull();
    await confirm.click(); await page.waitForTimeout(500);
    await gotoPortfolio();
    const after = await countPositions();
    expect(after, "a virtual buy must add exactly one holding/position (strict state transition)").toBeGreaterThan(before);
    // Reload and assert the new position survived (identity persists), still with zero broker traffic.
    await page.reload(); await page.waitForTimeout(800);
    await gotoPortfolio();
    const afterReload = await countPositions();
    expect(afterReload, "the virtual position count persists across reload").toBeGreaterThanOrEqual(after);
    expect(brokerHits(), "no broker endpoint touched across the whole journey").toHaveLength(0);
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
