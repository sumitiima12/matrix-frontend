/**
 * lib/series.js — indicator helpers that return a VALUE PER BAR, not a single value.
 *
 * These lived inside pages/Automation.jsx while their main caller, domain/strategyLang.js,
 * lived in domain/ — and strategyLang had no imports at all. In a bundled build a bare
 * `MACDarr(...)` is not a compile error, it is a runtime ReferenceError, so EVERY strategy
 * evaluation threw ("Can't find variable: MACDarr"). That is one bug behind three symptoms:
 * the Automation crash, "Test" not working, and activated strategies never placing a trade.
 *
 * They belong in lib/: pure functions over arrays of candles, no React, no fetch.
 * lib/indicators.js computes the LATEST value; this computes the whole series.
 */

export function SMAarr(a, p) { const o = Array(a.length).fill(NaN); let s = 0; for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= p) s -= a[i - p]; if (i >= p - 1) o[i] = s / p; } return o; }

export function EMAarr(a, p) { const o = Array(a.length).fill(NaN); const k = 2 / (p + 1); let prev = a[0]; o[0] = a[0]; for (let i = 1; i < a.length; i++) { prev = a[i] * k + prev * (1 - k); o[i] = prev; } return o; }

export function RSIarr(a, p) { const o = Array(a.length).fill(NaN); let g = 0, l = 0; for (let i = 1; i < a.length; i++) { const d = a[i] - a[i - 1], up = Math.max(d, 0), dn = Math.max(-d, 0); if (i <= p) { g += up; l += dn; if (i === p) { g /= p; l /= p; o[i] = 100 - 100 / (1 + (l === 0 ? 100 : g / l)); } } else { g = (g * (p - 1) + up) / p; l = (l * (p - 1) + dn) / p; o[i] = 100 - 100 / (1 + (l === 0 ? 100 : g / l)); } } return o; }

export function MACDarr(a, fast = 12, slow = 26, sig = 9) { const ef = EMAarr(a, Number(fast) || 12), es = EMAarr(a, Number(slow) || 26); const line = a.map((_, i) => ef[i] - es[i]); const signal = EMAarr(line, Number(sig) || 9); const hist = line.map((v, i) => v - signal[i]); return { line, signal, hist }; }

export function BBarr(a, p, mult = 2) { const m = Number(mult) || 2; const mid = SMAarr(a, p); const upper = Array(a.length).fill(NaN), lower = Array(a.length).fill(NaN); for (let i = p - 1; i < a.length; i++) { let s = 0; for (let j = i - p + 1; j <= i; j++) s += (a[j] - mid[i]) ** 2; const sd = Math.sqrt(s / p); upper[i] = mid[i] + m * sd; lower[i] = mid[i] - m * sd; } return { upper, middle: mid, lower }; }

/* Rolling average / median of a series over p bars — used by the Volume indicator's avg/median mode. */
export function ROLLavg(a, p) { const o = Array(a.length).fill(NaN); for (let i = 0; i < a.length; i++) { if (i < p - 1) continue; let s = 0; for (let j = i - p + 1; j <= i; j++) s += (a[j] || 0); o[i] = s / p; } return o; }
export function ROLLmedian(a, p) { const o = Array(a.length).fill(NaN); for (let i = 0; i < a.length; i++) { if (i < p - 1) continue; const w = a.slice(i - p + 1, i + 1).map((x) => x || 0).sort((x, y) => x - y); const h = Math.floor(w.length / 2); o[i] = w.length % 2 ? w[h] : (w[h - 1] + w[h]) / 2; } return o; }

export function CCIarr(c, p) { const tp = c.map((x) => (x.h + x.l + x.c) / 3); const sma = SMAarr(tp, p); const o = Array(c.length).fill(NaN); for (let i = p - 1; i < c.length; i++) { let md = 0; for (let j = i - p + 1; j <= i; j++) md += Math.abs(tp[j] - sma[i]); md /= p; o[i] = md === 0 ? 0 : (tp[i] - sma[i]) / (0.015 * md); } return o; }

export function ATRarr(c, p) { const tr = c.map((x, i) => i === 0 ? x.h - x.l : Math.max(x.h - x.l, Math.abs(x.h - c[i - 1].c), Math.abs(x.l - c[i - 1].c))); return EMAarr(tr, p); }

export function VWAParr(c) { let pv = 0, vv = 0; return c.map((x) => { const tp = (x.h + x.l + x.c) / 3, v = x.v || 1; pv += tp * v; vv += v; return pv / vv; }); }
/* Rolling population standard deviation of a value series. */
export function STDDEVarr(a, p) { const out = Array(a.length).fill(NaN); for (let i = p - 1; i < a.length; i++) { let m = 0; for (let j = i - p + 1; j <= i; j++) m += a[j]; m /= p; let s = 0; for (let j = i - p + 1; j <= i; j++) s += (a[j] - m) ** 2; out[i] = Math.sqrt(s / p); } return out; }
/* Central Pivot Range from each bar's PRIOR bar: { pivot, bc, tc }. */
export function CPRarr(c) { const pivot = Array(c.length).fill(NaN), bc = Array(c.length).fill(NaN), tc = Array(c.length).fill(NaN); for (let i = 1; i < c.length; i++) { const p = c[i - 1], pv = (p.h + p.l + p.c) / 3, b = (p.h + p.l) / 2; pivot[i] = pv; bc[i] = b; tc[i] = pv + (pv - b); } return { pivot, bc, tc }; }
/* Standard floor-trader pivots from each bar's PRIOR bar: { p, r1, r2, s1, s2 }. */
export function PIVOTarr(c) { const P = Array(c.length).fill(NaN), r1 = Array(c.length).fill(NaN), r2 = Array(c.length).fill(NaN), s1 = Array(c.length).fill(NaN), s2 = Array(c.length).fill(NaN); for (let i = 1; i < c.length; i++) { const p = c[i - 1], pv = (p.h + p.l + p.c) / 3, rng = p.h - p.l; P[i] = pv; r1[i] = 2 * pv - p.l; s1[i] = 2 * pv - p.h; r2[i] = pv + rng; s2[i] = pv - rng; } return { p: P, r1, r2, s1, s2 }; }
/* Ichimoku lines (no forward displacement): tenkan(9), kijun(26), spanA, spanB(52). */
export function ICHIarr(c, conv = 9, base = 26, spanBp = 52) { const mid = (n, i) => { if (i < n - 1) return NaN; let hh = -Infinity, ll = Infinity; for (let j = i - n + 1; j <= i; j++) { if (c[j].h > hh) hh = c[j].h; if (c[j].l < ll) ll = c[j].l; } return (hh + ll) / 2; }; const tenkan = [], kijun = [], spanA = [], spanB = []; for (let i = 0; i < c.length; i++) { const t = mid(conv, i), k = mid(base, i), b = mid(spanBp, i); tenkan[i] = t; kijun[i] = k; spanB[i] = b; spanA[i] = (isNaN(t) || isNaN(k)) ? NaN : (t + k) / 2; } return { tenkan, kijun, spanA, spanB }; }
/* Fibonacci retracement level (constant) for `ratio` over the swing high/low of the last `look` bars. */
export function FIBarr(c, look = 90, ratio = 0.618) { const seg = c.slice(Math.max(0, c.length - look)); if (!seg.length) return c.map(() => NaN); const hi = Math.max(...seg.map((x) => x.h)), lo = Math.min(...seg.map((x) => x.l)); const lvl = hi - (hi - lo) * ratio; return c.map(() => lvl); }

export function ADXarr(c, p) {
  const n = c.length, pDM = Array(n).fill(0), mDM = Array(n).fill(0), tr = Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const up = c[i].h - c[i - 1].h, dn = c[i - 1].l - c[i].l;
    pDM[i] = up > dn && up > 0 ? up : 0; mDM[i] = dn > up && dn > 0 ? dn : 0;
    tr[i] = Math.max(c[i].h - c[i].l, Math.abs(c[i].h - c[i - 1].c), Math.abs(c[i].l - c[i - 1].c));
  }
  const atr = EMAarr(tr, p), pdi = EMAarr(pDM, p).map((v, i) => 100 * v / (atr[i] || 1)), mdi = EMAarr(mDM, p).map((v, i) => 100 * v / (atr[i] || 1));
  const dx = pdi.map((v, i) => { const s = v + mdi[i]; return s ? 100 * Math.abs(v - mdi[i]) / s : 0; });
  return EMAarr(dx, p);
}

/* DMI — the +DI / -DI lines plus ADX from the same Wilder machinery. Returns { plus, minus, adx }
   so a rule can trade the +DI/-DI cross (trend direction) or gate on ADX (trend strength). */
export function DMIarr(c, p) {
  const n = c.length, pDM = Array(n).fill(0), mDM = Array(n).fill(0), tr = Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const up = c[i].h - c[i - 1].h, dn = c[i - 1].l - c[i].l;
    pDM[i] = up > dn && up > 0 ? up : 0; mDM[i] = dn > up && dn > 0 ? dn : 0;
    tr[i] = Math.max(c[i].h - c[i].l, Math.abs(c[i].h - c[i - 1].c), Math.abs(c[i].l - c[i - 1].c));
  }
  const atr = EMAarr(tr, p);
  const plus = EMAarr(pDM, p).map((v, i) => 100 * v / (atr[i] || 1));
  const minus = EMAarr(mDM, p).map((v, i) => 100 * v / (atr[i] || 1));
  const dx = plus.map((v, i) => { const s = v + minus[i]; return s ? 100 * Math.abs(v - minus[i]) / s : 0; });
  return { plus, minus, adx: EMAarr(dx, p) };
}

/* Stochastic oscillator. %K = smoothed position of close within the kLen high-low range;
   %D = SMA of %K. Returns { k, d } in 0..100 (oversold < 20, overbought > 80). */
export function STOCHarr(c, kLen = 14, kSmooth = 3, dSmooth = 3) {
  const n = c.length, raw = Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (i < kLen - 1) continue;
    let hi = -Infinity, lo = Infinity;
    for (let j = i - kLen + 1; j <= i; j++) { if (c[j].h > hi) hi = c[j].h; if (c[j].l < lo) lo = c[j].l; }
    raw[i] = hi === lo ? 50 : 100 * (c[i].c - lo) / (hi - lo);
  }
  const k = SMAarr(raw.map((v) => (isNaN(v) ? 0 : v)), kSmooth).map((v, i) => (raw[i] == null || isNaN(raw[i]) ? NaN : v));
  const d = SMAarr(k.map((v) => (isNaN(v) ? 0 : v)), dSmooth).map((v, i) => (isNaN(k[i]) ? NaN : v));
  return { k, d };
}

/**
 * Supertrend — the classic ATR trailing-stop trend line.
 *
 * Returns a value per bar for the trend line plus a direction (+1 up / -1 down).
 * When the direction flips, price has crossed the line: a close crossing ABOVE the
 * line is a bullish flip, a close crossing BELOW it is bearish. `p` is the ATR
 * period, `mult` the ATR multiplier (band width).
 */
export function STarr(c, p = 10, mult = 3) {
  const n = c.length;
  const atr = ATRarr(c, p);
  const line = Array(n).fill(NaN);
  const dir = Array(n).fill(1);
  let prevFUpper = NaN, prevFLower = NaN, prevLine = NaN, trend = 1;
  for (let i = 0; i < n; i++) {
    const a = atr[i];
    if (isNaN(a)) { line[i] = NaN; dir[i] = 1; continue; }
    const hl2 = (c[i].h + c[i].l) / 2;
    const bUpper = hl2 + mult * a;
    const bLower = hl2 - mult * a;
    const cPrev = i > 0 ? c[i - 1].c : c[i].c;
    const fUpper = (isNaN(prevFUpper) || bUpper < prevFUpper || cPrev > prevFUpper) ? bUpper : prevFUpper;
    const fLower = (isNaN(prevFLower) || bLower > prevFLower || cPrev < prevFLower) ? bLower : prevFLower;
    if (isNaN(prevLine)) trend = 1;
    else if (prevLine === prevFUpper) trend = c[i].c > fUpper ? 1 : -1;
    else trend = c[i].c < fLower ? -1 : 1;
    line[i] = trend === 1 ? fLower : fUpper;
    dir[i] = trend;
    prevFUpper = fUpper; prevFLower = fLower; prevLine = line[i];
  }
  return { line, dir };
}

export const CF = { open: "o", high: "h", low: "l", close: "c" };

/**
 * Drop the candle that is still forming.
 *
 * During market hours the last bar in a series is the CURRENT one: its close is the
 * live price and it changes every tick. Evaluating a rule on it means a signal can
 * fire and then un-fire seconds later — "close crossed above the upper band" is true
 * at 10:31:05 and false at 10:31:40, and an automation acting on that will buy into a
 * cross that never actually happened. A completed candle is a fact; a forming one is
 * a rumour.
 *
 * We detect it from the data rather than from a clock: take the spacing between the
 * last two bars as the interval, and if `now` is inside the final bar's window, that
 * bar hasn't closed yet.
 *
 * @returns the candles up to and including the last CLOSED bar
 */
export function closedCandles(c, now = Date.now()) {
  if (!c || c.length < 3) return c || [];
  const last = c[c.length - 1];
  const prev = c[c.length - 2];
  if (last.t == null || prev.t == null) return c;      // no timestamps -> can't tell, don't guess

  const interval = last.t - prev.t;
  if (!(interval > 0)) return c;

  // The final bar closes at t + interval. Before that, it is still being written.
  return now < last.t + interval ? c.slice(0, -1) : c;
}
