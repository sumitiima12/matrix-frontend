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
import { coordinatedFetch } from "./dataCoordinator";

// Per-endpoint freshness: quotes change fast; candle history and static-ish reads can be cached longer. This
// is what lets many features asking for the same quotes/history within the window share ONE network trip.
function ttlForPath(path) {
  if (path.startsWith("/api/quote")) return 8000;
  if (path.startsWith("/api/history") || path.startsWith("/api/indicators")) return 60000;
  return 15000;
}
// All market-data GETs flow through the coordinator: de-duplicated, TTL-cached, paused while the tab is hidden
// or offline, and adaptively backed-off on error — instead of every mounted component fetching independently.
const get = async (path) => {
  if (!BACKEND_URL) return null;
  return coordinatedFetch(`GET ${path}`, async () => {
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
  }, { ttlMs: ttlForPath(path), priority: "normal" });
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
export function aggregate(candles, n, baseMin = 1, anchor = 0, nowMs = Date.now(), sessionCloseFn = null) {
  if (!Array.isArray(candles) || n <= 1) return candles;
  const stepMs = n * baseMin * 60 * 1000;
  const period = n * baseMin;   // minutes per aggregated bar
  /* R21-P2-07 / R25-M01: SESSION-ANCHOR the window, PER EXCHANGE DATE. Pure UTC-epoch buckets split an exchange
     session (e.g. NSE 09:15 IST) into a short leading bar. `anchor` is the session open as minutes-from-UTC-
     midnight (IN 03:45 UTC = 225; crypto 24/7 = 0) — either a constant or a FUNCTION of the candle's own epoch,
     so a range that crosses a US DST transition anchors each date to that date's real New-York offset (a single
     range-wide offset shifted the older side by an hour). */
  const anchorFor = typeof anchor === "function" ? anchor : () => anchor;
  const buckets = new Map();
  for (const c of candles) {
    const ms = c.t < 1e12 ? c.t * 1000 : c.t;
    const aMin = anchorFor(ms) || 0;
    const anchorMs = (((aMin % period) + period) % period) * 60 * 1000;
    const key = Math.floor((ms - anchorMs) / stepMs) * stepMs + anchorMs;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(c);
  }
  const keys = [...buckets.keys()].sort((a, b) => a - b);
  const lastKey = keys[keys.length - 1];
  const out = [];
  for (const key of keys) {
    const g = buckets.get(key).sort((a, b) => a.t - b.t);
    /* R24-P2-07 / R25-M02: a short TAIL bar is kept only when it is genuinely COMPLETE — its clock window has
       fully elapsed, OR its exchange session has ended (the last sample is at/after that date's session close).
       We NO LONGER treat mere sample staleness as "complete": during a current-session data outage the last
       sample is old but the bar is NOT done, so keeping it would present an incomplete bar as closed. Such a bar
       is dropped. A legitimate past closing bar (NSE 13:15–15:30, US closing partial) is kept via window-elapsed
       or session-ended; only a still-forming or outage-truncated CURRENT bar is discarded. */
    if (key === lastKey && g.length < n) {
      const lastT = g[g.length - 1].t;
      const lastMs = lastT < 1e12 ? lastT * 1000 : lastT;
      const windowElapsed = nowMs >= (key + stepMs);
      let sessionEnded = false;
      if (sessionCloseFn) {
        const closeMin = sessionCloseFn(lastMs);                 // minutes-from-UTC-midnight of the session close, or null
        /* M01 fix: the closing partial bar is COMPLETE once the WALL CLOCK passes the exchange close for THAT
           bar's date — compare nowMs to the dated close instant, NOT the last candle's start-of-day. The old
           form asked "is the last candle's time-of-day past close?", which is false for the 15:25 candle of the
           15:30 NSE close, so the finished 4-hour closing bar was wrongly dropped at 15:31 until its 17:15 clock
           window elapsed. */
        if (closeMin != null) {
          const dayStartMs = Math.floor(lastMs / 86400000) * 86400000;   // UTC midnight of the bar's date
          sessionEnded = nowMs >= (dayStartMs + closeMin * 60000);
        }
      }
      if (!windowElapsed && !sessionEnded) continue;             // still forming OR outage-truncated → drop
    }
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
/* R21-P2-07: exchange session open as minutes-from-UTC-midnight, used to anchor multi-hour aggregation to the
   real session. IN (NSE/BSE, .NS/.BO): 09:15 IST = 03:45 UTC = 225. US: 09:30 ET, DST-dependent (13:30 UTC EDT
   / 14:30 UTC EST) — resolved via Intl for the sample's own date. Crypto/others: 24/7, no anchor. */
function sessionAnchorMin(ySym, sampleMs) {
  const s = String(ySym || "").toUpperCase();
  if (/\.(NS|BO)$/.test(s)) return 225;                       // NSE/BSE 09:15 IST
  if (/-USD$|USDT$|USDC$/.test(s) || /^(BTC|ETH|SOL|DOGE|XRP)/.test(s)) return 0;  // crypto = epoch
  // US equities: derive the current UTC offset of America/New_York for this date (handles DST).
  try {
    const d = new Date(sampleMs || Date.now());
    const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: false }).formatToParts(d);
    const etHour = +(p.find((x) => x.type === "hour")?.value ?? 0);
    const utcHour = d.getUTCHours();
    let offset = utcHour - etHour; if (offset < 0) offset += 24;   // 5 (EST) or 4 (EDT)
    return ((9 * 60 + 30) + offset * 60) % 1440;                    // 09:30 ET → UTC minutes
  } catch { return 0; }
}
/* R25-M02: exchange session CLOSE as minutes-from-UTC-midnight, resolved per date (DST-aware for US). Used to
   decide whether a short trailing bar is a genuine closing bar (session ended) vs an incomplete/outage bar.
   Crypto/24-7 has no close → null. */
function sessionCloseMin(ySym, sampleMs) {
  const s = String(ySym || "").toUpperCase();
  if (/\.(NS|BO)$/.test(s)) return 10 * 60;                        // NSE/BSE 15:30 IST = 10:00 UTC
  if (/-USD$|USDT$|USDC$/.test(s) || /^(BTC|ETH|SOL|DOGE|XRP)/.test(s)) return null;   // crypto = no session close
  try {
    const d = new Date(sampleMs || Date.now());
    const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: false }).formatToParts(d);
    const etHour = +(p.find((x) => x.type === "hour")?.value ?? 0);
    const utcHour = d.getUTCHours();
    let offset = utcHour - etHour; if (offset < 0) offset += 24;
    return ((16 * 60) + offset * 60) % 1440;                       // 16:00 ET close → UTC minutes
  } catch { return null; }
}

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

  if (!m.agg) return rows;
  // Anchor multi-hour aggregation to the exchange session (only matters when a bar spans ≥1h; sub-hour bars
  // clock-align fine on epoch). R25-M01: pass a PER-DATE anchor function so each date uses its own DST offset;
  // R25-M02: pass the session-close function so a short trailing bar is kept only when its session has ended.
  const multiHour = m.agg * baseMinutesOf(m.i) >= 60;
  const anchor = multiHour ? (ms) => sessionAnchorMin(ySym, ms) : 0;
  const closeFn = multiHour ? (ms) => sessionCloseMin(ySym, ms) : null;
  return aggregate(rows, m.agg, baseMinutesOf(m.i), anchor, Date.now(), closeFn);
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
