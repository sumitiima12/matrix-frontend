/**
 * services/researchService.js — the Research Engine's contract layer.
 *
 * The spec is explicit: "Never give unexplained recommendations."
 * So an analysis is never free-form prose. It is a STRUCTURED object with a
 * recommendation, a confidence, explicit levels, and the reasoning behind them.
 *
 * Division of labour (important):
 *   - WE compute the numbers  (entry / stop / target / R:R) from real price data.
 *   - The LLM supplies the REASONING only.
 * A language model must never be trusted to do arithmetic on price levels, so
 * `normalizeAnalysis` overwrites any levels it returns with our real ones.
 *
 * Pure module: no I/O, no React, fully testable.
 */

export const RECOMMENDATIONS = ["Strong Buy", "Buy", "Hold", "Reduce", "Avoid"];

/** The shape every analysis must satisfy before it can be rendered. */
export const RESEARCH_SCHEMA = {
  recommendation: "one of: Strong Buy | Buy | Hold | Reduce | Avoid",
  confidence: "integer 0-100",
  thesis: "one paragraph",
  bullCase: ["string"],
  bearCase: ["string"],
  risks: ["string"],
  watch: ["string"],
  holdingPeriod: "e.g. '2-6 weeks'",
  entry: "number",
  stop: "number",
  target: "number",
  rr: "number",
};

const n = (v, suffix = "") => (v == null || Number.isNaN(v) ? "n/a" : `${v}${suffix}`);

/**
 * Assemble the model's context from REAL figures only.
 * Anything missing is explicitly "n/a" so the model cannot quietly fill the gap.
 */
export function buildContext(s, signal, market = "IN") {
  const lines = [
    `Symbol: ${s.sym} (${s.name}). Market: ${market}. Sector: ${s.sector || "n/a"}.`,
    `Price: ${n(s.price)} (${s.chg >= 0 ? "+" : ""}${n(s.chg, "%")} today).`,
    `TECHNICALS (computed from real daily candles): RSI ${n(s.rsi)}, MACD ${n(s.macd)} vs signal ${n(s.macdSignal)}, ADX ${n(s.adx)}, ATR ${n(s.atr)}, Stochastic ${n(s.stoch)}, CCI ${n(s.cci)}, MFI ${n(s.mfi)}.`,
    `TREND: 50-DMA ${n(s.sma50)}, 200-DMA ${n(s.sma200)}, EMA20 ${n(s.ema20)}, EMA50 ${n(s.ema50)}.`,
    `LEVELS (real 60-session swings): support ${n(s.support)}, resistance ${n(s.resistance)}, 52w range ${n(s.low52)}–${n(s.high52)}.`,
    `VOLUME: last ${n(s.vol)} vs 20-day average ${n(s.avgVol)}${s.vol && s.avgVol ? ` (${(s.vol / s.avgVol).toFixed(2)}x)` : ""}.`,
    `FUNDAMENTALS (as reported): P/E ${n(s.pe)}, ROE ${n(s.roe, "%")}, revenue growth ${n(s.revGrowth, "%")}, earnings growth ${n(s.ebitdaGrowth, "%")}, profit margin ${n(s.profitMargin, "%")}, debt/equity ${n(s.debtToEquity)}, market cap ${n(s.marketCap)}.`,
  ];
  if (s.inst && s.inst.length) {
    lines.push(`INSTITUTIONAL (latest filings): ${s.inst.slice(0, 3).map((h) => `${h.n} ${n(h.pct, "%")} held${h.c != null ? ` (${h.c >= 0 ? "+" : ""}${h.c}% change)` : ""}`).join("; ")}.`);
  }
  if (signal) {
    lines.push(`ENGINE SIGNAL: "${signal.signal}" (score ${signal.score}). Computed levels — entry ${n(signal.entry ?? s.price)}, stop ${n(signal.stop)}, target ${n(signal.target)}, R:R ${n(signal.rr)}.`);
  }
  return lines.join("\n");
}

/** System prompt: forces JSON, forbids invention, forbids re-deriving levels. */
export function analysisSystemPrompt() {
  return [
    "You are Matrix, a senior equity research analyst. You are NOT a chatbot.",
    "You will be given REAL market data for one instrument. Analyse it and return a research verdict.",
    "",
    "HARD RULES:",
    "1. Output ONLY a JSON object. No markdown, no code fences, no preamble.",
    "2. Use ONLY the figures provided. If a figure is 'n/a', say so — NEVER invent a number, event, or news item.",
    "3. Do NOT compute your own entry/stop/target; those are supplied and will be used verbatim.",
    "4. Every claim in bullCase/bearCase must cite a figure from the data.",
    "5. This is a TECHNICALS-ONLY view. Do NOT mention or lament missing fundamentals (P/E, ROE, revenue, market cap). Never write phrases like 'due to lack of fundamental data' or 'no P/E available'. Simply analyse the technical and price data you have.",
    "",
    "JSON shape:",
    '{"recommendation":"Strong Buy|Buy|Hold|Reduce|Avoid","confidence":0-100,',
    '"thesis":"2-3 sentences","bullCase":["..."],"bearCase":["..."],',
    '"risks":["..."],"watch":["..."],"holdingPeriod":"e.g. 2-6 weeks"}',
  ].join("\n");
}

/**
 * Deterministic, fully-grounded fallback used when the LLM is unreachable.
 * It is derived from the SAME real signal engine as the picks — so it is honest
 * and structured, never invented prose.
 */
export function localRecommendation(s, signal) {
  if (!signal || !s || s.rsi == null) {
    return {
      recommendation: "Hold",
      confidence: 0,
      thesis: "Live market data for this instrument hasn't loaded yet, so Matrix has nothing real to analyse. No recommendation is offered without data.",
      bullCase: [], bearCase: [], risks: ["No data available."], watch: [],
      holdingPeriod: "n/a",
      entry: s?.price ?? null, stop: null, target: null, rr: null,
      source: "no-data",
    };
  }

  const score = signal.score;
  const rec = score >= 4 ? "Strong Buy" : score >= 2.5 ? "Buy" : score >= 1 ? "Hold" : score >= 0 ? "Reduce" : "Avoid";
  // Confidence rises with signal strength and trend quality (ADX), never above 85
  // for a rules-only verdict — we don't pretend to more certainty than we have.
  const adxBonus = s.adx != null && s.adx > 25 ? 10 : 0;
  const confidence = Math.max(10, Math.min(85, Math.round(40 + score * 8 + adxBonus)));

  const bull = [];
  const bear = [];
  if (s.sma50 != null && s.price > s.sma50) bull.push(`Price is above the 50-DMA (${s.sma50}), keeping the medium-term trend intact.`);
  else if (s.sma50 != null) bear.push(`Price is below the 50-DMA (${s.sma50}) — the medium-term trend is against the trade.`);
  if (s.sma50 != null && s.sma200 != null) {
    (s.sma50 > s.sma200 ? bull : bear).push(`50-DMA is ${s.sma50 > s.sma200 ? "above" : "below"} the 200-DMA (${s.sma200}) — a ${s.sma50 > s.sma200 ? "bullish" : "bearish"} long-term structure.`);
  }
  if (s.macd != null && s.macdSignal != null) {
    (s.macd > s.macdSignal ? bull : bear).push(`MACD (${s.macd}) is ${s.macd > s.macdSignal ? "above" : "below"} its signal line (${s.macdSignal}).`);
  }
  if (s.rsi >= 70) bear.push(`RSI ${s.rsi} is overbought — entries here carry pullback risk.`);
  else if (s.rsi <= 30) bull.push(`RSI ${s.rsi} is oversold — mean-reversion potential if support holds.`);
  else bull.push(`RSI ${s.rsi} is in a healthy mid-range, leaving room to run.`);
  if (signal.volRatio != null && signal.volRatio > 1.3) bull.push(`Volume is ${signal.volRatio}x its 20-day average, confirming participation.`);
  if (s.adx != null) (s.adx > 25 ? bull : bear).push(`ADX ${s.adx} indicates a ${s.adx > 25 ? "strong" : "weak"} trend.`);
  if (s.pe != null && s.pe > 60) bear.push(`P/E of ${s.pe} is demanding — valuation offers little cushion.`);
  if (s.revGrowth != null && s.revGrowth > 10) bull.push(`Revenue is growing ${s.revGrowth}% year on year.`);
  if (s.revGrowth != null && s.revGrowth < 0) bear.push(`Revenue is contracting ${Math.abs(s.revGrowth)}% year on year.`);

  const risks = [];
  if (s.atr != null && s.price) risks.push(`Daily range is roughly ${((s.atr / s.price) * 100).toFixed(1)}% (ATR ${s.atr}) — size the position accordingly.`);
  if (signal.rr != null && signal.rr < 1.5) risks.push(`Risk:reward is only ${signal.rr}:1 — thin reward for the risk taken.`);

  const watch = [];
  if (s.resistance != null) watch.push(`A decisive close above ${s.resistance} would confirm the breakout.`);
  if (s.support != null) watch.push(`Losing ${s.support} invalidates the setup.`);
  watch.push("Volume expansion on the next move — participation confirms or denies the signal.");

  return {
    recommendation: rec,
    confidence,
    thesis: `${signal.why} On the evidence available, Matrix rates this a ${rec.toLowerCase()} with ${confidence}% confidence.`,
    bullCase: bull.slice(0, 4),
    bearCase: bear.slice(0, 4),
    risks: risks.slice(0, 3),
    watch: watch.slice(0, 3),
    holdingPeriod: signal.pattern === "breakout" ? "1-4 weeks" : "2-6 weeks",
    entry: s.price,
    stop: signal.stop,
    target: signal.target,
    rr: signal.rr,
    source: "rules",
  };
}

/**
 * Validate & harden whatever the LLM returned.
 * Levels are ALWAYS taken from our engine, never from the model.
 */
export function normalizeAnalysis(raw, s, signal) {
  const base = localRecommendation(s, signal);
  if (!raw || typeof raw !== "object") return base;

  const arr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, 5) : []);
  const rec = RECOMMENDATIONS.includes(raw.recommendation) ? raw.recommendation : base.recommendation;
  let conf = Number(raw.confidence);
  if (!Number.isFinite(conf)) conf = base.confidence;
  conf = Math.max(0, Math.min(100, Math.round(conf)));

  return {
    recommendation: rec,
    confidence: conf,
    thesis: typeof raw.thesis === "string" && raw.thesis.trim() ? raw.thesis.trim() : base.thesis,
    bullCase: arr(raw.bullCase).length ? arr(raw.bullCase) : base.bullCase,
    bearCase: arr(raw.bearCase).length ? arr(raw.bearCase) : base.bearCase,
    risks: arr(raw.risks).length ? arr(raw.risks) : base.risks,
    watch: arr(raw.watch).length ? arr(raw.watch) : base.watch,
    holdingPeriod: typeof raw.holdingPeriod === "string" && raw.holdingPeriod.trim() ? raw.holdingPeriod.trim() : base.holdingPeriod,
    // Levels come from OUR engine. The model does not get to make these up.
    entry: base.entry,
    stop: base.stop,
    target: base.target,
    rr: base.rr,
    source: "ai",
  };
}

/** Colour/intent helper so the UI doesn't re-implement this. */
export function recTone(rec) {
  if (rec === "Strong Buy" || rec === "Buy") return "up";
  if (rec === "Reduce" || rec === "Avoid") return "down";
  return "neutral";
}
