# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.js >> Smoke >> app boots into the dashboard without crashing
- Location: e2e/smoke.spec.js:4:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Indian', { exact: true }).first()
Expected: visible
Timeout: 8000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 8000ms
  - waiting for getByText('Indian', { exact: true }).first()

```

```yaml
- text: Step 1 of 5 Matrix One Let's personalise your edge. How would you rate your investing skill?
- button "Beginner":
  - text: Beginner
  - img
- button "Intermediate"
- button "Pro"
- button "Skip"
- button "Continue"
- text: Matrix One
- button "Activity":
  - img
- img
- text: Account LIVE (15m DELAY) 07:07 PM
- switch "Dark mode"
- img
- img
- text: Search any stock, crypto or commodity…
- button "🇺🇸 US"
- button "₿ Crypto"
- button "🪙 Commodity"
- text: NIFTY 50 — SENSEX — BANK NIFTY — S&P 500 — NASDAQ — DOW — BTC ▲2.10% ETH — GOLD — CRUDE —
- button "Total"
- button "Smart Auto-Buy"
- text: Virtual · 🇺🇸 US · current value My Portfolio
- img
- text: $0 Returns % +0.0% Net returns +$0 0 open 0 auto-buy No holdings yet — buy your first stock in Virtual Trade.
- img
- text: Top Picks Waiting on real indicators — picks are ranked on RSI and the 50-DMA, so they appear once the data lands.
- img
- text: Market updates
- paragraph: Live market data is still loading.
- img
- text: Ideas No ideas for this market right now — check back later or switch markets. VIX +% S&P 500 ▲ +% 🔥 Hot Stocks AAPL +0.5%
- img
- text: Earnings calendar
- button "Upcoming (1)"
- button "Recent (1)"
- text: AAPL Est. EPS 1.50 Jul 23
- img
- text: Trending now No intraday moves yet — trending needs live 5-minute candles, which arrive while the market is open. Screener Build rules from technicals, fundamentals or events. Recommended
- button "Momentum movers"
- button "Value with growth"
- button "Oversold bounce"
- button "EMA 21 > EMA 50"
- text: Build your own
- combobox "Metric":
  - option "Day change %"
  - option "Price"
  - option "RSI" [selected]
  - option "MACD"
  - option "ADX"
  - option "CCI"
  - option "Stochastic %K"
  - option "MFI"
  - option "ATR"
  - option "VWAP"
  - option "EMA 20"
  - option "EMA 50"
  - option "SMA 50 (50-DMA)"
  - option "SMA 200 (200-DMA)"
  - option "Bollinger %B"
- combobox "Comparator":
  - option ">" [selected]
  - option "<"
  - option "≥"
  - option "≤"
- textbox "value": "50"
- button:
  - img
- button "vs value"
- button "vs indicator"
- text: TF Screening on daily indicators
- button "Add condition":
  - img
  - text: Add condition
- text: Or write a prompt
- textbox "e.g. large-cap IT stocks with RSI under 40 and rising revenue"
- button "Run screener":
  - img
  - text: Run screener
- img
- text: Top gainers & losers
- button "Gainers"
- button "Losers"
- text: AAPL Apple $230
- img
- text: +0.50%
- img
- text: In the news RELIANCE.NS Reliance posts record quarter Test · 0m ago
- button "Read more":
  - text: Read more
  - img
- text: MatrixOne is a personal project for research purposes only. It is not for commercial use and does not recommend or advise any trade.
- button "Terms of Use"
- button "Privacy Policy"
- button "Disclaimer"
- button "FAQ"
- text: "For any queries, contact: brandbucksconsulting@gmail.com © 2026 · All rights reserved Log in Use your phone number and a PIN to save trades, automations and preferences across visits."
- button "Log in"
- button "Register"
- text: Phone number
- textbox "10-digit mobile"
- text: PIN (4+ digits)
- textbox "••••"
- button "Log in"
- button "Forgot PIN?"
- button "Cancel"
```

# Test source

```ts
  1  | import { test, expect, enterApp } from "./fixtures";
  2  | 
  3  | test.describe("Smoke", () => {
  4  |   test("app boots into the dashboard without crashing", async ({ page }) => {
  5  |     const errors = [];
  6  |     page.on("pageerror", (e) => errors.push(String(e)));
  7  |     await enterApp(page);
  8  |     // The market tabs are always present text on the dashboard — a reliable "we're in" signal.
  9  |     for (const m of ["Indian", "US", "Crypto", "Commodity"]) {
> 10 |       await expect(page.getByText(m, { exact: true }).first()).toBeVisible();
     |                                                                ^ Error: expect(locator).toBeVisible() failed
  11 |     }
  12 |     expect(errors, "no uncaught page errors on load").toEqual([]);
  13 |   });
  14 | 
  15 |   test("market tabs switch without error", async ({ page }) => {
  16 |     await enterApp(page);
  17 |     for (const m of ["US", "Crypto", "Indian"]) {
  18 |       await page.getByText(m, { exact: true }).first().click();
  19 |       await page.waitForTimeout(400);
  20 |     }
  21 |     // Still alive: a price (₹ or $) is on screen.
  22 |     await expect(page.locator("text=/₹|\\$/").first()).toBeVisible();
  23 |   });
  24 | });
  25 | 
```