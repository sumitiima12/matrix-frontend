# MATRIX

AI trading research platform. Real market data, no simulation.

---

## ⚠️ Read this first

**One value must be set or nothing works:**

Open `frontend/src/config.js` and paste your Render backend URL:

```js
export const BACKEND_URL = "https://your-backend.onrender.com";   // NO trailing slash
```

While this is `""` the app runs with **no data at all** — no prices, charts,
indicators, news, AI or trade sync. Matrix will show "—" and "unavailable"
rather than inventing numbers. That is deliberate.

---

## Run it

### Frontend

```bash
cd frontend
npm install
npm run dev          # → http://localhost:5173
```

If you already have a Vite project, just drop in `src/` (replacing the old one)
and run `npm install recharts lucide-react` if those aren't present.
`src/Matrix.jsx` is still the entry component, so your `main.jsx` doesn't change.

### Backend

```bash
cd backend
npm install
npm start            # → http://localhost:3000
```

Check it's alive: open `http://localhost:3000/api/health` — it reports which LLM
engines and database it can actually see.

---

## Backend environment variables

| Variable | Required | Purpose |
|---|---|---|
| `GROQ_API_KEY` | for AI | Ask Matrix, Deep Analysis, market briefs, screener parsing |
| `DATABASE_URL` | recommended | Postgres (Neon). Without it, trades live in a flat file that Render wipes on restart |
| `OPENROUTER_API_KEY` | optional | Fallback LLM |
| `GEMINI_API_KEY` | optional | Fallback LLM |
| `ANTHROPIC_API_KEY` | optional | Fallback LLM |
| `NEWS_API_KEY` | optional | Better news coverage (defaults to Yahoo) |
| `EXIT_MONITOR` | optional | Set to `off` to disable the server-side exit engine |

The LLM chain tries Groq → OpenRouter → Gemini → Anthropic and uses the first
one that answers.

---

## Architecture

```
frontend/src/
  Matrix.jsx          680 lines — orchestration only (routing, layout, state)
  config.js           BACKEND_URL lives here

  lib/                pure utilities, no I/O
    format.js         currency, numbers, dates, storage
    indicators.js     SMA / EMA / Bollinger / MACD / RSI + overlay registry
    patterns.js       chart-pattern glyphs
    csv.js            CSV export

  domain/             business rules, no UI
    universe.js       every instrument Matrix can trade
    signals.js        the technical signal engine (picks, tags, stops, targets)
    api.js            the ONLY bridge from UI to services
    screener.js       screen parsing + matching
    backtest.js       backtest engine
    fno.js            lot sizes, monthly expiry, futures contracts
    ideas.js          trade ideas
    strategies.js     starter strategies

  services/           all I/O and the Risk Engine — no UI, no React
    riskService.js    ★ every order passes through validateOrder()
    marketService.js  quotes, history, news, indicators, fundamentals
    aiService.js      all LLM calls
    tradeService.js   trades, auth, state
    researchService.js  structured AI research schema
    portfolioService.js portfolio intelligence + health score
    journalService.js   trading journal + pattern detection

  hooks/              React bindings over the services
  pages/              10 pages, one per screen
  components/         21 reusable components
```

**Rules enforced by the structure:**

- `fetch()` appears **nowhere** outside `services/` — no component talks to an API directly.
- Every order passes through the **Risk Engine** (`validateOrder`) — position size,
  daily loss cap, max open positions, cooldown, funds, market hours. Orders with no
  live price are blocked outright.
- The **LLM reasons; the engine owns the numbers.** Entry/stop/target are computed
  from real support/resistance + ATR, and any levels a model returns are overwritten.

---

## Data integrity

Everything on screen is real or absent. There is no simulated data anywhere:

- **Prices, volume, OHLC candles** — Yahoo Finance via the backend proxy
- **Indicators** — RSI (Wilder), MACD, ADX, ATR, Stochastic, CCI, MFI, VWAP, OBV,
  Bollinger %B, 52-week range, and support/resistance from real 60-session swings —
  all computed from actual candles
- **Fundamentals** — P/E, ROE, margins, growth, debt/equity, quarterly revenue and
  earnings, institutional holders — as reported
- **News** — live headlines with real publishers and timestamps
- **Picks, ideas, signals** — derived from the above

If data is unavailable, Matrix says so. It never fills the gap with a plausible number.

**Known limitation:** Yahoo publishes no NSE futures feed, so an F&O contract is
priced off its **underlying's** real spot price. The price is real — it's just the
underlying's, not the contract's. Cost of carry is not modelled. Lot sizes and
expiry dates are the real exchange conventions.

---

## Paper trading

Wallets are virtual (₹10,00,000 per market). No broker is connected and no real
money can move. The broker adapter layer is not built yet.
