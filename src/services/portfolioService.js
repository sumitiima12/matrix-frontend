/**
 * services/portfolioService.js — Portfolio intelligence (the AI portfolio manager).
 *
 * The spec: a portfolio should not just list holdings. For each one it must show
 * trend, risk, a recommendation (Add / Hold / Reduce / Exit), confidence, and
 * suggested stop & target — and it must explain itself.
 *
 * Pure module: no I/O, no React. Reads REAL indicator data only; when data is
 * missing it says so instead of guessing.
 */

export const ACTIONS = ["Add", "Hold", "Reduce", "Exit"];

const pct = (a, b) => (b ? ((a - b) / b) * 100 : 0);

/**
 * Analyse a single holding.
 *
 * @param h      { sym, qty, buy, sl, tp, tsl }
 * @param s      the live stock (real indicators merged in)
 * @param signal techSignal(s) — the same engine the picks use
 */
export function analyzeHolding(h, s, signal) {
  const price = s?.price ?? h.buy;
  const pnlPct = pct(price, h.buy);
  const pnl = (price - h.buy) * (h.qty || 0);
  const value = price * (h.qty || 0);

  // No real data -> refuse to advise.
  if (!s || !s.hasData || s.rsi == null) {
    return {
      sym: h.sym, price, value, pnl, pnlPct,
      trend: "Unknown", action: "Hold", confidence: 0,
      technical: "Live indicators haven't loaded for this holding.",
      fundamental: "No fundamentals available.",
      risk: "Unknown",
      suggestedStop: null, suggestedTarget: null, rMultiple: null,
      reasons: ["No real market data — Matrix won't guess."],
      hasData: false,
    };
  }

  // ---- trend from real moving averages ----
  const aboveMid = s.sma50 != null ? price > s.sma50 : null;
  const golden = s.sma50 != null && s.sma200 != null ? s.sma50 > s.sma200 : null;
  const trend =
    aboveMid && golden ? "Uptrend"
    : aboveMid === false && golden === false ? "Downtrend"
    : "Sideways";

  // ---- risk from real ATR ----
  const atrPct = s.atr != null && price ? (s.atr / price) * 100 : null;
  const risk = atrPct == null ? "Unknown" : atrPct > 4 ? "High" : atrPct > 2 ? "Medium" : "Low";

  // ---- suggested levels: prefer the user's own, else the engine's ----
  const suggestedStop = h.sl ? +(h.buy * (1 - h.sl / 100)).toFixed(2) : (signal?.stop ?? null);
  const suggestedTarget = h.tp ? +(h.buy * (1 + h.tp / 100)).toFixed(2) : (signal?.target ?? null);
  const riskPerUnit = suggestedStop != null ? h.buy - suggestedStop : null;
  const rMultiple = riskPerUnit && riskPerUnit > 0 ? +((price - h.buy) / riskPerUnit).toFixed(2) : null;

  // ---- action ----
  const reasons = [];
  let action = "Hold";
  let confidence = 50;

  const brokeStop = suggestedStop != null && price <= suggestedStop;
  const hitTarget = suggestedTarget != null && price >= suggestedTarget;
  const score = signal?.score ?? 0;

  if (brokeStop) {
    action = "Exit";
    confidence = 90;
    reasons.push(`Price ${price} is at or below the stop ${suggestedStop} — the thesis is invalidated.`);
  } else if (hitTarget) {
    action = "Take profit";
    confidence = 75;
    reasons.push(`Target ${suggestedTarget} reached — booking part of the position locks in the gain.`);
  } else if (trend === "Downtrend" && pnlPct < 0) {
    action = "Reduce";
    confidence = 65;
    reasons.push(`Position is down ${pnlPct.toFixed(1)}% and the trend is negative (price below both moving averages).`);
  } else if (s.rsi >= 75) {
    action = "Reduce";
    confidence = 60;
    reasons.push(`RSI ${s.rsi} is heavily overbought — a pullback is likely from here.`);
  } else if (score >= 2.5 && trend === "Uptrend" && s.rsi < 68) {
    action = "Add";
    confidence = Math.min(85, 55 + Math.round(score * 6));
    reasons.push(`The setup still scores well (${signal.signal}) with the trend intact and RSI ${s.rsi} not yet stretched.`);
  } else {
    action = "Hold";
    confidence = 55;
    reasons.push(`No decisive signal: trend is ${trend.toLowerCase()} and RSI is ${s.rsi}.`);
  }

  if (!h.sl && !h.tsl) reasons.push("No stop-loss armed on this position — risk is currently unbounded.");

  // ---- summaries ----
  const technical = [
    `RSI ${s.rsi}`,
    s.sma50 != null ? `price ${price > s.sma50 ? "above" : "below"} 50-DMA (${s.sma50})` : null,
    s.macd != null && s.macdSignal != null ? `MACD ${s.macd > s.macdSignal ? "above" : "below"} signal` : null,
    s.adx != null ? `ADX ${s.adx} (${s.adx > 25 ? "trending" : "choppy"})` : null,
  ].filter(Boolean).join(" · ");

  const fundamental = s.pe == null && s.revGrowth == null
    ? "No published fundamentals for this instrument."
    : [
        s.pe != null ? `P/E ${s.pe}` : null,
        s.roe != null ? `ROE ${s.roe}%` : null,
        s.revGrowth != null ? `revenue ${s.revGrowth >= 0 ? "+" : ""}${s.revGrowth}%` : null,
      ].filter(Boolean).join(" · ");

  return {
    sym: h.sym, price, value, pnl, pnlPct,
    trend, action, confidence, risk,
    technical, fundamental,
    suggestedStop, suggestedTarget, rMultiple,
    reasons,
    hasData: true,
  };
}

/**
 * Portfolio health — a 0-100 score built from REAL components, each explained.
 * Never a vibe: every point is traceable to a number.
 */
export function portfolioHealth(analyses, wallet = 0) {
  if (!analyses || !analyses.length) {
    return { score: null, components: [], flags: ["No open positions."] };
  }

  const invested = analyses.reduce((a, x) => a + x.value, 0);
  const equity = invested + wallet;

  // 1. Concentration (Herfindahl index of position weights)
  const weights = analyses.map((x) => (invested ? x.value / invested : 0));
  const hhi = weights.reduce((a, w) => a + w * w, 0);
  const concentrationScore = Math.max(0, Math.min(100, Math.round((1 - hhi) * 125)));
  const biggest = analyses.reduce((a, b) => (b.value > a.value ? b : a), analyses[0]);
  const biggestPct = invested ? (biggest.value / invested) * 100 : 0;

  // Cash % is still used by the flags below, but is no longer a health component.
  const cashPct = equity ? (wallet / equity) * 100 : 0;

  // 3. Protection — how many positions have a stop armed
  const protectedN = analyses.filter((x) => x.suggestedStop != null).length;
  const protectionScore = Math.round((protectedN / analyses.length) * 100);

  // 4. Trend quality — how many holdings are in an uptrend
  const upN = analyses.filter((x) => x.trend === "Uptrend").length;
  const trendScore = Math.round((upN / analyses.length) * 100);

  // 5. Drawdown pressure — positions currently underwater
  const losers = analyses.filter((x) => x.pnlPct < 0).length;
  const ddScore = Math.round((1 - losers / analyses.length) * 100);

  const components = [
    { k: "Diversification", v: concentrationScore, why: `Largest position is ${biggestPct.toFixed(0)}% of the book (${biggest.sym}).` },
    { k: "Downside protection", v: protectionScore, why: `${protectedN} of ${analyses.length} positions have a stop armed.` },
    { k: "Trend alignment", v: trendScore, why: `${upN} of ${analyses.length} holdings are in an uptrend.` },
    { k: "Drawdown pressure", v: ddScore, why: `${losers} of ${analyses.length} positions are underwater.` },
  ];

  const score = Math.round(components.reduce((a, c) => a + c.v, 0) / components.length);

  const flags = [];
  if (biggestPct > 40) flags.push(`Over-concentrated: ${biggest.sym} is ${biggestPct.toFixed(0)}% of the portfolio.`);
  if (protectionScore < 60) flags.push(`${analyses.length - protectedN} position(s) have no stop-loss — risk is unbounded there.`);
  if (cashPct < 5) flags.push("Almost fully invested — no dry powder for opportunities or drawdowns.");
  const exits = analyses.filter((x) => x.action === "Exit");
  if (exits.length) flags.push(`${exits.length} position(s) have broken their stop and need attention: ${exits.map((x) => x.sym).join(", ")}.`);

  return { score, components, flags, invested, cashPct };
}

/** Sector exposure from real sector tags. */
export function sectorExposure(analyses, stockOf) {
  const total = analyses.reduce((a, x) => a + x.value, 0);
  if (!total) return [];
  const map = new Map();
  analyses.forEach((x) => {
    const sec = stockOf(x.sym)?.sector || "Other";
    map.set(sec, (map.get(sec) || 0) + x.value);
  });
  return [...map.entries()]
    .map(([sector, value]) => ({ sector, value, pct: +((value / total) * 100).toFixed(1) }))
    .sort((a, b) => b.value - a.value);
}
