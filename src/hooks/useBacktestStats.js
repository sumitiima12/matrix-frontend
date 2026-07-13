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
export function useBacktestStats(strat, months = 6) {
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

    Promise.all(syms.map((s) => fetchHistory(s, "1d").catch(() => null)))
      .then((sets) => {
        if (stop) return;

        const bars = Math.round(months * 21);              // ~21 trading days a month
        const cap = strat.cap || 100000;
        const perSym = cap / syms.length;

        const trades = [];
        let pnl = 0;
        let usable = 0;

        sets.forEach((c) => {
          if (!c || c.length < 30) return;                  // not enough real history
          usable += 1;
          const window = c.slice(-bars);
          const r = backtest(cfg, window);
          r.trades.forEach((t) => {
            trades.push(t);
            pnl += perSym * t.ret;                          // t.ret is a fraction
          });
        });

        if (!usable) { setState({ loading: false, stats: null }); return; }

        if (!trades.length) {
          // The strategy ran but never triggered. That is a real result: say it.
          setState({ loading: false, stats: { trades: 0, winRate: null, pnl: null, retPct: null, symbols: usable } });
          return;
        }

        const wins = trades.filter((t) => t.ret > 0).length;
        setState({
          loading: false,
          stats: {
            trades: trades.length,
            wins,
            winRate: (wins / trades.length) * 100,
            pnl,
            retPct: (pnl / cap) * 100,
            symbols: usable,
          },
        });
      })
      .catch(() => { if (!stop) setState({ loading: false, stats: null }); });

    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strat && strat.id, months]);

  return state;
}
