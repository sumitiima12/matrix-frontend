# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: flows.spec.js >> open a stock and see its detail
- Location: e2e/flows.spec.js:5:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByText('RELIANCE', { exact: true }).first()
    - locator resolved to <div class="disp">RELIANCE</div>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div>Use your phone number and a PIN to save trades, a…</div> from <div>…</div> subtree intercepts pointer events
  - retrying click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div class="sheet card">…</div> from <div>…</div> subtree intercepts pointer events
  - retrying click action
    - waiting 20ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div>Use your phone number and a PIN to save trades, a…</div> from <div>…</div> subtree intercepts pointer events
  2 × retrying click action
      - waiting 100ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div>…</div> intercepts pointer events
  11 × retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <div class="sheet card">…</div> from <div>…</div> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <div>Use your phone number and a PIN to save trades, a…</div> from <div>…</div> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <div>…</div> intercepts pointer events
     - retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <div>…</div> intercepts pointer events
  - retrying click action
    - waiting 500ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div class="sheet card">…</div> from <div>…</div> subtree intercepts pointer events
  - retrying click action
    - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e6]: Step 1 of 5
    - generic "Matrix One" [ref=e14]:
      - generic [ref=e15]: Matrix
      - generic [ref=e16]: One
    - generic [ref=e17]: Let's personalise your edge.
    - generic [ref=e18]: How would you rate your investing skill?
    - generic [ref=e19]:
      - button "Beginner" [ref=e20] [cursor=pointer]:
        - text: Beginner
        - img [ref=e21]
      - button "Intermediate" [ref=e23] [cursor=pointer]
      - button "Pro" [ref=e24] [cursor=pointer]
    - generic [ref=e25]:
      - button "Skip" [ref=e26] [cursor=pointer]
      - button "Continue" [ref=e27] [cursor=pointer]
  - generic [ref=e28]:
    - generic [ref=e29]:
      - generic [ref=e30]:
        - generic "Matrix One" [ref=e32] [cursor=pointer]:
          - generic [ref=e33]: Matrix
          - generic [ref=e34]: One
        - generic [ref=e35]:
          - button "Virtual wallet" [ref=e36] [cursor=pointer]:
            - img [ref=e37]
            - generic [ref=e40]: 10.00 L
          - button "Activity" [ref=e41] [cursor=pointer]:
            - img [ref=e42]
          - generic [ref=e45] [cursor=pointer]:
            - img [ref=e47]
            - generic [ref=e50]: Account
      - generic [ref=e51]:
        - generic "Yahoo Finance — delayed ~15 minutes on NSE. Connect a broker for a real-time feed." [ref=e52] [cursor=pointer]: LIVE (15m DELAY)
        - generic [ref=e54]:
          - generic [ref=e55]: 12:25 PM
          - switch "Dark mode" [ref=e56] [cursor=pointer]
          - img [ref=e59]
      - generic [ref=e66] [cursor=pointer]:
        - img [ref=e67]
        - text: Search any stock, crypto or commodity…
      - generic [ref=e70]:
        - button "🇮🇳 Indian" [ref=e71] [cursor=pointer]
        - button "🇺🇸 US" [ref=e72] [cursor=pointer]
        - button "₿ Crypto" [ref=e73] [cursor=pointer]
        - button "🪙 Commodity" [ref=e74] [cursor=pointer]
    - generic [ref=e75]:
      - generic [ref=e76]:
        - generic [ref=e77]:
          - generic [ref=e78]:
            - generic [ref=e79]: NIFTY 50
            - generic [ref=e80]: —
          - generic [ref=e81]:
            - generic [ref=e82]: SENSEX
            - generic [ref=e83]: —
          - generic [ref=e84]:
            - generic [ref=e85]: BANK NIFTY
            - generic [ref=e86]: —
          - generic [ref=e87]:
            - generic [ref=e88]: S&P 500
            - generic [ref=e89]: —
          - generic [ref=e90]:
            - generic [ref=e91]: NASDAQ
            - generic [ref=e92]: —
          - generic [ref=e93]:
            - generic [ref=e94]: DOW
            - generic [ref=e95]: —
          - generic [ref=e96]:
            - generic [ref=e97]: BTC
            - generic [ref=e98]: ▲2.10%
          - generic [ref=e99]:
            - generic [ref=e100]: ETH
            - generic [ref=e101]: —
          - generic [ref=e102]:
            - generic [ref=e103]: GOLD
            - generic [ref=e104]: —
          - generic [ref=e105]:
            - generic [ref=e106]: CRUDE
            - generic [ref=e107]: —
        - generic [ref=e109]:
          - generic [ref=e110]:
            - button "Total" [ref=e111] [cursor=pointer]
            - button "Smart Auto-Buy" [ref=e112] [cursor=pointer]
          - generic [ref=e113] [cursor=pointer]:
            - generic [ref=e114]:
              - generic [ref=e115]: Virtual · 🇮🇳 Indian · current value
              - generic [ref=e116]:
                - text: My Portfolio
                - img [ref=e117]
            - generic [ref=e119]: ₹0
            - generic [ref=e120]:
              - generic [ref=e121]:
                - generic [ref=e122]: Returns %
                - generic [ref=e123]: +0.0%
              - generic [ref=e124]:
                - generic [ref=e125]: Net returns
                - generic [ref=e126]: +₹0
            - generic [ref=e127]:
              - generic [ref=e128]: 0 open
              - generic [ref=e129]: 0 auto-buy
            - generic [ref=e130]: No holdings yet — buy your first stock in Virtual Trade.
        - generic [ref=e131]:
          - generic [ref=e133]:
            - img [ref=e134]
            - text: Top Picks
          - generic [ref=e137]: Waiting on real indicators — picks are ranked on RSI and the 50-DMA, so they appear once the data lands.
        - generic [ref=e140]:
          - generic [ref=e141]:
            - img [ref=e142]
            - text: Market updates
          - paragraph [ref=e145]: Live market data is still loading.
        - generic [ref=e146]:
          - generic [ref=e148]:
            - img [ref=e149]
            - text: Ideas
          - generic [ref=e152]: No ideas for this market right now — check back later or switch markets.
        - generic [ref=e154]:
          - generic [ref=e155] [cursor=pointer]:
            - generic [ref=e156]: INDIA VIX
            - generic [ref=e158]: +%
          - generic [ref=e160] [cursor=pointer]:
            - generic [ref=e161]: NIFTY 50
            - generic [ref=e162]: ▲ +%
          - generic [ref=e164]:
            - generic [ref=e165]: 🔥 Hot Stocks
            - generic [ref=e167] [cursor=pointer]:
              - generic [ref=e168]: INFY
              - generic [ref=e169]: +0.8%
        - generic [ref=e170]:
          - generic [ref=e171]:
            - img [ref=e172]
            - text: Earnings · results
          - generic [ref=e174]:
            - button "Upcoming (1)" [ref=e175] [cursor=pointer]
            - button "Recent (1)" [ref=e176] [cursor=pointer]
          - generic [ref=e178] [cursor=pointer]:
            - generic [ref=e179]: AAPL
            - generic [ref=e180]: Est. EPS 1.50
            - generic [ref=e181]: Jul 23
        - generic [ref=e182]:
          - generic [ref=e184]:
            - img [ref=e185]
            - text: Trending now
          - generic [ref=e190]: No intraday moves yet — trending needs live 5-minute candles, which arrive while the market is open.
        - generic [ref=e192]:
          - generic [ref=e193]: Screener
          - generic [ref=e194]: Build rules from technicals, fundamentals or events.
          - generic [ref=e195]: Recommended
          - generic [ref=e196]:
            - button "Momentum movers" [ref=e197] [cursor=pointer]
            - button "Value with growth" [ref=e198] [cursor=pointer]
            - button "Oversold bounce" [ref=e199] [cursor=pointer]
            - button "EMA 21 > EMA 50" [ref=e200] [cursor=pointer]
          - generic [ref=e201]:
            - generic [ref=e202]: Build your own
            - generic [ref=e203]:
              - generic [ref=e204]:
                - combobox "Metric" [ref=e205]:
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
                - combobox "Comparator" [ref=e206]:
                  - option ">" [selected]
                  - option "<"
                  - option "≥"
                  - option "≤"
                - textbox "value" [ref=e207]: "50"
                - button [ref=e208] [cursor=pointer]:
                  - img [ref=e209]
              - generic [ref=e212]:
                - generic [ref=e213]:
                  - button "vs value" [ref=e214] [cursor=pointer]
                  - button "vs indicator" [ref=e215] [cursor=pointer]
                - generic [ref=e216]: TF
            - text: Screening on daily indicators
            - button "Add condition" [ref=e217] [cursor=pointer]:
              - img [ref=e218]
              - text: Add condition
            - generic [ref=e219]: Or write a prompt
            - textbox "e.g. large-cap IT stocks with RSI under 40 and rising revenue" [ref=e220]
            - button "Run screener" [ref=e221] [cursor=pointer]:
              - img [ref=e222]
              - text: Run screener
        - generic [ref=e224]:
          - generic [ref=e225]:
            - generic [ref=e226]:
              - img [ref=e227]
              - text: Top gainers & losers
            - generic [ref=e229]:
              - button "Gainers" [ref=e230] [cursor=pointer]
              - button "Losers" [ref=e231] [cursor=pointer]
          - generic [ref=e233]:
            - generic [ref=e234] [cursor=pointer]:
              - generic [ref=e235]:
                - generic [ref=e236]: RELIANCE
                - generic [ref=e237]: Reliance Industries
              - generic [ref=e238]:
                - generic [ref=e239]: ₹2,900
                - generic [ref=e240]:
                  - img [ref=e241]
                  - text: +1.20%
            - generic [ref=e244] [cursor=pointer]:
              - generic [ref=e245]:
                - generic [ref=e246]: INFY
                - generic [ref=e247]: Infosys
              - generic [ref=e248]:
                - generic [ref=e249]: ₹1,600
                - generic [ref=e250]:
                  - img [ref=e251]
                  - text: +0.80%
            - generic [ref=e254] [cursor=pointer]:
              - generic [ref=e255]:
                - generic [ref=e256]: TCS
                - generic [ref=e257]: Tata Consultancy Services
              - generic [ref=e258]:
                - generic [ref=e259]: ₹3,800
                - generic [ref=e260]:
                  - img [ref=e261]
                  - text: "-0.40%"
        - generic [ref=e264]:
          - generic [ref=e266]:
            - img [ref=e267]
            - text: In the news
          - generic [ref=e272]:
            - generic [ref=e273]:
              - generic [ref=e275]: RELIANCE.NS
              - generic [ref=e276]: Reliance posts record quarter
              - generic [ref=e277]: Test · 0m ago
            - button "Read more" [ref=e278] [cursor=pointer]:
              - text: Read more
              - img [ref=e279]
      - generic [ref=e281]:
        - generic [ref=e282]: MatrixOne is a personal project for research purposes only. It is not for commercial use and does not recommend or advise any trade.
        - generic [ref=e283]:
          - button "Terms of Use" [ref=e284] [cursor=pointer]
          - button "Privacy Policy" [ref=e285] [cursor=pointer]
          - button "Disclaimer" [ref=e286] [cursor=pointer]
          - button "FAQ" [ref=e287] [cursor=pointer]
        - generic [ref=e288]: "For any queries, contact: brandbucksconsulting@gmail.com"
        - generic [ref=e289]: © 2026 · All rights reserved
  - generic [ref=e291]:
    - generic [ref=e293]: Log in
    - generic [ref=e294]: Use your phone number and a PIN to save trades, automations and preferences across visits.
    - generic [ref=e295]:
      - button "Log in" [ref=e296] [cursor=pointer]
      - button "Register" [ref=e297] [cursor=pointer]
    - generic [ref=e298]: Phone number
    - textbox "10-digit mobile" [ref=e299]
    - generic [ref=e300]: PIN (4+ digits)
    - textbox "••••" [ref=e301]
    - button "Log in" [ref=e302] [cursor=pointer]
    - button "Forgot PIN?" [ref=e303] [cursor=pointer]
    - button "Cancel" [ref=e304] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect, enterApp } from "./fixtures";
  2  | 
  3  | // High-value journeys. Selectors are forgiving (text/regex) because the UI is dense.
  4  | 
  5  | test("open a stock and see its detail", async ({ page }) => {
  6  |   await enterApp(page);
> 7  |   await page.getByText("RELIANCE", { exact: true }).first().click();
     |                                                             ^ Error: locator.click: Test timeout of 30000ms exceeded.
  8  |   await page.waitForTimeout(600);
  9  |   await expect(page.locator("text=/₹|\\$/").first()).toBeVisible();
  10 | });
  11 | 
  12 | test("Automate: Neo interprets a plain-English prompt", async ({ page }) => {
  13 |   await enterApp(page);
  14 |   await page.getByText("Auto", { exact: true }).first().click();
  15 |   await page.waitForTimeout(500);
  16 |   // Enter prompt mode if the toggle exists.
  17 |   const promptTab = page.getByText(/Write a Prompt/i).first();
  18 |   if (await promptTab.count().catch(() => 0)) await promptTab.click();
  19 |   const box = page.getByPlaceholder(/cup and handle|bounces off support|describe|plain English|EMA/i).first();
  20 |   if (await box.count().catch(() => 0)) {
  21 |     await box.fill("buy when a cup and handle forms and RSI is above 50");
  22 |     await expect(page.getByText(/Neo reads/i).first()).toBeVisible();
  23 |   }
  24 | });
  25 | 
  26 | test("Profile opens; delete-account (if signed in) warns about data loss", async ({ page }) => {
  27 |   await enterApp(page);
  28 |   const profile = page.getByText(/Login|Profile/i).first();
  29 |   if (await profile.count().catch(() => 0)) {
  30 |     await profile.click();
  31 |     await page.waitForTimeout(300);
  32 |     const del = page.getByText(/Delete account/i).first();
  33 |     if (await del.count().catch(() => 0)) {
  34 |       await del.click();
  35 |       await expect(page.getByText(/permanent|cannot be undone|erased|deleted/i).first()).toBeVisible();
  36 |       await page.getByText(/Cancel/i).first().click();
  37 |     }
  38 |   }
  39 | });
  40 | 
  41 | test("no real broker/market host is ever contacted", async ({ page }) => {
  42 |   const bad = [];
  43 |   page.on("request", (r) => {
  44 |     if (/finance\.yahoo|financialmodelingprep|indianapi|fyers|delta\.exchange|api\.kite|dhan\.co/.test(r.url())) bad.push(r.url());
  45 |   });
  46 |   await enterApp(page);
  47 |   await page.waitForTimeout(1000);
  48 |   for (const m of ["US", "Crypto", "Indian"]) { await page.getByText(m, { exact: true }).first().click(); await page.waitForTimeout(300); }
  49 |   expect(bad, "no requests to real broker/data hosts").toEqual([]);
  50 | });
  51 | 
```