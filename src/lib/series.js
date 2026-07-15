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

export function MACDarr(a) { const e12 = EMAarr(a, 12), e26 = EMAarr(a, 26); const line = a.map((_, i) => e12[i] - e26[i]); const signal = EMAarr(line, 9); const hist = line.map((v, i) => v - signal[i]); return { line, signal, hist }; }

export function BBarr(a, p) { const mid = SMAarr(a, p); const upper = Array(a.length).fill(NaN), lower = Array(a.length).fill(NaN); for (let i = p - 1; i < a.length; i++) { let s = 0; for (let j = i - p + 1; j <= i; j++) s += (a[j] - mid[i]) ** 2; const sd = Math.sqrt(s / p); upper[i] = mid[i] + 2 * sd; lower[i] = mid[i] - 2 * sd; } return { upper, middle: mid, lower }; }

export function CCIarr(c, p) { const tp = c.map((x) => (x.h + x.l + x.c) / 3); const sma = SMAarr(tp, p); const o = Array(c.length).fill(NaN); for (let i = p - 1; i < c.length; i++) { let md = 0; for (let j = i - p + 1; j <= i; j++) md += Math.abs(tp[j] - sma[i]); md /= p; o[i] = md === 0 ? 0 : (tp[i] - sma[i]) / (0.015 * md); } return o; }

export function ATRarr(c, p) { const tr = c.map((x, i) => i === 0 ? x.h - x.l : Math.max(x.h - x.l, Math.abs(x.h - c[i - 1].c), Math.abs(x.l - c[i - 1].c))); return EMAarr(tr, p); }

export function VWAParr(c) { let pv = 0, vv = 0; return c.map((x) => { const tp = (x.h + x.l + x.c) / 3, v = x.v || 1; pv += tp * v; vv += v; return pv / vv; }); }

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
