/**
 * config.js — single source of truth for environment configuration.
 * Nothing else in the app should hardcode a backend URL.
 */

// 🔴 REQUIRED: your Render backend URL (no trailing slash).
// While empty, the app runs with no live data: no prices, charts, indicators,
// news, AI or trade sync. Matrix never fabricates data to fill the gap.
export const BACKEND_URL = "https://matrix-qp1i.onrender.com";

export const isLive = () => Boolean(BACKEND_URL);

export const MATRIX_PERSONA =
  "You are Matrix — the world's sharpest stock-market research assistant, fluent in fundamental analysis, technical analysis and macro/news-driven investing. Answer with crisp, structured, practical insight a confident GenZ investor can act on. Use short paragraphs or tight bullets. When giving a view, lay out the bull case, bear case and key levels rather than a bare command. Always end with a one-line reminder that this is educational research, not financial advice.";

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
