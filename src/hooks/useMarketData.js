import { useEffect, useState } from "react";
import { BACKEND_URL } from "../config";
import { ALL, UNIVERSE, yahooSymbol, capTier } from "../domain/universe";
import { fetchLiveQuotes, fetchIndicators, fetchFundamentals } from "../domain/api";

/**
 * useMarketData — keeps the universe hydrated with REAL market data.
 *
 * Three streams, all from the backend:
 *   - quotes       (price, day change)        every 20s
 *   - indicators   (RSI/MACD/ATR/volume/S&R)  computed from real daily candles
 *   - fundamentals (P/E, ROE, growth, holders)
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

    const pullFundamentals = async () => {
      try {
        const f = await fetchFundamentals(syms);
        if (stop || !f) return;
        if (merge(f)) {
          // Cap tier is derived from the REAL market cap, never hardcoded.
          ALL.forEach((s) => { if (s.marketCap != null) s.cap = capTier(s.marketCap); });
          bump();
        }
      } catch { /* stays null -> UI shows "—" */ }
    };

    const refresh = () => {
      if (!BACKEND_URL) { setLive(false); return; }
      pullQuotes();
      pullIndicators();
      pullFundamentals();
    };

    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => { stop = true; clearInterval(id); };
  }, [market, intervalMs]);

  return { live, liveAt, tick };
}
