import { useCallback, useEffect, useRef, useState } from "react";
import { ALL } from "../domain/universe";
import { brokerSymbol, fromBrokerSymbol, mappableSymbols } from "../domain/brokerSymbols";
import { brokerById } from "../domain/brokers";
import {
  loadSessions, saveSession, clearSession, BROKER_MARKETS,
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
  /* A MAP of broker -> session. One broker per market, several at once. */
  const [sessions, setSessions] = useState(() => loadSessions());
  const [lastTick, setLastTick] = useState(null);
  const [error, setError] = useState(null);

  const [real, setReal] = useState(null);          // the user's ACTUAL broker portfolio
  const [realErr, setRealErr] = useState(null);
  const [realLoading, setRealLoading] = useState(false);

  const tickRef = useRef(onTick);
  tickRef.current = onTick;

  const connectedBrokers = Object.keys(sessions);
  const connected = connectedBrokers.length > 0;

  /* The "primary" broker, for the header pill and anything still expecting one. Prefer the
     Indian one — it's the home market and the one options require. */
  const primaryId =
    connectedBrokers.find((b) => (BROKER_MARKETS[b] || []).includes("IN")) || connectedBrokers[0] || null;
  const session = primaryId ? sessions[primaryId] : null;
  const broker = primaryId ? brokerById(primaryId) : null;

  /* Which broker serves a given market — null if none is connected for it. This is what
     routes an order: an Indian buy must go to the Indian broker even while Schwab and
     Delta are also live. */
  const brokerFor = useCallback((market) => {
    const id = connectedBrokers.find((b) => (BROKER_MARKETS[b] || []).includes(market));
    return id ? { id, session: sessions[id], meta: brokerById(id) } : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  /** market -> broker id, for the UI to show what covers what. */
  const marketMap = { IN: null, US: null, Crypto: null };
  Object.keys(marketMap).forEach((m) => {
    marketMap[m] = connectedBrokers.find((b) => (BROKER_MARKETS[b] || []).includes(m)) || null;
  });

  /** Finish the OAuth handshake. Returns a promise — the caller awaits it. */
  const connect = useCallback(async (brokerId, requestToken) => {
    setError(null);
    try {
      // The SERVER exchanges the token and keeps it; we get an opaque session id.
      const s = await brokerSession(brokerId, requestToken, userId);
      saveSession(s);                               // ADDS to the map; does not evict others
      setSessions((p) => ({ ...p, [s.broker]: s }));
      return s;
    } catch (e) {
      setError(String(e.message || e));
      throw e;
    }
  }, [userId]);

  /** Disconnect ONE broker (or all, if none named). The others keep streaming. */
  const disconnect = useCallback((brokerId) => {
    const targets = brokerId ? [brokerId] : Object.keys(sessions);
    targets.forEach((b) => {
      if (sessions[b]) brokerLogout(sessions[b], userId);   // drop it server-side too
      clearSession(b);
    });
    setSessions((p) => {
      const c = { ...p };
      targets.forEach((b) => delete c[b]);
      return c;
    });
    setReal(null);
    setError(null);
  }, [sessions, userId]);

  /* Live quote polling. */
  useEffect(() => {
    if (!connected) return undefined;
    let stop = false;

    /* EVERY connected broker is polled, each for the symbols IT can price. FYERS covers
       the Indian names, Schwab the US ones, Delta the crypto — so a single tick can update
       three markets from three different feeds. A broker that fails is dropped for that
       tick alone; the others still deliver, rather than one dead US token blanking the
       Indian prices too. */
    const pull = async () => {
      const active = Object.values(sessions).filter((x) => x && x.sessionId);
      if (!active.length) return;

      const results = await Promise.all(active.map(async (sess) => {
        const covered = mappableSymbols(sess.broker, ALL.map((a) => a.sym));
        if (!covered.length) return { n: 0 };

        const map = {};
        const bsyms = [];
        covered.forEach((sym) => {
          const b = brokerSymbol(sym, sess.broker);
          if (b) { map[b] = sym; bsyms.push(b); }
        });
        if (!bsyms.length) return { n: 0 };

        try {
          const quotes = await brokerQuotes(sess, userId, bsyms);
          if (stop) return { n: 0 };

          let n = 0;
          Object.entries(quotes).forEach(([bsym, q]) => {
            const our = map[bsym] || fromBrokerSymbol(bsym, sess.broker);
            const s = ALL.find((a) => a.sym === our);
            if (!s || q.price == null) return;      // no price -> leave the old one alone
            s.price = q.price;
            if (q.chg != null) s.chg = q.chg;
            if (q.vol != null) s.vol = q.vol;
            if (q.oi != null) s.oi = q.oi;
            if (q.bid != null) s.bid = q.bid;
            if (q.ask != null) s.ask = q.ask;
            s.hasData = true;
            s.liveSource = sess.broker;             // this price is live, not delayed
            n++;
          });
          return { n };
        } catch (e) {
          const msg = String(e.message || e);
          /* A dead token is the normal end of a broker day. Drop THAT broker only — the
             others keep streaming. Blanking every feed because one expired would be worse
             than the outage itself. */
          if (/session|token|auth|401|403/i.test(msg)) {
            clearSession(sess.broker);
            setSessions((p) => { const c = { ...p }; delete c[sess.broker]; return c; });
          }
          return { n: 0, err: `${sess.broker}: ${msg}` };
        }
      }));

      if (stop) return;

      const total = results.reduce((a, r) => a + (r.n || 0), 0);
      const errs = results.map((r) => r.err).filter(Boolean);
      setError(errs.length && !total ? errs.join(" · ") : null);

      if (total) {
        setLastTick(Date.now());
        if (tickRef.current) tickRef.current(total);
      }
    };

    pull();
    const id = setInterval(pull, intervalMs);
    return () => { stop = true; clearInterval(id); };
  }, [connected, sessions, userId, intervalMs]);

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
    /* multi-broker */
    sessions, connectedBrokers, brokerFor, marketMap,
  };
}
