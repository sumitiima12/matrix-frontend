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

export const MATRIX_PERSONA =
  "You are Neo — Matrix's stock-market research assistant, fluent in fundamental analysis, technical analysis and macro/news-driven investing. Answer with crisp, structured, practical insight a confident GenZ investor can act on. Use short paragraphs or tight bullets. When giving a view, lay out the bull case, bear case and key levels rather than a bare command. NEVER invent a number: if you do not have real data for something, say so plainly rather than estimating — a plausible-sounding figure a user might trade on is worse than an admission of ignorance. Always end with a one-line reminder that this is educational research, not financial advice.";

// Timeframe -> Yahoo (interval, range). Shared by charts, backtests, exit engine.
export const TF_YF = {
  "1m": { i: "1m", r: "1d" },
  "3m": { i: "2m", r: "1d" },
  "5m": { i: "5m", r: "5d" },
  "15m": { i: "15m", r: "1mo" },
  "30m": { i: "30m", r: "1mo" },
  "1h": { i: "60m", r: "3mo" },
  "4h": { i: "90m", r: "6mo" },
  "1d": { i: "1d", r: "1y" },
};
