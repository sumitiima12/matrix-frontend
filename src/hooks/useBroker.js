import { useCallback, useEffect, useRef, useState } from "react";
import { ALL } from "../domain/universe";
import { brokerSymbol, fromBrokerSymbol, mappableSymbols } from "../domain/brokerSymbols";
import { brokerById } from "../domain/brokers";
import {
  loadSessions, saveSession, clearSession, BROKER_MARKETS,
  brokerSession, brokerQuotes, brokerLogout, brokerPortfolio,
  loadBrokerPref, setBrokerPref, resumeBroker, brokerStatus,
  recordConnect, forgetConnect, brokersNeedingReconnect,
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
  /* Consecutive quote failures per broker. A cold Render backend routinely 502s the first
     poll or two right after connect — that must NOT be treated as a dead token. We only
     drop a broker after several failures in a row, and only ever on a genuine auth status
     (a clean 401/403), never on a transient 502 or a network blip. */
  const failStreak = useRef({});
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

  /* Resolve which connected broker drives a market: the user's PREFERENCE for that market
     wins (if that broker is still connected and covers it); otherwise the first connected
     broker that covers it. This is what makes "use Groww for Indian, IND Money for US" work
     even though IND Money also covers Indian. */
  const resolveFor = (market) => {
    const pref = loadBrokerPref()[market];
    if (pref && sessions[pref] && (BROKER_MARKETS[pref] || []).includes(market)) return pref;
    return connectedBrokers.find((b) => (BROKER_MARKETS[b] || []).includes(market)) || null;
  };

  /* The "primary" broker, for the header pill and anything still expecting one. Prefer the
     Indian one — it's the home market and the one options require. */
  const primaryId = resolveFor("IN") || connectedBrokers[0] || null;
  const session = primaryId ? sessions[primaryId] : null;
  const broker = primaryId ? brokerById(primaryId) : null;

  /* Which broker serves a given market — null if none is connected for it. This is what
     routes an order: an Indian buy must go to the Indian broker even while Schwab and
     Delta are also live. */
  const brokerFor = useCallback((market) => {
    const id = resolveFor(market);
    return id ? { id, session: sessions[id], meta: brokerById(id) } : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  /** market -> broker id, for the UI to show what covers what. */
  const marketMap = { IN: null, US: null, Crypto: null, Commodity: null };
  Object.keys(marketMap).forEach((m) => { marketMap[m] = resolveFor(m); });

  /** Finish the OAuth handshake. Returns a promise — the caller awaits it. */
  const connect = useCallback(async (brokerId, requestToken, extra, market) => {
    setError(null);
    try {
      // The SERVER exchanges the token and keeps it; we get an opaque session id.
      // `extra` carries bring-your-own credentials (Dhan/IND Money token, Angel One login).
      const s = await brokerSession(brokerId, requestToken, userId, extra);
      saveSession(s);                               // ADDS to the map; does not evict others
      recordConnect(s.broker);                      // remember for the daily-reconnect nudge
      // Connected FOR a specific market -> make it the preferred driver for that market.
      if (market) setBrokerPref(market, s.broker);
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
      forgetConnect(b);   // user chose to disconnect — don't nudge them to reconnect
    });
    setSessions((p) => {
      const c = { ...p };
      targets.forEach((b) => delete c[b]);
      return c;
    });
    setReal(null);
    setError(null);
  }, [sessions, userId]);

  /* AUTO-RESUME across devices. Broker CREDENTIALS live on the server (encrypted, per-user), but
     the session HANDLE is saved per-device. So logging in on mobile after connecting on a laptop
     showed "not connected". On login we ask the server which brokers it holds creds for and
     re-establish those sessions here — no manual reconnect on the new device. */
  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    brokerStatus(userId).then((d) => {
      if (!alive || !d || !d.brokers) return;
      Object.entries(d.brokers).forEach(([id, info]) => {
        if (info && info.hasCreds && !sessions[id]) {
          resumeBroker(id, userId).then((s) => { if (s && alive) setSessions((p) => (p[s.broker] ? p : { ...p, [s.broker]: s })); }).catch(() => {});
        }
      });
    }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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
          failStreak.current[sess.broker] = 0;    // healthy poll — reset the failure count
          return { n };
        } catch (e) {
          const msg = String(e.message || e);
          const status = e && e.status;

          /* Only a CLEAN auth status means the token is actually dead. A 502/500/network
             error is the cold backend or an upstream hiccup — keep the session, it will
             recover on the next tick. This is the fix for "connects then immediately drops":
             the first poll after connect often 502s while Render wakes, and the old code
             cleared the session on any error string containing "401"/"token"/etc. */
          const isAuthFailure = status === 401 || status === 403;

          const streak = (failStreak.current[sess.broker] || 0) + 1;
          failStreak.current[sess.broker] = streak;

          /* Before dropping a session on auth failure, try to RESUME it from the server's
             stored creds — this is what silently reconnects after the mobile browser reopens
             or the free-tier server restarts, instead of forcing the user to reconnect. */
          if (isAuthFailure) {
            const resumed = await resumeBroker(sess.broker, userId);
            if (resumed && !stop) {
              setSessions((p) => ({ ...p, [sess.broker]: resumed }));
              failStreak.current[sess.broker] = 0;
              return { n: 0, resumed: true };
            }
          }

          /* Resume failed (no stored creds / expired token): drop only after a couple of
             consecutive real auth failures — never on the very first poll. */
          if (isAuthFailure && streak >= 2) {
            clearSession(sess.broker);
            setSessions((p) => { const c = { ...p }; delete c[sess.broker]; return c; });
            failStreak.current[sess.broker] = 0;
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

  /** The REAL portfolio. Only pulled when the user is actually in Real mode.
      Market-aware: on the Crypto tab it pulls the Delta/CoinDCX holdings, on Indian the
      FYERS/Zerodha ones, etc. — each from the broker that actually covers that market, so
      the user sees the account that matches the tab instead of always the Indian one. */
  const refreshPortfolio = useCallback(async (market) => {
    if (!connected) { setReal(null); return; }
    const route = market ? brokerFor(market) : null;
    const sess = (route && route.session) || session;
    if (!sess) { setReal(null); setRealErr(null); return; }
    setRealLoading(true);
    try {
      const d = await brokerPortfolio(sess, userId);
      setReal(d);
      setRealErr(null);
    } catch (e) {
      setReal(null);
      setRealErr(String(e.message || e));
    } finally {
      setRealLoading(false);
    }
  }, [connected, session, userId, brokerFor]);

  /* Daily-expiry brokers the user connected on a prior day and that aren't live now — surfaced so the
     UI can nudge "reconnect for live prices" each morning instead of silently going delayed. */
  const reconnectHints = brokersNeedingReconnect(connectedBrokers)
    .map((id) => ({ id, name: (brokerById(id) || {}).name || id }));

  return {
    session, connected, broker, error, lastTick,
    connect, disconnect,
    real, realErr, realLoading, refreshPortfolio,
    /* multi-broker */
    sessions, connectedBrokers, brokerFor, marketMap,
    reconnectHints,
  };
}
