/**
 * lib/indicators.js — pure technical-indicator math.
 *
 * Operates on REAL candle arrays: [{ t, o, h, l, c, v }].
 * Series functions return arrays aligned to the input, with leading `null`s
 * where the lookback isn't satisfied yet.
 *
 * These run client-side because chart overlays must work at ANY timeframe,
 * while the backend's /api/indicators only computes daily values.
 */

export function smaSeries(vals, n) {
  const out = new Array(vals.length).fill(null);
  let sum = 0;
  for (let i = 0; i < vals.length; i++) {
    sum += vals[i];
    if (i >= n) sum -= vals[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

export function emaSeries(vals, n) {
  const out = new Array(vals.length).fill(null);
  if (vals.length < n) return out;
  const k = 2 / (n + 1);
  let e = vals.slice(0, n).reduce((a, b) => a + b, 0) / n;
  out[n - 1] = e;
  for (let i = n; i < vals.length; i++) { e = vals[i] * k + e * (1 - k); out[i] = e; }
  return out;
}

export function bollingerSeries(vals, n = 20, mult = 2) {
  const mid = smaSeries(vals, n);
  const up = new Array(vals.length).fill(null);
  const lo = new Array(vals.length).fill(null);
  for (let i = n - 1; i < vals.length; i++) {
    const w = vals.slice(i - n + 1, i + 1);
    const m = mid[i];
    const sd = Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / n);
    up[i] = m + mult * sd;
    lo[i] = m - mult * sd;
  }
  return { mid, up, lo };
}

export function macdSeries(vals, fast = 12, slow = 26, sig = 9) {
  const ef = emaSeries(vals, fast);
  const es = emaSeries(vals, slow);
  const line = vals.map((_, i) => (ef[i] != null && es[i] != null ? ef[i] - es[i] : null));
  const compactLine = line.filter((v) => v != null);
  const sigCompact = emaSeries(compactLine, sig);
  const signal = new Array(vals.length).fill(null);
  let k = 0;
  for (let i = 0; i < vals.length; i++) {
    if (line[i] != null) { signal[i] = sigCompact[k]; k++; }
  }
  const hist = line.map((v, i) => (v != null && signal[i] != null ? v - signal[i] : null));
  return { line, signal, hist };
}

/** Wilder-smoothed RSI (matches the textbook definition). */
export function rsiSeries(vals, n = 14) {
  const out = new Array(vals.length).fill(null);
  if (vals.length < n + 1) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = vals[i] - vals[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  gain /= n; loss /= n;
  out[n] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = n + 1; i < vals.length; i++) {
    const d = vals[i] - vals[i - 1];
    gain = (gain * (n - 1) + (d > 0 ? d : 0)) / n;
    loss = (loss * (n - 1) + (d < 0 ? -d : 0)) / n;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

/** VWAP overlay. Cumulative volume-weighted average of the typical price (h+l+c)/3.
   Aligned to input; skips bars with no volume so it degrades gracefully to a running mean. */
export function vwapSeries(candles) {
  const out = new Array(candles.length).fill(null);
  let pv = 0, vol = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const tp = (c.h + c.l + c.c) / 3;
    const v = c.v > 0 ? c.v : 0;
    pv += tp * (v || 1); vol += (v || 1);
    out[i] = vol ? pv / vol : tp;
  }
  return out;
}

/** Wilder ADX (trend strength, 0–100) with +DI / −DI. Sub-panel indicator. */
export function adxSeries(candles, n = 14) {
  const len = candles.length;
  const adx = new Array(len).fill(null);
  const pdi = new Array(len).fill(null);
  const mdi = new Array(len).fill(null);
  if (len < n + 1) return { adx, pdi, mdi };
  const tr = new Array(len).fill(0), pDM = new Array(len).fill(0), mDM = new Array(len).fill(0);
  for (let i = 1; i < len; i++) {
    const h = candles[i].h, l = candles[i].l, pc = candles[i - 1].c, ph = candles[i - 1].h, pl = candles[i - 1].l;
    tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    const up = h - ph, dn = pl - l;
    pDM[i] = up > dn && up > 0 ? up : 0;
    mDM[i] = dn > up && dn > 0 ? dn : 0;
  }
  let atr = 0, sP = 0, sM = 0;
  for (let i = 1; i <= n; i++) { atr += tr[i]; sP += pDM[i]; sM += mDM[i]; }
  const dxArr = [];
  const calcDx = (i) => {
    const p = atr ? (100 * sP) / atr : 0;
    const m = atr ? (100 * sM) / atr : 0;
    pdi[i] = p; mdi[i] = m;
    const sum = p + m;
    return sum ? (100 * Math.abs(p - m)) / sum : 0;
  };
  dxArr.push(calcDx(n));
  for (let i = n + 1; i < len; i++) {
    atr = atr - atr / n + tr[i];
    sP = sP - sP / n + pDM[i];
    sM = sM - sM / n + mDM[i];
    dxArr.push(calcDx(i));
    if (dxArr.length === n) {
      adx[i] = dxArr.reduce((a, b) => a + b, 0) / n;
    } else if (dxArr.length > n) {
      adx[i] = (adx[i - 1] * (n - 1) + dxArr[dxArr.length - 1]) / n;
    }
  }
  return { adx, pdi, mdi };
}

/** Stochastic oscillator %K (fast) smoothed to %D. Sub-panel indicator, 0–100. */
export function stochSeries(candles, n = 14, d = 3) {
  const len = candles.length;
  const rawK = new Array(len).fill(null);
  for (let i = n - 1; i < len; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = i - n + 1; j <= i; j++) { if (candles[j].h > hh) hh = candles[j].h; if (candles[j].l < ll) ll = candles[j].l; }
    rawK[i] = hh === ll ? 50 : (100 * (candles[i].c - ll)) / (hh - ll);
  }
  const kComp = rawK.filter((v) => v != null);
  const dComp = smaSeries(kComp, d);
  const dOut = new Array(len).fill(null);
  let p = 0;
  for (let i = 0; i < len; i++) { if (rawK[i] != null) { dOut[i] = dComp[p]; p++; } }
  return { k: rawK, d: dOut };
}

/** Heikin-Ashi candles from real OHLC. Each HA candle smooths the trend:
      haClose = (o+h+l+c)/4 ; haOpen = (prevHaOpen + prevHaClose)/2 (seed (o+c)/2)
      haHigh  = max(h, haOpen, haClose) ; haLow = min(l, haOpen, haClose)
   Returned aligned to input so it slices to the visible window exactly like real candles. */
export function heikinAshiSeries(candles) {
  const out = new Array(candles.length);
  let prevO = null, prevC = null;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const haClose = (c.o + c.h + c.l + c.c) / 4;
    const haOpen = prevO == null ? (c.o + c.c) / 2 : (prevO + prevC) / 2;
    const haHigh = Math.max(c.h, haOpen, haClose);
    const haLow = Math.min(c.l, haOpen, haClose);
    out[i] = { t: c.t, o: haOpen, h: haHigh, l: haLow, c: haClose, v: c.v };
    prevO = haOpen; prevC = haClose;
  }
  return out;
}

/** Palette for user-added overlays (each new indicator gets the next distinct colour). */
export const OVERLAY_COLORS = ["#EF4444", "#8B5CF6", "#0EA5E9", "#F59E0B", "#10B981", "#EC4899", "#6366F1", "#F97316", "#14B8A6", "#A855F7"];

/** Chart overlay registry — adding an indicator is one entry, not new chart code. */
export const OVERLAYS = [
  { id: "ema9",   label: "EMA 9",   kind: "ema", n: 9,   color: "#F59E0B" },
  { id: "ema13",  label: "EMA 13",  kind: "ema", n: 13,  color: "#F97316" },
  { id: "ema21",  label: "EMA 21",  kind: "ema", n: 21,  color: "#EF4444" },
  { id: "ema50",  label: "EMA 50",  kind: "ema", n: 50,  color: "#8B5CF6" },
  { id: "ema100", label: "EMA 100", kind: "ema", n: 100, color: "#6366F1" },
  { id: "ema200", label: "EMA 200", kind: "ema", n: 200, color: "#0EA5E9" },
  { id: "sma9",   label: "SMA 9",   kind: "sma", n: 9,   color: "#FBBF24" },
  { id: "sma13",  label: "SMA 13",  kind: "sma", n: 13,  color: "#FB923C" },
  { id: "sma20",  label: "SMA 20",  kind: "sma", n: 20,  color: "#F87171" },
  { id: "sma50",  label: "SMA 50",  kind: "sma", n: 50,  color: "#A78BFA" },
  { id: "sma100", label: "SMA 100", kind: "sma", n: 100, color: "#818CF8" },
  { id: "sma200", label: "SMA 200", kind: "sma", n: 200, color: "#38BDF8" },
  { id: "bb",     label: "Bollinger (20,2)", kind: "bb", n: 20, color: "#94A3B8" },
];

export const CHART_TFS = [["5m", "5m"], ["15m", "15m"], ["30m", "30m"], ["1h", "1h"], ["1d", "1D"]];
