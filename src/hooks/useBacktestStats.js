import { useEffect, useState } from "react";
import { fetchHistory } from "../domain/api";
import { backtest } from "../domain/backtest";

/**
 * useBacktestStats — six-month performance for a strategy, from REAL candles.
 *
 * The sample strategies have never traded, so they have no live track record. The
 * honest way to show "win rate / trades / P&L" for them is to actually RUN them
 * over the last six months of real price history and report what comes out. That
 * is what this does: real candles, the strategy's real rules, real trades.
 *
 * It is a BACKTEST, not a live record, and the UI must say so. Backtested returns
 * are not promises — the strategy is being scored on data it can see in hindsight.
 * What we will not do is invent a plausible-looking win rate, which is what the old
 * seeded-random `stratPerf` did.
 *
 * Returns { loading, stats } where stats is null if it could not be computed, and
 * `trades: 0` with null metrics if the strategy simply never triggered.
 */
/* A strategy is EXECUTED on one timeframe (its entry rules are checked candle-by-candle on that
   interval). Backtesting on daily candles when the strategy actually trades on 5-minute bars tests
   something the strategy never does. So we backtest on the strategy's OWN timeframe: strat.tf if it
   carries one, else 5-minute — the default for most intraday strategies. */
const ALLOWED_TF = new Set(["1m", "3m", "5m", "15m", "30m", "1h", "4h", "1d"]);
function backtestTf(strat) {
  const tf = strat && (strat.tf || (strat.cfg && strat.cfg.tf));
  return ALLOWED_TF.has(tf) ? tf : "5m";
}
/* A human period label for whatever span of candles we actually got back (intraday windows are days,
   daily windows are months) — so the card can say "over the last 5 days" honestly. */
function periodLabel(sets) {
  let first = Infinity, last = 0;
  sets.forEach((c) => { if (c && c.length) { first = Math.min(first, c[0].t); last = Math.max(last, c[c.length - 1].t); } });
  if (!isFinite(first) || !last) return null;
  const days = Math.max(1, Math.round((last - first) / 864e5));
  if (days < 45) return { n: days, unit: "day" };
  return { n: Math.round(days / 30), unit: "month" };
}

/* opts (optional): { tf } overrides the backtest timeframe; { days } trims the candles to the last
   N days (period selection). Both are used by the admin Backtesting panel; the strategy cards pass
   nothing and get the default (strategy's own tf, full available window). */
/* Load the backtest candles for one symbol on a timeframe, trimmed to the last `days` (0 = full window).
   Shared so the optimiser previews score on the SAME candles the results table uses. */
export async function loadBtCandles(sym, tf, days = 0) {
  const c0 = await fetchHistory(sym, tf, true).catch(() => null);
  if (!c0 || !c0.length) return null;
  const cutoff = days ? Date.now() - days * 864e5 : 0;
  return cutoff ? c0.filter((x) => (x.t || 0) >= cutoff) : c0;
}

/* Score a cfg on a pre-fetched candle array with the SAME sizing model useBacktestStats uses:
   an explicit per-trade qty/USD-amount when given (absolute P&L on deployed capital), else the
   capital-split model. Returns { trades, winRate, slHit, tpHit, pnl, retPct } or null. */
export function scoreCfg(cfg, candles, tf, { qty = null, amount = null, market = null, cap = 100000 } = {}) {
  if (!cfg || !candles || candles.length < 30) return null;
  const { trades } = backtest(cfg, candles, 1, tf);
  const n = trades.length;
  if (!n) return { trades: 0, winRate: null, slHit: 0, tpHit: 0, pnl: 0, retPct: 0 };
  const wins = trades.filter((t) => t.ret > 0).length;
  const slHit = trades.filter((t) => t.reason === "SL").length;
  const tpHit = trades.filter((t) => t.reason === "TP").length;
  const sumRet = trades.reduce((a, t) => a + (t.ret || 0), 0);
  const hasSize = qty != null || amount != null;
  let pnl, retPct;
  if (hasSize) {
    if (market === "Crypto") { const amt = Number(amount) || 0; pnl = amt * sumRet; retPct = amt ? (pnl / amt) * 100 : null; }
    else {
      const q = Number(qty) || 0;
      pnl = q * trades.reduce((a, t) => a + ((t.exit || 0) - (t.entry || 0)), 0);
      const avgEntry = trades.reduce((a, t) => a + (t.entry || 0), 0) / n;
      const base = q * avgEntry; retPct = base ? (pnl / base) * 100 : null;
    }
  } else { pnl = cap * sumRet; retPct = sumRet * 100; }
  return { trades: n, winRate: (wins / n) * 100, slHit, tpHit, pnl, retPct };
}

export function useBacktestStats(strat, opts = {}) {
  const [state, setState] = useState({ loading: true, stats: null });
  const tfOverride = ALLOWED_TF.has(opts.tf) ? opts.tf : null;
  const days = Number(opts.days) || 0;
  const symOverride = opts.sym || null;
  // Per-trade sizing for absolute P&L (backtest panel): qty (shares) or amount (USD, crypto).
  const qty = opts.qty != null ? opts.qty : null;
  const amount = opts.amount != null ? opts.amount : null;
  const sizeMarket = opts.market || null;
  /* Re-run whenever the strategy's CONFIG changes — not just its id. Optimising SL&TP (or indicator
     lengths / timeframe / rules) mutates strat.cfg in place while the id stays the same; keying the
     effect on id alone left the backtest showing the OLD result after Apply. Signing the fields the
     backtest actually reads makes it recompute the moment they change. */
  const cfg0 = strat && strat.cfg;
  const cfgSig = cfg0 ? JSON.stringify({ sl: cfg0.sl, tp: cfg0.tp, tf: cfg0.tf, defs: cfg0.defs, entry: cfg0.entry, exit: cfg0.exit, sy: strat.symbols }) : "";

  useEffect(() => {
    let stop = false;

    const syms = symOverride ? [symOverride] : ((strat && strat.symbols) || []);
    const cfg = strat && strat.cfg;
    if (!cfg || cfg.mode === "plain" || !syms.length) {
      setState({ loading: false, stats: null });
      return undefined;
    }

    setState({ loading: true, stats: null });

    const tf = tfOverride || backtestTf(strat);
    const cutoff = days ? Date.now() - days * 864e5 : 0;
    Promise.all(syms.map((s) => fetchHistory(s, tf, true).catch(() => null)))
      .then((raw) => {
        if (stop) return;
        // Trim each symbol's candles to the selected period (if any).
        const sets = cutoff ? raw.map((c) => (c ? c.filter((x) => (x.t || 0) >= cutoff) : c)) : raw;

        const cap = strat.cap || 100000;
        const perSym = cap / syms.length;

        /* WARM-UP MATTERS. Indicators need history before they mean anything (a 200-period SMA is NaN
           until the 200th bar). So we run the strategy over the FULL fetched history — the indicators
           warm up properly — and count every trade it takes. Intraday history is already a short,
           recent window, so there's no separate sub-window to carve out. */
        const trades = [];
        let capPnl = 0;
        let usable = 0;
        sets.forEach((c, si) => {
          if (!c || c.length < 30) return;
          usable += 1;
          const r = backtest(cfg, c, 1, tf);
          // Tag each trade with its candle array + symbol so we can resolve entry/exit timestamps later.
          r.trades.forEach((t) => { trades.push({ ...t, _c: c, _sym: syms[si] }); capPnl += perSym * t.ret; });
        });

        if (!usable) { setState({ loading: false, stats: null }); return; }

        /* Absolute P&L sizing: when a per-trade size is supplied (the backtest panel's Qty / USD-amount
           filter), size each trade explicitly — shares × (exit − entry) for stocks/commodities, or a
           USD notional × return for crypto. With no size, fall back to the capital-split model the
           strategy cards use.

           RETURNS ARE MEASURED ON DEPLOYED CAPITAL. Positions are taken one at a time and the same
           capital is recycled into the next trade, so the base is ONE trade's deployment — not the sum
           of every trade's notional. So $100 per trade with +$1,000 total P&L reads as +1000%. */
        const hasSize = qty != null || amount != null;
        let pnl = capPnl;
        let retBase = null;   // capital the return % is measured against (per-trade deployment)
        if (hasSize) {
          if (sizeMarket === "Crypto") {
            const amt = Number(amount) || 0;
            pnl = amt * trades.reduce((a, t) => a + (t.ret || 0), 0);
            retBase = amt;
          } else {
            const q = Number(qty) || 0;
            pnl = q * trades.reduce((a, t) => a + ((t.exit || 0) - (t.entry || 0)), 0);
            // Deployed capital for a stock/commodity trade = shares × entry price (averaged over trades).
            const avgEntry = trades.length ? trades.reduce((a, t) => a + (t.entry || 0), 0) / trades.length : 0;
            retBase = q * avgEntry;
          }
        }

        /* MAX DRAWDOWN (absolute currency). Stack each trade's P&L in sequence into an equity curve and
           track the deepest fall from a running high — that peak-to-trough drop is the worst losing
           streak a holder would have sat through. Sized the SAME way as `pnl` above so the drawdown is
           in the same units the P&L is shown in. */
        const perTradePnl = trades.map((t) => {
          if (hasSize) {
            return sizeMarket === "Crypto" ? (Number(amount) || 0) * (t.ret || 0) : (Number(qty) || 0) * ((t.exit || 0) - (t.entry || 0));
          }
          return perSym * (t.ret || 0);
        });
        let eq = 0, peak = 0, maxDD = 0;
        for (const p of perTradePnl) { eq += p; if (eq > peak) peak = eq; const dd = peak - eq; if (dd > maxDD) maxDD = dd; }

        /* Detailed trade ledger for the "List of Trades" view: each executed round-trip with its entry
           and exit timestamps (resolved from the candle it fired on), prices, return % and sized P&L. */
        /* Per-trade INVESTED amount (deployed capital) and QUANTITY: with an explicit size, crypto
           deploys the USD amount (qty = amount ÷ entry coins), stocks deploy qty × entry (qty shares);
           with no size, the capital-split per-symbol slice is deployed. */
        const investedOf = (entry) => hasSize
          ? (sizeMarket === "Crypto" ? (Number(amount) || 0) : (Number(qty) || 0) * (entry || 0))
          : perSym;
        const qtyOf = (entry) => hasSize
          ? (sizeMarket === "Crypto" ? (entry ? (Number(amount) || 0) / entry : 0) : (Number(qty) || 0))
          : (entry ? perSym / entry : 0);
        const tradeList = trades.map((t, i) => {
          const c = t._c || [];
          return {
            sym: t._sym,
            entryTime: c[t.entryIdx] ? c[t.entryIdx].t : null,
            exitTime: c[t.exitIdx] ? c[t.exitIdx].t : null,
            entryPrice: t.entry,
            exitPrice: t.exit,
            invested: investedOf(t.entry),
            qty: qtyOf(t.entry),
            retPct: (t.ret || 0) * 100,
            pnl: perTradePnl[i],
            reason: t.reason,
          };
        });

        const period = periodLabel(sets);

        if (!trades.length) {
          // The strategy ran but never triggered. That is a real result: say it.
          setState({ loading: false, stats: { trades: 0, winRate: null, pnl: null, retPct: null, maxDD: null, symbols: usable, tf, period } });
          return;
        }

        const wins = trades.filter((t) => t.ret > 0).length;
        // Exit-reason breakdown for the comparison table. `reason` is set by the backtest engine.
        const slHit = trades.filter((t) => t.reason === "SL").length;
        const tpHit = trades.filter((t) => t.reason === "TP").length;
        setState({
          loading: false,
          stats: {
            trades: trades.length,
            wins,
            losses: trades.length - wins,
            slHit,
            tpHit,
            winRate: (wins / trades.length) * 100,
            pnl,
            // With an explicit per-trade size, return % = total P&L ÷ capital deployed on one trade.
            // Otherwise fall back to the capital-split model (sum of per-trade returns).
            retPct: hasSize ? (retBase ? (pnl / retBase) * 100 : null) : (capPnl / cap) * 100,
            maxDD,   // absolute currency: deepest peak-to-trough fall of the equity curve
            tradeList,   // detailed per-trade ledger for the List of Trades view
            symbols: usable,
            tf,
            period,
          },
        });
      })
      .catch(() => { if (!stop) setState({ loading: false, stats: null }); });

    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strat && strat.id, cfgSig, tfOverride, days, symOverride, qty, amount, sizeMarket]);

  return state;
}
