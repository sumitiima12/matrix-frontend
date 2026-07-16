/**
 * domain/strategies.js — starter strategies and the instruments automations can trade.
 */
import { ALL } from "./universe";
import { TEMPLATES } from "./strategyLang";

/**
 * Sample strategies, across EVERY market — not just Indian indices.
 *
 * `market` is stated explicitly so the Automation page can group and filter them,
 * and so each is backtested against instruments it was actually designed for.
 * These have never traded: they carry no fake track record. The Sample tab scores
 * them by running them over real candles (see useBacktestStats).
 */
export const SEED_STRATS = [
  // ── Indian equity ──────────────────────────────────────────────────────────
  { id: "s1", name: "Golden Cross + RSI", market: "IN", by: "Matrix", active: false, alerts: false, cfg: TEMPLATES[0].cfg, cap: 200000, symbols: ["RELIANCE"], created: Date.now() - 128 * 864e5 },
  { id: "s2", name: "MACD crossover", market: "IN", by: "Matrix", active: false, alerts: false, cfg: TEMPLATES[2].cfg, cap: 100000, symbols: ["INFY"], created: Date.now() - 46 * 864e5 },
  { id: "s3", name: "Bollinger squeeze", market: "IN", by: "Matrix", active: false, alerts: false, cfg: TEMPLATES[1].cfg, cap: 150000, symbols: ["SBIN"], created: Date.now() - 84 * 864e5 },

  // ── F&O ────────────────────────────────────────────────────────────────────

  // ── US equity ──────────────────────────────────────────────────────────────
  { id: "s6", name: "Big tech momentum", market: "US", by: "Matrix", active: false, alerts: false, cfg: TEMPLATES[2].cfg, cap: 10000, symbols: ["AAPL"], created: Date.now() - 74 * 864e5 },
  { id: "s7", name: "BB breakout + RSI", market: "US", by: "Matrix", active: false, alerts: false, cfg: TEMPLATES[4].cfg, cap: 10000, symbols: ["TSLA"], created: Date.now() - 51 * 864e5 },

  // ── Crypto ─────────────────────────────────────────────────────────────────
  { id: "s8", name: "Crypto trend follow", market: "Crypto", by: "Matrix", active: false, alerts: false, cfg: TEMPLATES[0].cfg, cap: 5000, symbols: ["BTC"], created: Date.now() - 63 * 864e5 },
  { id: "s9", name: "Crypto mean reversion", market: "Crypto", by: "Matrix", active: false, alerts: false, cfg: TEMPLATES[1].cfg, cap: 5000, symbols: ["SOL"], created: Date.now() - 38 * 864e5 },

  // ── Commodity ──────────────────────────────────────────────────────────────
  { id: "s10", name: "Gold trend", market: "Commodity", by: "Matrix", active: false, alerts: false, cfg: TEMPLATES[0].cfg, cap: 10000, symbols: ["GOLD"], created: Date.now() - 120 * 864e5 },
  { id: "s11", name: "Crude momentum", market: "Commodity", by: "Matrix", active: false, alerts: false, cfg: TEMPLATES[2].cfg, cap: 10000, symbols: ["CRUDEOIL"], created: Date.now() - 57 * 864e5 },

  // ── More Matrix sample strategies ────────────────────────────────────────────
  // A broader set of starter ideas across every market, each expressed in the
  // builder's own indicators and rules so it runs and backtests on real candles.
  { id: "s20", name: "Supertrend flip", market: "Crypto", by: "Matrix", active: false, alerts: false, cap: 5000, symbols: ["BTC", "ETH"], created: Date.now() - 30 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "Supertrend", len: "14", mult: "3", name: "ST1" }],
      entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "ST1" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "ST1" }], sl: "1.2", tp: "5" } },
  { id: "s21", name: "RSI Breakout", market: "Commodity", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["GOLD"], created: Date.now() - 29 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "RSI", len: "14", name: "RSI1" }, { type: "LastNCandles", len: "10", name: "HL" }],
      entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "HL.high" }, { gate: "AND", la: "RSI1", op: ">", bType: "num", b: "60" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "HL.low" }], sl: "1.2", tp: "5" } },
  { id: "s22", name: "EMA crossover screener", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["TSLA", "NVDA", "AAPL"], created: Date.now() - 28 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "13", name: "EMA13" }, { type: "SMA", len: "83", name: "SMA83" }],
      entry: [{ la: "EMA13", op: "crosses_above", bType: "ind", b: "SMA83" }],
      exit: [{ la: "EMA13", op: "crosses_below", bType: "ind", b: "SMA83" }], sl: "2", tp: "8" } },
  { id: "s23", name: "SMA20 slope + RSI", market: "Crypto", by: "Matrix", active: false, alerts: false, cap: 5000, symbols: ["BTC"], created: Date.now() - 27 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "SMA", len: "20", name: "SMA20" }, { type: "RSI", len: "14", name: "RSI1" }],
      entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "SMA20" }, { gate: "AND", la: "RSI1", op: ">", bType: "num", b: "60" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "SMA20" }, { gate: "OR", la: "RSI1", op: "<", bType: "num", b: "40" }], sl: "2", tp: "6" } },
  { id: "s24", name: "Swing high/low", market: "IN", by: "Matrix", active: false, alerts: false, cap: 150000, symbols: ["RELIANCE", "SBIN"], created: Date.now() - 26 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "LastNCandles", len: "5", name: "SW" }],
      entry: [{ la: "Price", op: "<=", bType: "ind", b: "SW.low" }],
      exit: [{ la: "Price", op: ">=", bType: "ind", b: "SW.high" }], sl: "3", tp: "6" } },
  { id: "s25", name: "Bollinger Blast + RSI", market: "Crypto", by: "Matrix", active: false, alerts: false, cap: 5000, symbols: ["BTC", "ETH"], created: Date.now() - 25 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "BB", len: "20", name: "BB1" }, { type: "RSI", len: "14", name: "RSI1" }],
      entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "BB1.upper" }, { gate: "AND", la: "RSI1", op: ">", bType: "num", b: "65" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "BB1.middle" }], sl: "1.2", tp: "5" } },
  { id: "s26", name: "EMA/SMA cross (multi-exit)", market: "IN", by: "Matrix", active: false, alerts: false, cap: 200000, symbols: ["HDFCBANK", "RELIANCE", "TCS"], created: Date.now() - 24 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "13", name: "EMA13" }, { type: "SMA", len: "83", name: "SMA83" }, { type: "RSI", len: "20", name: "RSI1" }],
      entry: [{ la: "EMA13", op: "crosses_above", bType: "ind", b: "SMA83" }],
      exit: [{ la: "EMA13", op: "crosses_below", bType: "ind", b: "SMA83" }, { gate: "OR", la: "RSI1", op: ">", bType: "num", b: "80" }], sl: "3", tp: "8" } },
  { id: "s27", name: "AlphaX Nexus (confluence)", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["AAPL", "MSFT", "NVDA"], created: Date.now() - 23 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "21", name: "EMA_f" }, { type: "EMA", len: "50", name: "EMA_m" }, { type: "EMA", len: "200", name: "EMA_s" }, { type: "Volume", len: "", name: "Volume" }, { type: "SMA", len: "20", name: "VMA" }],
      entry: [{ la: "EMA_f", op: ">", bType: "ind", b: "EMA_m" }, { gate: "AND", la: "EMA_m", op: ">", bType: "ind", b: "EMA_s" }, { gate: "AND", la: "Volume", op: ">", bType: "ind", b: "VMA" }],
      exit: [{ la: "EMA_f", op: "crosses_below", bType: "ind", b: "EMA_m" }], sl: "1.2", tp: "5" } },
  { id: "s28", name: "EMA/TEMA + VWAP (NY)", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["TSLA", "AMZN"], created: Date.now() - 22 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "8", name: "EMA8" }, { type: "EMA", len: "55", name: "EMA55" }, { type: "VWAP", len: "", name: "VWAP1" }],
      entry: [{ la: "EMA8", op: "crosses_above", bType: "ind", b: "EMA55" }, { gate: "AND", la: "Price", op: ">", bType: "ind", b: "VWAP1" }],
      exit: [{ la: "EMA8", op: "crosses_below", bType: "ind", b: "EMA55" }], sl: "0.5", tp: "1" } },
  { id: "s29", name: "Fibonacci range", market: "Commodity", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["CRUDEOIL"], created: Date.now() - 21 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "BB", len: "20", name: "BB1" }],
      entry: [{ la: "Price", op: "<=", bType: "ind", b: "BB1.lower" }],
      exit: [{ la: "Price", op: ">=", bType: "ind", b: "BB1.upper" }], sl: "3", tp: "5" } },
  { id: "s30", name: "Simple MACD + RSI", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["MSFT", "AAPL"], created: Date.now() - 20 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "MACD", len: "", name: "MACD1" }, { type: "RSI", len: "14", name: "RSI1" }],
      entry: [{ la: "MACD1.line", op: "crosses_above", bType: "ind", b: "MACD1.signal" }, { gate: "AND", la: "RSI1", op: ">", bType: "num", b: "60" }],
      exit: [{ la: "MACD1.line", op: "crosses_below", bType: "ind", b: "MACD1.signal" }], sl: "3", tp: "8" } },
  { id: "s31", name: "EMA zone inversion", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["NVDA", "TSLA"], created: Date.now() - 19 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "33", name: "EMA1" }, { type: "EMA", len: "50", name: "EMA2" }, { type: "EMA", len: "200", name: "EMA3" }],
      entry: [{ la: "EMA1", op: ">", bType: "ind", b: "EMA2" }, { gate: "AND", la: "EMA2", op: ">", bType: "ind", b: "EMA3" }, { gate: "AND", la: "Price", op: "crosses_above", bType: "ind", b: "EMA1" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "EMA1" }], sl: "3", tp: "6" } },
  { id: "s32", name: "Dynamic swing VWAP", market: "Crypto", by: "Matrix", active: false, alerts: false, cap: 5000, symbols: ["SOL", "ETH"], created: Date.now() - 18 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "VWAP", len: "", name: "VWAP1" }],
      entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "VWAP1" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "VWAP1" }], sl: "3", tp: "6" } },
  { id: "s33", name: "Trendline break (liquidity)", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["AMZN", "NVDA"], created: Date.now() - 17 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "LastNCandles", len: "14", name: "HL" }],
      entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "HL.high" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "HL.low" }], sl: "3", tp: "8" } },
  { id: "s34", name: "AlphaX Prism", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["AAPL", "MSFT", "TSLA"], created: Date.now() - 16 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "21", name: "EMA_f" }, { type: "EMA", len: "50", name: "EMA_m" }, { type: "EMA", len: "200", name: "EMA_s" }, { type: "RSI", len: "14", name: "RSI1" }, { type: "ADX", len: "14", name: "ADX1" }],
      entry: [{ la: "EMA_f", op: ">", bType: "ind", b: "EMA_m" }, { gate: "AND", la: "EMA_m", op: ">", bType: "ind", b: "EMA_s" }, { gate: "AND", la: "RSI1", op: ">", bType: "num", b: "50" }, { gate: "AND", la: "ADX1", op: ">", bType: "num", b: "20" }],
      exit: [{ la: "RSI1", op: ">", bType: "num", b: "75" }, { gate: "OR", la: "Price", op: "crosses_below", bType: "ind", b: "EMA_m" }], sl: "3", tp: "6" } },
  { id: "s35", name: "R/S dynamic zones", market: "IN", by: "Matrix", active: false, alerts: false, cap: 150000, symbols: ["SBIN", "AXISBANK"], created: Date.now() - 15 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "LastNCandles", len: "10", name: "SW" }],
      entry: [{ la: "Price", op: "<=", bType: "ind", b: "SW.low" }],
      exit: [{ la: "Price", op: ">=", bType: "ind", b: "SW.high" }], sl: "1", tp: "1.5" } },
  { id: "s36", name: "Smart money BOS", market: "IN", by: "Matrix", active: false, alerts: false, cap: 150000, symbols: ["RELIANCE", "INFY"], created: Date.now() - 14 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "LastNCandles", len: "10", name: "HL" }, { type: "RSI", len: "14", name: "RSI1" }],
      entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "HL.high" }, { gate: "AND", la: "RSI1", op: ">", bType: "num", b: "50" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "HL.low" }], sl: "2", tp: "4" } },
  { id: "s37", name: "Elliott wave momentum", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["NVDA", "TSLA"], created: Date.now() - 13 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "SMA", len: "5", name: "EO_f" }, { type: "SMA", len: "35", name: "EO_s" }, { type: "Volume", len: "", name: "Volume" }, { type: "SMA", len: "20", name: "VMA" }],
      entry: [{ la: "EO_f", op: "crosses_above", bType: "ind", b: "EO_s" }, { gate: "AND", la: "Volume", op: ">", bType: "ind", b: "VMA" }],
      exit: [{ la: "EO_f", op: "crosses_below", bType: "ind", b: "EO_s" }], sl: "2", tp: "6" } },
  { id: "s38", name: "Candlestick pattern (intraday)", market: "IN", by: "Matrix", active: false, alerts: false, cap: 100000, symbols: ["TCS", "ITC"], created: Date.now() - 12 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "CurrentCandle", len: "", name: "CC" }, { type: "PrevCandle", len: "", name: "PC" }],
      entry: [{ la: "CC.close", op: ">", bType: "ind", b: "PC.high" }],
      exit: [{ la: "CC.close", op: "<", bType: "ind", b: "PC.low" }], sl: "1", tp: "2" } },
];

/**
 * Premium strategies (s20–s38): Matrix's curated, locked strategies. They live in a
 * separate "Premium" tab, appear in every market, and only expose a name + a short
 * description — never the underlying rules. Users can activate and backtest them but
 * cannot open, edit, or copy them as a template.
 */
const PREMIUM_DESC = {
  s20: "Follows the prevailing trend and steps aside the moment it turns. Built for clean, momentum-driven moves.",
  s21: "Catches decisive breakouts after a build-up of pressure, aiming to ride the expansion that follows.",
  s22: "A disciplined trend-follower that stays with strength and exits when momentum fades.",
  s23: "Enters when the trend is accelerating with momentum behind it, and leaves as it flattens out.",
  s24: "Buys into pullbacks near fresh swing lows and books profit into swing strength.",
  s25: "Targets high-energy breakouts backed by strong momentum, with a tight protective exit.",
  s26: "A classic trend cross with a momentum filter, tuned to sidestep choppy, directionless phases.",
  s27: "A multi-factor confluence model that only fires when several conditions agree — quality over quantity.",
  s28: "An intraday trend system aligned with the session's fair value for cleaner entries.",
  s29: "Fades stretched moves back toward the day's balance, aiming for the opposite extreme.",
  s30: "Momentum turns confirmed by trend strength, designed to filter out weak signals.",
  s31: "Trades continuation inside a strong trend once price reclaims a key zone.",
  s32: "Rotates with the swing structure around a rolling fair-value line.",
  s33: "Acts on decisive breaks of the prevailing range, aiming to capture the next leg.",
  s34: "A layered trend-and-momentum filter that waits for strong, trending conditions.",
  s35: "Reacts to price behaviour at dynamic support and resistance with tightly defined risk.",
  s36: "Trades structure breaks in the direction of momentum while keeping risk defined.",
  s37: "Aims to enter impulsive momentum legs and step out as they mature.",
  s38: "Reads decisive intraday price action to time entries and exits.",
};
SEED_STRATS.forEach((s) => {
  if (PREMIUM_DESC[s.id]) { s.premium = true; s.desc = PREMIUM_DESC[s.id]; }
});

export const ACTIVATE_SYMS = [...new Set(ALL.map((x) => x.sym))];

/**
 * Real strategy performance, computed from the trades the strategy ACTUALLY
 * placed. Previously this returned seeded random win rates and returns — pure
 * fiction. A strategy with no trades yet now reports exactly that, rather than
 * inventing a track record.
 *
 * @param strat      the strategy
 * @param trades     the user's real trade log
 * @param rangeDays  lookback window
 */
export function stratPerf(strat, trades = [], rangeDays = 365) {
  const from = Date.now() - rangeDays * 86_400_000;
  const mine = (trades || []).filter(
    (t) => t.strategyId === strat.id || t.strategy === strat.name
  ).filter((t) => (t.exitAt || t.entryAt || 0) >= from);

  const closed = mine.filter((t) => t.exitAt != null && t.exit != null);
  const cap = strat.cap || 100000;

  if (!closed.length) {
    return {
      trades: mine.length, wins: 0, winRate: null, retPct: null,
      annual: null, pnl: null, cap, open: mine.length - closed.length,
      hasData: false,
    };
  }

  const wins = closed.filter((t) => (t.exit - t.entry) * (t.qty || 1) > 0).length;
  const pnl = closed.reduce((a, t) => a + (t.exit - t.entry) * (t.qty || 1), 0);
  const retPct = cap ? (pnl / cap) * 100 : 0;
  const years = Math.max(rangeDays / 365, 1 / 365);

  return {
    trades: closed.length,
    wins,
    winRate: +((wins / closed.length) * 100).toFixed(1),
    retPct: +retPct.toFixed(2),
    annual: +(retPct / years).toFixed(2),
    pnl: +pnl.toFixed(2),
    cap,
    open: mine.length - closed.length,
    hasData: true,
  };
}
