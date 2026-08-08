import { useEffect, useRef } from "react";
import { positionsDue } from "../services/squareOff";
import { isBackgrounded, isOnline } from "../services/dataCoordinator";

/**
 * useSquareOff — closes INTRADAY positions on schedule.
 *
 * Checks every 30 seconds. A real broker force-closes your MIS positions near the
 * bell at whatever price is going; doing it ourselves, 15 minutes early and on a
 * rule you can read, is strictly better than being surprised.
 *
 * Guards against double-selling: a position already being squared off is remembered
 * for the rest of the session, because the sell is async and the next tick would
 * otherwise fire again on a position that is still in the portfolio.
 */
export function useSquareOff({ portfolio, onSell, enabled = true, notify }) {
  const firing = useRef(new Set());

  useEffect(() => {
    if (!enabled) return undefined;

    const tick = () => {
      // PERF-3/4: this is a VIRTUAL-only (paper) square-off — real intraday positions are squared off by the
      // backend exit engine (authoritative), so it's never running for real money. Skip while the tab is hidden
      // or offline: a paper square-off can wait for the tab to be foregrounded again, and this avoids background
      // work in hidden tabs.
      if (isBackgrounded() || !isOnline()) return;
      const due = positionsDue(portfolio);
      due.forEach(({ holding, reason }) => {
        const key = holding.sym + ":" + (holding.boughtAt || 0);
        if (firing.current.has(key)) return;              // already on its way out
        firing.current.add(key);

        const ok = onSell(holding.sym, holding.qty);
        if (ok && notify) notify(`${holding.sym} squared off — ${reason}`);
        // If the sell failed (no live price, market shut), let a later tick retry.
        if (!ok) firing.current.delete(key);
      });
    };

    tick();
    const id = setInterval(tick, 60000);   // 60s — this tick can EXECUTE a square-off sell, so keep it responsive (not slower)
    return () => clearInterval(id);
  }, [portfolio, onSell, enabled, notify]);
}
