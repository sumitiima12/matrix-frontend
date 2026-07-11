/**
 * hooks/useCandles.js — the single source of real candles for every chart.
 *
 * No synthetic fallback by design: if the backend can't supply history,
 * this returns an error and the UI says so.
 */
import { useEffect, useMemo, useState } from "react";
import { BACKEND_URL } from "../config";
import { getHistory } from "../services/marketService";

const cache = new Map();          // key: "SYM|tf" -> { at, data }
const TTL = 60_000;

export function useCandles(ySym, tf, limit = 0) {
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
