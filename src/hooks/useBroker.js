import { useCallback, useEffect, useRef, useState } from "react";
import { ALL } from "../domain/universe";
import { BROKER_COVERAGE } from "../domain/brokerSymbols";
import { loadSession, clearSession, brokerQuotes } from "../services/brokerService";

/**
 * useBroker — live prices from a connected broker.
 *
 * When a broker is connected this polls its REAL-TIME quote endpoint and writes the
 * prices straight onto the universe, in place, exactly where the Yahoo poller writes
 * its delayed ones. Nothing downstream changes: the same `s.price` every card and
 * chart already reads simply stops being ~15 minutes old.
 *
 * It also brings back a field Yahoo never had: `s.oi` (real open interest). We had
 * deleted the "OI" label rather than mislabel volume as OI. With a broker it is real.
 *
 * If the token dies (both brokers expire daily), the session is cleared and the app
 * falls back to Yahoo — rather than showing a "LIVE" badge over stale numbers.
 */
export function useBroker({ onTick, intervalMs = 2000 } = {}) {
  const [session, setSession] = useState(() => loadSession());
  const [lastTick, setLastTick] = useState(null);
  const tickRef = useRef(onTick);
  tickRef.current = onTick;

  const connect = useCallback((s) => setSession(s), []);
  const disconnect = useCallback(() => { clearSession(); setSession(null); }, []);

  useEffect(() => {
    if (!session) return undefined;
    let stop = false;

    const pull = async () => {
      const syms = ALL.map((a) => a.sym);
      const rows = await brokerQuotes(session, syms);

      if (stop) return;

      if (rows === null) {
        // 401 already cleared the stored session; reflect that in the UI so the
        // LIVE badge cannot outlive the token it depends on.
        if (!loadSession()) setSession(null);
        return;
      }

      let n = 0;
      rows.forEach((r) => {
        const s = ALL.find((a) => a.sym === r.sym);
        if (!s) return;
        if (r.price != null) { s.price = r.price; n++; }
        if (r.chg != null) s.chg = r.chg;
        if (r.vol != null) s.vol = r.vol;
        if (r.oi != null) s.oi = r.oi;         // REAL open interest — Yahoo has none
        if (r.bid != null) s.bid = r.bid;
        if (r.ask != null) s.ask = r.ask;
        s.hasData = true;
        s.live = true;                          // this price came from a broker
      });

      if (n) {
        setLastTick(Date.now());
        if (tickRef.current) tickRef.current();
      }
    };

    pull();
    const id = setInterval(pull, intervalMs);
    return () => { stop = true; clearInterval(id); };
  }, [session, intervalMs]);

  return {
    session,
    connected: Boolean(session),
    broker: session ? BROKER_COVERAGE[session.broker] || null : null,
    connect,
    disconnect,
    lastTick,
  };
}
