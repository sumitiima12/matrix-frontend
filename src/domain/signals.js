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
  const isCrypto = marketOf(s.sym) === "Crypto";
  // Dirty-candle guard (applies to EVERY market). A single bad print can report a
  // 60-session "resistance" 100× above price or a "support" near zero. Any level that
  // far from the current price is a data artifact, not a tradeable level — drop it and
  // fall back to ATR-based projection. Band is a bit wider for crypto's real volatility.
  const levHi = px * (isCrypto ? 1.6 : 1.4);
  const levLo = px * (isCrypto ? 0.55 : 0.7);
  const res = (s.resistance != null && s.resistance > px && s.resistance <= levHi) ? s.resistance : null;
  const sup = (s.support != null && s.support < px && s.support >= levLo) ? s.support : null;
  const atr = Math.min(s.atr || (px * 0.02), px * 0.10);   // ATR never more than 10% of price
  const volRatio = (s.avgVol && s.vol != null) ? s.vol / s.avgVol : null;   // real relative volume, or nothing
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
  // Levels are already dirty-candle-sanitised above; here we additionally keep target/stop
  // inside a believable swing band so a daily idea is reachable in days, not never, and the
  // stop can never underflow below zero.
  const tpCap = px * (isCrypto ? 1.30 : 1.20);               // target at most +30% (crypto) / +20%
  const slFloor = px * (isCrypto ? 0.85 : 0.90);             // stop at most −15% (crypto) / −10%, always > 0
  let target = (res != null && res <= tpCap) ? res : px + 2.5 * atr;
  target = Math.min(Math.max(target, px * 1.01), tpCap);     // between +1% and the cap
  let stop = (sup != null && sup >= slFloor) ? Math.max(sup - 0.25 * atr, slFloor) : px - 2 * atr;
  stop = Math.min(Math.max(stop, slFloor), px * 0.995);      // between the floor and −0.5%, always positive
  const slPct = +(((px - stop) / px) * 100).toFixed(1);
  const tpPct = +(((target - px) / px) * 100).toFixed(1);
  const rr = slPct > 0 ? +(tpPct / slPct).toFixed(1) : null;
  const dp = px < 1 ? 6 : px < 10 ? 4 : 2;                   // sub-dollar coins need real precision

  return {
    score: +score.toFixed(2), signal, pattern, why,
    stop: +stop.toFixed(dp), target: +target.toFixed(dp), slPct, tpPct, rr,
    volRatio: volRatio != null ? +volRatio.toFixed(2) : null,
  };
}

/* A BULLISH one-liner for Top Picks. techSignal.why is a neutral verdict — for a range-bound
   name it literally says "chopping… no clear edge", which is nonsense on a card that is
   recommending you BUY. Top Picks are, by construction, the strongest setups we found, so the
   blurb states the bullish thesis (what's working) and the upside, never "no edge". */
export function pickReason(s, t) {
  const cur = (v) => fmt(v, marketOf(s.sym));
  const trendUp = s.sma200 != null ? s.sma50 > s.sma200 : (s.sma50 != null && s.price > s.sma50);
  const macdBull = s.macd != null && s.macdSignal != null && s.macd > s.macdSignal;
  const vr = (s.avgVol && s.vol != null) ? s.vol / s.avgVol : null;
  let lead;
  if (t.pattern === "breakout") lead = `Breaking through its ${cur(s.resistance)} ceiling`;
  else if (t.pattern === "doubleBottom") lead = `Bouncing off ${cur(s.support)} support`;
  else if (t.pattern === "cup") lead = `Reclaiming ground after an oversold dip`;
  else if (trendUp) lead = `Holding a steady uptrend above its 50-day average`;
  else lead = `Basing above support with buyers stepping in`;
  const conf = [];
  if (macdBull) conf.push("MACD positive");
  if (s.rsi != null && s.rsi >= 50 && s.rsi < 70) conf.push(`RSI ${s.rsi} with room to run`);
  if (s.adx != null && s.adx > 25) conf.push(`ADX ${Math.round(s.adx)} trend strength`);
  if (vr && vr > 1.3) conf.push(`${vr.toFixed(1)}× average volume`);
  const tail = conf.length ? ` — ${conf.slice(0, 2).join(", ")}.` : ".";
  return `${lead}${tail} Upside toward ${cur(t.target)} (+${t.tpPct}%).`;
}

// Ranked picks — only from instruments with REAL data. Refreshed hourly.
export function dailyPicks(list) {
  return (list || [])
    .filter((s) => s.hasData && s.rsi != null && s.sma50 != null && s.sector !== "Volatility")
    .map((s) => ({ s, t: techSignal(s) }))
    // A "top pick" is a BUY idea, so we drop outright bearish/overbought readings — never
    // surface a stretched or edgeless name as a pick.
    .filter((x) => x.t && x.t.score > 0 && x.t.signal !== "Overbought")
    .sort((a, b) => b.t.score - a.t.score)
    .map(({ s, t }) => Object.assign(s, {
      pickSignal: t.signal, pickReason: pickReason(s, t), pickPattern: t.pattern,
      pickStop: t.stop, pickTarget: t.target, pickSlPct: t.slPct, pickTpPct: t.tpPct, pickRR: t.rr,
      pickScore: t.score,
    }));
}

/**
 * Technical strength, 0–100 — derived from the SAME signal score the verdict uses.
 *
 * There used to be a second, ad-hoc formula living inside StockDetail:
 *     50 + (rsi-50)*0.6 + smaBonus + macdBonus + adxBonus
 * while the Buy/Hold/Sell verdict came from techSignal().score. Two independent opinions,
 * both labelled "technical", shown on the same screen — so the app could tell you "Buy,
 * 60% confidence" directly above a gauge reading "bearish", and both were "right" by their
 * own arithmetic. That isn't nuance, it's a bug: a verdict and its evidence must come from
 * one calculation.
 *
 * Now the gauge IS the verdict's score, mapped to a dial. If the gauge is bearish, the
 * verdict is bearish. They cannot disagree, because they are the same number.
 */
export function techStrength(s) {
  const t = techSignal(s);
  if (!t) return null;
  // techSignal scores roughly -1 .. +6. Map that span onto the dial.
  const pct = Math.round(((t.score + 1) / 7) * 100);
  return Math.max(3, Math.min(97, pct));
}
