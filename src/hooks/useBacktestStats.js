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
function backtestTf(strat) {
  const tf = strat && (strat.tf || (strat.cfg && strat.cfg.tf));
  const ALLOWED = new Set(["1m", "3m", "5m", "15m", "30m", "1h", "4h", "1d"]);
  return ALLOWED.has(tf) ? tf : "5m";
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

export function useBacktestStats(strat) {
  const [state, setState] = useState({ loading: true, stats: null });

  useEffect(() => {
    let stop = false;

    const syms = (strat && strat.symbols) || [];
    const cfg = strat && strat.cfg;
    if (!cfg || cfg.mode === "plain" || !syms.length) {
      setState({ loading: false, stats: null });
      return undefined;
    }

    setState({ loading: true, stats: null });

    const tf = backtestTf(strat);
    Promise.all(syms.map((s) => fetchHistory(s, tf, true).catch(() => null)))
      .then((sets) => {
        if (stop) return;

        const cap = strat.cap || 100000;
        const perSym = cap / syms.length;

        /* WARM-UP MATTERS. Indicators need history before they mean anything (a 200-period SMA is NaN
           until the 200th bar). So we run the strategy over the FULL fetched history — the indicators
           warm up properly — and count every trade it takes. Intraday history is already a short,
           recent window, so there's no separate sub-window to carve out. */
        const trades = [];
        let pnl = 0;
        let usable = 0;
        sets.forEach((c) => {
          if (!c || c.length < 30) return;
          usable += 1;
          const r = backtest(cfg, c, 1, tf);
          r.trades.forEach((t) => { trades.push(t); pnl += perSym * t.ret; });
        });

        if (!usable) { setState({ loading: false, stats: null }); return; }

        const period = periodLabel(sets);

        if (!trades.length) {
          // The strategy ran but never triggered. That is a real result: say it.
          setState({ loading: false, stats: { trades: 0, winRate: null, pnl: null, retPct: null, symbols: usable, tf, period } });
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
            retPct: (pnl / cap) * 100,
            symbols: usable,
            tf,
            period,
          },
        });
      })
      .catch(() => { if (!stop) setState({ loading: false, stats: null }); });

    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strat && strat.id]);

  return state;
}
