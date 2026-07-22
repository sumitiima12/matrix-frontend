import { resolveOperand, chainEval, parseClause, mapToken, detectOp, interpretText } from "./strategyLang";

/**
 * Backtest engine — runs a strategy over REAL candles and reports win rate, P&L and drawdown.
 */

/**
 * @param cfg      the strategy
 * @param c        FULL candle history — indicators are computed over all of it
 * @param startIdx first bar allowed to OPEN a trade (the warm-up boundary)
 *
 * WHY startIdx EXISTS: indicators need history. Slice the candles down to your test
 * window first and a 200-day SMA is NaN for the whole window, an entry rule that
 * depends on it can never fire, and the backtest confidently reports zero trades —
 * which reads as "the strategy never triggers" rather than "we never gave it enough
 * data to know". So: compute over everything, only COUNT entries from startIdx on.
 */
export function backtest(cfg, c, startIdx = 1, baseTf = null) {
  const closes = c.map((x) => x.c), vols = c.map((x) => x.v || 0), cache = {};
  // baseTf lets a def on a HIGHER timeframe (e.g. a 1D EMA) resolve on daily candles even though the
  // backtest runs on, say, 5-minute bars — instead of silently becoming a wrong 5-minute EMA.
  const get = (op) => resolveOperand(op, cfg.defs, c, closes, vols, cache, baseTf);
  const trades = []; let pos = null, equity = 1, peak = 1, maxDD = 0; const eq = [{ i: 0, eq: 100 }];
  const from = Math.max(1, startIdx | 0);
  for (let i = 1; i < c.length; i++) {
    if (pos) equity *= closes[i] / closes[i - 1];
    eq.push({ i, eq: +(equity * 100).toFixed(2) });
    peak = Math.max(peak, equity); maxDD = Math.max(maxDD, (peak - equity) / peak);
    if (pos) {
      const ret = closes[i] / pos.entry - 1;
      const hitSL = cfg.sl && ret <= -Math.abs(Number(cfg.sl)) / 100;
      const hitTP = cfg.tp && ret >= Math.abs(Number(cfg.tp)) / 100;
      const sig = chainEval(cfg.exit, i, get);
      if (hitSL || hitTP || sig) { trades.push({ entryIdx: pos.i, exitIdx: i, entry: pos.entry, exit: closes[i], ret, reason: hitSL ? "SL" : hitTP ? "TP" : "Signal" }); pos = null; }
    } else if (i >= from && chainEval(cfg.entry, i, get)) {
      // Only OPEN inside the window. Exits above are ungated on purpose: a position
      // opened in-window must still be allowed to close.
      pos = { i, entry: closes[i] };
    }
  }
  if (pos) { const i = c.length - 1; trades.push({ entryIdx: pos.i, exitIdx: i, entry: pos.entry, exit: closes[i], ret: closes[i] / pos.entry - 1, reason: "EOD" }); }
  const totalRet = (trades.reduce((a, t) => a * (1 + t.ret), 1) - 1) * 100;
  const wins = trades.filter((t) => t.ret > 0).length;
  const bh = (closes[closes.length - 1] / closes[0] - 1) * 100;
  return { trades, eq, stats: { n: trades.length, wins, winRate: trades.length ? wins / trades.length * 100 : 0, totalRet, maxDD: maxDD * 100, bh, avg: trades.length ? trades.reduce((a, t) => a + t.ret, 0) / trades.length * 100 : 0 } };
}

/* Delegates to the shared interpreter (strategyLang.interpretText), which now also understands
   chart patterns and support/resistance — so the plain-English builder and the screener speak
   the same language. Kept as a named export for the existing callers. */
export function parseRules(text) {
  return interpretText(text);
}
