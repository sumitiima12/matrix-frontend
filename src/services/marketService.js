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
import { BACKEND_URL, TF_YF, BT_YF } from "../config";

const get = async (path) => {
  if (!BACKEND_URL) return null;
  // Attach the logged-in user's token when present. Market data is public, but the server uses the
  // identity to decide whether to serve the OWNER's licensed FYERS feed (owner only) vs Yahoo.
  let headers;
  try {
    const tok = typeof localStorage !== "undefined" && localStorage.getItem("mx_token");
    if (tok) headers = { Authorization: `Bearer ${tok}` };
  } catch { /* ignore */ }
  const r = await fetch(`${BACKEND_URL}${path}`, headers ? { headers } : undefined);
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
/* C-03 / M2-02: fold base candles into a higher timeframe by CLOCK BOUNDARY. Each bar is keyed to
   floor(epoch / (n·baseMin)) so a "3m from 1m" bar is a true clock window (09:15–09:18, …) aligned to
   minute % 3 == 0, even if the feed starts late or has gaps — not "every n rows since the first present".
   The trailing bucket is dropped while it's still forming (fewer than n base candles) so a half-formed bar
   never appears as closed. `baseMin` is the base interval in minutes (1 for 1m→3m, 60 for 60m→4h). */
function aggregate(candles, n, baseMin = 1) {
  if (!Array.isArray(candles) || n <= 1) return candles;
  const stepMs = n * baseMin * 60 * 1000;
  const buckets = new Map();
  for (const c of candles) {
    const ms = c.t < 1e12 ? c.t * 1000 : c.t;
    const key = Math.floor(ms / stepMs) * stepMs;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(c);
  }
  const keys = [...buckets.keys()].sort((a, b) => a - b);
  const lastKey = keys[keys.length - 1];
  const out = [];
  for (const key of keys) {
    const g = buckets.get(key).sort((a, b) => a.t - b.t);
    if (key === lastKey && g.length < n) continue;        // drop the still-forming tail bar only
    out.push({
      t: g[0].t, o: g[0].o, c: g[g.length - 1].c,
      h: Math.max(...g.map((x) => x.h)), l: Math.min(...g.map((x) => x.l)),
      v: g.reduce((a, x) => a + (x.v || 0), 0),
    });
  }
  return out.map((c, i) => ({ ...c, i }));
}
// Base-interval minutes for a Yahoo interval string (e.g. "1m"→1, "60m"→60), so clock-bucketing knows how
// many base candles make one aggregated bar.
function baseMinutesOf(iv) { const m = String(iv || "").match(/^(\d+)m$/); if (m) return +m[1]; if (iv === "60m" || iv === "1h") return 60; return 1; }

export async function getHistory(ySym, tf, useBt = false) {
  const table = useBt ? BT_YF : TF_YF;
  const m = table[tf] || table["1d"] || TF_YF["1d"];
  const d = await get(`/api/history?symbol=${encodeURIComponent(ySym)}&range=${m.r}&interval=${m.i}`);
  if (!d) return null;
  // Adaptive precision: 2dp for >=$1, but KEEP sub-dollar detail so cheap crypto (LAB $0.156,
  // BEAT $0.025, PEPE $0.000001) doesn't collapse into a flat line at 2 decimals.
  const r = (x) => (x == null ? x : Math.abs(+x) >= 1 ? +(+x).toFixed(2) : +(+x).toPrecision(6));
  const rows = (d.candles || [])
    .filter((c) => c.o != null && c.c != null && c.h != null && c.l != null)
    .map((c, i) => ({ i, t: c.t, o: r(c.o), h: r(c.h), l: r(c.l), c: r(c.c), v: c.v }));

  return m.agg ? aggregate(rows, m.agg, baseMinutesOf(m.i)) : rows;
}

/** Real fundamentals from Yahoo quoteSummary (via backend crumb flow). Returns the object,
 *  or { unavailable:true } when Yahoo declines / the instrument has none (e.g. crypto). */
export async function getFundamentals(ySym) {
  if (!ySym) return null;
  try { return await get(`/api/fundamentals?symbol=${encodeURIComponent(ySym)}`); }
  catch { return { unavailable: true }; }
}

/** Real headlines: [{ t, d, src, url }]. */
/** Earnings calendar (recent + upcoming) for a market. Soft-fails to empty lists. */
export async function getEarnings(market) {
  try { const d = await get(`/api/earnings?market=${encodeURIComponent(market || "US")}`); return d || { recent: [], upcoming: [] }; }
  catch { return { recent: [], upcoming: [] }; }
}

export async function getNews(ySym, name) {
  const nameQ = name ? `&name=${encodeURIComponent(name)}` : "";
  const d = await get(`/api/news?symbol=${encodeURIComponent(ySym)}${nameQ}`);
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
