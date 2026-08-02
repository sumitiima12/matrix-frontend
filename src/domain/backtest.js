import { resolveOperand, chainEval, parseClause, mapToken, detectOp, interpretText, sessionStarts } from "./strategyLang";

/**
 * Backtest engine — runs a strategy over REAL candles and reports win rate, P&L and drawdown.
 */

/* TRADING COSTS & SLIPPAGE — user-supplied, default ZERO (a fresh backtest is gross unless the user
   enters costs). `costs` = { slipPct, brokMode, brokeragePct, brokerageAmt, tradeValue }:
     • slipPct       — slippage as % of price on EACH fill; a round trip loses 2×slipPct of notional.
     • brokMode      — "pct" (brokerage as % of trade value) or "amount" (flat currency per trade).
     • brokeragePct  — used when brokMode === "pct"; charged on BOTH legs ⇒ 2×.
     • brokerageAmt  — used when brokMode === "amount"; a flat fee per round-trip trade, expressed as a
                       fraction of `tradeValue` (the capital deployed per trade) so it lands in return-space.
   Returns the fraction of notional deducted from every trade's return and from equity when it closes. */
/* Per-side default estimates the backtest UI pre-fills (the user can edit or zero them). slipPct +
   brokeragePct are each charged on BOTH legs, so the round-trip cost ≈ 2×(slip + brokerage). Rough,
   conservative retail figures — IN equity ≈0.10% RT, F&O ≈0.12%, US ≈0.04%, crypto ≈0.16%, MCX ≈0.12%. */
export const MARKET_COST_DEFAULTS = {
  IN:        { slipPct: 0.02, brokeragePct: 0.03 },
  FNO:       { slipPct: 0.03, brokeragePct: 0.03 },
  US:        { slipPct: 0.01, brokeragePct: 0.01 },
  // Crypto (Delta perps): fee is on NOTIONAL value. A round trip pays MAKER 0.05% on the buy + TAKER
  // 0.02% on the sell = 0.07% total. The cost model charges brokeragePct on BOTH legs, so we store the
  // per-leg AVERAGE (0.035%) → 2×0.035 = 0.07% round-trip fees. Leverage (25×) scales notional return
  // and fee equally, so the cost as a % of the notional return is leverage-independent.
  Crypto:    { slipPct: 0.03, brokeragePct: 0.035 },
  Commodity: { slipPct: 0.03, brokeragePct: 0.03 },
};
export function marketCostDefaults(market) {
  return MARKET_COST_DEFAULTS[market] || { slipPct: 0.02, brokeragePct: 0.03 };
}

export function tradeCostFrac(costs) {
  const c = costs || {};
  const slip = Math.max(0, +c.slipPct || 0);
  const pct = c.brokMode === "amount" ? 0 : Math.max(0, +c.brokeragePct || 0);
  const flat = (c.brokMode === "amount" && +c.brokerageAmt > 0 && +c.tradeValue > 0)
    ? Math.max(0, +c.brokerageAmt) / Math.max(1e-9, +c.tradeValue) : 0;
  return (2 * slip + 2 * pct) / 100 + flat;
}
/* Round-trip cost as a PERCENT (what the optimiser endpoints take as body.costPct). */
export function costPctOf(costs) { return +(tradeCostFrac(costs) * 100).toFixed(4); }

/* The backtest cost inputs persist PER MARKET so the panel and every optimiser (which live in separate
   components) share one source of truth: whatever the user typed for that market. Falls back to the
   market default the first time. Guarded for non-browser/SSR contexts. */
const BT_COST_KEY = (market) => "mx_bt_costs_" + (market || "IN");
export function getBtCosts(market) {
  const dflt = marketCostDefaults(market);
  const base = { slipPct: dflt.slipPct, brokMode: "pct", brokeragePct: dflt.brokeragePct, brokerageAmt: 0, tradeValue: 100000 };
  try { const raw = localStorage.getItem(BT_COST_KEY(market)); if (raw) return { ...base, ...JSON.parse(raw) }; } catch { /* ignore */ }
  return base;
}
export function setBtCosts(market, costs) {
  try { localStorage.setItem(BT_COST_KEY(market), JSON.stringify(costs || {})); } catch { /* ignore */ }
}

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
export function backtest(cfg, c, startIdx = 1, baseTf = null, opts = {}) {
  const closes = c.map((x) => x.c), vols = c.map((x) => x.v || 0), cache = {};
  const short = !!(cfg && (cfg.side === "SELL" || cfg.short === true));
  const dir = short ? -1 : 1;
  const slPct = cfg.sl ? Math.abs(Number(cfg.sl)) : null;
  const tpPct = cfg.tp ? Math.abs(Number(cfg.tp)) : null;
  // Round-trip cost fraction (user-supplied, default 0), deducted from each realized trade and equity.
  const costFrac = tradeCostFrac(opts.costs);
  const get = (op) => resolveOperand(op, cfg.defs, c, closes, vols, cache, baseTf);
  const trades = []; let pos = null, realized = 1, peak = 1, maxDD = 0; const eq = [{ i: 0, eq: 100 }];
  const from = Math.max(1, startIdx | 0);
  /* OPT-IN intraday square-off (default OFF — existing results are unchanged). A live intraday strategy
     flattens at the session close and never carries overnight; "EOD" in the loop below is really
     end-of-DATASET. When squareOffEod is set AND the timeframe is intraday (minute/hour bars), we close
     any position held across a session boundary at the PRIOR session's last close — matching the live
     auto-square-off (task #149). Daily/weekly bars are excluded (every bar would be a "new session"). */
  const intraday = !!baseTf && /(m|h)$/i.test(String(baseTf));
  const squareOff = !!opts.squareOffEod && intraday;
  const sf = squareOff ? sessionStarts(c) : null;
  // Realize a closed trade: record it (net of round-trip cost) AND compound its return into `realized`,
  // so the equity curve and maxDD actually reflect the exit. The previous version cleared `pos` before
  // the mark-to-market ran, so realized exits — including losses — never hit the curve (R2-P0-01).
  const closeTrade = (entryI, entryPx, exitI, exitPx, reason) => {
    const gross = dir * (exitPx / entryPx - 1), net = gross - costFrac;
    trades.push({ entryIdx: entryI, exitIdx: exitI, entry: entryPx, exit: +exitPx, ret: net, gross, reason });
    realized *= (1 + net);
  };
  const levels = (entryPx) => ({
    stop: slPct != null ? (dir > 0 ? entryPx * (1 - slPct / 100) : entryPx * (1 + slPct / 100)) : null,
    tgt:  tpPct != null ? (dir > 0 ? entryPx * (1 + tpPct / 100) : entryPx * (1 - tpPct / 100)) : null,
  });
  for (let i = 1; i < c.length; i++) {
    const bar = c[i];
    // P2-15 — skip malformed candles (NaN/negative prices, high<low). Acting on garbage OHLC would
    // fabricate stop/target hits and corrupt the equity curve; a bad bar is simply passed over.
    if (!bar || !Number.isFinite(bar.o) || !Number.isFinite(bar.h) || !Number.isFinite(bar.l) || !Number.isFinite(bar.c) || bar.c <= 0 || bar.h < bar.l) continue;
    let exitedThisBar = false;
    // OPT-IN square-off: a position carried into a NEW session is flattened at the PRIOR session's last
    // close (intraday strategies don't hold overnight). Runs before intrabar SL/TP so the new session's
    // bar can't manage a position that should already be closed. Re-entry on this bar is allowed.
    if (squareOff && pos && sf[i] && i > pos.i) {
      const px = closes[i - 1];
      if (Number.isFinite(px) && px > 0) { closeTrade(pos.i, pos.entry, i - 1, px, "EOD"); pos = null; }
    }
    // ── 1. Manage a position opened on a PRIOR bar: intrabar SL/TP, else exit-signal at this open ──
    if (pos) {
      const { stop, tgt } = levels(pos.entry);
      const hitStop = stop != null && (dir > 0 ? bar.l <= stop : bar.h >= stop);
      const hitTgt  = tgt  != null && (dir > 0 ? bar.h >= tgt  : bar.l <= tgt);
      // R3-#5: a stop is a STOP-MARKET order. If the bar GAPS through it at the open, you don't get the
      // stop price — you fill at the (worse) open. Fill at whichever is worse for the position.
      if (hitStop) { const sf = dir > 0 ? Math.min(stop, bar.o) : Math.max(stop, bar.o); closeTrade(pos.i, pos.entry, i, sf, "SL"); pos = null; exitedThisBar = true; }   // tie → stop first
      else if (hitTgt) { closeTrade(pos.i, pos.entry, i, tgt, "TP"); pos = null; exitedThisBar = true; }
      else if (chainEval(cfg.exit, i - 1, get)) { closeTrade(pos.i, pos.entry, i, bar.o, "Signal"); pos = null; exitedThisBar = true; }
    }
    // ── 2. ENTRY: signal on the CLOSED bar (i-1) fills at THIS bar's OPEN. NOT on a bar we just exited
    //    (re-entering at an already-passed open is time-travel — R2-P1-01). The entry bar's own high/low
    //    is then eligible for SL/TP, matching the optimizer (R2-P1-02). ──
    if (!pos && !exitedThisBar && i >= from && i > 1 && chainEval(cfg.entry, i - 1, get)) {
      pos = { i, entry: bar.o };
      const { stop, tgt } = levels(pos.entry);
      const hitStop = stop != null && (dir > 0 ? bar.l <= stop : bar.h >= stop);
      const hitTgt  = tgt  != null && (dir > 0 ? bar.h >= tgt  : bar.l <= tgt);
      if (hitStop) { const sf = dir > 0 ? Math.min(stop, bar.o) : Math.max(stop, bar.o); closeTrade(pos.i, pos.entry, i, sf, "SL"); pos = null; }  // R3-#5 gap-aware fill; stopped out on entry bar
      else if (hitTgt) { closeTrade(pos.i, pos.entry, i, tgt, "TP"); pos = null; }
    }
    // ── 3. equity curve = realized P&L × unrealised MTM of any still-open position at this close ──
    const curveEq = realized * (pos ? (1 + dir * (bar.c / pos.entry - 1)) : 1);
    eq.push({ i, eq: +(curveEq * 100).toFixed(2) });
    peak = Math.max(peak, curveEq); maxDD = Math.max(maxDD, (peak - curveEq) / peak);
  }
  // R3-#4: the LAST candle can itself be malformed (skipped in the loop). Forcing an exit or a buy&hold
  // return off a zero/negative/NaN close would corrupt results, so resolve the last VALID close first.
  const isNum = (x) => Number.isFinite(x) && x > 0;
  let lastIdx = c.length - 1;
  while (lastIdx > 0 && !isNum(closes[lastIdx])) lastIdx--;
  const lastClose = isNum(closes[lastIdx]) ? closes[lastIdx] : null;
  // Force-close anything still open at the END OF THE DATASET (note: end of data, not necessarily EOD session).
  if (pos && lastClose != null) {
    closeTrade(pos.i, pos.entry, lastIdx, lastClose, "EOD");
    pos = null;
    // R3-#3: the forced exit's transaction cost is in `realized` now — reflect it in the FINAL equity
    // point and the drawdown too, so the curve/maxDD agree with totalRet instead of trailing it.
    const lastPt = eq[eq.length - 1];
    if (lastPt) lastPt.eq = +(realized * 100).toFixed(2);
    peak = Math.max(peak, realized); maxDD = Math.max(maxDD, (peak - realized) / peak);
  }
  const totalRet = (realized - 1) * 100;
  const wins = trades.filter((t) => t.ret > 0).length;
  // Buy & hold over the SAME test window (from the warm-up boundary), using valid closes at both ends.
  let startIdxV = Math.min(from, closes.length - 1);
  while (startIdxV < closes.length && !isNum(closes[startIdxV])) startIdxV++;
  const bhStart = isNum(closes[startIdxV]) ? closes[startIdxV] : (closes.find(isNum) || null);
  const bh = (lastClose != null && bhStart != null) ? (lastClose / bhStart - 1) * 100 - costFrac * 100 : 0;
  return { trades, eq, stats: { n: trades.length, wins, winRate: trades.length ? wins / trades.length * 100 : 0, totalRet, maxDD: maxDD * 100, bh, avg: trades.length ? trades.reduce((a, t) => a + t.ret, 0) / trades.length * 100 : 0, costPct: +(costFrac * 100).toFixed(3) } };
}

/* Delegates to the shared interpreter (strategyLang.interpretText), which now also understands
   chart patterns and support/resistance — so the plain-English builder and the screener speak
   the same language. Kept as a named export for the existing callers. */
export function parseRules(text) {
  return interpretText(text);
}
