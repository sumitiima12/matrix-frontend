/**
 * hooks/useCandles.js — the single source of real candles for every chart.
 *
 * No synthetic fallback by design: if the backend can't supply history,
 * this returns an error and the UI says so.
 */
import { useEffect, useMemo, useState } from "react";
import { BACKEND_URL } from "../config";
import { getHistory } from "../services/marketService";
import { yahooSymbol } from "../domain/universe";

const cache = new Map();          // key: "SYM|tf" -> { at, data }
const TTL = 60_000;

/**
 * Candles for an APP symbol (e.g. "BAJAJFINSV", "BTC", "GOLD").
 *
 * It used to take a Yahoo symbol, but every caller passed the app symbol — so
 * requests went out as `BAJAJFINSV` instead of `BAJAJFINSV.NS` and every chart
 * silently failed. The conversion belongs here, once, rather than at each call
 * site where it can be forgotten.
 */
export function useCandles(sym, tf, limit = 0) {
  const ySym = yahooSymbol(sym);
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let stop = false;
    const key = `${ySym}|${tf}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) {
      setState({ data: hit.data, loading: false, error: null });
      return;
    }
    if (!BACKEND_URL) {
      setState({ data: null, loading: false, error: "no-backend" });
      return;
    }
    setState({ data: null, loading: true, error: null });
    getHistory(ySym, tf)
      .then((d) => {
        if (stop) return;
        if (!d || d.length < 3) { setState({ data: null, loading: false, error: "no-data" }); return; }
        cache.set(key, { at: Date.now(), data: d });
        setState({ data: d, loading: false, error: null });
      })
      .catch(() => { if (!stop) setState({ data: null, loading: false, error: "failed" }); });
    return () => { stop = true; };
  }, [ySym, tf]);

  const data = useMemo(() => {
    if (!state.data) return null;
    const d = limit ? state.data.slice(-limit) : state.data;
    return d.map((c, i) => ({ ...c, i }));
  }, [state.data, limit]);

  return { ...state, data };
}
