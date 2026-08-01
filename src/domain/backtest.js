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
 *
 * CAUSAL (no look-ahead) execution — this is what a live trader can actually achieve:
 *   • A signal is read on a CLOSED bar (i-1). You can't act on bar i's close while bar i
 *     is still forming, so the fill happens at the NEXT bar's OPEN (bar i). This removes the
 *     same-bar "see the close, trade at that close" look-ahead the old engine had.
 *   • Stop-loss / take-profit are standing orders, so they trigger INTRABAR against each bar's
 *     HIGH/LOW (not the closing return) and fill at the level. If both the stop and target are
 *     touched inside one bar, we assume the STOP filled first (conservative).
 *   • SHORT strategies (side:"SELL") mirror direction, stop-above / target-below.
 */
export function backtest(cfg, c, startIdx = 1, baseTf = null) {
  const closes = c.map((x) => x.c), vols = c.map((x) => x.v || 0), cache = {};
  const short = !!(cfg && (cfg.side === "SELL" || cfg.short === true));
  const dir = short ? -1 : 1;
  const slPct = cfg.sl ? Math.abs(Number(cfg.sl)) : null;
  const tpPct = cfg.tp ? Math.abs(Number(cfg.tp)) : null;
  const get = (op) => resolveOperand(op, cfg.defs, c, closes, vols, cache, baseTf);
  const trades = []; let pos = null, equity = 1, peak = 1, maxDD = 0; const eq = [{ i: 0, eq: 100 }];
  const from = Math.max(1, startIdx | 0);
  for (let i = 1; i < c.length; i++) {
    const bar = c[i];
    // ── 1. Manage an OPEN position on bar i ──────────────────────────────────────────────────
    if (pos) {
      const stop = slPct != null ? (dir > 0 ? pos.entry * (1 - slPct / 100) : pos.entry * (1 + slPct / 100)) : null;
      const tgt = tpPct != null ? (dir > 0 ? pos.entry * (1 + tpPct / 100) : pos.entry * (1 - tpPct / 100)) : null;
      const hitStop = stop != null && (dir > 0 ? bar.l <= stop : bar.h >= stop);
      const hitTgt = tgt != null && (dir > 0 ? bar.h >= tgt : bar.l <= tgt);
      let exitPx = null, reason = null;
      if (hitStop) { exitPx = stop; reason = "SL"; }               // tie -> stop first (conservative)
      else if (hitTgt) { exitPx = tgt; reason = "TP"; }
      else if (i > pos.i && chainEval(cfg.exit, i - 1, get)) { exitPx = bar.o; reason = "Signal"; }  // signal on closed bar, fill next open
      if (exitPx != null) {
        const ret = dir * (exitPx / pos.entry - 1);
        trades.push({ entryIdx: pos.i, exitIdx: i, entry: pos.entry, exit: +exitPx, ret, reason });
        pos = null;
      }
    }
    // ── equity curve: mark-to-market a still-open position on the close ──
    if (pos) equity *= 1 + dir * (closes[i] / closes[i - 1] - 1);
    eq.push({ i, eq: +(equity * 100).toFixed(2) });
    peak = Math.max(peak, equity); maxDD = Math.max(maxDD, (peak - equity) / peak);
    // ── 2. ENTRY: signal read on the last CLOSED bar (i-1), filled at THIS bar's OPEN ──
    if (!pos && i >= from && i > 1 && chainEval(cfg.entry, i - 1, get)) {
      pos = { i, entry: bar.o };
    }
  }
  if (pos) { const i = c.length - 1; trades.push({ entryIdx: pos.i, exitIdx: i, entry: pos.entry, exit: closes[i], ret: dir * (closes[i] / pos.entry - 1), reason: "EOD" }); }
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
