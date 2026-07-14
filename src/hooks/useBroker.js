import { useCallback, useEffect, useRef, useState } from "react";
import { ALL } from "../domain/universe";
import { brokerSymbol, fromBrokerSymbol, mappableSymbols } from "../domain/brokerSymbols";
import { brokerById } from "../domain/brokers";
import {
  loadSession, saveSession, clearSession,
  brokerSession, brokerQuotes, brokerLogout, brokerPortfolio,
} from "../services/brokerService";

/**
 * useBroker — the live broker connection.
 *
 * A connected broker writes its REAL-TIME prices straight onto the universe, in place,
 * exactly where the Yahoo poller writes its delayed ones. Nothing downstream changes:
 * the same `s.price` every card and chart already reads simply stops being ~15 min old.
 *
 * It also restores a field Yahoo never had: `s.oi` (real open interest). We deleted the
 * "OI" label rather than mislabel volume as OI; with a broker it is real.
 *
 * Symbols the broker cannot price are never requested (brokerSymbols returns null rather
 * than guessing a ticker), and their Yahoo price is left untouched. We never blank a real
 * number just because a second source lacks it.
 *
 * If the token dies — both brokers expire theirs daily — the session is cleared and the
 * app falls back to Yahoo, rather than flying a "LIVE" badge over stale numbers.
 */
export function useBroker({ onTick, userId, intervalMs = 2000 } = {}) {
  const [session, setSession] = useState(() => loadSession());
  const [lastTick, setLastTick] = useState(null);
  const [error, setError] = useState(null);

  const [real, setReal] = useState(null);          // the user's ACTUAL broker portfolio
  const [realErr, setRealErr] = useState(null);
  const [realLoading, setRealLoading] = useState(false);

  const tickRef = useRef(onTick);
  tickRef.current = onTick;

  const connected = Boolean(session && session.sessionId && session.broker);
  const broker = connected ? brokerById(session.broker) : null;

  /** Finish the OAuth handshake. Returns a promise — the caller awaits it. */
  const connect = useCallback(async (brokerId, requestToken) => {
    setError(null);
    try {
      // The SERVER exchanges the token and keeps it; we get an opaque session id.
      const s = await brokerSession(brokerId, requestToken, userId);
      saveSession(s);
      setSession(s);
      return s;
    } catch (e) {
      setError(String(e.message || e));
      throw e;
    }
  }, [userId]);

  const disconnect = useCallback(() => {
    brokerLogout(session, userId);                  // drop it server-side too
    clearSession();
    setSession(null);
    setReal(null);
    setError(null);
  }, [session, userId]);

  /* Live quote polling. */
  useEffect(() => {
    if (!connected) return undefined;
    let stop = false;

    /* Only the symbols this broker can actually price. BROKER_COVERAGE is metadata
       (markets, capabilities) — NOT a symbol list; iterating it would request nothing
       and no quote would ever arrive. mappableSymbols does the real work. */
    const covered = mappableSymbols(session.broker, ALL.map((a) => a.sym));
    if (!covered.length) return undefined;

    const pull = async () => {
      const map = {};
      const bsyms = [];
      covered.forEach((sym) => {
        const b = brokerSymbol(sym, session.broker);
        if (b) { map[b] = sym; bsyms.push(b); }
      });
      if (!bsyms.length) return;

      try {
        const quotes = await brokerQuotes(session, userId, bsyms);
        if (stop) return;

        let n = 0;
        Object.entries(quotes).forEach(([bsym, q]) => {
          const our = map[bsym] || fromBrokerSymbol(bsym, session.broker);
          const s = ALL.find((a) => a.sym === our);
          if (!s || q.price == null) return;        // no price -> leave the old one alone
          s.price = q.price;
          if (q.chg != null) s.chg = q.chg;
          if (q.vol != null) s.vol = q.vol;
          if (q.oi != null) s.oi = q.oi;
          if (q.bid != null) s.bid = q.bid;
          if (q.ask != null) s.ask = q.ask;
          s.hasData = true;
          s.liveSource = session.broker;            // this price is live, not delayed
          n++;
        });

        if (n) {
          setLastTick(Date.now());
          setError(null);
          if (tickRef.current) tickRef.current(n);
        }
      } catch (e) {
        if (stop) return;
        const msg = String(e.message || e);
        setError(msg);
        // A dead token is the normal end of a broker day. Fall back; don't retry blindly.
        if (/session|token|auth|401|403/i.test(msg)) {
          clearSession();
          setSession(null);
        }
      }
    };

    pull();
    const id = setInterval(pull, intervalMs);
    return () => { stop = true; clearInterval(id); };
  }, [connected, session, userId, intervalMs]);

  /** The REAL portfolio. Only pulled when the user is actually in Real mode. */
  const refreshPortfolio = useCallback(async () => {
    if (!connected) { setReal(null); return; }
    setRealLoading(true);
    try {
      const d = await brokerPortfolio(session, userId);
      setReal(d);
      setRealErr(null);
    } catch (e) {
      setReal(null);
      setRealErr(String(e.message || e));
    } finally {
      setRealLoading(false);
    }
  }, [connected, session, userId]);

  return {
    session, connected, broker, error, lastTick,
    connect, disconnect,
    real, realErr, realLoading, refreshPortfolio,
  };
}
