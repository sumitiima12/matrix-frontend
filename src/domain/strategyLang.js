import { SMAarr, EMAarr, RSIarr, MACDarr, BBarr, CCIarr, ATRarr, VWAParr, ADXarr, STarr, DMIarr, STOCHarr, STDDEVarr, CPRarr, PIVOTarr, ICHIarr, FIBarr, CF, ROLLavg, ROLLmedian } from "../lib/series";
import { pivots, detectPatterns, PATTERN_KEYS } from "./patterns";

/* Support / resistance as evaluable series: at each bar, the price of the most recent CONFIRMED
   swing low (support) / swing high (resistance) at or before that bar. Falls back to a rolling
   extreme early on, before any pivot exists, so the operand is never NaN for the whole window. */
function srSeries(c, kind) {
  const pv = pivots(c, 3);
  const wantT = kind === "support" ? "L" : "H";
  const out = new Array(c.length).fill(NaN);
  let last = NaN, pi = 0;
  for (let i = 0; i < c.length; i++) {
    while (pi < pv.length && pv[pi].i <= i) { if (pv[pi].t === wantT) last = pv[pi].p; pi++; }
    if (!isNaN(last)) { out[i] = last; continue; }
    // No pivot yet — use the running extreme of the window seen so far.
    let ext = kind === "support" ? Infinity : -Infinity;
    for (let j = 0; j <= i; j++) ext = kind === "support" ? Math.min(ext, c[j].l) : Math.max(ext, c[j].h);
    out[i] = ext;
  }
  return out;
}

/* Chart-pattern condition series: 1 on bars where a pattern of `key` is present (from its
   confirmation bar, held for a short window so the entry rule has time to fire), else 0. */
function patternSeries(c, key, within = 3) {
  const s = new Array(c.length).fill(0);
  const pats = detectPatterns(c).filter((p) => p.key === key);
  for (const p of pats) for (let j = p.at; j <= Math.min(c.length - 1, p.at + within); j++) s[j] = 1;
  return s;
}
/* ── CANDLESTICK PATTERNS ────────────────────────────────────────────────────────────────
   Single/two/three-candle formations a trader names directly — DOJI, hammer, engulfing, etc.
   Separate from the multi-bar CHART patterns above (double bottom, cup & handle). Operand form
   is "CDL:<key>" and, like chart patterns, it's 1 on the bar the formation completes.        */
export const CANDLE_OPERAND_PREFIX = "CDL:";
/* Phrase -> key. Longest phrase must be tried first ("inverted hammer" before "hammer"). */
export const CANDLE_KEYS = {
  "three white soldiers": "three-white-soldiers",
  "3 white soldiers": "three-white-soldiers",
  "three black crows": "three-black-crows",
  "3 black crows": "three-black-crows",
  "bullish engulfing": "bull-engulfing",
  "bearish engulfing": "bear-engulfing",
  "engulfing candle": "bull-engulfing",
  "engulfing": "bull-engulfing",
  "inverted hammer": "inverted-hammer",
  "inverse hammer": "inverted-hammer",
  "shooting star": "shooting-star",
  "hanging man": "hanging-man",
  "morning star": "morning-star",
  "evening star": "evening-star",
  "spinning top": "spinning-top",
  "marubozu": "marubozu",
  "hammer": "hammer",
  "doji": "doji",
};
export const CANDLE_LABEL = {
  "three-white-soldiers": "Three White Soldiers", "three-black-crows": "Three Black Crows",
  "bull-engulfing": "Bullish Engulfing", "bear-engulfing": "Bearish Engulfing",
  "inverted-hammer": "Inverted Hammer", "shooting-star": "Shooting Star",
  "hanging-man": "Hanging Man", "morning-star": "Morning Star", "evening-star": "Evening Star",
  "spinning-top": "Spinning Top", "marubozu": "Marubozu", "hammer": "Hammer", "doji": "Doji",
};
/* 1 on bars where the named candlestick completes, else 0. Geometry only — o/h/l/c per candle. */
export function candleSeries(c, key) {
  const s = new Array(c.length).fill(0);
  const body = (x) => Math.abs(x.c - x.o);
  const rng = (x) => (x.h - x.l) || 1e-9;
  const upW = (x) => x.h - Math.max(x.o, x.c);
  const loW = (x) => Math.min(x.o, x.c) - x.l;
  const green = (x) => x.c > x.o, red = (x) => x.c < x.o;
  for (let i = 0; i < c.length; i++) {
    const x = c[i], p = i > 0 ? c[i - 1] : null, p2 = i > 1 ? c[i - 2] : null;
    const b = body(x), r = rng(x); let hit = false;
    switch (key) {
      case "doji": hit = b <= 0.1 * r; break;
      case "hammer": hit = b > 0 && b <= 0.4 * r && loW(x) >= 2 * b && upW(x) <= b; break;
      case "hanging-man": hit = b > 0 && b <= 0.4 * r && loW(x) >= 2 * b && upW(x) <= b && !!p && green(p); break;
      case "inverted-hammer": hit = b > 0 && b <= 0.4 * r && upW(x) >= 2 * b && loW(x) <= b; break;
      case "shooting-star": hit = b > 0 && b <= 0.4 * r && upW(x) >= 2 * b && loW(x) <= b && !!p && green(p); break;
      case "marubozu": hit = b >= 0.9 * r; break;
      case "spinning-top": hit = b <= 0.35 * r && upW(x) >= b && loW(x) >= b; break;
      case "bull-engulfing": hit = !!p && red(p) && green(x) && x.o <= p.c && x.c >= p.o && b > body(p); break;
      case "bear-engulfing": hit = !!p && green(p) && red(x) && x.o >= p.c && x.c <= p.o && b > body(p); break;
      case "morning-star": hit = !!p2 && !!p && red(p2) && body(p) <= 0.4 * rng(p) && green(x) && x.c >= (p2.o + p2.c) / 2; break;
      case "evening-star": hit = !!p2 && !!p && green(p2) && body(p) <= 0.4 * rng(p) && red(x) && x.c <= (p2.o + p2.c) / 2; break;
      // Three consecutive strong green candles, each closing and opening higher (opens inside the
      // prior body) with small upper wicks — a sustained-buying reversal/continuation signal.
      case "three-white-soldiers": hit = !!p2 && !!p && green(p2) && green(p) && green(x)
        && x.c > p.c && p.c > p2.c && x.o > p.o && p.o > p2.o && x.o < p.c && p.o < p2.c
        && body(x) >= 0.5 * rng(x) && body(p) >= 0.5 * rng(p); break;
      // Three consecutive strong red candles, each closing and opening lower — sustained selling.
      case "three-black-crows": hit = !!p2 && !!p && red(p2) && red(p) && red(x)
        && x.c < p.c && p.c < p2.c && x.o < p.o && p.o < p2.o && x.o > p.c && p.o > p2.c
        && body(x) >= 0.5 * rng(x) && body(p) >= 0.5 * rng(p); break;
      default: hit = false;
    }
    if (hit) s[i] = 1;
  }
  return s;
}
/* Timeframe written in the prose — "3 mins" / "3m" / "5 minute" / "1 hour" / "daily" — mapped to
   the app's tf tokens (3m, 1h, 1D…). Returns null when the text names no timeframe. */
export function detectTf(text) {
  const t = String(text || "").toLowerCase();
  let m;
  if ((m = t.match(/(\d+)\s*(?:m\b|min\b|mins\b|minute|minutes)/))) return m[1] + "m";
  if ((m = t.match(/(\d+)\s*(?:h\b|hr\b|hrs\b|hour|hours)/))) return m[1] + "h";
  if (/\b(?:daily|end\s*of\s*day|eod|day\s*chart)\b/.test(t)) return "1D";
  if (/\b(?:weekly|week\s*chart)\b/.test(t)) return "1W";
  if ((m = t.match(/(\d+)\s*(?:d\b|day|days)/))) return m[1] === "1" ? "1D" : m[1] + "D";
  return null;
}
/* Every timeframe mentioned in a line, in order of appearance and de-duplicated. detectTf returns
   only the FIRST; for multi-timeframe prompts ("bullish on 3m + 5m + 15m") we need them all. */
export function detectAllTfs(text) {
  const t = String(text || "").toLowerCase();
  const out = [];
  const push = (tf) => { if (tf && !out.includes(tf)) out.push(tf); };
  const re = /(\d+)\s*(m\b|min\b|mins\b|minute|minutes|h\b|hr\b|hrs\b|hour|hours|d\b|day|days)/g;
  let m;
  while ((m = re.exec(t))) {
    const n = m[1], u = m[2][0];
    push(u === "m" ? n + "m" : u === "h" ? n + "h" : (n === "1" ? "1D" : n + "D"));
  }
  if (/\b(?:daily|eod|end\s*of\s*day)\b/.test(t)) push("1D");
  if (/\bweekly\b/.test(t)) push("1W");
  return out;
}
/* Momentum phrase -> a price-jump scan spec, or null. Recognises both a ratio ("current price /
   previous candle close > 1.02") and plain English ("price jumped 2% in 5 mins", "down 3% today").
   The timeframe comes from detectTf ("5 mins"/"1 hour"/"4 hours"/"daily"); default 1d. */
export function parseMomentum(text) {
  const t = String(text || "").toLowerCase();
  const tf = detectTf(t) || "1d";
  // Ratio form: <price/close> / <...previous...close> <op> <number>. Anything between the slash and
  // the second "close" ("price of previous candle") is allowed.
  let m = t.match(/(?:current\s*)?(?:price|close|ltp)\s*\/\s*[a-z\s'()]*close\s*(>=?|<=?|above|below|greater\s*than|less\s*than)\s*(\d+(?:\.\d+)?)/);
  if (m) {
    const ratio = parseFloat(m[2]);
    const down = /<|below|less/.test(m[1]);
    const pct = Math.abs((ratio - 1) * 100);
    if (pct > 0) return { pct: +pct.toFixed(4), dir: down ? "down" : "up", tf };
  }
  // Plain-English form: a percent + a direction word.
  const pm = t.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pm) {
    const up = /(jump|jumped|jumps|rose|rise|rises|risen|rally|rallied|surge|surged|gain|gained|gains|gaining|\bup\b|increase|increased|higher|spike|spiked|rocket|pump|pumped|moved?\s*up|rallies)/.test(t);
    const dn = /(fell|fall|falls|drop|dropped|drops|declin|\bdown\b|lost|lose|loses|lower|dump|dumped|crash|plunge|plunged|sink|sank|moved?\s*down)/.test(t);
    if (up || dn) { const pct = parseFloat(pm[1]); if (pct > 0) return { pct, dir: dn && !up ? "down" : "up", tf }; }
  }
  return null;
}
/* MACD(fast,slow,signal) and BB(length,mult) carry their bracket/number params onto the def so
   "MACD(3,10,16)" or "RSI 21" actually change the calculation instead of using defaults. */
function macdDef(nums) { const d = { type: "MACD", len: "", name: "MACD" }; if (nums && nums.length >= 3) { d.fast = nums[0]; d.slow = nums[1]; d.signal = nums[2]; } return d; }
function bbDef(nums) { const d = { type: "BB", len: String((nums && nums[0]) || 20), name: "BB" }; if (nums && nums[1]) d.mult = nums[1]; return d; }

/* Map a plain-English pattern phrase to its canonical key, or null. Longest phrase wins so
   "inverse head and shoulders" beats "head and shoulders". */
export function patternKeyFromText(text) {
  const t = String(text || "").toLowerCase();
  const phrases = Object.keys(PATTERN_KEYS).sort((a, b) => b.length - a.length);
  for (const ph of phrases) if (t.includes(ph)) return PATTERN_KEYS[ph];
  return null;
}
export const PATTERN_OPERAND_PREFIX = "PAT:";
/**
 * domain/strategyLang.js — the strategy rule language.
 *
 * Parses plain-English and visual-builder conditions into evaluable operands,
 * and evaluates them against REAL candles. Pure: no UI, no I/O.
 *
 * Used by domain/backtest.js (to run a strategy) and by the Automation page
 * (to show the generated pseudo-code and the operand pickers).
 */
function rollExt(c, len, field, max) { const o = Array(c.length).fill(NaN); for (let i = 0; i < c.length; i++) { let v = c[i][field]; for (let j = Math.max(0, i - len + 1); j <= i; j++) v = max ? Math.max(v, c[j][field]) : Math.min(v, c[j][field]); o[i] = v; } return o; }
/* One indicator def -> its value series, over WHATEVER OHLC series you pass. Pulled out of
   resolveOperand so the identical logic can run on the base candles OR on a higher-timeframe
   aggregate of them (multi-timeframe support). */
function computeIndicator(d, attr, c, closes, vols) {
  const len = Number(d.len) || 14;
  switch (d.type) {
    case "EMA": return EMAarr(closes, len);
    case "SMA": return SMAarr(closes, len);
    case "RSI": return RSIarr(closes, len);
    case "CCI": return CCIarr(c, len);
    case "ATR": return ATRarr(c, len);
    case "VWAP": return VWAParr(c);
    case "MACD": { const m = MACDarr(closes, d.fast, d.slow, d.signal); return m[attr || "line"]; }
    case "BB": { const b = BBarr(closes, len, d.mult); return b[attr || "middle"]; }
    case "KC": { const mid = EMAarr(closes, len), at = ATRarr(c, len); return attr === "upper" ? mid.map((v, i) => v + 1.5 * at[i]) : attr === "lower" ? mid.map((v, i) => v - 1.5 * at[i]) : mid; }
    case "ADX": return ADXarr(c, len);
    case "DMI": { const dm = DMIarr(c, len); return attr === "minus" ? dm.minus : attr === "adx" ? dm.adx : dm.plus; }
    case "Stoch": { const st = STOCHarr(c, len, Number(d.smoothK) || 3, Number(d.smoothD) || 3); return attr === "d" ? st.d : st.k; }
    case "Supertrend": { const st = STarr(c, len, Number(d.mult) || 3); return attr === "dir" ? st.dir : st.line; }
    case "StdDev": return STDDEVarr(closes, len);
    case "CPR": { const cp = CPRarr(c); return attr === "bc" ? cp.bc : attr === "tc" ? cp.tc : cp.pivot; }
    case "Pivots": { const pv = PIVOTarr(c); return attr === "r1" ? pv.r1 : attr === "r2" ? pv.r2 : attr === "s1" ? pv.s1 : attr === "s2" ? pv.s2 : pv.p; }
    case "Ichimoku": { const ic = ICHIarr(c); return attr === "kijun" ? ic.kijun : attr === "spanA" ? ic.spanA : attr === "spanB" ? ic.spanB : ic.tenkan; }
    case "Fib": { const rt = { r236: 0.236, r382: 0.382, r500: 0.5, r618: 0.618, r786: 0.786 }[attr] ?? 0.5; return FIBarr(c, len || 90, rt); }
    case "DMA": return SMAarr(closes, len);
    case "Volume": { const mode = d.mode || "raw"; return mode === "avg" ? ROLLavg(vols, len) : mode === "median" ? ROLLmedian(vols, len) : vols; }
    case "CurrentCandle": case "CurrentDay": { const f = CF[attr] || "c"; return c.map((x) => x[f]); }
    case "PrevCandle": case "PrevDay": { const f = CF[attr] || "c"; return c.map((x, i) => i > 0 ? c[i - 1][f] : NaN); }
    case "LastNCandles": { const f = CF[attr] || "c"; return attr === "high" ? rollExt(c, len, "h", true) : attr === "low" ? rollExt(c, len, "l", false) : c.map((x, i) => (i - len + 1 >= 0 ? c[i - len + 1][f] : x[f])); }
    case "FirstNCandles": { const f = CF[attr] || "c"; const head = c.slice(0, Math.max(1, len)); const val = attr === "high" ? Math.max(...head.map((x) => x.h)) : attr === "low" ? Math.min(...head.map((x) => x.l)) : (attr === "open" ? head[0].o : head[head.length - 1].c); return closes.map(() => val); }
    /* OPENING RANGE — the high/low of the first `len` MINUTES of each trading day. Resets every day.
       `len` defaults to 15. Used for opening-range-breakout: entry when price crosses above ORB.high.
       Day boundary is the first candle of each UTC date, which for NSE/US sessions is the market open
       (their sessions don't straddle UTC midnight). */
    case "ORB": {
      const mins = Number(d.len) || 15;
      const out = new Array(c.length);
      let dayKey = null, hi = -Infinity, lo = Infinity, dayStart = 0;
      for (let i = 0; i < c.length; i++) {
        const dt = new Date(c[i].t);
        const key = dt.getUTCFullYear() + "-" + dt.getUTCMonth() + "-" + dt.getUTCDate();
        if (key !== dayKey) { dayKey = key; hi = -Infinity; lo = Infinity; dayStart = c[i].t; }
        if (c[i].t - dayStart < mins * 60000) { if (c[i].h > hi) hi = c[i].h; if (c[i].l < lo) lo = c[i].l; }
        out[i] = attr === "low" ? lo : hi;
      }
      return out;
    }
    default: return closes.map(() => NaN);
  }
}

const TF_MIN = { "1m": 1, "2m": 2, "3m": 3, "5m": 5, "10m": 10, "15m": 15, "30m": 30, "45m": 45, "60m": 60, "1h": 60, "90m": 90, "2h": 120, "3h": 180, "4h": 240, "1d": 1440, "1D": 1440, "1w": 10080, "1W": 10080, "1mo": 43200 };
export function tfMinutes(tf) { const k = String(tf || "").trim(); return TF_MIN[k] || TF_MIN[k.toLowerCase()] || TF_MIN[k.toUpperCase()] || 0; }

/* Fold the base OHLC series into `periodMin`-minute buckets and, for every base bar, record the index
   of the last CLOSED higher-tf bar. Using the last CLOSED bar (not the one still forming) is what
   keeps a higher-tf indicator from peeking at the future. Cached per period on the eval cache. */
function mtfBuckets(c, periodMin, store) {
  const key = "__mtf_" + periodMin;
  if (store[key]) return store[key];
  const P = periodMin * 60000;
  const hi = [];
  let curB = null, cur = null;
  for (const x of c) {
    const b = Math.floor(x.t / P);
    if (b !== curB) { if (cur) hi.push(cur); curB = b; cur = { t: b * P, o: x.o, h: x.h, l: x.l, c: x.c, v: x.v || 0, _b: b }; }
    else { cur.h = Math.max(cur.h, x.h); cur.l = Math.min(cur.l, x.l); cur.c = x.c; cur.v += (x.v || 0); }
  }
  if (cur) hi.push(cur);
  const idxOf = new Array(c.length);
  let p = 0;
  for (let i = 0; i < c.length; i++) {
    const b = Math.floor(c[i].t / P);
    while (p < hi.length && hi[p]._b < b) p++;   // advance past every fully-closed higher-tf bar
    idxOf[i] = p - 1;
  }
  const out = { hi, idxOf, hiCloses: hi.map((x) => x.c), hiVols: hi.map((x) => x.v || 0) };
  store[key] = out; return out;
}

export function resolveOperand(op, defs, c, closes, vols, cache, baseTf = null) {
  if (op in cache) return cache[op];
  let series;
  if (op !== "" && !isNaN(Number(op))) { const n = Number(op); series = closes.map(() => n); }
  else if (op === "Price") series = closes;
  else if (op === "Volume") series = vols;
  else if (op === "Support") series = srSeries(c, "support");
  else if (op === "Resistance") series = srSeries(c, "resistance");
  else if (op.startsWith(PATTERN_OPERAND_PREFIX)) series = patternSeries(c, op.slice(PATTERN_OPERAND_PREFIX.length));
  else if (op.startsWith(CANDLE_OPERAND_PREFIX)) series = candleSeries(c, op.slice(CANDLE_OPERAND_PREFIX.length));
  else {
    const [nm, attr] = op.split(".");
    const d = (defs || []).find((x) => x.name === nm);
    if (!d) series = closes.map(() => NaN);
    else {
      const bm = tfMinutes(baseTf), dm = tfMinutes(d.tf);
      if (baseTf && bm > 0 && dm > bm) {
        /* HIGHER-TIMEFRAME def: compute on a higher-tf aggregate of the base candles, then map each
           base bar to the last CLOSED higher-tf bar. This is what makes a "1D EMA" actually mean the
           DAILY EMA while backtesting on 5-minute candles, instead of a (wrong) 5-minute EMA. */
        const agg = mtfBuckets(c, dm, cache);
        const hiSeries = computeIndicator(d, attr, agg.hi, agg.hiCloses, agg.hiVols);
        series = agg.idxOf.map((k) => (k >= 0 ? hiSeries[k] : NaN));
      } else {
        series = computeIndicator(d, attr, c, closes, vols);
      }
    }
  }
  cache[op] = series; return series;
}
export function evalCond(cond, i, get) {
  const L = get(cond.la), R = cond.bType === "num" ? null : get(cond.b);
  const lv = L[i], rv = cond.bType === "num" ? Number(cond.b) : R[i];
  const plv = L[i - 1], prv = cond.bType === "num" ? Number(cond.b) : (R ? R[i - 1] : NaN);
  if (lv == null || rv == null || isNaN(lv) || isNaN(rv)) return false;
  switch (cond.op) {
    case ">": return lv > rv; case "<": return lv < rv; case ">=": return lv >= rv; case "<=": return lv <= rv;
    case "==": return Math.abs(lv - rv) < 1e-9;
    case "crosses_above": return !isNaN(plv) && !isNaN(prv) && plv <= prv && lv > rv;

    /* "Crossed above at some point in the last N bars" — the cross stays TRUE for a
       short window instead of for exactly one candle. Requiring two separate crosses to
       land on the same bar is nearly a coincidence; this lets you say "the band broke
       out AND momentum crossed up within the last 3 candles", which is what the rule
       actually means. Default 3 bars. */
    case "crossed_above_within": {
      const n = Math.max(1, Number(cond.n) || 3);
      for (let k = 0; k < n; k++) {
        const a = L[i - k], b = cond.bType === "num" ? Number(cond.b) : (R ? R[i - k] : NaN);
        const pa = L[i - k - 1], pb = cond.bType === "num" ? Number(cond.b) : (R ? R[i - k - 1] : NaN);
        if (!isNaN(a) && !isNaN(b) && !isNaN(pa) && !isNaN(pb) && pa <= pb && a > b) return true;
      }
      return false;
    }
    case "crossed_below_within": {
      const n = Math.max(1, Number(cond.n) || 3);
      for (let k = 0; k < n; k++) {
        const a = L[i - k], b = cond.bType === "num" ? Number(cond.b) : (R ? R[i - k] : NaN);
        const pa = L[i - k - 1], pb = cond.bType === "num" ? Number(cond.b) : (R ? R[i - k - 1] : NaN);
        if (!isNaN(a) && !isNaN(b) && !isNaN(pa) && !isNaN(pb) && pa >= pb && a < b) return true;
      }
      return false;
    }
    case "crosses_below": return !isNaN(plv) && !isNaN(prv) && plv >= prv && lv < rv;
    default: return false;
  }
}
export function chainEval(conds, i, get) { if (!conds || !conds.length) return false; let r = evalCond(conds[0], i, get); for (let k = 1; k < conds.length; k++) { const e = evalCond(conds[k], i, get); r = (conds[k].gate || "AND") === "OR" ? (r || e) : (r && e); } return r; }
/**
 * The indicator catalogue the strategy builder offers.
 *
 * This lived in pages/Automation.jsx while domain/strategyLang.js referenced it —
 * i.e. a domain module depended on a UI page, which is backwards, and it crashed
 * the app at runtime (ReferenceError: IND_CATALOG is not defined). It belongs
 * here, with the language that consumes it; the page imports it from here.
 */
export const IND_CATALOG = [
  { type: "EMA", label: "EMA", needsLen: true, attrs: [] },
  { type: "SMA", label: "SMA", needsLen: true, attrs: [] },
  { type: "RSI", label: "RSI", needsLen: true, attrs: [] },
  { type: "CCI", label: "CCI", needsLen: true, attrs: [] },
  { type: "MACD", label: "MACD", needsLen: false, attrs: ["line", "signal", "hist"] },
  { type: "BB", label: "Bollinger Band", needsLen: true, attrs: ["upper", "middle", "lower"] },
  { type: "KC", label: "Keltner Channel", needsLen: true, attrs: ["upper", "middle", "lower"] },
  { type: "ATR", label: "ATR", needsLen: true, attrs: [] },
  { type: "StdDev", label: "Standard deviation", needsLen: true, attrs: [] },
  { type: "CPR", label: "Central Pivot Range", needsLen: false, attrs: ["pivot", "bc", "tc"] },
  { type: "Pivots", label: "Pivot Points (standard)", needsLen: false, attrs: ["pivot", "r1", "r2", "s1", "s2"] },
  { type: "Ichimoku", label: "Ichimoku Cloud", needsLen: false, attrs: ["tenkan", "kijun", "spanA", "spanB"] },
  { type: "Fib", label: "Fibonacci retracement", needsLen: true, attrs: ["r236", "r382", "r500", "r618", "r786"] },
  { type: "VWAP", label: "VWAP", needsLen: false, attrs: [] },
  { type: "ADX", label: "ADX", needsLen: true, attrs: [] },
  { type: "DMI", label: "DMI (+DI / -DI / ADX)", needsLen: true, attrs: ["plus", "minus", "adx"] },
  { type: "Stoch", label: "Stochastic (%K / %D)", needsLen: true, attrs: ["k", "d"] },
  { type: "Supertrend", label: "Supertrend", needsLen: true, attrs: ["line", "dir"] },
  { type: "DMA", label: "DMA (displaced MA)", needsLen: true, attrs: [] },
  { type: "Volume", label: "Volume", needsLen: false, attrs: [] },
  { type: "CurrentCandle", label: "Current candle", needsLen: false, attrs: ["open", "high", "low", "close"] },
  { type: "PrevCandle", label: "Previous candle", needsLen: false, attrs: ["open", "high", "low", "close"] },
  { type: "FirstNCandles", label: "First N candles", needsLen: true, attrs: ["open", "high", "low", "close"] },
  { type: "LastNCandles", label: "Last N candles", needsLen: true, attrs: ["open", "high", "low", "close"] },
  { type: "CurrentDay", label: "Current day", needsLen: false, attrs: ["open", "close"] },
  { type: "PrevDay", label: "Previous day", needsLen: false, attrs: ["open", "close"] },
];

export function defOperands(defs) {
  const out = [];
  defs.forEach((d) => {
    const cat = IND_CATALOG.find((c) => c.type === d.type) || { attrs: [] };
    if (cat.attrs.length) cat.attrs.forEach((a) => out.push(`${d.name}.${a}`));
    else out.push(d.name);
  });
  return out;
}

/* -------- Plain-English → executable rules parser --------
 * Turns sentences like "exit when RSI crosses above 85 or MACD histogram
 * becomes negative or MACD line crosses below MACD signal line" into structured,
 * backtestable conditions the engine understands. */
export const MACD_DEF = { type: "MACD", len: "", name: "MACD" };
export const BB_DEF = { type: "BB", len: "20", name: "BB" };
export const CC_DEF = { type: "CurrentCandle", len: "", name: "CC" };   // this candle's O/H/L/C
export function mapToken(tok) {
  const t = tok.toLowerCase();
  // Any bare numbers in the token are the indicator's PARAMS — "MACD(3,10,16)" -> [3,10,16],
  // "RSI 21" / "RSI(21)" -> [21], "BB(20,2)" -> [20,2]. This is how Neo reads a setting change
  // written in brackets, instead of always using the defaults.
  const nums = (t.match(/\d+/g) || []).map(Number);
  if (/hist/.test(t)) return { operand: "MACD.hist", def: macdDef(nums) };
  if (/signal/.test(t)) return { operand: "MACD.signal", def: macdDef(nums) };
  if (/macd/.test(t)) return { operand: "MACD.line", def: macdDef(nums) };
  // Candle O/H/L/C — must be checked BEFORE the generic price/close catch, and each maps to
  // the real candle field so "close > open" means a green candle (not the old bug where
  // "open" was dropped and it collapsed to "price > 0").
  if (/\bopen\b/.test(t)) return { operand: "CC.open", def: CC_DEF };
  if (/\bhigh\b/.test(t)) return { operand: "CC.high", def: CC_DEF };
  if (/\blow\b/.test(t)) return { operand: "CC.low", def: CC_DEF };
  if (/\bclose\b/.test(t)) return { operand: "CC.close", def: CC_DEF };
  let m;
  if ((m = t.match(/(\d+)\s*[- ]?\s*ema|ema\s*\(?\s*(\d+)?/))) { const len = m[1] || m[2] || "20"; return { operand: "EMA" + len, def: { type: "EMA", len, name: "EMA" + len } }; }
  if ((m = t.match(/(\d+)\s*[- ]?\s*sma|sma\s*\(?\s*(\d+)?/))) { const len = m[1] || m[2] || "50"; return { operand: "SMA" + len, def: { type: "SMA", len, name: "SMA" + len } }; }
  if (/upper/.test(t)) return { operand: "BB.upper", def: bbDef(nums) };
  if (/lower/.test(t)) return { operand: "BB.lower", def: bbDef(nums) };
  if (/middle|bollinger|\bbb\b/.test(t)) return { operand: "BB.middle", def: bbDef(nums) };
  if (/rsi/.test(t)) return { operand: "RSI", def: { type: "RSI", len: String(nums[0] || 14), name: "RSI" } };
  if (/adx/.test(t)) return { operand: "ADX", def: { type: "ADX", len: String(nums[0] || 14), name: "ADX" } };
  if (/cci/.test(t)) return { operand: "CCI", def: { type: "CCI", len: String(nums[0] || 20), name: "CCI" } };
  if (/vwap/.test(t)) return { operand: "VWAP", def: { type: "VWAP", len: "", name: "VWAP" } };
  if (/volume/.test(t)) return { operand: "Volume", def: { type: "Volume", len: "", name: "Volume" } };
  if (/resistance/.test(t)) return { operand: "Resistance", def: null };
  if (/support/.test(t)) return { operand: "Support", def: null };
  if (/price|ltp|spot/.test(t)) return { operand: "Price", def: null };
  return null;
}
export const TOKEN_RE = /macd\s*hist\w*|macd\s*signal\w*|signal\s*line|\bsignal\b|macd\s*line|macd\s*\(?\s*\d+\s*[,/ ]\s*\d+\s*[,/ ]\s*\d+\s*\)?|macd|\d+\s*[- ]?\s*ema|ema\s*\(?\s*\d*\s*\)?|\d+\s*[- ]?\s*sma|sma\s*\(?\s*\d*\s*\)?|upper\s*band|lower\s*band|middle\s*band|bollinger(?:\s*bands?)?\s*\(?\s*\d*\s*,?\s*\d*\s*\)?|\bbb\b\s*\(?\s*\d+\s*,?\s*\d*\s*\)?|rsi\s*\(?\s*\d*\s*\)?|adx\s*\(?\s*\d*\s*\)?|cci\s*\(?\s*\d*\s*\)?|\bvwap\b|\bvolume\b|\bresistance\b|\bsupport\b|\bprice\b|\bclose\b|\bopen\b|\bhigh\b|\blow\b|\bltp\b/gi;
export function detectOp(clause) {
  const c = clause.toLowerCase();
  if (/cross(es|ing)?\s*(above|over)/.test(c)) return { op: "crosses_above" };
  if (/cross(es|ing)?\s*(below|under)/.test(c)) return { op: "crosses_below" };
  if (/(become|becomes|turn|turns|goes|going)\s*(negative|below\s*zero)/.test(c)) return { op: "<", rhs: "0" };
  if (/(become|becomes|turn|turns|goes|going)\s*(positive|above\s*zero)/.test(c)) return { op: ">", rhs: "0" };
  if (c.includes(">=") || /greater\s*than\s*or\s*equal|at\s*least/.test(c)) return { op: ">=" };
  if (c.includes("<=") || /less\s*than\s*or\s*equal|at\s*most/.test(c)) return { op: "<=" };
  if (c.includes(">") || /greater\s*than|more\s*than|above|exceed|exceeds|rises?\s*above|goes?\s*above|breaks?\s*above/.test(c)) return { op: ">" };
  if (c.includes("<") || /less\s*than|below|under|drops?\s*below|falls?\s*below|dips?\s*below|breaks?\s*below/.test(c)) return { op: "<" };
  if (c.includes("==") || c.includes("=") || /equal|reaches|reach|hits|hit/.test(c)) return { op: "==" };
  return null;
}
export function parseClause(clause) {
  const toks = [...clause.matchAll(TOKEN_RE)].map((mm) => ({ idx: mm.index, ...(mapToken(mm[0]) || {}) })).filter((t) => t.operand);
  const opi = detectOp(clause);
  if (!toks.length || !opi) return null;
  const left = toks[0];
  let b, bType, rdef = null;
  if (opi.rhs !== undefined) { b = opi.rhs; bType = "num"; }
  else if (toks[1]) { b = toks[1].operand; bType = "ind"; rdef = toks[1].def; }
  else { const nums = clause.match(/-?\d+(\.\d+)?/g); b = nums ? nums[nums.length - 1] : "0"; bType = "num"; }
  return { cond: { la: left.operand, op: opi.op, b, bType }, defs: [left.def, rdef].filter(Boolean) };
}
/* ── THE INTERPRETER (Neo) ──────────────────────────────────────────────────────────────
   One place that turns a plain-English line into executable conditions. Handles, in order:
     1. Named chart patterns ("cup and handle", "double bottom", …) -> a pattern condition
        the engine checks with the real detector. Stripped BEFORE the and/or split so the
        "and" inside "cup AND handle" doesn't get treated as a logical connective.
     2. support / resistance, VWAP, candle O/H/L/C, indicators, numbers -> operand conditions.
   Used by the strategy builder (Automate) AND the screener, so both read the same language. */
/* Compound trading phrases that don't fit the "operand op operand" grammar — mapped whole to
   the conditions (and indicators) a trader means by them. Extends what Neo understands beyond
   raw indicator names to the vocabulary people actually use. */
const PHRASE_RULES = [
  { re: /golden\s*cross/i, cond: { la: "EMA50", op: "crosses_above", b: "EMA200", bType: "ind" }, defs: [{ type: "EMA", len: "50", name: "EMA50" }, { type: "EMA", len: "200", name: "EMA200" }] },
  { re: /death\s*cross/i, cond: { la: "EMA50", op: "crosses_below", b: "EMA200", bType: "ind" }, defs: [{ type: "EMA", len: "50", name: "EMA50" }, { type: "EMA", len: "200", name: "EMA200" }] },
  { re: /oversold/i, cond: { la: "RSI", op: "<", b: "30", bType: "num" }, defs: [{ type: "RSI", len: "14", name: "RSI" }] },
  { re: /overbought/i, cond: { la: "RSI", op: ">", b: "70", bType: "num" }, defs: [{ type: "RSI", len: "14", name: "RSI" }] },
  { re: /macd\s*(turns?|crosses?|goes?)?\s*(bullish|positive)/i, cond: { la: "MACD.line", op: "crosses_above", b: "MACD.signal", bType: "ind" }, defs: [{ type: "MACD", len: "", name: "MACD" }] },
  { re: /macd\s*(turns?|crosses?|goes?)?\s*(bearish|negative)/i, cond: { la: "MACD.line", op: "crosses_below", b: "MACD.signal", bType: "ind" }, defs: [{ type: "MACD", len: "", name: "MACD" }] },
  /* Green / red candle, exactly as the user defines them: green = Close > Open, red = Close < Open.
     Placed here so "green candle" is understood as a whole phrase before the word-by-word parser. */
  { re: /green\s*candle|bullish\s*candle|candle\s*(is\s*)?green/i, cond: { la: "CC.close", op: ">", b: "CC.open", bType: "ind" }, defs: [CC_DEF] },
  { re: /red\s*candle|bearish\s*candle|candle\s*(is\s*)?red/i, cond: { la: "CC.close", op: "<", b: "CC.open", bType: "ind" }, defs: [CC_DEF] },
  /* Connector allows MULTIPLE words ("bounces OFF FROM support") — the old single-word optional
     group failed on "off from". Requires a bounce/hold verb OR a near/at/off/from prefix so it
     doesn't swallow "breaks below support" (that still routes to the breakdown rule below). */
  { re: /(?:bounce|bounces|bouncing|bounced|rebound|rebounds|rebounding|reversal|reverses|holds?|holding|respect(?:s|ing)?|defend(?:s|ing)?)(?:\s+(?:from|off|at|of|near|the))*\s+support|(?:near|at|off|from)\s+support/i, cond: { la: "Price", op: ">", b: "Support", bType: "ind" }, defs: [] },
  { re: /(?:reject|rejected|rejects|rejecting|fail|fails|failing|failed|reverses?)(?:\s+(?:at|from|off|near|the))*\s+resistance|(?:near|at|off|from)\s+resistance|hits?\s+resistance/i, cond: { la: "Price", op: "<", b: "Resistance", bType: "ind" }, defs: [] },
  { re: /break(?:s|ing|out)?\s*(?:above|over|through|past)?\s*resistance|breakout/i, cond: { la: "Price", op: "crosses_above", b: "Resistance", bType: "ind" }, defs: [] },
  { re: /break(?:s|ing|down)?\s*(?:below|under|through)?\s*support|breakdown/i, cond: { la: "Price", op: "crosses_below", b: "Support", bType: "ind" }, defs: [] },
];

export function interpretText(text) {
  const conds = [], defs = [], unparsed = [];
  if (!text || !text.trim()) return { conds, defs, unparsed };
  let work = String(text);
  const pushDefs = (ds) => (ds || []).forEach((d) => { if (d && !defs.find((x) => x.name === d.name)) defs.push(d); });

  // 0. Multi-timeframe trend alignment: "bullish on 3m + 5m + 15m" (or bearish / uptrend / downtrend).
  //    A bare direction word plus two or more timeframes means "the trend agrees on every one of these
  //    intervals". We express that as an EMA(9) vs EMA(21) alignment PER timeframe — each EMA carries its
  //    own tf so the engine reads it off that timeframe's aggregated candles. Consumed before anything
  //    else so the loose "3m", "+", "15m" tokens don't confuse the word-by-word parser downstream.
  {
    const tfs = detectAllTfs(work);
    const bear = /\b(bearish|downtrend|trending\s*down|weak(?:ness)?)\b/i.test(work);
    const bull = /\b(bullish|uptrend|trending\s*up|strength|strong)\b/i.test(work);
    if (tfs.length >= 2 && (bull || bear)) {
      tfs.forEach((tf) => {
        const suf = tf.replace(/\W/g, "");
        const fast = { type: "EMA", len: "9", name: "EMA9_" + suf, tf };
        const slow = { type: "EMA", len: "21", name: "EMA21_" + suf, tf };
        pushDefs([fast, slow]);
        conds.push({ la: fast.name, op: bear && !bull ? "<" : ">", b: slow.name, bType: "ind", gate: conds.length ? "AND" : undefined });
      });
      work = work
        .replace(/\b(bullish|bearish|uptrend|downtrend|trending\s*up|trending\s*down|strength|strong|weak(?:ness)?)\b/ig, " ")
        .replace(/(\d+)\s*(?:m\b|min\b|mins\b|minute|minutes|h\b|hr\b|hrs\b|hour|hours|d\b|day|days)/ig, " ")
        .replace(/\b(?:on|across|over|and|plus)\b|[+&/]/ig, " ");
    }
  }

  // 0. Compound phrases (golden cross, oversold, MACD turns bullish, bounce off support…).
  for (const pr of PHRASE_RULES) {
    if (pr.re.test(work)) {
      const c = { ...pr.cond, gate: conds.length ? "AND" : undefined };
      if (!conds.find((x) => x.la === c.la && x.b === c.b && x.op === c.op)) { conds.push(c); pushDefs(pr.defs); }
      work = work.replace(pr.re, " ");
    }
  }

  // 1. Chart-pattern phrases anywhere in the line.
  const phrases = Object.keys(PATTERN_KEYS).sort((a, b) => b.length - a.length);
  for (const ph of phrases) {
    const re = new RegExp(ph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
    if (re.test(work)) {
      const key = PATTERN_KEYS[ph];
      const la = PATTERN_OPERAND_PREFIX + key;
      if (!conds.find((cd) => cd.la === la)) {
        conds.push({ la, op: ">", b: "0", bType: "num", gate: conds.length ? "AND" : undefined });
      }
      work = work.replace(re, " ");   // remove so the and/or splitter ignores it
    }
  }

  // 1b. Candlestick patterns by NAME (doji, hammer, inverted hammer, engulfing…). Longest phrase
  //     first so "inverted hammer" isn't eaten by "hammer". Each becomes a CDL: condition the
  //     engine checks with the real candlestick detector.
  const candlePhrases = Object.keys(CANDLE_KEYS).sort((a, b) => b.length - a.length);
  for (const ph of candlePhrases) {
    const re = new RegExp("\\b" + ph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "ig");
    if (re.test(work)) {
      const la = CANDLE_OPERAND_PREFIX + CANDLE_KEYS[ph];
      if (!conds.find((cd) => cd.la === la)) {
        conds.push({ la, op: ">", b: "0", bType: "num", gate: conds.length ? "AND" : undefined });
      }
      work = work.replace(re, " ");
    }
  }

  // 2. The remaining text: operand op operand/number, chained with AND / OR.
  const cleaned = work.replace(/^\s*(buy|sell|enter|exit|go long|short|when|if)\b[:,]?\s*/i, "").trim();
  if (cleaned) {
    const parts = cleaned.split(/\s+(and|or)\s+/i);
    for (let i = 0; i < parts.length; i += 2) {
      const clause = parts[i];
      if (!clause || !clause.trim()) continue;
      const gate = (i > 0 && parts[i - 1] && parts[i - 1].toLowerCase() === "or") ? "OR" : (conds.length || i > 0) ? "AND" : undefined;
      const p = parseClause(clause);
      if (p) { if (gate) p.cond.gate = gate; conds.push(p.cond); p.defs.forEach((d) => { if (d && !defs.find((x) => x.name === d.name)) defs.push(d); }); }
      else unparsed.push(clause.trim());
    }
  }
  // Drop clauses that are only filler left over after a phrase/pattern was consumed ("when price",
  // "on", "then") — they aren't real unparsed conditions and shouldn't raise a warning.
  const FILLER = /^(?:when|then|if|on|at|in|a|an|the|is|are|was|be|it|its|and|or|buy|sell|enter|exit|go|long|short|price|of|to|from|for|with|that|this|now|forms?|forming|appears?|appearing|shows?|showing|candle|candles|candlestick|pattern|patterns|signal|line|band|near)$/i;
  const cleanUnparsed = unparsed.filter((u) => /[a-z0-9]/i.test(u) && u.split(/\s+/).some((w) => w && !FILLER.test(w)));
  return { conds, defs, unparsed: cleanUnparsed };
}

/* ── STRATEGY SUGGESTER ──────────────────────────────────────────────────────────────────
   Turns a loose BRIEF ("suggest a strategy using Bollinger, MACD and RSI", "ride momentum with
   BB + RSI") into a COMPLETE, coherent entry+exit system. Unlike interpretText (which parses the
   literal conditions a user writes), this DESIGNS one: Neo picks sensible defaults and combines the
   named indicators into a bull-momentum (default) or mean-reversion strategy. Each indicator plays a
   role — trend/breakout trigger, momentum confirmation, or exit — and the highest-priority exit wins
   so the strategy has one clean way out. Bias flips every rule for reversal briefs. */
function suggestSpecs(bias) {
  const bull = bias !== "reversal";
  return {
    BB: { defs: [{ type: "BB", len: "20", name: "BB1" }, CC_DEF],
      entry: [{ la: "CC.close", op: bull ? ">" : "<", b: bull ? "BB1.upper" : "BB1.lower", bType: "ind" }],
      exit: { la: "CC.close", op: bull ? "crosses_below" : "crosses_above", b: "BB1.middle", bType: "ind" }, exitP: 90 },
    KC: { defs: [{ type: "KC", len: "20", name: "KC1" }, CC_DEF],
      entry: [{ la: "CC.close", op: bull ? ">" : "<", b: bull ? "KC1.upper" : "KC1.lower", bType: "ind" }],
      exit: { la: "CC.close", op: bull ? "crosses_below" : "crosses_above", b: "KC1.middle", bType: "ind" }, exitP: 85 },
    Supertrend: { defs: [{ type: "Supertrend", len: "10", mult: "3", name: "ST1" }],
      entry: [{ la: "ST1.dir", op: bull ? ">" : "<", b: "0", bType: "num" }],
      exit: { la: "ST1.dir", op: bull ? "crosses_below" : "crosses_above", b: "0", bType: "num" }, exitP: 70 },
    MACD: { defs: [{ type: "MACD", len: "", name: "MACD1" }],
      entry: [{ la: "MACD1.line", op: bull ? ">" : "crosses_above", b: "MACD1.signal", bType: "ind" }],
      exit: { la: "MACD1.line", op: "crosses_below", b: "MACD1.signal", bType: "ind" }, exitP: 60 },
    EMA: { defs: [{ type: "EMA", len: "9", name: "EMA_f" }, { type: "EMA", len: "21", name: "EMA_s" }],
      entry: [{ la: "EMA_f", op: bull ? ">" : "crosses_above", b: "EMA_s", bType: "ind" }],
      exit: { la: "EMA_f", op: "crosses_below", b: "EMA_s", bType: "ind" }, exitP: 50 },
    VWAP: { defs: [{ type: "VWAP", len: "", name: "VWAP1" }, CC_DEF],
      entry: [{ la: "CC.close", op: bull ? ">" : "<", b: "VWAP1", bType: "ind" }],
      exit: { la: "CC.close", op: bull ? "crosses_below" : "crosses_above", b: "VWAP1", bType: "ind" }, exitP: 40 },
    Stoch: { defs: [{ type: "Stoch", len: "14", name: "STO1" }],
      entry: bull ? [{ la: "STO1.k", op: ">", b: "STO1.d", bType: "ind" }] : [{ la: "STO1.k", op: "<", b: "20", bType: "num" }],
      exit: bull ? { la: "STO1.k", op: "crosses_below", b: "STO1.d", bType: "ind" } : { la: "STO1.k", op: ">", b: "80", bType: "num" }, exitP: 35 },
    RSI: { defs: [{ type: "RSI", len: "14", name: "RSI1" }],
      entry: [{ la: "RSI1", op: bull ? ">" : "<", b: bull ? "60" : "30", bType: "num" }],
      exit: { la: "RSI1", op: bull ? "<" : ">", b: bull ? "45" : "55", bType: "num" }, exitP: 30 },
    ADX: { defs: [{ type: "ADX", len: "14", name: "ADX1" }],   // trend-strength FILTER only — no exit of its own
      entry: [{ la: "ADX1", op: ">", b: "25", bType: "num" }], exit: null, exitP: 0 },
  };
}
const SUGGEST_DETECT = [
  [/bollinger|boll\b|\bbb\b|bbands?/i, "BB"],
  [/keltner|\bkc\b/i, "KC"],
  [/super\s*trend/i, "Supertrend"],
  [/macd/i, "MACD"],
  [/vwap/i, "VWAP"],
  [/stochastic|\bstoch\b/i, "Stoch"],
  [/\badx\b/i, "ADX"],
  [/\brsi\b|relative\s*strength/i, "RSI"],
  [/\bema\b|exponential\s*moving|moving\s*average|\bma\b/i, "EMA"],
];
/* TRADING-STYLE INTENTS — the "training" that lets Neo answer "suggest a scalping / momentum /
   mean-reversion / breakout / trend strategy" even when NO indicator is named. Each style maps to the
   indicator recipe a trader would actually use:
     • Scalping    — quick in/out on a fast EMA cross confirmed by RSI strength (tight SL/TP).
     • Momentum    — ride strength: EMA trend + MACD + ADX (a real trend, not chop).
     • Mean revert — fade extremes: buy the lower Bollinger band while RSI is oversold.
     • Breakout    — buy the upper Bollinger band with MACD confirming.
     • Trend       — EMA trend filtered by ADX strength. */
const SUGGEST_INTENTS = [
  { re: /scalp/i, inds: ["EMA", "RSI"], bias: "momentum" },
  { re: /mean[\s-]*revers|mean[\s-]*revert|reversion|revert|contrarian|fade|oversold\s*bounce/i, inds: ["BB", "RSI"], bias: "reversal" },
  { re: /break\s*out/i, inds: ["BB", "MACD"], bias: "momentum" },
  { re: /momentum|trend[\s-]*follow|trend\s*rider|trending|strong\s*trend/i, inds: ["EMA", "MACD", "ADX"], bias: "momentum" },
  { re: /\btrend\b/i, inds: ["EMA", "ADX"], bias: "momentum" },
];
/* Does this text READ like a request for Neo to design a strategy (vs. a literal rule)? */
export function isSuggestRequest(text) {
  const t = String(text || "");
  const hasVerb = /\b(suggest|recommend|design|build|create|make|give\s+me|come\s+up|ride|combination|combine|want|need)\b/i.test(t);
  return hasVerb && (SUGGEST_DETECT.some(([re]) => re.test(t)) || SUGGEST_INTENTS.some((x) => x.re.test(t)));
}
export function suggestStrategy(text) {
  const t = String(text || "");
  let reversal = /revers|mean[\s-]*revert|mean[\s-]*reversion|bounce|oversold|\bdip\b|pull[\s-]*back|contrarian|fade/i.test(t);
  let picked = [];
  for (const [re, key] of SUGGEST_DETECT) if (re.test(t) && !picked.includes(key)) picked.push(key);
  // No indicator named? Fall back to the trading-style intent recipe (scalping / momentum / …).
  if (!picked.length) {
    const intent = SUGGEST_INTENTS.find((x) => x.re.test(t));
    if (intent) { picked = intent.inds.slice(); if (intent.bias === "reversal") reversal = true; }
  }
  if (!picked.length) return null;
  const bias = reversal ? "reversal" : "momentum";
  const specs = suggestSpecs(bias);
  const defs = [], entry = [], exitCands = [];
  const addDefs = (ds) => ds.forEach((d) => { if (!defs.find((x) => x.name === d.name)) defs.push(d); });
  picked.forEach((key) => {
    const s = specs[key];
    addDefs(s.defs);
    s.entry.forEach((c) => entry.push({ ...c, gate: entry.length ? "AND" : undefined }));
    if (s.exit) exitCands.push({ p: s.exitP, cond: s.exit });
  });
  exitCands.sort((a, b) => b.p - a.p);
  const exit = exitCands.length ? [{ ...exitCands[0].cond, gate: undefined }] : [];
  return { entry, exit, defs, bias, indicators: picked, tf: detectTf(t) || null };
}

/* Human phrase for a single operand, so a condition preview reads like English. */
export function operandLabel(op) {
  // Multi-timeframe EMA/SMA operand ("EMA9_3m") -> "EMA 9 (3m)" so the read-back stays human.
  const mtf = typeof op === "string" && op.match(/^(EMA|SMA)(\d+)_(\w+)$/);
  if (mtf) return `${mtf[1]} ${mtf[2]} (${mtf[3]})`;
  // Sub-attribute operands (BB1.upper, MACD1.signal, CC.close) -> friendly phrases for the read-back.
  if (typeof op === "string" && op.includes(".") && !op.startsWith(PATTERN_OPERAND_PREFIX) && !op.startsWith(CANDLE_OPERAND_PREFIX)) {
    const [nm, attrRaw] = op.split("."); const a = (attrRaw || "").toLowerCase();
    if (/^CC$/i.test(nm) || /^CurrentCandle/i.test(nm)) return "candle " + a;
    if (/^PC$/i.test(nm) || /^PrevCandle/i.test(nm)) return "previous candle " + a;
    if (/^BB/i.test(nm)) return "Bollinger " + (a === "upper" ? "upper band" : a === "lower" ? "lower band" : "middle band");
    if (/^KC/i.test(nm)) return "Keltner " + (a === "upper" ? "upper band" : a === "lower" ? "lower band" : "middle line");
    if (/^MACD/i.test(nm)) return a === "signal" ? "MACD signal" : a === "hist" ? "MACD histogram" : "MACD line";
    if (/^STO/i.test(nm)) return a === "d" ? "Stochastic %D" : "Stochastic %K";
    if (/^ST/i.test(nm)) return "Supertrend " + (a === "dir" ? "direction" : "line");
  }
  if (typeof op === "string" && !op.includes(".")) {
    if (/^RSI/i.test(op)) return "RSI";
    if (/^ADX/i.test(op)) return "ADX";
    if (/^VWAP/i.test(op)) return "VWAP";
    if (op === "EMA_f") return "fast EMA"; if (op === "EMA_s") return "slow EMA";
    const em = op.match(/^(EMA|SMA)(\d+)$/); if (em) return `${em[1]} ${em[2]}`;
  }
  if (typeof op === "string" && op.startsWith(PATTERN_OPERAND_PREFIX)) {
    const key = op.slice(PATTERN_OPERAND_PREFIX.length);
    const ph = Object.keys(PATTERN_KEYS).find((k) => PATTERN_KEYS[k] === key);
    return ph ? ph.replace(/\b\w/g, (m) => m.toUpperCase()) : key;
  }
  if (typeof op === "string" && op.startsWith(CANDLE_OPERAND_PREFIX)) {
    const key = op.slice(CANDLE_OPERAND_PREFIX.length);
    return CANDLE_LABEL[key] || key;
  }
  if (op === "Support") return "support"; if (op === "Resistance") return "resistance";
  if (op === "Price") return "price"; if (op === "Volume") return "volume";
  return op;
}
/* Render a condition as a sentence — pattern conditions read as "a Cup & Handle forms". */
export function humanizeCond(c) {
  if (typeof c.la === "string" && c.la.startsWith(PATTERN_OPERAND_PREFIX)) {
    return `a ${operandLabel(c.la)} forms`;
  }
  if (typeof c.la === "string" && c.la.startsWith(CANDLE_OPERAND_PREFIX)) {
    return `a ${operandLabel(c.la)} candle forms`;
  }
  const opw = { ">": "is above", "<": "is below", ">=": "is at/above", "<=": "is at/below", "==": "equals", crosses_above: "crosses above", crosses_below: "crosses below" }[c.op] || c.op;
  const right = c.bType === "num" ? c.b : operandLabel(c.b);
  return `${operandLabel(c.la)} ${opw} ${right}`;
}

/* Plain-English "how Neo detects this pattern" notes, keyed by canonical pattern key.
   Shown under "Neo reads" so the user sees the actual geometric rule behind a pattern. */
export const PATTERN_EXPLAIN = {
  "double-bottom": "Two swing lows at roughly the same price (within ~2%), separated by a higher peak. Neo confirms it when price closes back above that middle peak — the breakout that completes the W.",
  "double-top": "Two swing highs at about the same price with a valley between. Neo confirms it when price closes below that middle valley — the breakdown that completes the M.",
  "cup-handle": "A rounded U-shaped base (the cup) followed by a small downward drift (the handle). Neo triggers when price breaks above the handle's high.",
  "head-shoulders": "Three peaks — a higher middle 'head' between two lower 'shoulders'. Neo confirms on a close below the neckline joining the two intervening lows.",
  "inv-head-shoulders": "Three troughs — a lower middle 'head' between two higher 'shoulders'. Neo confirms on a close above the neckline joining the two intervening highs.",
  "asc-triangle": "A flat resistance line with rising lows beneath it. Neo triggers on a close above the flat top.",
  "desc-triangle": "A flat support line with falling highs above it. Neo triggers on a close below the flat bottom.",
  "sym-triangle": "Lower highs and higher lows converging to a point. Neo triggers on a close beyond whichever trendline breaks first.",
  "bull-flag": "A sharp rally, then a slight downward-sloping consolidation. Neo triggers on a breakout above the flag's upper edge.",
  "bear-flag": "A sharp drop, then a slight upward-sloping consolidation. Neo triggers on a breakdown below the flag's lower edge.",
  "rising-wedge": "Higher highs and higher lows converging upward — usually bearish. Neo triggers on a close below the lower line.",
  "falling-wedge": "Lower highs and lower lows converging downward — usually bullish. Neo triggers on a close above the upper line.",
  "rectangle": "Price oscillating between a flat support and flat resistance. Neo triggers on a close beyond either edge.",
};
/* Which pattern keys appear in a set of conditions (for showing the explainer). */
export function patternsInConds(conds) {
  const keys = [];
  for (const c of conds || []) {
    if (typeof c.la === "string" && c.la.startsWith(PATTERN_OPERAND_PREFIX)) {
      const k = c.la.slice(PATTERN_OPERAND_PREFIX.length);
      if (!keys.includes(k)) keys.push(k);
    }
  }
  return keys;
}

export function condCode(c) { return `${c.la} ${c.op} ${c.b}`; }
export function chainCode(conds) { return conds.map((c, i) => `${i ? " " + (c.gate || "AND") + " " : ""}${condCode(c)}`).join(""); }

export const TEMPLATES = [
  /* BB breakout with momentum confirmation.
     Entry demands THREE things line up on the same completed candle: a close that has
     just crossed the upper band, RSI above 60, and a positive MACD histogram. The band
     break already implies the candle pushed up through resistance, so the separate
     green-candle check was largely redundant.

     The MACD is confirmed by histogram > 0, which is positive exactly when the MACD line
     is above its signal — so "momentum is positive" is still required, we just don't also
     demand the cross to happen ON the breakout bar (a near-coincidence that suppressed
     most entries).

     Exit is deliberately WIDE (OR): the trend breaking (close under the middle band),
     momentum turning (MACD cross down), or the move going parabolic (RSI > 90). Any
     one of them is enough. Quick to leave, slow to enter. */
  { name: "BB breakout + MACD", tag: "Momentum",
    code: "BB1 = BollingerBand(length=20)\nRSI1 = RSI(length=14)\nMACD1 = MACD()\nCC1 = CurrentCandle()\n\nif CC1.close crosses_above BB1.upper\n   AND RSI1 > 60\n   AND MACD1.hist > 0:\n    enter_trade()\n\nif CC1.close crosses_below BB1.middle\n   OR MACD1.line crosses_below MACD1.signal\n   OR RSI1 > 90:\n    exit_trade()",
    cfg: {
      mode: "builder",
      defs: [
        { type: "BB", len: "20", name: "BB1" },
        { type: "RSI", len: "14", name: "RSI1" },
        { type: "MACD", len: "", name: "MACD1" },
        { type: "CurrentCandle", len: "", name: "CC1" },
      ],
      entry: [
        { la: "CC1.close", op: "crosses_above", bType: "ind", b: "BB1.upper" },
        { gate: "AND", la: "RSI1", op: ">", bType: "num", b: "60" },
        { gate: "AND", la: "MACD1.hist", op: ">", bType: "num", b: "0" },
      ],
      exit: [
        { la: "CC1.close", op: "crosses_below", bType: "ind", b: "BB1.middle" },
        { gate: "OR", la: "MACD1.line", op: "crosses_below", bType: "ind", b: "MACD1.signal" },
        { gate: "OR", la: "RSI1", op: ">", bType: "num", b: "90" },
      ],
    },
  },
  { name: "Golden Cross + RSI", code: "EMA1 = EMA(length=50, tf=1D)\nEMA2 = EMA(length=200, tf=1D)\nif EMA1 > EMA2 AND RSI1 < 70:\n    enter_trade()", tag: "Trend",
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "50", name: "EMA1" }, { type: "EMA", len: "200", name: "EMA2" }, { type: "RSI", len: "14", name: "RSI1" }], entry: [{ la: "EMA1", op: ">", bType: "ind", b: "EMA2" }, { la: "RSI1", op: "<", bType: "num", b: "70", gate: "AND" }], exit: [{ la: "EMA1", op: "crosses_below", bType: "ind", b: "EMA2" }], sl: "3", tp: "8" } },
  { name: "Bollinger squeeze", code: "if Price <= BB1.lower:\n    enter_trade()\nif Price >= BB1.upper:\n    exit_trade()", tag: "Volatility",
    cfg: { mode: "builder", defs: [{ type: "BB", len: "20", name: "BB1" }], entry: [{ la: "Price", op: "<=", bType: "ind", b: "BB1.lower" }], exit: [{ la: "Price", op: ">=", bType: "ind", b: "BB1.upper" }], sl: "4", tp: "6" } },
  { name: "MACD crossover", code: "if MACD1.line crosses_above MACD1.signal:\n    enter_trade()", tag: "Momentum",
    cfg: { mode: "builder", defs: [{ type: "MACD", len: "", name: "MACD1" }], entry: [{ la: "MACD1.line", op: "crosses_above", bType: "ind", b: "MACD1.signal" }], exit: [{ la: "MACD1.line", op: "crosses_below", bType: "ind", b: "MACD1.signal" }], sl: "3", tp: "8" } },
  { name: "CCI reversal", code: "if CCI1 < -100:\n    enter_trade()\nif CCI1 > 100:\n    exit_trade()", tag: "Reversal",
    cfg: { mode: "builder", defs: [{ type: "CCI", len: "20", name: "CCI1" }], entry: [{ la: "CCI1", op: "<", bType: "num", b: "-100" }], exit: [{ la: "CCI1", op: ">", bType: "num", b: "100" }], sl: "3", tp: "7" } },
  { name: "BB breakout + RSI", code: "BB1 = BollingerBand(length=20)\nRSI1 = RSI(length=14)\nif close crosses_above BB1.upper AND RSI1 > 60:\n    enter_trade()\nif close crosses_below BB1.middle:\n    exit_trade()", tag: "Breakout",
    cfg: { mode: "builder", defs: [{ type: "BB", len: "20", name: "BB1" }, { type: "RSI", len: "14", name: "RSI1" }], entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "BB1.upper" }, { la: "RSI1", op: ">", bType: "num", b: "60", gate: "AND" }], exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "BB1.middle" }], sl: "3", tp: "9" } },
  { name: "Multi-timeframe trend (3/5/10/30m)", code: "# Same trend across 3m, 5m, 10m, 30m\nEMA_3 = EMA(20, tf=3m); EMA_5 = EMA(20, tf=5m)\nEMA_10 = EMA(20, tf=10m); EMA_30 = EMA(20, tf=30m)\nif close>EMA_3 AND close>EMA_5 AND close>EMA_10 AND close>EMA_30:\n    enter_trade()\nif close < EMA_5:\n    exit_trade()", tag: "MTF",
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "20", tf: "3m", name: "EMA_3" }, { type: "EMA", len: "20", tf: "5m", name: "EMA_5" }, { type: "EMA", len: "20", tf: "10m", name: "EMA_10" }, { type: "EMA", len: "20", tf: "30m", name: "EMA_30" }], entry: [{ la: "Price", op: ">", bType: "ind", b: "EMA_3" }, { la: "Price", op: ">", bType: "ind", b: "EMA_5", gate: "AND" }, { la: "Price", op: ">", bType: "ind", b: "EMA_10", gate: "AND" }, { la: "Price", op: ">", bType: "ind", b: "EMA_30", gate: "AND" }], exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "EMA_5" }], sl: "2", tp: "6" } },
  { name: "EMA 13 / SMA 83 crossover", code: "EMA13 = EMA(13); SMA83 = SMA(83); SMA39 = SMA(39)\nif EMA13 crosses_above SMA83:\n    enter_trade()\nif EMA13 crosses_below SMA39:\n    exit_trade()", tag: "Trend",
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "13", name: "EMA13" }, { type: "SMA", len: "83", name: "SMA83" }, { type: "SMA", len: "39", name: "SMA39" }], entry: [{ la: "EMA13", op: "crosses_above", bType: "ind", b: "SMA83" }], exit: [{ la: "EMA13", op: "crosses_below", bType: "ind", b: "SMA39" }], sl: "3", tp: "8" } },
  { name: "EMA 9 / SMA 39 crossover", code: "EMA9 = EMA(9); SMA39 = SMA(39); EMA21 = EMA(21)\nif EMA9 crosses_above SMA39:\n    enter_trade()\nif EMA9 crosses_below EMA21:\n    exit_trade()", tag: "Trend",
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "9", name: "EMA9" }, { type: "SMA", len: "39", name: "SMA39" }, { type: "EMA", len: "21", name: "EMA21" }], entry: [{ la: "EMA9", op: "crosses_above", bType: "ind", b: "SMA39" }], exit: [{ la: "EMA9", op: "crosses_below", bType: "ind", b: "EMA21" }], sl: "3", tp: "8" } },
  { name: "ADX trend + Triple EMA + Volume", code: "if ADX1 > 25 AND EMA_f crosses_above EMA_s AND Volume > VMA:\n    enter_trade()\nif EMA_f crosses_below EMA_m:\n    exit_trade()", tag: "Trend",
    cfg: { mode: "builder", defs: [{ type: "ADX", len: "14", name: "ADX1" }, { type: "EMA", len: "8", name: "EMA_f" }, { type: "EMA", len: "21", name: "EMA_m" }, { type: "EMA", len: "55", name: "EMA_s" }, { type: "Volume", len: "", name: "Volume" }, { type: "SMA", len: "20", name: "VMA" }], entry: [{ la: "ADX1", op: ">", bType: "num", b: "25" }, { la: "EMA_f", op: "crosses_above", bType: "ind", b: "EMA_s", gate: "AND" }], exit: [{ la: "EMA_f", op: "crosses_below", bType: "ind", b: "EMA_m" }], sl: "3", tp: "9" } },
  { name: "Keltner + Heikin-Ashi + MACD", code: "if close crosses_above KC1.upper AND MACD1.line > MACD1.signal:\n    enter_trade()\nif close crosses_below KC1.middle:\n    exit_trade()", tag: "Momentum",
    cfg: { mode: "builder", defs: [{ type: "KC", len: "20", name: "KC1" }, { type: "MACD", len: "", name: "MACD1" }, { type: "CurrentCandle", name: "HA" }], entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "KC1.upper" }, { la: "MACD1.line", op: ">", bType: "ind", b: "MACD1.signal", gate: "AND" }], exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "KC1.middle" }], sl: "3", tp: "8" } },
  { name: "RSI + CCI + BB mean-reversion", code: "if RSI1<35 AND CCI1<-100 AND close<=BB1.lower:\n    enter_trade()\nif RSI1>60 OR close>=BB1.middle:\n    exit_trade()", tag: "Reversal",
    cfg: { mode: "builder", defs: [{ type: "RSI", len: "14", name: "RSI1" }, { type: "CCI", len: "20", name: "CCI1" }, { type: "BB", len: "20", name: "BB1" }], entry: [{ la: "RSI1", op: "<", bType: "num", b: "35" }, { la: "CCI1", op: "<", bType: "num", b: "-100", gate: "AND" }, { la: "Price", op: "<=", bType: "ind", b: "BB1.lower", gate: "AND" }], exit: [{ la: "RSI1", op: ">", bType: "num", b: "60" }, { la: "Price", op: ">=", bType: "ind", b: "BB1.middle", gate: "OR" }], sl: "4", tp: "7" } },
];

// Reusable multi-select (chips). Empty value array = "All".

/**
 * Turn a strategy's structured cfg into plain English.
 *
 * The sample-strategy cards used to print the raw DSL ("EMA1 = EMA(length=50)\nif EMA1 >
 * EMA2 AND RSI1 < 70: enter_trade()") — which is precise but reads like code, not an idea.
 * This renders the SAME cfg as sentences, so a starter idea reads the way a person would
 * describe it. It's derived from the executable rules, not a hand-written blurb, so it
 * cannot drift from what the strategy actually does.
 */
function humanIndicator(def) {
  const L = def.len ? ` ${def.len}` : "";
  switch (def.type) {
    case "EMA": return `the ${def.len}-period EMA`;
    case "SMA": return `the ${def.len}-day moving average`;
    case "RSI": return `RSI`;
    case "MACD": return `MACD`;
    case "BB": return `the Bollinger Bands`;
    case "ADX": return `ADX`;
    case "Supertrend": return `Supertrend`;
    case "CCI": return `CCI`;
    case "ATR": return `ATR`;
    case "VWAP": return `VWAP`;
    default: return `${def.type}${L}`;
  }
}

const OP_WORDS = {
  ">": "is above", "<": "is below", ">=": "is at or above", "<=": "is at or below",
  "==": "equals", "crosses_above": "crosses above", "crosses_below": "crosses below",
  crossed_above_within: "crosses above", crossed_below_within: "crosses below",
};

function humanCond(cond, defs) {
  const byName = (n) => defs.find((d) => d.name === n);
  const left = byName(cond.la) ? humanIndicator(byName(cond.la)) : cond.la;
  const op = OP_WORDS[cond.op] || cond.op;
  let right;
  if (cond.bType === "ind" && byName(cond.b)) right = humanIndicator(byName(cond.b));
  else if (cond.bType === "num" || cond.bType === "price") right = cond.b;
  else right = cond.b;
  const gate = cond.gate ? `${cond.gate.toLowerCase()} ` : "";
  return `${gate}${left} ${op} ${right}`;
}

export function humanizeStrategy(cfg) {
  if (!cfg) return null;
  const defs = cfg.defs || [];
  const entry = (cfg.entry || []).map((c) => humanCond(c, defs));
  const exit = (cfg.exit || []).map((c) => humanCond(c, defs));
  const bits = [];
  if (entry.length) bits.push({ k: "Buy when", v: entry.join(" ") });
  if (exit.length) bits.push({ k: "Sell when", v: exit.join(" ") });
  if (cfg.sl) bits.push({ k: "Stop loss", v: `${cfg.sl}%` });
  if (cfg.tp) bits.push({ k: "Target", v: `${cfg.tp}%` });
  return bits;
}
