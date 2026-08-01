# Matrix One — Frontend

The mobile-first web app for **Matrix One**, a multi-market trading platform covering Indian equities/F&O, US stocks, crypto, and commodities. It provides live charts and quotes, AI research ("Neo"), a plain-English strategy builder, screeners, paper (virtual) trading, and **real** broker order placement — all in a single React SPA.

Built with **React 18 + Vite**. All data comes from the [Matrix backend](../matrix-backend); the frontend never fabricates prices or candles — if the backend can't supply data, the UI says so.

---

## Stack

- **React 18**, **Vite 5** (ES modules, no TypeScript)
- **recharts** for charts, **lucide-react** for icons
- Styling is inline CSS with CSS custom properties (theme tokens) driven from `Matrix.jsx` — supports light and dark mode
- **ESLint 9** (incl. rules-of-hooks), **Playwright** for E2E, Node test runner for unit tests

## Quick start

```bash
npm install
npm run dev        # Vite dev server
```

The backend URL is configured in `src/config.js` (defaults to the deployed Render backend). Override with a `VITE_BACKEND_URL` env var if pointing at a local backend:

```bash
VITE_BACKEND_URL=http://localhost:3000 npm run dev
```

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint over `src` |
| `npm run test:unit` | Node test runner (`test/*.test.mjs`) |
| `npm run smoke` | Smoke check (`scripts/smoke.mjs`) |
| `npm run check` | lint + unit + smoke |
| `npm run predeploy` | check + `vite build` (gate before deploying) |
| `npm run test:e2e` | Playwright E2E (`e2e/`) |
| `npm run test:e2e:ui` | Playwright in UI mode |

---

## Project structure

```
index.html            Vite entry
src/
  main.jsx            React root
  Matrix.jsx          App shell: header, bottom nav, routing, theme tokens (light/dark)
  config.js           BACKEND_URL, feature flags, timeframe→interval maps, Neo persona
  pages/              Top-level screens
    Dashboard.jsx       Home: quotes, Top Picks, trending, ideas, smart auto-buy, news
    Automation.jsx      Strategy builder, backtesting, deployed strategies, optimizers
    Screener.jsx        Custom + popular screeners, screener auto-buy
    Ideas.jsx           Neo + community trade ideas, post-an-idea
    StockDetail.jsx     Per-symbol charts, indicators, fundamentals, news
    Orders.jsx          Order history (virtual + real)
    PortfolioPage.jsx   Holdings & P&L
    Trade.jsx           Buy/Sell order ticket
    Watchlist.jsx       Saved symbols
    AIAssistant.jsx     Ask Neo chat
  components/
    ai/  auth/  cards/  charts/  common/  home/
  hooks/              useAuth, useBroker, useCandles, useBacktestStats, usePortfolio,
                      useOrders, useAutomation, useOptionChain, useSquareOff, …
  services/           API + domain services: brokerService, marketService, aiService,
                      tradeService, portfolioService, riskService, automationEngine,
                      journalService, optionService, squareOff, notificationService, …
  domain/             Pure logic: api (fetch layer), universe, strategies, strategyLang,
                      backtest, patterns, signals, screener, options, fno, brokers,
                      brokerSymbols, conviction, strength, tags, analysisFramework, ideas
  lib/                Helpers: indicators, series, patterns, format, csv, newsCategory
  assets/             Logos, icons
public/               Static assets, favicon
e2e/                  Playwright specs (broker calls stubbed)
test/                 Unit tests
```

---

## Key concepts

- **Backend is the single source of truth.** `config.js` holds `BACKEND_URL`; if it's empty the app renders "—" everywhere rather than inventing data. Candles come only from `useCandles` → backend `/api/history`.
- **Virtual vs Real.** The app has a Virtual (paper) mode and a Real (live broker) mode, toggled in the header. Real mode is PIN-gated and requires a connected broker. Real-money controls are hidden in Virtual mode.
- **Neo (AI).** Plain-English → strategy conditions in the builder and screener, plus an "Ask Neo" research chat. Neo is scoped to markets/trading and won't fabricate figures.
- **Automation.** Strategies and screeners can be deployed to auto-execute. Virtual deployment runs a paper loop client-side; real deployment registers with the backend auto-buy/auto-exit engines.
- **Theming.** Light/dark mode via CSS variables set on the app shell. Cards use a soft elevated outline in both themes.

## Timeframes

`config.js` maps each app timeframe to the real upstream interval/range. Timeframes that don't exist upstream (e.g. 4h) are **aggregated** from lower intervals rather than mislabeled — an indicator is never computed on the wrong period.

---

## Deployment

Production build is a static bundle:

```bash
npm run build      # outputs to dist/
```

Deploy is git-push based (the host builds `dist/` on push to `main`):

```bash
cd ~/Documents/matrix-frontend
rm -f .git/index.lock .git/HEAD.lock
git add -A && git commit -m "your message" && \
  (git push || (git pull --no-rebase -X ours --no-edit origin main && git push))
```

Run `npm run predeploy` first to gate on lint + unit + smoke + build.

---

## Testing

- **Unit:** `npm run test:unit` — pure domain/lib logic (indicators, backtest, strategy language, patterns).
- **Smoke:** `npm run smoke` — fast sanity check.
- **E2E:** `npm run test:e2e` — Playwright drives the feature pages with broker calls stubbed (never places real orders).
