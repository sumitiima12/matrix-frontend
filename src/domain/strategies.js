/**
 * domain/strategies.js — starter strategies and the instruments automations can trade.
 */
import { ALL, FNO } from "./universe";
import { TEMPLATES } from "./strategyLang";

export const SEED_STRATS = [
  { id: "s1", name: "Golden Cross + RSI", by: "Matrix", active: true, alerts: false, cfg: TEMPLATES[0].cfg, cap: 200000, symbols: ["NIFTY50", "BANKNIFTY"], created: Date.now() - 128 * 864e5 },
  { id: "s2", name: "MACD crossover", by: "Matrix", active: true, alerts: false, cfg: TEMPLATES[2].cfg, cap: 100000, symbols: ["RELIANCE", "INFY"], created: Date.now() - 46 * 864e5 },
  { id: "s3", name: "Bollinger squeeze", by: "Matrix", active: false, alerts: false, cfg: TEMPLATES[1].cfg, cap: 150000, symbols: ["NIFTY50"], created: Date.now() - 84 * 864e5 },
  { id: "s4", name: "CCI reversal", by: "Matrix", active: false, alerts: false, cfg: TEMPLATES[3].cfg, cap: 50000, symbols: ["BANKNIFTY"], created: Date.now() - 210 * 864e5 },
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
