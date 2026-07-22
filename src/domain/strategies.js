/**
 * domain/strategies.js — starter strategies and the instruments automations can trade.
 */
import { ALL } from "./universe";

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
  // These used to share a couple of generic TEMPLATES, so the NAME never matched the RULES
  // (e.g. "Bollinger Squeeze" actually ran EMA + RSI). Each now has its own cfg whose indicators
  // match its name. (Timeframe = 5m and SL/TP = 0.5%/1% are applied uniformly below.)
  { id: "s1", name: "Golden Cross", market: "IN", by: "Matrix", active: false, alerts: false, cap: 200000, symbols: ["RELIANCE"], created: Date.now() - 128 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "50", name: "EMA50" }, { type: "EMA", len: "200", name: "EMA200" }],
      entry: [{ la: "EMA50", op: "crosses_above", bType: "ind", b: "EMA200" }],
      exit: [{ la: "EMA50", op: "crosses_below", bType: "ind", b: "EMA200" }] } },
  { id: "s2", name: "MACD Pulse", market: "IN", by: "Matrix", active: false, alerts: false, cap: 100000, symbols: ["INFY"], created: Date.now() - 46 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "MACD", len: "", name: "MACD1" }],
      entry: [{ la: "MACD1.line", op: "crosses_above", bType: "ind", b: "MACD1.signal" }],
      exit: [{ la: "MACD1.line", op: "crosses_below", bType: "ind", b: "MACD1.signal" }] } },
  { id: "s3", name: "Bollinger Squeeze", market: "IN", by: "Matrix", active: false, alerts: false, cap: 150000, symbols: ["SBIN"], created: Date.now() - 84 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "BB", len: "20", name: "BB1" }],
      entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "BB1.upper" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "BB1.middle" }] } },

  // ── F&O ────────────────────────────────────────────────────────────────────

  // ── US equity ──────────────────────────────────────────────────────────────
  { id: "s6", name: "Big Tech Momentum", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["AAPL"], created: Date.now() - 74 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "20", name: "EMA20" }, { type: "EMA", len: "50", name: "EMA50" }, { type: "RSI", len: "14", name: "RSI1" }],
      entry: [{ la: "EMA20", op: "crosses_above", bType: "ind", b: "EMA50" }, { gate: "AND", la: "RSI1", op: ">", bType: "num", b: "55" }],
      exit: [{ la: "EMA20", op: "crosses_below", bType: "ind", b: "EMA50" }] } },
  { id: "s7", name: "Bollinger Breakout", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["TSLA"], created: Date.now() - 51 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "BB", len: "20", name: "BB1" }],
      entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "BB1.upper" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "BB1.middle" }] } },

  // ── Crypto ─────────────────────────────────────────────────────────────────
  { id: "s8", name: "Crypto Trend Rider", market: "Crypto", by: "Matrix", active: false, alerts: false, cap: 5000, symbols: ["BTC"], created: Date.now() - 63 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "20", name: "EMA20" }, { type: "EMA", len: "50", name: "EMA50" }],
      entry: [{ la: "EMA20", op: "crosses_above", bType: "ind", b: "EMA50" }],
      exit: [{ la: "EMA20", op: "crosses_below", bType: "ind", b: "EMA50" }] } },
  { id: "s9", name: "Crypto Reversal", market: "Crypto", by: "Matrix", active: false, alerts: false, cap: 5000, symbols: ["SOL"], created: Date.now() - 38 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "RSI", len: "14", name: "RSI1" }],
      entry: [{ la: "RSI1", op: "crosses_above", bType: "num", b: "30" }],
      exit: [{ la: "RSI1", op: ">", bType: "num", b: "60" }] } },

  // ── Commodity ──────────────────────────────────────────────────────────────
  { id: "s10", name: "Gold Trend", market: "Commodity", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["GOLD"], created: Date.now() - 120 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "20", name: "EMA20" }, { type: "EMA", len: "50", name: "EMA50" }],
      entry: [{ la: "EMA20", op: "crosses_above", bType: "ind", b: "EMA50" }],
      exit: [{ la: "EMA20", op: "crosses_below", bType: "ind", b: "EMA50" }] } },
  { id: "s11", name: "Crude Momentum", market: "Commodity", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["CRUDEOIL"], created: Date.now() - 57 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "MACD", len: "", name: "MACD1" }, { type: "RSI", len: "14", name: "RSI1" }],
      entry: [{ la: "MACD1.line", op: "crosses_above", bType: "ind", b: "MACD1.signal" }, { gate: "AND", la: "RSI1", op: ">", bType: "num", b: "50" }],
      exit: [{ la: "MACD1.line", op: "crosses_below", bType: "ind", b: "MACD1.signal" }] } },

  // ── More Matrix sample strategies ────────────────────────────────────────────
  // A broader set of starter ideas across every market, each expressed in the
  // builder's own indicators and rules so it runs and backtests on real candles.
  { id: "s20", name: "Supertrend Flip", market: "Crypto", by: "Matrix", active: false, alerts: false, cap: 5000, symbols: ["BTC", "ETH"], created: Date.now() - 30 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "Supertrend", len: "14", mult: "3", name: "ST1" }],
      entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "ST1" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "ST1" }], sl: "1.2", tp: "5" } },
  { id: "s21", name: "RSI Breakout", market: "Commodity", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["GOLD"], created: Date.now() - 29 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "RSI", len: "14", name: "RSI1" }, { type: "LastNCandles", len: "10", name: "HL" }],
      entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "HL.high" }, { gate: "AND", la: "RSI1", op: ">", bType: "num", b: "60" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "HL.low" }], sl: "1.2", tp: "5" } },
  { id: "s22", name: "EMA Crossover", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["TSLA", "NVDA", "AAPL"], created: Date.now() - 28 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "13", name: "EMA13" }, { type: "SMA", len: "83", name: "SMA83" }],
      entry: [{ la: "EMA13", op: "crosses_above", bType: "ind", b: "SMA83" }],
      exit: [{ la: "EMA13", op: "crosses_below", bType: "ind", b: "SMA83" }], sl: "2", tp: "8" } },
  { id: "s23", name: "Momentum Ride", market: "Crypto", by: "Matrix", active: false, alerts: false, cap: 5000, symbols: ["BTC"], created: Date.now() - 27 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "SMA", len: "20", name: "SMA20" }, { type: "RSI", len: "14", name: "RSI1" }],
      entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "SMA20" }, { gate: "AND", la: "RSI1", op: ">", bType: "num", b: "60" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "SMA20" }, { gate: "OR", la: "RSI1", op: "<", bType: "num", b: "40" }], sl: "2", tp: "6" } },
  { id: "s24", name: "Swing Catcher", market: "IN", by: "Matrix", active: false, alerts: false, cap: 150000, symbols: ["RELIANCE", "SBIN"], created: Date.now() - 26 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "LastNCandles", len: "5", name: "SW" }],
      entry: [{ la: "Price", op: "<=", bType: "ind", b: "SW.low" }],
      exit: [{ la: "Price", op: ">=", bType: "ind", b: "SW.high" }], sl: "3", tp: "6" } },
  { id: "s25", name: "Bollinger Blast", market: "Crypto", by: "Matrix", active: false, alerts: false, cap: 5000, symbols: ["BTC", "ETH"], created: Date.now() - 25 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "BB", len: "20", name: "BB1" }, { type: "RSI", len: "14", name: "RSI1" }],
      entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "BB1.upper" }, { gate: "AND", la: "RSI1", op: ">", bType: "num", b: "65" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "BB1.middle" }], sl: "1.2", tp: "5" } },
  { id: "s26", name: "EMA-SMA Crossover", market: "IN", by: "Matrix", active: false, alerts: false, cap: 200000, symbols: ["HDFCBANK", "RELIANCE", "TCS"], created: Date.now() - 24 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "13", name: "EMA13" }, { type: "SMA", len: "83", name: "SMA83" }, { type: "RSI", len: "20", name: "RSI1" }],
      entry: [{ la: "EMA13", op: "crosses_above", bType: "ind", b: "SMA83" }],
      exit: [{ la: "EMA13", op: "crosses_below", bType: "ind", b: "SMA83" }, { gate: "OR", la: "RSI1", op: ">", bType: "num", b: "80" }], sl: "3", tp: "8" } },
  { id: "s27", name: "AlphaX Nexus", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["AAPL", "MSFT", "NVDA"], created: Date.now() - 23 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "21", name: "EMA_f" }, { type: "EMA", len: "50", name: "EMA_m" }, { type: "EMA", len: "200", name: "EMA_s" }, { type: "Volume", len: "", name: "Volume" }, { type: "SMA", len: "20", name: "VMA" }],
      entry: [{ la: "EMA_f", op: ">", bType: "ind", b: "EMA_m" }, { gate: "AND", la: "EMA_m", op: ">", bType: "ind", b: "EMA_s" }, { gate: "AND", la: "Volume", op: ">", bType: "ind", b: "VMA" }],
      exit: [{ la: "EMA_f", op: "crosses_below", bType: "ind", b: "EMA_m" }], sl: "1.2", tp: "5" } },
  { id: "s28", name: "TEMA Rider", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["TSLA", "AMZN"], created: Date.now() - 22 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "8", name: "EMA8" }, { type: "EMA", len: "55", name: "EMA55" }, { type: "VWAP", len: "", name: "VWAP1" }],
      entry: [{ la: "EMA8", op: "crosses_above", bType: "ind", b: "EMA55" }, { gate: "AND", la: "Price", op: ">", bType: "ind", b: "VWAP1" }],
      exit: [{ la: "EMA8", op: "crosses_below", bType: "ind", b: "EMA55" }], sl: "0.5", tp: "1" } },
  { id: "s29", name: "Fibonacci Range", market: "Commodity", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["CRUDEOIL"], created: Date.now() - 21 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "Fib", len: "90", name: "FIB" }],
      entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "FIB.r618" }],
      exit: [{ la: "Price", op: ">=", bType: "ind", b: "FIB.r236" }] } },
  { id: "s30", name: "MACD Momentum", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["MSFT", "AAPL"], created: Date.now() - 20 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "MACD", len: "", name: "MACD1" }, { type: "RSI", len: "14", name: "RSI1" }],
      entry: [{ la: "MACD1.line", op: "crosses_above", bType: "ind", b: "MACD1.signal" }, { gate: "AND", la: "RSI1", op: ">", bType: "num", b: "60" }],
      exit: [{ la: "MACD1.line", op: "crosses_below", bType: "ind", b: "MACD1.signal" }], sl: "3", tp: "8" } },
  { id: "s31", name: "EMA Zone Inversion", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["NVDA", "TSLA"], created: Date.now() - 19 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "33", name: "EMA1" }, { type: "EMA", len: "50", name: "EMA2" }, { type: "EMA", len: "200", name: "EMA3" }],
      entry: [{ la: "EMA1", op: ">", bType: "ind", b: "EMA2" }, { gate: "AND", la: "EMA2", op: ">", bType: "ind", b: "EMA3" }, { gate: "AND", la: "Price", op: "crosses_above", bType: "ind", b: "EMA1" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "EMA1" }], sl: "3", tp: "6" } },
  { id: "s32", name: "Swing VWAP", market: "Crypto", by: "Matrix", active: false, alerts: false, cap: 5000, symbols: ["SOL", "ETH"], created: Date.now() - 18 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "VWAP", len: "", name: "VWAP1" }],
      entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "VWAP1" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "VWAP1" }], sl: "3", tp: "6" } },
  { id: "s33", name: "Trendline Break", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["AMZN", "NVDA"], created: Date.now() - 17 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "LastNCandles", len: "14", name: "HL" }],
      entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "HL.high" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "HL.low" }], sl: "3", tp: "8" } },
  { id: "s34", name: "AlphaX Prism", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["AAPL", "MSFT", "TSLA"], created: Date.now() - 16 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "21", name: "EMA_f" }, { type: "EMA", len: "50", name: "EMA_m" }, { type: "EMA", len: "200", name: "EMA_s" }, { type: "RSI", len: "14", name: "RSI1" }, { type: "ADX", len: "14", name: "ADX1" }],
      entry: [{ la: "EMA_f", op: ">", bType: "ind", b: "EMA_m" }, { gate: "AND", la: "EMA_m", op: ">", bType: "ind", b: "EMA_s" }, { gate: "AND", la: "RSI1", op: ">", bType: "num", b: "50" }, { gate: "AND", la: "ADX1", op: ">", bType: "num", b: "20" }],
      exit: [{ la: "RSI1", op: ">", bType: "num", b: "75" }, { gate: "OR", la: "Price", op: "crosses_below", bType: "ind", b: "EMA_m" }], sl: "3", tp: "6" } },
  { id: "s35", name: "Support & Resistance", market: "IN", by: "Matrix", active: false, alerts: false, cap: 150000, symbols: ["SBIN", "AXISBANK"], created: Date.now() - 15 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "LastNCandles", len: "10", name: "SW" }],
      entry: [{ la: "Price", op: "<=", bType: "ind", b: "SW.low" }],
      exit: [{ la: "Price", op: ">=", bType: "ind", b: "SW.high" }], sl: "1", tp: "1.5" } },
  { id: "s36", name: "Smart Money", market: "IN", by: "Matrix", active: false, alerts: false, cap: 150000, symbols: ["RELIANCE", "INFY"], created: Date.now() - 14 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "LastNCandles", len: "10", name: "HL" }, { type: "RSI", len: "14", name: "RSI1" }],
      entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "HL.high" }, { gate: "AND", la: "RSI1", op: ">", bType: "num", b: "50" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "HL.low" }], sl: "2", tp: "4" } },
  { id: "s37", name: "Elliott Wave", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["NVDA", "TSLA"], created: Date.now() - 13 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "SMA", len: "5", name: "EO_f" }, { type: "SMA", len: "35", name: "EO_s" }, { type: "Volume", len: "", name: "Volume" }, { type: "SMA", len: "20", name: "VMA" }],
      entry: [{ la: "EO_f", op: "crosses_above", bType: "ind", b: "EO_s" }, { gate: "AND", la: "Volume", op: ">", bType: "ind", b: "VMA" }],
      exit: [{ la: "EO_f", op: "crosses_below", bType: "ind", b: "EO_s" }], sl: "2", tp: "6" } },
  { id: "s38", name: "Candlestick Pro", market: "IN", by: "Matrix", active: false, alerts: false, cap: 100000, symbols: ["TCS", "ITC"], created: Date.now() - 12 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "CurrentCandle", len: "", name: "CC" }, { type: "PrevCandle", len: "", name: "PC" }],
      entry: [{ la: "CC.close", op: ">", bType: "ind", b: "PC.high" }],
      exit: [{ la: "CC.close", op: "<", bType: "ind", b: "PC.low" }], sl: "1", tp: "2" } },

  // ── Advanced premium set (s39–s58): chart-pattern, support/resistance and the classic
  //    algorithmic archetypes (Chan-style mean reversion, dual momentum, breakout) — each a real,
  //    backtestable cfg built on the engine's operands, including the pattern & S/R detectors.
  { id: "s39", name: "Cup & Handle Breakout", market: "IN", by: "Matrix", active: false, alerts: false, cap: 150000, symbols: ["RELIANCE", "TCS", "INFY"], created: Date.now() - 11 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "RSI", len: "14", name: "RSI1" }],
      entry: [{ la: "PAT:cup-handle", op: ">", bType: "num", b: "0" }],
      exit: [{ la: "RSI1", op: ">", bType: "num", b: "75" }], sl: "3", tp: "9" } },
  { id: "s40", name: "Double-Bottom Reversal", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["AAPL", "AMZN", "NVDA"], created: Date.now() - 10.5 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "RSI", len: "14", name: "RSI1" }],
      entry: [{ la: "PAT:double-bottom", op: ">", bType: "num", b: "0" }, { gate: "AND", la: "RSI1", op: ">", bType: "num", b: "45" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "Support" }], sl: "3", tp: "8" } },
  { id: "s41", name: "Inverse H&S Long", market: "Crypto", by: "Matrix", active: false, alerts: false, cap: 5000, symbols: ["BTC", "ETH"], created: Date.now() - 10 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "RSI", len: "14", name: "RSI1" }],
      entry: [{ la: "PAT:inv-head-shoulders", op: ">", bType: "num", b: "0" }],
      exit: [{ la: "RSI1", op: ">", bType: "num", b: "72" }], sl: "4", tp: "12" } },
  { id: "s42", name: "Support Bounce", market: "IN", by: "Matrix", active: false, alerts: false, cap: 150000, symbols: ["SBIN", "AXISBANK", "HDFCBANK"], created: Date.now() - 9.5 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "CurrentCandle", len: "", name: "CC" }, { type: "RSI", len: "14", name: "RSI1" }],
      entry: [{ la: "Price", op: ">", bType: "ind", b: "Support" }, { gate: "AND", la: "CC.close", op: ">", bType: "ind", b: "CC.open" }, { gate: "AND", la: "RSI1", op: ">", bType: "num", b: "45" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "Support" }], sl: "2", tp: "5" } },
  { id: "s43", name: "Resistance Breakout", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["TSLA", "MSFT", "NVDA"], created: Date.now() - 9 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "Volume", len: "", name: "Volume" }, { type: "SMA", len: "20", name: "VMA" }],
      entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "Resistance" }, { gate: "AND", la: "Volume", op: ">", bType: "ind", b: "VMA" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "Support" }], sl: "3", tp: "8" } },
  { id: "s44", name: "Bollinger Mean Reversion", market: "Crypto", by: "Matrix", active: false, alerts: false, cap: 5000, symbols: ["BTC", "SOL"], created: Date.now() - 8.5 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "BB", len: "20", name: "BB1" }, { type: "RSI", len: "14", name: "RSI1" }],
      entry: [{ la: "Price", op: "<=", bType: "ind", b: "BB1.lower" }, { gate: "AND", la: "RSI1", op: "<", bType: "num", b: "35" }],
      exit: [{ la: "Price", op: ">=", bType: "ind", b: "BB1.middle" }], sl: "3", tp: "6" } },
  { id: "s45", name: "RSI-2 Pullback", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["AAPL", "MSFT", "AMZN"], created: Date.now() - 8 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "RSI", len: "2", name: "RSI2" }, { type: "SMA", len: "200", name: "SMA200" }, { type: "SMA", len: "5", name: "SMA5" }],
      entry: [{ la: "Price", op: ">", bType: "ind", b: "SMA200" }, { gate: "AND", la: "RSI2", op: "<", bType: "num", b: "10" }],
      exit: [{ la: "Price", op: ">=", bType: "ind", b: "SMA5" }], sl: "2", tp: "4" } },
  { id: "s46", name: "ADX Trend Momentum", market: "IN", by: "Matrix", active: false, alerts: false, cap: 150000, symbols: ["RELIANCE", "ICICIBANK"], created: Date.now() - 7.5 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "ADX", len: "14", name: "ADX1" }, { type: "EMA", len: "20", name: "EMA20" }, { type: "EMA", len: "50", name: "EMA50" }],
      entry: [{ la: "ADX1", op: ">", bType: "num", b: "25" }, { gate: "AND", la: "EMA20", op: ">", bType: "ind", b: "EMA50" }, { gate: "AND", la: "Price", op: ">", bType: "ind", b: "EMA20" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "EMA20" }], sl: "3", tp: "7" } },
  { id: "s47", name: "VWAP Reclaim", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["NVDA", "TSLA"], created: Date.now() - 7 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "VWAP", len: "", name: "VWAP1" }, { type: "RSI", len: "14", name: "RSI1" }],
      entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "VWAP1" }, { gate: "AND", la: "RSI1", op: ">", bType: "num", b: "50" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "VWAP1" }], sl: "1.5", tp: "3" } },
  { id: "s48", name: "Supertrend + MACD", market: "Crypto", by: "Matrix", active: false, alerts: false, cap: 5000, symbols: ["BTC", "ETH"], created: Date.now() - 6.5 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "Supertrend", len: "10", mult: "3", name: "ST1" }, { type: "MACD", len: "", name: "MACD1" }],
      entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "ST1" }, { gate: "AND", la: "MACD1.hist", op: ">", bType: "num", b: "0" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "ST1" }], sl: "3", tp: "8" } },
  { id: "s49", name: "20-Day Momentum Breakout", market: "Commodity", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["GOLD", "CRUDEOIL"], created: Date.now() - 6 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "LastNCandles", len: "20", name: "HL" }, { type: "Volume", len: "", name: "Volume" }, { type: "SMA", len: "20", name: "VMA" }],
      entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "HL.high" }, { gate: "AND", la: "Volume", op: ">", bType: "ind", b: "VMA" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "HL.low" }], sl: "3", tp: "9" } },
  { id: "s50", name: "Golden Cross + ADX", market: "IN", by: "Matrix", active: false, alerts: false, cap: 200000, symbols: ["TCS", "HDFCBANK"], created: Date.now() - 5.5 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "50", name: "EMA50" }, { type: "EMA", len: "200", name: "EMA200" }, { type: "ADX", len: "14", name: "ADX1" }],
      entry: [{ la: "EMA50", op: ">", bType: "ind", b: "EMA200" }, { gate: "AND", la: "ADX1", op: ">", bType: "num", b: "20" }],
      exit: [{ la: "EMA50", op: "crosses_below", bType: "ind", b: "EMA200" }], sl: "4", tp: "10" } },
  { id: "s51", name: "Ascending Triangle Break", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["AAPL", "AMZN"], created: Date.now() - 5 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "RSI", len: "14", name: "RSI1" }],
      entry: [{ la: "PAT:asc-triangle", op: ">", bType: "num", b: "0" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "Support" }], sl: "3", tp: "8" } },
  { id: "s52", name: "Bull Flag Continuation", market: "Crypto", by: "Matrix", active: false, alerts: false, cap: 5000, symbols: ["SOL", "ETH"], created: Date.now() - 4.5 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "RSI", len: "14", name: "RSI1" }],
      entry: [{ la: "PAT:bull-flag", op: ">", bType: "num", b: "0" }],
      exit: [{ la: "RSI1", op: ">", bType: "num", b: "75" }], sl: "4", tp: "10" } },
  { id: "s53", name: "Keltner Squeeze Breakout", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["MSFT", "NVDA"], created: Date.now() - 4 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "KC", len: "20", name: "KC1" }, { type: "MACD", len: "", name: "MACD1" }],
      entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "KC1.upper" }, { gate: "AND", la: "MACD1.line", op: ">", bType: "ind", b: "MACD1.signal" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "KC1.middle" }], sl: "3", tp: "7" } },
  { id: "s54", name: "Triple-EMA Dual Momentum", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["AAPL", "MSFT", "NVDA"], created: Date.now() - 3.5 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "21", name: "EMA_f" }, { type: "EMA", len: "50", name: "EMA_m" }, { type: "EMA", len: "200", name: "EMA_s" }, { type: "RSI", len: "14", name: "RSI1" }],
      entry: [{ la: "EMA_f", op: ">", bType: "ind", b: "EMA_m" }, { gate: "AND", la: "EMA_m", op: ">", bType: "ind", b: "EMA_s" }, { gate: "AND", la: "RSI1", op: ">", bType: "num", b: "55" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "EMA_m" }], sl: "3", tp: "8" } },
  { id: "s55", name: "Oversold Reversal", market: "IN", by: "Matrix", active: false, alerts: false, cap: 150000, symbols: ["ITC", "SBIN"], created: Date.now() - 3 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "RSI", len: "14", name: "RSI1" }, { type: "SMA", len: "50", name: "SMA50" }],
      entry: [{ la: "RSI1", op: "<", bType: "num", b: "30" }],
      exit: [{ la: "RSI1", op: ">", bType: "num", b: "55" }, { gate: "OR", la: "Price", op: "crosses_above", bType: "ind", b: "SMA50" }], sl: "3", tp: "6" } },
  { id: "s56", name: "CCI Extremes", market: "Commodity", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["GOLD", "SILVER"], created: Date.now() - 2.5 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "CCI", len: "20", name: "CCI1" }],
      entry: [{ la: "CCI1", op: "<", bType: "num", b: "-100" }],
      exit: [{ la: "CCI1", op: ">", bType: "num", b: "100" }], sl: "3", tp: "6" } },
  { id: "s57", name: "Volatility Expansion", market: "IN", by: "Matrix", active: false, alerts: false, cap: 150000, symbols: ["RELIANCE", "INFY"], created: Date.now() - 2 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "BB", len: "20", name: "BB1" }, { type: "ADX", len: "14", name: "ADX1" }],
      entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "BB1.upper" }, { gate: "AND", la: "ADX1", op: ">", bType: "num", b: "20" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "BB1.middle" }], sl: "3", tp: "7" } },
  { id: "s58", name: "VWAP Trend Pullback", market: "US", by: "Matrix", active: false, alerts: false, cap: 10000, symbols: ["TSLA", "AMZN"], created: Date.now() - 1.5 * 864e5,
    cfg: { mode: "builder", defs: [{ type: "VWAP", len: "", name: "VWAP1" }, { type: "EMA", len: "50", name: "EMA50" }, { type: "RSI", len: "14", name: "RSI1" }],
      entry: [{ la: "Price", op: ">", bType: "ind", b: "EMA50" }, { gate: "AND", la: "Price", op: "crosses_above", bType: "ind", b: "VWAP1" }, { gate: "AND", la: "RSI1", op: ">", bType: "num", b: "50" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "EMA50" }], sl: "2", tp: "5" } },

  // ── New premium strategies ───────────────────────────────────────────────────
  // MULTI-TIMEFRAME: base runs on 3m; the 5m and 15m EMAs resolve on their own aggregated candles
  // (multi-timeframe engine). Long only when all three timeframes are bullish at once.
  { id: "s59", name: "Multi-Timeframe Momentum", market: "Crypto", by: "Matrix", active: false, alerts: false, cap: 5000, symbols: ["BTC", "ETH"], created: Date.now() - 1 * 864e5, tf: "3m",
    cfg: { mode: "builder", tf: "3m", defs: [
        { type: "EMA", len: "9", tf: "3m", name: "E3f" }, { type: "EMA", len: "21", tf: "3m", name: "E3s" },
        { type: "EMA", len: "9", tf: "5m", name: "E5f" }, { type: "EMA", len: "21", tf: "5m", name: "E5s" },
        { type: "EMA", len: "9", tf: "15m", name: "E15f" }, { type: "EMA", len: "21", tf: "15m", name: "E15s" }],
      entry: [{ la: "E3f", op: ">", bType: "ind", b: "E3s" }, { gate: "AND", la: "E5f", op: ">", bType: "ind", b: "E5s" }, { gate: "AND", la: "E15f", op: ">", bType: "ind", b: "E15s" }],
      exit: [{ la: "E3f", op: "crosses_below", bType: "ind", b: "E3s" }] } },
  // OPENING RANGE BREAKOUT: buy the break above the high of the day's first 15 minutes.
  { id: "s60", name: "Opening Range Breakout", market: "IN", by: "Matrix", active: false, alerts: false, cap: 150000, symbols: ["RELIANCE", "SBIN"], created: Date.now() - 0.5 * 864e5, tf: "5m",
    cfg: { mode: "builder", tf: "5m", defs: [{ type: "ORB", len: "15", name: "OR" }],
      entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "OR.high" }],
      exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "OR.low" }] } },
];

/* HOUSE DEFAULTS for every sample & premium strategy: run each indicator on the 5-minute timeframe,
   and use a uniform 0.5% stop-loss / 1% take-profit. Applied in one pass so the individual cfgs above
   stay readable and there's a single place to change the policy. */
SEED_STRATS.forEach((s) => {
  if (!s.cfg || s.cfg.mode !== "builder") return;
  // Default each indicator to 5m, but KEEP an explicit per-indicator timeframe where one is set
  // (the multi-timeframe strategy relies on its 3m / 5m / 15m defs surviving this pass).
  (s.cfg.defs || []).forEach((d) => { d.tf = d.tf || "5m"; });
  s.cfg.sl = "0.5";
  s.cfg.tp = "1";
});

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
  s39: "Detects the classic cup-and-handle base and enters the breakout, riding the measured move that follows.",
  s40: "Spots a double-bottom reversal off a tested floor and turns up with momentum confirmation.",
  s41: "Enters an inverse head-and-shoulders bottom as it completes — a high-conviction trend reversal.",
  s42: "Buys green candles defending a proven support level, with risk pinned just below the floor.",
  s43: "Breaks decisively above a well-tested ceiling on expanding volume, aiming for the next leg.",
  s44: "A mean-reversion play that fades stretched selloffs at the lower band and exits back to the mean.",
  s45: "The RSI-2 pullback within an uptrend — buy deep short-term dips above the 200-day, exit on the snapback.",
  s46: "Rides only strong, trending moves — a genuine trend filter keeps it out of chop.",
  s47: "Reclaims the session's fair-value line with momentum for cleaner intraday entries.",
  s48: "Aligns trend and momentum — enters when both the trend line and MACD agree, exits on the flip.",
  s49: "A Donchian-style momentum breakout: buys new 20-day highs backed by volume.",
  s50: "The long-term golden cross, gated by trend strength so it only acts on real trends.",
  s51: "Trades the breakout from an ascending triangle — a bullish continuation with defined risk.",
  s52: "Enters a bull-flag continuation after a strong pole, targeting the next impulse.",
  s53: "Fires on a volatility-squeeze breakout through the channel with momentum behind it.",
  s54: "A layered triple-EMA trend stack with a momentum filter — quality trend-following.",
  s55: "Buys capitulation lows and rides the reversion back toward the mean.",
  s56: "Fades commodity extremes, entering deeply oversold and exiting into overbought.",
  s57: "Trades volatility expansion out of a quiet base, confirmed by trend strength.",
  s58: "Buys trend-aligned pullbacks that reclaim fair value — trade with the trend, enter on the dip.",
  s59: "Goes long only when the 3-minute, 5-minute AND 15-minute trends all agree — triple-timeframe confirmation for higher-quality entries.",
  s60: "Buys the break above the high of the day's first 15 minutes — the classic opening-range breakout, with risk pinned at the range low.",
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
/* `priceOf(sym)` (optional) supplies the current price so OPEN paper positions contribute their
   live UNREALISED P&L — without it, a strategy that just opened a position showed "—" because only
   closed trades counted. Realised P&L (closed) + unrealised (open) is the number the user expects. */
export function stratPerf(strat, trades = [], rangeDays = 365, priceOf = null) {
  const from = Date.now() - rangeDays * 86_400_000;
  const mine = (trades || []).filter(
    (t) => (t.strategyId === strat.id || t.strategy === strat.name) && t.status !== "rejected"
  ).filter((t) => (t.exitAt || t.entryAt || 0) >= from);

  const closed = mine.filter((t) => t.exitAt != null && t.exit != null);
  const openPos = mine.filter((t) => t.entry != null && (t.exitAt == null || t.exit == null));
  const cap = strat.cap || 100000;

  const realised = closed.reduce((a, t) => a + (t.exit - t.entry) * (t.qty || 1), 0);
  const unrealised = openPos.reduce((a, t) => {
    const cur = priceOf ? priceOf(t.sym) : null;
    return a + (cur != null ? (cur - t.entry) * (t.qty || 1) : 0);
  }, 0);
  const pnl = realised + unrealised;

  // No closed trades AND no priced open positions => genuinely nothing to show yet.
  if (!closed.length && !(openPos.length && priceOf)) {
    return {
      trades: 0, positions: mine.length, wins: 0, winRate: null, retPct: null,
      annual: null, pnl: openPos.length ? null : (closed.length ? +realised.toFixed(2) : null),
      cap, open: openPos.length, hasData: false,
    };
  }

  const wins = closed.filter((t) => (t.exit - t.entry) * (t.qty || 1) > 0).length;
  const retPct = cap ? (pnl / cap) * 100 : 0;
  const years = Math.max(rangeDays / 365, 1 / 365);

  return {
    trades: closed.length,
    positions: mine.length,
    wins,
    winRate: closed.length ? +((wins / closed.length) * 100).toFixed(1) : null,
    retPct: +retPct.toFixed(2),
    annual: +(retPct / years).toFixed(2),
    pnl: +pnl.toFixed(2),
    cap,
    open: openPos.length,
    hasData: true,
  };
}
