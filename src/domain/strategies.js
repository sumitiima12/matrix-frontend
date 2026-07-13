/**
 * domain/strategies.js — starter strategies and the instruments automations can trade.
 */
import { ALL, FNO } from "./universe";
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
  { id: "s1", name: "Golden Cross + RSI", market: "IN", by: "Matrix", active: false, alerts: false, cfg: TEMPLATES[0].cfg, cap: 200000, symbols: ["RELIANCE", "TCS", "HDFCBANK"], created: Date.now() - 128 * 864e5 },
  { id: "s2", name: "MACD crossover", market: "IN", by: "Matrix", active: false, alerts: false, cfg: TEMPLATES[2].cfg, cap: 100000, symbols: ["INFY", "ITC"], created: Date.now() - 46 * 864e5 },
  { id: "s3", name: "Bollinger squeeze", market: "IN", by: "Matrix", active: false, alerts: false, cfg: TEMPLATES[1].cfg, cap: 150000, symbols: ["SBIN", "AXISBANK"], created: Date.now() - 84 * 864e5 },

  // ── F&O ────────────────────────────────────────────────────────────────────
  { id: "s4", name: "Index trend rider", market: "FNO", by: "Matrix", active: false, alerts: false, cfg: TEMPLATES[0].cfg, cap: 500000, symbols: ["NIFTY50", "BANKNIFTY"], created: Date.now() - 210 * 864e5 },
  { id: "s5", name: "CCI reversal", market: "FNO", by: "Matrix", active: false, alerts: false, cfg: TEMPLATES[3].cfg, cap: 300000, symbols: ["BANKNIFTY"], created: Date.now() - 96 * 864e5 },

  // ── US equity ──────────────────────────────────────────────────────────────
  { id: "s6", name: "Big tech momentum", market: "US", by: "Matrix", active: false, alerts: false, cfg: TEMPLATES[2].cfg, cap: 10000, symbols: ["AAPL", "MSFT", "NVDA"], created: Date.now() - 74 * 864e5 },
  { id: "s7", name: "BB breakout + RSI", market: "US", by: "Matrix", active: false, alerts: false, cfg: TEMPLATES[4].cfg, cap: 10000, symbols: ["TSLA", "AMZN"], created: Date.now() - 51 * 864e5 },

  // ── Crypto ─────────────────────────────────────────────────────────────────
  { id: "s8", name: "Crypto trend follow", market: "Crypto", by: "Matrix", active: false, alerts: false, cfg: TEMPLATES[0].cfg, cap: 5000, symbols: ["BTC", "ETH"], created: Date.now() - 63 * 864e5 },
  { id: "s9", name: "Crypto mean reversion", market: "Crypto", by: "Matrix", active: false, alerts: false, cfg: TEMPLATES[1].cfg, cap: 5000, symbols: ["SOL", "ETH"], created: Date.now() - 38 * 864e5 },

  // ── Commodity ──────────────────────────────────────────────────────────────
  { id: "s10", name: "Gold trend", market: "Commodity", by: "Matrix", active: false, alerts: false, cfg: TEMPLATES[0].cfg, cap: 10000, symbols: ["GOLD"], created: Date.now() - 120 * 864e5 },
  { id: "s11", name: "Crude momentum", market: "Commodity", by: "Matrix", active: false, alerts: false, cfg: TEMPLATES[2].cfg, cap: 10000, symbols: ["CRUDEOIL"], created: Date.now() - 57 * 864e5 },
];

export const ACTIVATE_SYMS = [...new Set([...FNO.map((s) => s.sym), "AAPL", "NVDA", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "BTC", "ETH", "SOL", "DOGE"])].filter((sym) => ALL.some((a) => a.sym === sym));

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
