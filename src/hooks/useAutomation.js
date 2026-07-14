import { fetchOptionChain } from "../services/optionService";
import { useEffect, useRef } from "react";
import { runOnce } from "../services/automationEngine";
import { fetchHistory, marketOpen } from "../domain/api";
import { ALL, marketOf } from "../domain/universe";
import { lsGet, lsSet } from "../lib/format";

/**
 * useAutomation — the loop that actually runs your active strategies.
 *
 * Ticks every 60s. On each tick it pulls REAL candles for every symbol an active
 * strategy watches, evaluates the entry/exit rules, and places orders through the
 * SAME order pipeline as a manual trade (risk engine -> broker -> portfolio ->
 * journal). No confirmation dialog: you already authorised this when you activated
 * the strategy, and a dialog you're asleep for would stop it firing at all.
 *
 * Positions are persisted, so a page reload does not make the engine forget what
 * it is holding and re-buy.
 *
 * It does nothing when the market is closed — the candles would be stale and the
 * fill price would not be real.
 */
export function useAutomation({ strats, onBuy, onSell, userId, enabled = true }) {
  /* Option chains, refreshed each tick for any strategy with an option leg. The engine
     runs synchronously, so the chain has to be in hand BEFORE it evaluates — we cannot
     await inside the rule loop. */
  const chains = useRef({});
  const positions = useRef(null);
  const candles = useRef({});          // sym -> real candles, refreshed each tick
  const key = `mx_auto_pos_${userId || "guest"}`;

  if (positions.current === null) positions.current = lsGet(key) || {};

  useEffect(() => {
    if (!enabled) return undefined;
    let stop = false;

    const tick = async () => {
      const active = (strats || []).filter((s) => s.active);
      if (!active.length) return;

      const syms = [...new Set(active.flatMap((s) => s.symbols || []))];

      // Only trade markets that are actually OPEN. A fill against a stale candle
      // is not a real fill.
      const tradable = syms.filter((sym) => {
        const s = ALL.find((a) => a.sym === sym);
        return s && s.price != null && marketOpen(marketOf(sym));
      });
      if (!tradable.length) return;

      // Real candles. If a symbol's history won't load, it simply isn't traded.
      await Promise.all(tradable.map(async (sym) => {
        try {
          const c = await fetchHistory(sym, "1d");
          if (c && c.length) candles.current[sym] = c;
        } catch { /* leave whatever we had; missing data -> no order */ }
      }));

      /* Pull the live option chain for every underlying an option strategy trades. If a
         chain fails, we leave it ABSENT rather than stale — the engine then skips that
         signal instead of resolving a strike against yesterday's ladder. */
      const optUnderlyings = [...new Set(
        active.filter((s) => s.opt && s.opt.enabled).flatMap((s) => s.symbols || [])
      )];

      await Promise.all(optUnderlyings.map(async (sym) => {
        try {
          chains.current[sym] = await fetchOptionChain(sym, userId);
        } catch {
          delete chains.current[sym];       // absent, not stale
        }
      }));

      if (stop) return;

      const { positions: next, log } = runOnce({
        strats: active,
        getCandles: (sym) => candles.current[sym] || null,
        getStock: (sym) => ALL.find((a) => a.sym === sym) || null,
        getChain: (sym) => chains.current[sym] || null,
        positions: positions.current,
        capitalOf: (s) => s.cap || 100000,
        onBuy,
        onSell,
      });

      if (log.length) {
        positions.current = next;
        lsSet(key, next);
      }
    };

    tick();                                   // run immediately on activation
    const id = setInterval(tick, 60_000);     // then every minute
    return () => { stop = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strats, enabled, userId]);

  return positions;
}
