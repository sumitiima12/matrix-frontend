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
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let stop = false;
    const syms = (UNIVERSE[market] || []).map((a) => a.sym);
    if (!syms.length) return;

    const bump = () => setTick((t) => t + 1);

    /* Quotes for the WHOLE universe, not just the market on screen.
       Only the current market was ever fetched, so AAPL/BTC/GOLD sat at null while
       you were on Indian — which is why search showed "—" for them, and why a US
       holding in your portfolio had no price. Chunked to keep Yahoo happy, and run
       on a slower cadence than the active market. */
    const pullAllQuotes = async () => {
      try {
        const every = ALL.map((a) => a.sym);
        const chunks = [];
        for (let i = 0; i < every.length; i += 40) chunks.push(every.slice(i, i + 40));
        let n = 0;
        for (const chunk of chunks) {
          if (stop) return;
          const rows = await fetchLiveQuotes(chunk);
          (rows || []).forEach((r) => {
            const s = ALL.find((a) => a.sym === r.sym);
            if (s) { s.price = r.price; s.chg = r.chg; n++; }
          });
        }
        if (n && !stop) bump();
      } catch { /* leave nulls -> UI renders "—" */ }
    };

    const pullQuotes = async () => {
      try {
        const rows = await fetchLiveQuotes(syms);
        if (stop || !rows || !rows.length) { setLive(false); return; }
        let n = 0;
        rows.forEach((r) => {
          const s = ALL.find((a) => a.sym === r.sym);
          if (s) { s.price = r.price; s.chg = r.chg; n++; }
        });
        if (n) { setLive(true); setLiveAt(Date.now()); bump(); } else setLive(false);
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
    if (BACKEND_URL) pullAllQuotes();                 // once at startup
    const id = setInterval(refresh, intervalMs);

    // The whole universe on a slow cadence (5 min): enough to keep search, the
    // watchlist and cross-market holdings priced, without hammering Yahoo with
    // 135 symbols every few seconds.
    const allId = setInterval(() => { if (BACKEND_URL) pullAllQuotes(); }, 300000);

    // Intraday momentum: every 60s, and only while the market is actually open.
    const intraId = setInterval(() => {
      if (BACKEND_URL && marketOpen(market)) pullIntraday();
    }, 60000);

    return () => { stop = true; clearInterval(id); clearInterval(intraId); clearInterval(allId); };
  }, [market, intervalMs]);

  return { live, liveAt, tick };
}
