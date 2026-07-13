import { useEffect, useState } from "react";
import { fetchHistory } from "../domain/api";

/**
 * useEquityCurve — total portfolio value (cash + holdings) over time, per market.
 *
 * ── Why per market, and not one grand total ────────────────────────────────────
 * The Indian and F&O wallets settle in ₹; US, crypto and commodity wallets in $.
 * Adding them together requires an exchange rate for every day in the series, which
 * we do not have. A single blended "net worth" line would therefore be a number we
 * made up. So the curve is drawn per market, in that market's own currency.
 *
 * ── How each point is computed ─────────────────────────────────────────────────
 * Nothing here is simulated. For each day D:
 *
 *   holdings(D) = Σ  qty × REAL closing price on D        (from Yahoo daily candles)
 *                 over every position that was open on D, derived from the trade log
 *
 *   cash(D)     = opening + deposits≤D + sale proceeds≤D − purchase costs≤D
 *
 *   total(D)    = cash(D) + holdings(D)
 *
 * `opening` is DERIVED, not guessed:
 *
 *   opening = wallet_today + Σ(all purchases) − Σ(all sales) − Σ(logged deposits)
 *
 * which forces cash(today) to equal the actual wallet balance exactly. Its one
 * assumption: any wallet top-up made BEFORE we started logging deposits is treated
 * as having been there from the start. That is a stated assumption about when money
 * arrived, not an invented amount — every rupee is accounted for, and it becomes
 * exact for all deposits from now on, which are timestamped.
 *
 * If a symbol has no real price history, its position is EXCLUDED from the curve
 * rather than valued at its purchase price and passed off as a market value.
 */
export function useEquityCurve(market, portfolio = [], trades = [], deposits = [], wallet = 0, days = 90) {
  const [state, setState] = useState({ loading: true, series: null, excluded: [] });

  const mktTrades = (trades || []).filter((t) => t.market === market);
  const key = `${market}|${wallet}|${mktTrades.length}|${(deposits || []).length}|${portfolio.length}|${days}`;

  useEffect(() => {
    let stop = false;

    const syms = [...new Set(mktTrades.map((t) => t.sym))];
    if (!syms.length) {
      // No trades in this market: the only thing that ever moved is the wallet, and
      // a flat line is not worth drawing.
      setState({ loading: false, series: null, excluded: [] });
      return undefined;
    }

    setState({ loading: true, series: null, excluded: [] });

    Promise.all(syms.map((s) => fetchHistory(s, "1d").then((c) => [s, c]).catch(() => [s, null])))
      .then((sets) => {
        if (stop) return;

        const priced = {};
        const excluded = [];
        sets.forEach(([s, c]) => {
          if (!c || !c.length) { excluded.push(s); return; }
          // date (yyyy-mm-dd) -> real close
          const byDay = {};
          c.forEach((x) => { byDay[new Date(x.t).toISOString().slice(0, 10)] = x.c; });
          priced[s] = { byDay, candles: c };
        });

        if (!Object.keys(priced).length) {
          setState({ loading: false, series: null, excluded });
          return;
        }

        // The calendar comes from real trading days, so weekends/holidays are absent.
        const anySym = Object.keys(priced)[0];
        const calendar = priced[anySym].candles
          .slice(-days)
          .map((x) => new Date(x.t).toISOString().slice(0, 10));

        const usable = mktTrades.filter((t) => priced[t.sym]);

        // Derive the opening balance so that cash(today) === the real wallet.
        const buys = usable.reduce((a, t) => a + t.qty * t.entry, 0);
        const sells = usable.reduce((a, t) => a + (t.exitAt != null && t.exit != null ? t.qty * t.exit : 0), 0);
        const dep = (deposits || []).filter((d) => d.market === market).reduce((a, d) => a + d.amount, 0);
        const opening = wallet + buys - sells - dep;

        const series = calendar.map((day) => {
          const end = new Date(day + "T23:59:59Z").getTime();

          // Capital YOU put in, as of D. Deposits are not profit.
          let capital = opening;
          (deposits || []).forEach((d) => { if (d.market === market && d.at <= end) capital += d.amount; });

          let cash = capital;
          usable.forEach((t) => {
            if (t.entryAt <= end) cash -= t.qty * t.entry;
            if (t.exitAt != null && t.exit != null && t.exitAt <= end) cash += t.qty * t.exit;
          });

          let held = 0;
          let anyPrice = false;
          usable.forEach((t) => {
            const open = t.entryAt <= end && (t.exitAt == null || t.exitAt > end);
            if (!open) return;
            const px = priced[t.sym].byDay[day];
            if (px == null) return;       // no real close that day -> contributes nothing
            anyPrice = true;
            held += t.qty * px;
          });

          // REALISED: locked in by trades actually closed on or before D.
          let realised = 0;
          usable.forEach((t) => {
            if (t.exitAt != null && t.exit != null && t.exitAt <= end) {
              realised += (t.exit - t.entry) * t.qty;
            }
          });

          const total = cash + held;

          /* CUMULATIVE P&L = what the account is worth, minus what you put into it.
             Defining it this way is the whole point: topping up the wallet raises
             `total` AND `capital` by the same amount, so it moves P&L by exactly
             zero. A curve that treated a deposit as profit would be a lie, and it is
             the easiest lie in the world to ship by accident. */
          const pnl = total - capital;

          return {
            day, t: end,
            cash, holdings: held, total,
            capital,
            realised,
            unrealised: pnl - realised,
            pnl,
            priced: anyPrice,
          };
        });

        setState({ loading: false, series, excluded });
      })
      .catch(() => { if (!stop) setState({ loading: false, series: null, excluded: [] }); });

    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
