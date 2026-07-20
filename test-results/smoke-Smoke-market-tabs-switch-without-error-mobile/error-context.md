# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.js >> Smoke >> market tabs switch without error
- Location: e2e/smoke.spec.js:15:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByText('US', { exact: true }).first()

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
          - button "Activity" [ref=e36] [cursor=pointer]:
            - img [ref=e37]
          - generic [ref=e40] [cursor=pointer]:
            - img [ref=e42]
            - generic [ref=e45]: Account
      - generic [ref=e46]:
        - generic "Yahoo Finance — delayed ~15 minutes on NSE. Connect a broker for a real-time feed." [ref=e47] [cursor=pointer]: LIVE (15m DELAY)
        - generic [ref=e49]:
          - generic [ref=e50]: 07:08 PM
          - switch "Dark mode" [ref=e51] [cursor=pointer]
          - img [ref=e54]
      - generic [ref=e61] [cursor=pointer]:
        - img [ref=e62]
        - text: Search any stock, crypto or commodity…
      - generic [ref=e65]:
        - button "🇺🇸 US" [ref=e66] [cursor=pointer]
        - button "₿ Crypto" [ref=e67] [cursor=pointer]
        - button "🪙 Commodity" [ref=e68] [cursor=pointer]
    - generic [ref=e69]:
      - generic [ref=e70]:
        - generic [ref=e71]:
          - generic [ref=e72]:
            - generic [ref=e73]: NIFTY 50
            - generic [ref=e74]: —
          - generic [ref=e75]:
            - generic [ref=e76]: SENSEX
            - generic [ref=e77]: —
          - generic [ref=e78]:
            - generic [ref=e79]: BANK NIFTY
            - generic [ref=e80]: —
          - generic [ref=e81]:
            - generic [ref=e82]: S&P 500
            - generic [ref=e83]: —
          - generic [ref=e84]:
            - generic [ref=e85]: NASDAQ
            - generic [ref=e86]: —
          - generic [ref=e87]:
            - generic [ref=e88]: DOW
            - generic [ref=e89]: —
          - generic [ref=e90]:
            - generic [ref=e91]: BTC
            - generic [ref=e92]: ▲2.10%
          - generic [ref=e93]:
            - generic [ref=e94]: ETH
            - generic [ref=e95]: —
          - generic [ref=e96]:
            - generic [ref=e97]: GOLD
            - generic [ref=e98]: —
          - generic [ref=e99]:
            - generic [ref=e100]: CRUDE
            - generic [ref=e101]: —
        - generic [ref=e103]:
          - generic [ref=e104]:
            - button "Total" [ref=e105] [cursor=pointer]
            - button "Smart Auto-Buy" [ref=e106] [cursor=pointer]
          - generic [ref=e107] [cursor=pointer]:
            - generic [ref=e108]:
              - generic [ref=e109]: Virtual · 🇺🇸 US · current value
              - generic [ref=e110]:
                - text: My Portfolio
                - img [ref=e111]
            - generic [ref=e113]: $0
            - generic [ref=e114]:
              - generic [ref=e115]:
                - generic [ref=e116]: Returns %
                - generic [ref=e117]: +0.0%
              - generic [ref=e118]:
                - generic [ref=e119]: Net returns
                - generic [ref=e120]: +$0
            - generic [ref=e121]:
              - generic [ref=e122]: 0 open
              - generic [ref=e123]: 0 auto-buy
            - generic [ref=e124]: No holdings yet — buy your first stock in Virtual Trade.
        - generic [ref=e125]:
          - generic [ref=e127]:
            - img [ref=e128]
            - text: Top Picks
          - generic [ref=e131]: Waiting on real indicators — picks are ranked on RSI and the 50-DMA, so they appear once the data lands.
        - generic [ref=e134]:
          - generic [ref=e135]:
            - img [ref=e136]
            - text: Market updates
          - paragraph [ref=e139]: Live market data is still loading.
        - generic [ref=e140]:
          - generic [ref=e142]:
            - img [ref=e143]
            - text: Ideas
          - generic [ref=e146]: No ideas for this market right now — check back later or switch markets.
        - generic [ref=e148]:
          - generic [ref=e149] [cursor=pointer]:
            - generic [ref=e150]: VIX
            - generic [ref=e152]: +%
          - generic [ref=e154] [cursor=pointer]:
            - generic [ref=e155]: S&P 500
            - generic [ref=e156]: ▲ +%
          - generic [ref=e158]:
            - generic [ref=e159]: 🔥 Hot Stocks
            - generic [ref=e161] [cursor=pointer]:
              - generic [ref=e162]: AAPL
              - generic [ref=e163]: +0.5%
        - generic [ref=e164]:
          - generic [ref=e165]:
            - img [ref=e166]
            - text: Earnings calendar
          - generic [ref=e168]:
            - button "Upcoming (1)" [ref=e169] [cursor=pointer]
            - button "Recent (1)" [ref=e170] [cursor=pointer]
          - generic [ref=e172] [cursor=pointer]:
            - generic [ref=e173]: AAPL
            - generic [ref=e174]: Est. EPS 1.50
            - generic [ref=e175]: Jul 23
        - generic [ref=e176]:
          - generic [ref=e178]:
            - img [ref=e179]
            - text: Trending now
          - generic [ref=e184]: No intraday moves yet — trending needs live 5-minute candles, which arrive while the market is open.
        - generic [ref=e186]:
          - generic [ref=e187]: Screener
          - generic [ref=e188]: Build rules from technicals, fundamentals or events.
          - generic [ref=e189]: Recommended
          - generic [ref=e190]:
            - button "Momentum movers" [ref=e191] [cursor=pointer]
            - button "Value with growth" [ref=e192] [cursor=pointer]
            - button "Oversold bounce" [ref=e193] [cursor=pointer]
            - button "EMA 21 > EMA 50" [ref=e194] [cursor=pointer]
          - generic [ref=e195]:
            - generic [ref=e196]: Build your own
            - generic [ref=e197]:
              - generic [ref=e198]:
                - combobox "Metric" [ref=e199]:
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
                - combobox "Comparator" [ref=e200]:
                  - option ">" [selected]
                  - option "<"
                  - option "≥"
                  - option "≤"
                - textbox "value" [ref=e201]: "50"
                - button [ref=e202] [cursor=pointer]:
                  - img [ref=e203]
              - generic [ref=e206]:
                - generic [ref=e207]:
                  - button "vs value" [ref=e208] [cursor=pointer]
                  - button "vs indicator" [ref=e209] [cursor=pointer]
                - generic [ref=e210]: TF
            - text: Screening on daily indicators
            - button "Add condition" [ref=e211] [cursor=pointer]:
              - img [ref=e212]
              - text: Add condition
            - generic [ref=e213]: Or write a prompt
            - textbox "e.g. large-cap IT stocks with RSI under 40 and rising revenue" [ref=e214]
            - button "Run screener" [ref=e215] [cursor=pointer]:
              - img [ref=e216]
              - text: Run screener
        - generic [ref=e218]:
          - generic [ref=e219]:
            - generic [ref=e220]:
              - img [ref=e221]
              - text: Top gainers & losers
            - generic [ref=e223]:
              - button "Gainers" [ref=e224] [cursor=pointer]
              - button "Losers" [ref=e225] [cursor=pointer]
          - generic [ref=e228] [cursor=pointer]:
            - generic [ref=e229]:
              - generic [ref=e230]: AAPL
              - generic [ref=e231]: Apple
            - generic [ref=e232]:
              - generic [ref=e233]: $230
              - generic [ref=e234]:
                - img [ref=e235]
                - text: +0.50%
        - generic [ref=e238]:
          - generic [ref=e240]:
            - img [ref=e241]
            - text: In the news
          - generic [ref=e246]:
            - generic [ref=e247]:
              - generic [ref=e249]: RELIANCE.NS
              - generic [ref=e250]: Reliance posts record quarter
              - generic [ref=e251]: Test · 0m ago
            - button "Read more" [ref=e252] [cursor=pointer]:
              - text: Read more
              - img [ref=e253]
      - generic [ref=e255]:
        - generic [ref=e256]: MatrixOne is a personal project for research purposes only. It is not for commercial use and does not recommend or advise any trade.
        - generic [ref=e257]:
          - button "Terms of Use" [ref=e258] [cursor=pointer]
          - button "Privacy Policy" [ref=e259] [cursor=pointer]
          - button "Disclaimer" [ref=e260] [cursor=pointer]
          - button "FAQ" [ref=e261] [cursor=pointer]
        - generic [ref=e262]: "For any queries, contact: brandbucksconsulting@gmail.com"
        - generic [ref=e263]: © 2026 · All rights reserved
  - generic [ref=e265]:
    - generic [ref=e267]: Log in
    - generic [ref=e268]: Use your phone number and a PIN to save trades, automations and preferences across visits.
    - generic [ref=e269]:
      - button "Log in" [ref=e270] [cursor=pointer]
      - button "Register" [ref=e271] [cursor=pointer]
    - generic [ref=e272]: Phone number
    - textbox "10-digit mobile" [ref=e273]
    - generic [ref=e274]: PIN (4+ digits)
    - textbox "••••" [ref=e275]
    - button "Log in" [ref=e276] [cursor=pointer]
    - button "Forgot PIN?" [ref=e277] [cursor=pointer]
    - button "Cancel" [ref=e278] [cursor=pointer]
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
  10 |       await expect(page.getByText(m, { exact: true }).first()).toBeVisible();
  11 |     }
  12 |     expect(errors, "no uncaught page errors on load").toEqual([]);
  13 |   });
  14 | 
  15 |   test("market tabs switch without error", async ({ page }) => {
  16 |     await enterApp(page);
  17 |     for (const m of ["US", "Crypto", "Indian"]) {
> 18 |       await page.getByText(m, { exact: true }).first().click();
     |                                                        ^ Error: locator.click: Test timeout of 30000ms exceeded.
  19 |       await page.waitForTimeout(400);
  20 |     }
  21 |     // Still alive: a price (₹ or $) is on screen.
  22 |     await expect(page.locator("text=/₹|\\$/").first()).toBeVisible();
  23 |   });
  24 | });
  25 | 
```