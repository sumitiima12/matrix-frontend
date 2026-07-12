/**
 * domain/signals.js — the technical signal engine.
 *
 * Everything here is derived from indicators the backend computed from REAL
 * daily candles (RSI, MACD, ADX, ATR, EMA/SMA, real 60-session support and
 * resistance, real volume). A stock with no real data is simply not scored —
 * it is never guessed at.
 *
 * This is the single source of truth for: the signal tag on a card, the pick
 * reason, and the stop/target/R:R used by picks, ideas, auto-buy and the AI
 * Copilot. Pure module — no UI, no I/O.
 */
import { fmt } from "../lib/format";
import { marketOf } from "./universe";

/* ============ REAL technical signal — no synthetic series anywhere ============
   Everything below is derived from indicators the backend computed from actual
   daily candles (RSI, MACD, ADX, ATR, EMA/SMA, real support/resistance, real
   volume). If a stock has no real data it simply isn't scored.                 */
export function techSignal(s) {
  if (!s || !s.hasData || s.rsi == null || s.sma50 == null) return null;
  const px = s.price;
  const cur = (v) => fmt(v, marketOf(s.sym));
  const sup = s.support, res = s.resistance;
  const atr = s.atr || (px * 0.02);
  const volRatio = s.avgVol ? (s.vol || 0) / s.avgVol : null;   // real relative volume
  const range52 = (s.high52 != null && s.low52 != null && s.high52 > s.low52)
    ? (px - s.low52) / (s.high52 - s.low52) : null;             // where in the 52w range
  const macdBull = s.macd != null && s.macdSignal != null && s.macd > s.macdSignal;
  const trendUp = s.sma200 != null ? s.sma50 > s.sma200 : s.price > s.sma50;

  let score = 0, signal = "", why = "", pattern = "flag";

  // ---- price action first (this is what the user actually trades) ----
  if (res != null && px >= res * 0.995) {
    pattern = "breakout"; signal = "Resistance breakout";
    why = `Price is pressing through the ${cur(res)} ceiling that capped it over the last 60 sessions.`;
    score += 3.2;
  } else if (sup != null && (px - sup) / px * 100 < 2.5 && macdBull) {
    pattern = "doubleBottom"; signal = "Bounce off support";
    why = `Price is holding the ${cur(sup)} floor with MACD turning up — buyers defending the level.`;
    score += 2.7;
  } else if (trendUp && macdBull && s.rsi > 50 && s.rsi < 70) {
    pattern = "triangle"; signal = "Trend continuation";
    why = `50-DMA above 200-DMA with MACD above its signal and RSI ${s.rsi} — an intact uptrend, not yet overbought.`;
    score += 2.5;
  } else if (s.rsi < 35) {
    pattern = "cup"; signal = "Oversold";
    why = `RSI at ${s.rsi} is in oversold territory; watch for a reclaim of ${cur(s.sma50)} before acting.`;
    score += 1.6;
  } else if (s.rsi > 72) {
    pattern = "flag"; signal = "Overbought";
    why = `RSI ${s.rsi} is stretched; momentum is strong but entries here carry elevated pullback risk.`;
    score -= 0.4;
  } else {
    signal = trendUp ? "Uptrend" : "Range-bound";
    why = trendUp
      ? `Price is above its 50-DMA (${cur(s.sma50)}) with no extreme reading — a steady uptrend.`
      : `Price is chopping between ${sup != null ? cur(sup) : "support"} and ${res != null ? cur(res) : "resistance"} with no clear edge.`;
    score += trendUp ? 1.2 : 0.2;
  }

  // ---- confirmations from REAL indicators ----
  if (macdBull) score += 0.8;
  if (s.adx != null && s.adx > 25) score += 0.7;                 // genuine trend strength
  if (volRatio != null && volRatio > 1.3) { score += 0.8; why += ` Volume is ${volRatio.toFixed(1)}× its 20-day average, confirming participation.`; }
  if (range52 != null && range52 > 0.85) score += 0.5;           // near 52w highs
  if (s.rsi > 50 && s.rsi < 68) score += 0.5;
  if (s.chg != null) score += Math.max(-1, Math.min(1, s.chg * 0.15));

  // ---- REAL stop / target from support-resistance and ATR ----
  const stop = sup != null && sup < px ? Math.max(sup - 0.25 * atr, px - 3 * atr) : px - 2 * atr;
  const target = res != null && res > px ? res : px + 2.5 * atr;
  const slPct = +(((px - stop) / px) * 100).toFixed(1);
  const tpPct = +(((target - px) / px) * 100).toFixed(1);
  const rr = slPct > 0 ? +(tpPct / slPct).toFixed(1) : null;

  return {
    score: +score.toFixed(2), signal, pattern, why,
    stop: +stop.toFixed(2), target: +target.toFixed(2), slPct, tpPct, rr,
    volRatio: volRatio != null ? +volRatio.toFixed(2) : null,
  };
}

// Ranked picks — only from instruments with REAL data. Refreshed hourly.
export function dailyPicks(list) {
  return (list || [])
    .filter((s) => s.hasData && s.rsi != null && s.sma50 != null && s.sector !== "Volatility")
    .map((s) => ({ s, t: techSignal(s) }))
    .filter((x) => x.t && x.t.score > 0)
    .sort((a, b) => b.t.score - a.t.score)
    .map(({ s, t }) => Object.assign(s, {
      pickSignal: t.signal, pickReason: t.why, pickPattern: t.pattern,
      pickStop: t.stop, pickTarget: t.target, pickSlPct: t.slPct, pickTpPct: t.tpPct, pickRR: t.rr,
      pickScore: t.score,
    }));
}
