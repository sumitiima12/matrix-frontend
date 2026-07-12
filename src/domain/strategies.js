/**
 * domain/strategies.js — starter strategies and the instruments automations can trade.
 */
import { ALL, FNO } from "./universe";

export const SEED_STRATS = [
  { id: "s1", name: "Golden Cross + RSI", by: "Matrix", active: true, alerts: false, cfg: TEMPLATES[0].cfg, cap: 200000, symbols: ["NIFTY50", "BANKNIFTY"], created: Date.now() - 128 * 864e5 },
  { id: "s2", name: "MACD crossover", by: "Matrix", active: true, alerts: false, cfg: TEMPLATES[2].cfg, cap: 100000, symbols: ["RELIANCE", "INFY"], created: Date.now() - 46 * 864e5 },
  { id: "s3", name: "Bollinger squeeze", by: "Matrix", active: false, alerts: false, cfg: TEMPLATES[1].cfg, cap: 150000, symbols: ["NIFTY50"], created: Date.now() - 84 * 864e5 },
  { id: "s4", name: "CCI reversal", by: "Community", active: false, alerts: false, cfg: TEMPLATES[3].cfg, cap: 50000, symbols: ["BANKNIFTY"], created: Date.now() - 210 * 864e5 },
];

export const ACTIVATE_SYMS = [...new Set([...FNO.map((s) => s.sym), "AAPL", "NVDA", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "BTC", "ETH", "SOL", "DOGE"])].filter((sym) => ALL.some((a) => a.sym === sym));
