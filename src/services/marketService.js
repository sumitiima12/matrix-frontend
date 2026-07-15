/**
 * services/marketService.js — ALL market data I/O. Transport only.
 *
 * Every function takes a resolved Yahoo symbol (the caller owns app-symbol ->
 * Yahoo-symbol mapping, which is domain knowledge). This keeps the service layer
 * free of any dependency on the stock universe, so there are no circular imports.
 *
 * Hard rule: if the backend can't answer, these return null. They NEVER
 * fabricate data — the UI is responsible for saying "unavailable".
 */
import { BACKEND_URL, TF_YF } from "../config";

const get = async (path) => {
  if (!BACKEND_URL) return null;
  const r = await fetch(`${BACKEND_URL}${path}`);
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
};

/** Live quotes. Returns [{ sym, price, chg }] keyed by Yahoo symbol. */
export async function getQuotes(ySyms) {
  if (!ySyms || !ySyms.length) return null;
  const d = await get(`/api/quote?symbols=${encodeURIComponent(ySyms.join(","))}`);
  return d ? (d.quotes || null) : null;
}

/** Real OHLCV candles, normalised to { i, t, o, h, l, c, v }. */
/**
 * Fold N candles into one. This is how a 4h candle is genuinely built from 60m bars:
 * open of the first, close of the last, the highest high, the lowest low, volume summed.
 * Anything else — e.g. relabelling a 90m bar as "4h" — misstates the period every
 * indicator is then computed on.
 */
function aggregate(candles, n) {
  const out = [];
  for (let i = 0; i < candles.length; i += n) {
    const g = candles.slice(i, i + n);
    if (!g.length) continue;
    out.push({
      t: g[0].t,
      o: g[0].o,
      c: g[g.length - 1].c,
      h: Math.max(...g.map((x) => x.h)),
      l: Math.min(...g.map((x) => x.l)),
      v: g.reduce((a, x) => a + (x.v || 0), 0),
    });
  }
  return out.map((c, i) => ({ ...c, i }));
}

export async function getHistory(ySym, tf) {
  const m = TF_YF[tf] || TF_YF["1d"];
  const d = await get(`/api/history?symbol=${encodeURIComponent(ySym)}&range=${m.r}&interval=${m.i}`);
  if (!d) return null;
  const rows = (d.candles || [])
    .filter((c) => c.o != null && c.c != null && c.h != null && c.l != null)
    .map((c, i) => ({
      i,
      t: c.t,
      o: +(+c.o).toFixed(2),
      h: +(+c.h).toFixed(2),
      l: +(+c.l).toFixed(2),
      c: +(+c.c).toFixed(2),
      v: c.v,
    }));

  return m.agg ? aggregate(rows, m.agg) : rows;
}

/** Real headlines: [{ t, d, src, url }]. */
export async function getNews(ySym) {
  const d = await get(`/api/news?symbol=${encodeURIComponent(ySym)}`);
  return d ? (d.news || []) : null;
}

/** Real indicators computed server-side from daily candles, keyed by Yahoo symbol. */
export async function getIndicators(ySyms) {
  if (!ySyms || !ySyms.length) return null;
  const d = await get(`/api/indicators?symbols=${encodeURIComponent(ySyms.join(","))}`);
  return d ? (d.indicators || null) : null;
}

/** Backend diagnostics: which LLM engines and storage the server actually sees. */
export async function getHealth() {
  return get("/api/health");
}

/**
 * Real short-term momentum from actual 5-minute candles: change over the last
 * 5 and 15 minutes, plus a volume surge ratio against this session's own average
 * 5-min volume. Symbols with no intraday data are simply absent.
 */
export async function getIntraday(ySyms) {
  if (!BACKEND_URL || !ySyms?.length) return null;
  const d = await get(`/api/intraday?symbols=${encodeURIComponent(ySyms.join(","))}`);
  return d || null;
}
