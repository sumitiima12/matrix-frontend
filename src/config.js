/**
 * config.js — single source of truth for environment configuration.
 * Nothing else in the app should hardcode a backend URL.
 */

// 🔴 REQUIRED: your Render backend URL (no trailing slash).
// While empty, the app runs with no live data: no prices, charts, indicators,
// news, AI or trade sync. Matrix never fabricates data to fill the gap.
/* Your Render backend. If this is EMPTY, the app has no data source: no quotes, no
   search prices, no charts, no Neo — everything renders "—" and looks broken.
   It is the single most important line in this file, which is why it is no longer
   shipped blank. Override with VITE_BACKEND_URL if you prefer an env var. */
export const BACKEND_URL =
  (import.meta.env && import.meta.env.VITE_BACKEND_URL) || "https://matrix-qp1i.onrender.com";

export const isLive = () => Boolean(BACKEND_URL);

/* FLAG (default OFF): DISPLAY-only reconciliation of real closed positions. When on, the
   homepage cross-references your live broker holdings — a real Auto-Buy position whose symbol
   is no longer held is shown as CLOSED (estimated exit at the last price) instead of a stale
   "OPEN". It never mutates the stored journal, so it's safe to trial and turn off. Flip it on to
   validate against one small real position; enable via VITE_RECONCILE_CLOSES=on or localStorage
   key "mx_reconcile_closes"="on". */
export const RECONCILE_REAL_CLOSES =
  ((import.meta.env && import.meta.env.VITE_RECONCILE_CLOSES) === "on") ||
  (typeof localStorage !== "undefined" && localStorage.getItem("mx_reconcile_closes") === "on");

export const MATRIX_PERSONA =
  "You are Neo — Matrix's stock-market research assistant, fluent in fundamental analysis, technical analysis and macro/news-driven investing. Answer with crisp, structured, practical insight a confident GenZ investor can act on. Use short paragraphs or tight bullets. When giving a view, lay out the bull case, bear case and key levels rather than a bare command. NEVER invent a number: if you do not have real data for something, say so plainly rather than estimating — a plausible-sounding figure a user might trade on is worse than an admission of ignorance. Always end with a one-line reminder that this is educational research, not financial advice.";

// Timeframe -> Yahoo (interval, range). Shared by charts, backtests, exit engine.
/**
 * Timeframe -> the Yahoo interval + range that actually backs it.
 *
 * `agg` means the timeframe does NOT exist upstream and we build it by aggregating the
 * interval below it. Yahoo has no 4-hour candle. This table used to map "4h" straight to
 * the 90m interval — so the app drew 90-minute bars and labelled them 4-hour. That is a
 * quiet lie: every indicator read off that chart was computed on the wrong period.
 *
 * Now 4h is built by folding four real 60m candles into one, which is what a 4h candle is.
 */
export const TF_YF = {
  "1m":  { i: "1m",  r: "1d" },
  "3m":  { i: "2m",  r: "1d" },
  "5m":  { i: "5m",  r: "5d" },
  "15m": { i: "15m", r: "1mo" },
  "30m": { i: "30m", r: "1mo" },
  "1h":  { i: "60m", r: "3mo" },
  "4h":  { i: "60m", r: "6mo", agg: 4 },   // REAL 4h: four 60m candles folded into one
  // 6 MONTHS: a daily CHART is one small, fast request. Backtests use BT_YF below for the long window.
  "1d":  { i: "1d",  r: "6mo" },
  "1w":  { i: "1wk", r: "5y" },
  "1mo": { i: "1mo", r: "10y" },
};

/* BACKTEST ranges — deliberately MUCH larger than the chart display ranges above. The chart only
   needs the last few sessions; a backtest needs months. Reusing TF_YF meant a "6-month, 3-minute"
   backtest actually had ONE DAY of candles (~189 bars) and reported almost no trades. These pull the
   most history each source will give: the owner's FYERS (chunked) yields ~3 months of intraday and
   years of daily; Yahoo caps intraday near 60 days but still dwarfs the old 1–5 day windows. */
export const BT_YF = {
  "1m":  { i: "1m",  r: "5d"  },
  "3m":  { i: "2m",  r: "1y"  },
  "5m":  { i: "5m",  r: "1y"  },
  "15m": { i: "15m", r: "1y"  },
  "30m": { i: "30m", r: "1y"  },
  "1h":  { i: "60m", r: "2y"  },
  "4h":  { i: "60m", r: "2y", agg: 4 },
  "1d":  { i: "1d",  r: "5y"  },
  "1w":  { i: "1wk", r: "5y"  },
  "1mo": { i: "1mo", r: "10y" },
};
