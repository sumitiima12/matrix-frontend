import { useEffect, useState } from "react";
import { BACKEND_URL } from "../config";
import { ALL, UNIVERSE, yahooSymbol } from "../domain/universe";
import { fetchLiveQuotes, fetchIndicators, fetchIntraday, marketOpen } from "../domain/api";

/**
 * useMarketData — keeps the universe hydrated with REAL market data.
 *
 * Three streams, all from the backend:
 *   - quotes       (price, day change)        every 20s
 *   - indicators   (RSI/MACD/ATR/volume/S&R)  computed from real daily candles
 *
 * There is NO synthetic fallback. With no backend, instruments keep their null
 * indicators and the UI renders "—". Matrix never invents a number to look live.
 *
 * @returns { live, liveAt, tick } — `tick` increments whenever data lands, which
 *          is what consumers memoise against (the universe is mutated in place).
 */
export function useMarketData(market, intervalMs = 20000) {
  const [live, setLive] = useState(false);
  const [liveAt, setLiveAt] = useState(null);
  const [src, setSrc] = useState(null);   // "fyers" | "delta" | null(Yahoo) — the feed serving THIS market
  const [tick, setTick] = useState(0);

  /* WHOLE-UNIVERSE hydration lives in its OWN effect (keyed only on intervalMs), so it runs ONCE on mount and on
     a slow 5-min cadence — NOT again every time the user switches market tabs. Previously it sat inside the
     per-market effect, so every Crypto→Indian→US switch re-fetched all ~135 symbols in SERIAL 40-symbol chunks,
     which is the "markets load one after another / Top Picks slow" lag. Now the chunks fire in PARALLEL and the
     whole thing is decoupled from the active market, so switching tabs is instant (the target market is already
     priced) and cross-market holdings/search stay live. */
  useEffect(() => {
    if (!BACKEND_URL) return;
    let stop = false;
    const bump = () => setTick((t) => t + 1);
    const pullAllQuotes = async () => {
      try {
        const every = ALL.map((a) => a.sym);
        const chunks = [];
        for (let i = 0; i < every.length; i += 40) chunks.push(every.slice(i, i + 40));
        // PARALLEL: all chunks in flight at once (was serial for…await ⇒ 4× round-trips). Yahoo-safe (≤40 each).
        const results = await Promise.all(chunks.map((c) => fetchLiveQuotes(c).catch(() => [])));
        if (stop) return;
        let n = 0;
        for (const rows of results) (rows || []).forEach((r) => { const s = ALL.find((a) => a.sym === r.sym); if (s) { s.price = r.price; s.chg = r.chg; n++; } });
        if (n && !stop) bump();
      } catch { /* leave nulls -> UI renders "—" */ }
    };
    pullAllQuotes();                                    // once at startup
    const allId = setInterval(pullAllQuotes, 300000);   // whole universe every 5 min
    return () => { stop = true; clearInterval(allId); };
  }, [intervalMs]);

  useEffect(() => {
    let stop = false;
    const syms = (UNIVERSE[market] || []).map((a) => a.sym);
    if (!syms.length) return;

    const bump = () => setTick((t) => t + 1);

    const pullQuotes = async () => {
      try {
        const rows = await fetchLiveQuotes(syms);
        if (stop || !rows || !rows.length) { setLive(false); return; }
        let n = 0;
        const srcCount = {};
        rows.forEach((r) => {
          const s = ALL.find((a) => a.sym === r.sym);
          if (s) { s.price = r.price; s.chg = r.chg; if (r.src) s.liveSrc = r.src; n++; }
          if (r.src) srcCount[r.src] = (srcCount[r.src] || 0) + 1;
        });
        // The feed that served most of this market's names (fyers/delta = real-time; none = Yahoo).
        const dominant = Object.keys(srcCount).sort((a, b) => srcCount[b] - srcCount[a])[0] || null;
        if (n) { setLive(true); setLiveAt(Date.now()); setSrc(dominant); bump(); } else setLive(false);
      } catch { setLive(false); }
    };

    const merge = (data) => {
      if (!data) return 0;
      let n = 0;
      Object.keys(data).forEach((ySym) => {
        const s = ALL.find((a) => yahooSymbol(a.sym) === ySym || a.sym === ySym);
        if (!s) return;
        Object.assign(s, data[ySym]);
        n++;
      });
      return n;
    };

    const pullIndicators = async () => {
      try {
        const ind = await fetchIndicators(syms);
        if (stop || !ind) return;
        Object.keys(ind).forEach((y) => { const s = ALL.find((a) => yahooSymbol(a.sym) === y || a.sym === y); if (s) s.hasData = true; });
        if (merge(ind)) bump();
      } catch { /* stays null -> UI shows "—" */ }
    };

    /**
     * Real short-term momentum (5m / 15m change, volume surge) from 5-minute
     * candles. This is what Trending ranks on. It refreshes faster than the rest
     * because "trending" means "moving NOW" — a 20-minute-old reading is useless.
     * Skipped when the market is closed: the numbers would just be frozen.
     */
    const pullIntraday = async () => {
      try {
        const d = await fetchIntraday(syms);
        if (stop || !d) return;
        let n = 0;
        Object.keys(d).forEach((y) => {
          const s = ALL.find((a) => yahooSymbol(a.sym) === y || a.sym === y);
          if (!s) return;
          s.chg5m = d[y].chg5m;
          s.chg15m = d[y].chg15m;
          s.volSurge = d[y].volSurge;
          n++;
        });
        if (n) bump();
      } catch { /* stays null -> Trending simply shows less */ }
    };

    const refresh = () => {
      if (!BACKEND_URL) { setLive(false); return; }
      pullQuotes();
      pullIndicators();
    };

    refresh();
    pullIntraday();
    const id = setInterval(refresh, intervalMs);

    // Intraday momentum: every 60s, and only while the market is actually open.
    const intraId = setInterval(() => {
      if (BACKEND_URL && marketOpen(market)) pullIntraday();
    }, 60000);

    return () => { stop = true; clearInterval(id); clearInterval(intraId); };
  }, [market, intervalMs]);

  return { live, liveAt, tick, src };
}
